import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { resolveBranchScope } from '../common/branch-scope.util';
import { getTenantGymId } from '../common/tenant-context';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import {
  capabilitiesFor,
  resolveRoleView,
  type RoleCapabilities,
} from './role-view.util';

/**
 * One KPI cell — value + delta vs. previous period + 14-point sparkline.
 * `sparkline` is always 14-long when present; `[]` means we don't synthesize
 * the series cheaply yet (render the card without one — never fake data).
 * `delta_label` describes the comparison window (e.g. "vs yesterday").
 */
export interface PulseKpi {
  value: number;
  delta_pct: number | null;
  delta_abs: number | null;
  delta_label: string;
  sparkline: number[];
  as_of: string;
}

export interface PulseKpis {
  active_members: PulseKpi;
  today_revenue: PulseKpi;
  mrr: PulseKpi;
  check_ins_today: PulseKpi;
  renewals_at_risk_7d: PulseKpi & { value_at_stake: number };
  outstanding_dues: PulseKpi & {
    invoice_count: number;
    oldest_age_days: number;
  };
  generated_at: string;
  /** Role view this payload was computed for. */
  view: RoleCapabilities['view'];
  /** Field-level capabilities surfaced so the frontend can render variants. */
  capabilities: RoleCapabilities;
}

interface CacheEntry {
  data: PulseKpis;
  expiresAt: number;
}

type BranchFilter = { branch_id?: string | { in: string[] } };

@Injectable()
export class DashboardPulseService {
  private readonly logger = new Logger(DashboardPulseService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private static readonly TTL_SECONDS = 30;
  private static readonly MAX_CACHE_SIZE = 200;

  constructor(private readonly tenant: TenantPrisma) {}

  async getPulse(user?: JwtPayload, branchId?: string): Promise<PulseKpis> {
    const view = resolveRoleView(user);
    const caps = capabilitiesFor(view);
    const key = `pulse:${user?.studio_id ?? 'global'}:${view}:${branchId ?? JSON.stringify(user?.branch_ids ?? [])}`;
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data;

    const data = await this.computePulse(user, branchId, caps);

    if (this.cache.size >= DashboardPulseService.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + DashboardPulseService.TTL_SECONDS * 1000,
    });
    return data;
  }

  invalidate(studioId?: string) {
    if (!studioId) {
      this.cache.clear();
      return;
    }
    for (const k of this.cache.keys()) {
      if (k.includes(studioId)) this.cache.delete(k);
    }
  }

  // ── Filter / SQL helpers ─────────────────────────────────────────

  private getBranchFilter(
    user?: JwtPayload,
    explicitBranchId?: string,
  ): BranchFilter {
    return resolveBranchScope(user, explicitBranchId).branchFilter as BranchFilter;
  }

  /** Returns ` AND branch_id = ...` clause + the matching params slot. */
  private buildBranchSql(
    branchFilter: BranchFilter,
    paramOffset: number,
  ): { clause: string; params: unknown[] } {
    if (!branchFilter.branch_id) return { clause: '', params: [] };
    if (
      typeof branchFilter.branch_id === 'object' &&
      'in' in branchFilter.branch_id
    ) {
      return {
        clause: ` AND branch_id = ANY($${paramOffset}::uuid[])`,
        params: [branchFilter.branch_id.in],
      };
    }
    return {
      clause: ` AND branch_id = $${paramOffset}::uuid`,
      params: [branchFilter.branch_id],
    };
  }

  // ── Pulse compute (resilient — partial failure ≠ 500) ────────────

