import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveBranchScope } from '../common/branch-scope.util';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

export interface BranchScorecard {
  branch_id: string;
  branch_name: string;
  active_members: number;
  today_revenue: number;
  mrr: number;
  check_ins_today: number;
  check_ins_7d: number;
  outstanding_dues: number;
  renewals_at_risk_7d: number;
  /** Revenue ÷ active_members (₹ per member, this month). null when no members. */
  revenue_per_member: number | null;
  /** Check-ins ÷ active_members for the last 7 days (engagement proxy). */
  check_ins_per_member_7d: number | null;
  /** Week-over-week revenue change (%) — null when prior period was 0. */
  revenue_wow_pct: number | null;
  /** Week-over-week check-in change (%) — null when prior period was 0. */
  check_ins_wow_pct: number | null;
  /** 14-day daily revenue series. */
  revenue_sparkline_14d: number[];
  /** 14-day daily check-in series. */
  check_ins_sparkline_14d: number[];
  /** Outlier flags: human-readable reasons this branch deviates from its peers. */
  outliers: string[];
}

export interface PortfolioRollup {
  branch_count: number;
  total_active_members: number;
  total_today_revenue: number;
  total_mrr: number;
  total_check_ins_today: number;
  total_outstanding_dues: number;
  total_renewals_at_risk_7d: number;
  /** Mean WoW revenue change across branches (excluding nulls). */
  mean_revenue_wow_pct: number | null;
  /** Auto-engage map view when branches > this threshold (per plan §8.2). */
  use_map_view: boolean;
}

export interface PortfolioPayload {
  branches: BranchScorecard[];
  rollup: PortfolioRollup;
  generated_at: string;
}