  private async computePulse(
    user?: JwtPayload,
    branchId?: string,
    caps: RoleCapabilities = capabilitiesFor('owner'),
  ): Promise<PulseKpis> {
    const branchFilter = this.getBranchFilter(user, branchId);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const fourteenDaysAgo = new Date(startOfToday);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const settled = await Promise.allSettled([
      this.countActiveMembers(branchFilter, now),
      this.countActiveMembers(branchFilter, thirtyDaysAgo),
      this.activeMembersSparkline(branchFilter, fourteenDaysAgo),
      this.sumRevenueBetween(branchFilter, startOfToday, now),
      this.sumRevenueBetween(branchFilter, startOfYesterday, startOfToday),
      this.dailyRevenueSparkline(branchFilter, fourteenDaysAgo),
      this.computeMrr(branchFilter, now),
      this.computeMrr(branchFilter, thirtyDaysAgo),
      this.countCheckInsBetween(branchFilter, startOfToday, now),
      this.countCheckInsBetween(branchFilter, startOfYesterday, startOfToday),
      this.dailyCheckInsSparkline(branchFilter, fourteenDaysAgo),
      this.renewalsAtRisk(branchFilter, now, sevenDaysFromNow),
      this.outstandingDues(branchFilter, now),
    ]);

    const [
      activeMembersNow,
      activeMembers30dAgo,
      activeMembersSpark,
      revenueToday,
      revenueYesterday,
      revenueSpark,
      mrrNow,
      mrr30dAgo,
      checkInsToday,
      checkInsYesterday,
      checkInsSpark,
      renewals,
      dues,
    ] = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      this.logger.warn(`Pulse subquery #${i} failed: ${r.reason?.message ?? r.reason}`);
      return undefined;
    }) as [
      number | undefined,
      number | undefined,
      number[] | undefined,
      number | undefined,
      number | undefined,
      number[] | undefined,
      number | undefined,
      number | undefined,
      number | undefined,
      number | undefined,
      number[] | undefined,
      { count: number; amount: number } | undefined,
      { amount: number; count: number; oldestAgeDays: number } | undefined,
    ];

    const asOf = now.toISOString();

    const payload: PulseKpis = {
      active_members: this.kpi(
        activeMembersNow ?? 0,
        activeMembers30dAgo,
        activeMembersSpark ?? [],
        asOf,
        'vs 30 days ago',
      ),
      today_revenue: this.kpi(
        revenueToday ?? 0,
        revenueYesterday,
        revenueSpark ?? [],
        asOf,
        'vs yesterday',
      ),
      mrr: this.kpi(
        mrrNow ?? 0,
        mrr30dAgo,
        [],
        asOf,
        'vs 30 days ago',
      ),
      check_ins_today: this.kpi(
        checkInsToday ?? 0,
        checkInsYesterday,
        checkInsSpark ?? [],
        asOf,
        'vs yesterday',
      ),
      renewals_at_risk_7d: {
        ...this.kpi(renewals?.count ?? 0, undefined, [], asOf, 'next 7 days'),
        value_at_stake: renewals?.amount ?? 0,
      },
      outstanding_dues: {
        ...this.kpi(dues?.amount ?? 0, undefined, [], asOf, 'pending invoices'),
        invoice_count: dues?.count ?? 0,
        oldest_age_days: dues?.oldestAgeDays ?? 0,
      },
      generated_at: asOf,
      view: caps.view,
      capabilities: caps,
    };

    return this.applyRoleFilter(payload, caps, asOf);
  }

  /**
   * Server-side enforcement of the §3.6 visibility matrix. Strips fields a
   * given role must not see — even if they crafted a URL or hit the endpoint
   * directly. The frontend trusts these strips; do not duplicate the logic
   * client-side without consulting `capabilities`.
   */
  private applyRoleFilter(
    payload: PulseKpis,
    caps: RoleCapabilities,
    asOf: string,
  ): PulseKpis {
    const blank = (label: string): PulseKpi => ({
      value: 0,
      delta_pct: null,
      delta_abs: null,
      delta_label: label,
      sparkline: [],
      as_of: asOf,
    });

    if (!caps.see_financials) {
      payload.today_revenue = blank('vs yesterday');
      payload.mrr = blank('vs 30 days ago');
      payload.outstanding_dues = {
        ...blank('pending invoices'),
        invoice_count: 0,
        oldest_age_days: 0,
      };
    }
    if (!caps.see_churn_signals) {
      payload.renewals_at_risk_7d = {
        ...blank('next 7 days'),
        value_at_stake: 0,
      };
    }
    return payload;
  }

  private kpi(
    value: number,
    previous: number | undefined,
    sparkline: number[],
    asOf: string,
    label: string,
  ): PulseKpi {
    if (previous === undefined || previous === null) {
      return {
        value,
        delta_pct: null,
        delta_abs: null,
        delta_label: label,
        sparkline,
        as_of: asOf,
      };
    }
    const deltaAbs = value - previous;
    const deltaPct = previous > 0 ? round1((deltaAbs / previous) * 100) : null;
    return {
      value,
      delta_abs: deltaAbs,
      delta_pct: deltaPct,
      delta_label: label,
      sparkline,
      as_of: asOf,
    };
  }

  // ── Atomic queries ───────────────────────────────────────────────

  private async countActiveMembers(
    branchFilter: BranchFilter,
    asOf: Date,
  ): Promise<number> {
    return this.tenant.client.member.count({
      where: {
        status: 'active',
        created_at: { lte: asOf },
        ...branchFilter,
      },
    });
  }

  private async sumRevenueBetween(
    branchFilter: BranchFilter,
    from: Date,
    to: Date,
  ): Promise<number> {
    const result = await this.tenant.client.payment.aggregate({
      where: {
        status: 'paid',
        paid_at: { gte: from, lt: to },
        ...branchFilter,
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount || 0);
  }

  private async countCheckInsBetween(
    branchFilter: BranchFilter,
    from: Date,
    to: Date,
  ): Promise<number> {
    return this.tenant.client.checkIn.count({
      where: {
        status: 'success',
        checked_in_at: { gte: from, lt: to },
        ...branchFilter,
      },
    });
  }

  /**
   * MRR proxy — single raw SQL join over memberships + plans.
   * Normalizes any plan duration into a monthly figure: price / duration_days * 30.
   */
  private async computeMrr(
    branchFilter: BranchFilter,
    asOf: Date,
  ): Promise<number> {
    const gymId = getTenantGymId();
    if (!gymId) return 0;
    // Raw SQL bypasses Prisma's $use middleware (no gym_id auto-injection,
    // no set_config). The explicit `mm.gym_id = $2` filter is the load-
    // bearing tenant scope here; never rely on RLS alone.
    const branchSql = this.buildBranchSql(branchFilter, 3);
    const sql = `
      SELECT COALESCE(SUM(
        CASE WHEN COALESCE(p.duration_days, 30) > 0
             THEN p.price / COALESCE(p.duration_days, 30) * 30
             ELSE 0 END
      ), 0)::float AS mrr
      FROM member_memberships mm
      JOIN membership_plans p ON p.id = mm.plan_id
      WHERE mm.status = 'active'
        AND mm.gym_id = $2::uuid
        AND mm.start_date <= $1
        AND mm.end_date >= $1
        ${branchSql.clause.replace('branch_id', 'mm.branch_id')}
    `;
    try {
      const rows = await this.tenant.client.$queryRawUnsafe<{ mrr: number }[]>(
        sql,
        asOf,
        gymId,
        ...branchSql.params,
      );
      return Math.round(Number(rows[0]?.mrr ?? 0));
    } catch (err) {
      this.logger.warn(
        `MRR query failed, falling back to ORM: ${(err as Error)?.message ?? err}`,
      );
      return this.computeMrrOrm(branchFilter, asOf);
    }
  }

  private async computeMrrOrm(
    branchFilter: BranchFilter,
    asOf: Date,
  ): Promise<number> {
    const memberships = await this.tenant.client.memberMembership.findMany({
      where: {
        status: 'active',
        start_date: { lte: asOf },
        end_date: { gte: asOf },
        ...branchFilter,
      },
      select: { plan: { select: { price: true, duration_days: true } } },
    });
    let mrr = 0;
    for (const m of memberships) {
      const price = Number(m.plan?.price ?? 0);
      if (price <= 0) continue;
      const days = m.plan?.duration_days ?? 30;
      mrr += (price / Math.max(1, days)) * 30;
    }
    return Math.round(mrr);
  }

  private async renewalsAtRisk(
    branchFilter: BranchFilter,
    now: Date,
    horizon: Date,
  ): Promise<{ count: number; amount: number }> {
    const gymId = getTenantGymId();
    if (!gymId) return { count: 0, amount: 0 };
    const branchSql = this.buildBranchSql(branchFilter, 4);
    const sql = `
      SELECT COUNT(*)::int AS count,
             COALESCE(SUM(p.price), 0)::float AS amount
      FROM member_memberships mm
      JOIN membership_plans p ON p.id = mm.plan_id
      WHERE mm.status = 'active'
        AND mm.gym_id = $3::uuid
        AND mm.end_date >= $1
        AND mm.end_date <= $2
        ${branchSql.clause.replace('branch_id', 'mm.branch_id')}
    `;
    try {
      const rows = await this.tenant.client.$queryRawUnsafe<
        { count: number; amount: number }[]
      >(sql, now, horizon, gymId, ...branchSql.params);
      const r = rows[0];
      return {
        count: Number(r?.count ?? 0),
        amount: Number(r?.amount ?? 0),
      };
    } catch (err) {
      this.logger.warn(
        `renewalsAtRisk query failed: ${(err as Error)?.message ?? err}`,
      );
      return { count: 0, amount: 0 };
    }
  }

  private async outstandingDues(
    branchFilter: BranchFilter,
    now: Date,
  ): Promise<{ amount: number; count: number; oldestAgeDays: number }> {
    const gymId = getTenantGymId();
    if (!gymId) return { amount: 0, count: 0, oldestAgeDays: 0 };
    const branchSql = this.buildBranchSql(branchFilter, 2);
    const sql = `
      SELECT COUNT(*)::int AS count,
             COALESCE(SUM(total_amount), 0)::float AS amount,
             MIN(COALESCE(due_date, issued_at)) AS oldest_anchor
      FROM member_invoices
      WHERE status IN ('pending', 'partial')
        AND gym_id = $1::uuid
      ${branchSql.clause}
    `;
    try {
      const rows = await this.tenant.client.$queryRawUnsafe<
        { count: number; amount: number; oldest_anchor: Date | null }[]
      >(sql, gymId, ...branchSql.params);
      const r = rows[0];
      const oldestAgeDays = r?.oldest_anchor
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(r.oldest_anchor).getTime()) / 86400000,
            ),
          )
        : 0;
      return {
        amount: Math.round(Number(r?.amount ?? 0)),
        count: Number(r?.count ?? 0),
        oldestAgeDays,
      };
    } catch (err) {
      this.logger.warn(
        `outstandingDues query failed: ${(err as Error)?.message ?? err}`,
      );
      return { amount: 0, count: 0, oldestAgeDays: 0 };
    }
  }

  // ── Sparklines (raw SQL grouped by day) ──────────────────────────

  private async dailyRevenueSparkline(
    branchFilter: BranchFilter,
    fromDay: Date,
  ): Promise<number[]> {
    const gymId = getTenantGymId();
    if (!gymId) return [];
    const branchSql = this.buildBranchSql(branchFilter, 3);
    const sql = `
      SELECT DATE_TRUNC('day', paid_at) AS day, COALESCE(SUM(amount), 0)::float AS value
      FROM payments
      WHERE status = 'paid' AND gym_id = $2::uuid AND paid_at >= $1
      ${branchSql.clause}
      GROUP BY DATE_TRUNC('day', paid_at)
      ORDER BY day
    `;
    return this.runSparklineSql(sql, fromDay, [gymId, ...branchSql.params]);
  }

  private async dailyCheckInsSparkline(
    branchFilter: BranchFilter,
    fromDay: Date,
  ): Promise<number[]> {
    const gymId = getTenantGymId();
    if (!gymId) return [];
    const branchSql = this.buildBranchSql(branchFilter, 3);
    const sql = `
      SELECT DATE_TRUNC('day', checked_in_at) AS day, COUNT(*)::float AS value
      FROM check_ins
      WHERE status = 'success' AND gym_id = $2::uuid AND checked_in_at >= $1
      ${branchSql.clause}
      GROUP BY DATE_TRUNC('day', checked_in_at)
      ORDER BY day
    `;
    return this.runSparklineSql(sql, fromDay, [gymId, ...branchSql.params]);
  }

  /**
   * Active-member count per day for 14 days. We approximate "active at end
   * of day D" as members.created_at <= D AND status='active' (we don't have
   * a churned_at signal in schema, so this trends monotonically — that's
   * acceptable for a pulse-card sparkline).
   */
  private async activeMembersSparkline(
    branchFilter: BranchFilter,
    fromDay: Date,
  ): Promise<number[]> {
    const gymId = getTenantGymId();
    if (!gymId) return [];
    const branchSql = this.buildBranchSql(branchFilter, 3);
    const sql = `
      WITH days AS (
        SELECT generate_series($1::date, $1::date + INTERVAL '13 days', INTERVAL '1 day') AS day
      )
      SELECT d.day,
             (
               SELECT COUNT(*)::float
               FROM members m
               WHERE m.status = 'active'
                 AND m.gym_id = $2::uuid
                 AND m.created_at <= d.day + INTERVAL '1 day'
                 ${branchSql.clause.replace('branch_id', 'm.branch_id')}
             ) AS value
      FROM days d
      ORDER BY d.day
    `;
    return this.runSparklineSql(sql, fromDay, [gymId, ...branchSql.params]);
  }

  private async runSparklineSql(
    sql: string,
    fromDay: Date,
    extraParams: unknown[],
  ): Promise<number[]> {
    try {
      const rows = await this.tenant.client.$queryRawUnsafe<
        { day: Date; value: number }[]
      >(sql, fromDay, ...extraParams);
      const map = new Map<string, number>();
      for (const r of rows) {
        const key = new Date(r.day).toISOString().slice(0, 10);
        map.set(key, Number(r.value) || 0);
      }
      const out: number[] = [];
      const cursor = new Date(fromDay);
      cursor.setHours(0, 0, 0, 0);
      for (let i = 0; i < 14; i++) {
        const key = cursor.toISOString().slice(0, 10);
        out.push(map.get(key) ?? 0);
        cursor.setDate(cursor.getDate() + 1);
      }
      return out;
    } catch (err) {
      this.logger.warn(
        `Sparkline query failed: ${(err as Error)?.message ?? err}`,
      );
      return [];
    }
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