interface CacheEntry {
  data: PortfolioPayload;
  expiresAt: number;
}

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private static readonly TTL_SECONDS = 60;
  private static readonly MAP_VIEW_THRESHOLD = 8;

  constructor(private readonly prisma: PrismaService) {}

  async getPortfolio(user?: JwtPayload): Promise<PortfolioPayload> {
    const studioId = user?.studio_id ?? 'global';
    const allowed = resolveBranchScope(user).branchFilter as {
      branch_id?: string | { in: string[] };
    };

    const key = `portfolio:${studioId}:${JSON.stringify(allowed)}`;
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data;

    const data = await this.compute(allowed);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + PortfolioService.TTL_SECONDS * 1000,
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

  // ────────────────────────────────────────────────────────────────

  private async compute(allowed: {
    branch_id?: string | { in: string[] };
  }): Promise<PortfolioPayload> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfPriorWeek = new Date(startOfWeek);
    startOfPriorWeek.setDate(startOfPriorWeek.getDate() - 7);
    const fourteenDaysAgo = new Date(startOfToday);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

    const branchWhere: any = { is_active: true };
    if (allowed.branch_id) {
      if (typeof allowed.branch_id === 'string') {
        branchWhere.id = allowed.branch_id;
      } else if ('in' in allowed.branch_id) {
        branchWhere.id = { in: allowed.branch_id.in };
      }
    }

    const branches = await this.prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (branches.length === 0) {
      return {
        branches: [],
        rollup: this.emptyRollup(),
        generated_at: now.toISOString(),
      };
    }

    const ids = branches.map((b) => b.id);

    // Run all aggregates in parallel — each is a single grouped/aggregated
    // query, not N branches × Y queries.
    const [
      memberByBranch,
      todayRevenueByBranch,
      mrrByBranch,
      checkInsToday,
      checkInsWeek,
      checkInsPriorWeek,
      revenueWeek,
      revenuePriorWeek,
      duesByBranch,
      renewalsAtRiskByBranch,
      revenueSparkRaw,
      checkInsSparkRaw,
    ] = await Promise.all([
      this.prisma.member.groupBy({
        by: ['branch_id'],
        where: { status: 'active', branch_id: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ['branch_id'],
        where: {
          status: 'paid',
          paid_at: { gte: startOfToday, lt: now },
          branch_id: { in: ids },
        },
        _sum: { amount: true },
      }),
      this.mrrByBranch(ids, now),
      this.prisma.checkIn.groupBy({
        by: ['branch_id'],
        where: {
          status: 'success',
          checked_in_at: { gte: startOfToday, lt: now },
          branch_id: { in: ids },
        },
        _count: { _all: true },
      }),
      this.prisma.checkIn.groupBy({
        by: ['branch_id'],
        where: {
          status: 'success',
          checked_in_at: { gte: startOfWeek, lt: now },
          branch_id: { in: ids },
        },
        _count: { _all: true },
      }),
      this.prisma.checkIn.groupBy({
        by: ['branch_id'],
        where: {
          status: 'success',
          checked_in_at: { gte: startOfPriorWeek, lt: startOfWeek },
          branch_id: { in: ids },
        },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ['branch_id'],
        where: {
          status: 'paid',
          paid_at: { gte: startOfWeek, lt: now },
          branch_id: { in: ids },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['branch_id'],
        where: {
          status: 'paid',
          paid_at: { gte: startOfPriorWeek, lt: startOfWeek },
          branch_id: { in: ids },
        },
        _sum: { amount: true },
      }),
      this.prisma.memberInvoice.groupBy({
        by: ['branch_id'],
        where: {
          status: { in: ['pending', 'partial'] },
          branch_id: { in: ids },
        },
        _sum: { total_amount: true },
      }),
      this.prisma.memberMembership.groupBy({
        by: ['branch_id'],
        where: {
          status: 'active',
          end_date: { gte: now, lte: sevenDaysFromNow },
          branch_id: { in: ids },
        },
        _count: { _all: true },
      }),
      this.dailySparkByBranch(
        'payments',
        'paid_at',
        'amount',
        true,
        ids,
        fourteenDaysAgo,
      ),
      this.dailySparkByBranch(
        'check_ins',
        'checked_in_at',
        null,
        false,
        ids,
        fourteenDaysAgo,
      ),
    ]);

    const memberMap = mapBy(memberByBranch, 'branch_id', (r) => r._count._all);
    const todayRevMap = mapBy(todayRevenueByBranch, 'branch_id', (r) =>
      Number(r._sum.amount || 0),
    );
    const mrrMap = new Map(mrrByBranch);
    const checkInTodayMap = mapBy(checkInsToday, 'branch_id', (r) => r._count._all);
    const checkInWeekMap = mapBy(checkInsWeek, 'branch_id', (r) => r._count._all);
    const checkInPriorMap = mapBy(checkInsPriorWeek, 'branch_id', (r) => r._count._all);
    const revWeekMap = mapBy(revenueWeek, 'branch_id', (r) =>
      Number(r._sum.amount || 0),
    );
    const revPriorMap = mapBy(revenuePriorWeek, 'branch_id', (r) =>
      Number(r._sum.amount || 0),
    );
    const duesMap = mapBy(duesByBranch, 'branch_id', (r) =>
      Number(r._sum.total_amount || 0),
    );
    const renewalsMap = mapBy(renewalsAtRiskByBranch, 'branch_id', (r) => r._count._all);
    const revSparkMap = revenueSparkRaw;
    const checkSparkMap = checkInsSparkRaw;

    // First pass: compute scorecards (no outlier flags yet).
    const scorecards: BranchScorecard[] = branches.map((b) => {
      const active = memberMap.get(b.id) ?? 0;
      const todayRev = todayRevMap.get(b.id) ?? 0;
      const mrr = mrrMap.get(b.id) ?? 0;
      const checksToday = checkInTodayMap.get(b.id) ?? 0;
      const checksWeek = checkInWeekMap.get(b.id) ?? 0;
      const checksPrior = checkInPriorMap.get(b.id) ?? 0;
      const revWeek = revWeekMap.get(b.id) ?? 0;
      const revPrior = revPriorMap.get(b.id) ?? 0;
      return {
        branch_id: b.id,
        branch_name: b.name,
        active_members: active,
        today_revenue: todayRev,
        mrr,
        check_ins_today: checksToday,
        check_ins_7d: checksWeek,
        outstanding_dues: duesMap.get(b.id) ?? 0,
        renewals_at_risk_7d: renewalsMap.get(b.id) ?? 0,
        revenue_per_member: active > 0 ? Math.round(revWeek / active) : null,
        check_ins_per_member_7d:
          active > 0 ? Math.round((checksWeek / active) * 10) / 10 : null,
        revenue_wow_pct:
          revPrior > 0 ? round1(((revWeek - revPrior) / revPrior) * 100) : null,
        check_ins_wow_pct:
          checksPrior > 0
            ? round1(((checksWeek - checksPrior) / checksPrior) * 100)
            : null,
        revenue_sparkline_14d: revSparkMap.get(b.id) ?? [],
        check_ins_sparkline_14d: checkSparkMap.get(b.id) ?? [],
        outliers: [],
      };
    });

    // Second pass: outlier detection on revenue_wow_pct + check_ins_wow_pct.
    this.flagOutliers(scorecards);

    // Roll-up.
    const totals = {
      branch_count: scorecards.length,
      total_active_members: sum(scorecards.map((s) => s.active_members)),
      total_today_revenue: sum(scorecards.map((s) => s.today_revenue)),
      total_mrr: sum(scorecards.map((s) => s.mrr)),
      total_check_ins_today: sum(scorecards.map((s) => s.check_ins_today)),
      total_outstanding_dues: sum(scorecards.map((s) => s.outstanding_dues)),
      total_renewals_at_risk_7d: sum(scorecards.map((s) => s.renewals_at_risk_7d)),
      mean_revenue_wow_pct: meanIgnoringNull(
        scorecards.map((s) => s.revenue_wow_pct),
      ),
      use_map_view: scorecards.length > PortfolioService.MAP_VIEW_THRESHOLD,
    };

    return {
      branches: scorecards,
      rollup: totals,
      generated_at: now.toISOString(),
    };
  }

  // ── Outlier detection ────────────────────────────────────────────

  /**
   * Tags branches whose WoW deltas deviate >1.5σ from the chain mean,
   * AND have an absolute change ≥10% (so a noisy chain doesn't flood
   * the UI with false positives). We also flag any branch where revenue
   * dropped ≥25% WoW regardless of σ — that's always worth a look.
   */
  private flagOutliers(branches: BranchScorecard[]) {
    if (branches.length < 3) return; // need a meaningful sample

    const flag = (
      pickValue: (b: BranchScorecard) => number | null,
      label: (delta: number) => string,
      hardThresholdPct: number,
    ) => {
      const values = branches
        .map((b) => pickValue(b))
        .filter((v): v is number => v !== null);
      if (values.length < 3) return;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
      const stdev = Math.sqrt(variance);
      const threshold = 1.5 * stdev;
      for (const b of branches) {
        const v = pickValue(b);
        if (v === null) continue;
        const dev = Math.abs(v - mean);
        if (
          (dev > threshold && Math.abs(v) >= 10) ||
          v <= -hardThresholdPct
        ) {
          b.outliers.push(label(v));
        }
      }
    };

    flag(
      (b) => b.revenue_wow_pct,
      (delta) =>
        delta < 0
          ? `Revenue ${delta.toFixed(0)}% WoW`
          : `Revenue +${delta.toFixed(0)}% WoW`,
      25,
    );
    flag(
      (b) => b.check_ins_wow_pct,
      (delta) =>
        delta < 0
          ? `Check-ins ${delta.toFixed(0)}% WoW`
          : `Check-ins +${delta.toFixed(0)}% WoW`,
      30,
    );
  }

  // ── MRR per branch (single SQL) ──────────────────────────────────

  private async mrrByBranch(
    branchIds: string[],
    asOf: Date,
  ): Promise<Array<[string, number]>> {
    if (branchIds.length === 0) return [];
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { branch_id: string; mrr: number }[]
      >(
        `SELECT mm.branch_id,
                COALESCE(SUM(
                  CASE WHEN COALESCE(p.duration_days, 30) > 0
                       THEN p.price / COALESCE(p.duration_days, 30) * 30
                       ELSE 0 END
                ), 0)::float AS mrr
         FROM member_memberships mm
         JOIN membership_plans p ON p.id = mm.plan_id
         WHERE mm.status = 'active'
           AND mm.start_date <= $1
           AND mm.end_date >= $1
           AND mm.branch_id = ANY($2::uuid[])
         GROUP BY mm.branch_id`,
        asOf,
        branchIds,
      );
      return rows.map((r) => [r.branch_id, Math.round(Number(r.mrr ?? 0))]);
    } catch (err) {
      this.logger.warn(
        `mrrByBranch failed: ${(err as Error)?.message ?? err}`,
      );
      return [];
    }
  }

  // ── 14-day per-branch sparklines ─────────────────────────────────

  /**
   * Builds a Map<branch_id, number[14]> from a daily-grouped query over
   * any timeseries table that has (branch_id, <when>, [<amount>]).
   */
  private async dailySparkByBranch(
    table: string,
    whenCol: string,
    amountCol: string | null,
    isPaid: boolean,
    branchIds: string[],
    fromDay: Date,
  ): Promise<Map<string, number[]>> {
    const out = new Map<string, number[]>();
    if (branchIds.length === 0) return out;

    const valueExpr = amountCol ? `COALESCE(SUM(${amountCol}), 0)` : 'COUNT(*)';
    const statusFilter = isPaid
      ? "AND status = 'paid'"
      : "AND status = 'success'";
    const sql = `
      SELECT branch_id,
             DATE_TRUNC('day', ${whenCol}) AS day,
             ${valueExpr}::float AS value
      FROM ${table}
      WHERE ${whenCol} >= $1
        ${statusFilter}
        AND branch_id = ANY($2::uuid[])
      GROUP BY branch_id, DATE_TRUNC('day', ${whenCol})
      ORDER BY branch_id, day
    `;
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { branch_id: string; day: Date; value: number }[]
      >(sql, fromDay, branchIds);

      // Bucketize per-branch into a dense 14-day array.
      const perBranch = new Map<string, Map<string, number>>();
      for (const r of rows) {
        const key = new Date(r.day).toISOString().slice(0, 10);
        let m = perBranch.get(r.branch_id);
        if (!m) {
          m = new Map();
          perBranch.set(r.branch_id, m);
        }
        m.set(key, Number(r.value) || 0);
      }
      for (const id of branchIds) {
        const m = perBranch.get(id) ?? new Map<string, number>();
        const series: number[] = [];
        const cursor = new Date(fromDay);
        cursor.setHours(0, 0, 0, 0);
        for (let i = 0; i < 14; i++) {
          series.push(m.get(cursor.toISOString().slice(0, 10)) ?? 0);
          cursor.setDate(cursor.getDate() + 1);
        }
        out.set(id, series);
      }
    } catch (err) {
      this.logger.warn(
        `dailySparkByBranch (${table}) failed: ${(err as Error)?.message ?? err}`,
      );
    }
    return out;
  }

  private emptyRollup(): PortfolioRollup {
    return {
      branch_count: 0,
      total_active_members: 0,
      total_today_revenue: 0,
      total_mrr: 0,
      total_check_ins_today: 0,
      total_outstanding_dues: 0,
      total_renewals_at_risk_7d: 0,
      mean_revenue_wow_pct: null,
      use_map_view: false,
    };
  }
}

// ── pure helpers ─────────────────────────────────────────────────

function mapBy<T, K extends keyof T>(
  rows: T[],
  key: K,
  pick: (r: T) => number,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (r[key] as unknown) as string;
    if (typeof k === 'string') m.set(k, pick(r));
  }
  return m;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function meanIgnoringNull(xs: Array<number | null>): number | null {
  const v = xs.filter((x): x is number => x !== null);
  if (v.length === 0) return null;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
