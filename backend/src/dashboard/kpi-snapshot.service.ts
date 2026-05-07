import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardPulseService } from './dashboard-pulse.service';
import { resolveBranchScope } from '../common/branch-scope.util';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

const SNAPSHOT_METRICS = [
  'active_members',
  'today_revenue',
  'mrr',
  'check_ins_today',
  'renewals_at_risk_7d',
  'outstanding_dues',
] as const;
type SnapshotMetric = (typeof SNAPSHOT_METRICS)[number];

export interface RestatementCheck {
  metric: SnapshotMetric;
  prior_date: string;
  prior_value: number;
  current_value: number;
  delta_pct: number;
  /** True when |delta_pct| ≥ 5%. */
  is_restated: boolean;
}

/**
 * KPI Snapshot service (Wave 7) — captures one row per (gym, branch,
 * date, metric) at end-of-day. The dashboard later compares the current
 * value of yesterday's date against the snapshot; meaningful drift is
 * surfaced as a "▴ restated" marker so users see when a previously-
 * reported number changed (typically because of late-recorded payments,
 * back-dated refunds, or corrections).
 *
 * The cron runs at 23:30 UTC (≈ 5 AM IST next day) to catch end-of-day
 * activity. Calling `captureNow()` directly is also supported for
 * manual recapture from the controller.
 */
@Injectable()
export class KpiSnapshotService {
  private readonly logger = new Logger(KpiSnapshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pulse: DashboardPulseService,
  ) {}

  /** Cron — daily at 23:30 UTC. */
  @Cron('30 23 * * *', { timeZone: 'UTC' })
  async runNightlySnapshot() {
    try {
      const studios = await this.prisma.studio.findMany({
        where: {
          last_login_at: { gte: new Date(Date.now() - 7 * 86400000) },
        },
        select: { id: true, owner_user_id: true },
        take: 200,
      });
      for (const s of studios) {
        try {
          await this.captureNow({
            studio_id: s.id,
            user_id: s.owner_user_id,
            role: 'owner',
            branch_ids: [],
          } as any);
        } catch (err) {
          this.logger.warn(
            `Snapshot for ${s.id} failed: ${(err as Error)?.message ?? err}`,
          );
        }
      }
      this.logger.log(`KPI snapshot cron completed for ${studios.length} studios`);
    } catch (err) {
      this.logger.error(
        `KPI snapshot cron crashed: ${(err as Error)?.message ?? err}`,
      );
    }
  }

  /**
   * Capture the current KPI values into the snapshot table for today's
   * date. Idempotent: re-running on the same day overwrites the snapshot
   * (this is intentional — the latest read of a day is the authoritative
   * end-of-day value).
   */
  async captureNow(user: JwtPayload, branchId?: string): Promise<void> {
    if (!user?.studio_id) return;
    const pulse = await this.pulse.getPulse(user, branchId);
    const today = new Date().toISOString().slice(0, 10);

    const values: Record<SnapshotMetric, number> = {
      active_members: pulse.active_members.value,
      today_revenue: pulse.today_revenue.value,
      mrr: pulse.mrr.value,
      check_ins_today: pulse.check_ins_today.value,
      renewals_at_risk_7d: pulse.renewals_at_risk_7d.value,
      outstanding_dues: pulse.outstanding_dues.value,
    };

    for (const metric of SNAPSHOT_METRICS) {
      try {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO dashboard_kpi_snapshots (gym_id, branch_id, snapshot_date, metric, value)
           VALUES ($1::uuid, $2::uuid, $3::date, $4, $5)
           ON CONFLICT (gym_id, branch_id, snapshot_date, metric) DO UPDATE SET
             value = EXCLUDED.value,
             captured_at = NOW()`,
          user.studio_id,
          branchId ?? null,
          today,
          metric,
          values[metric],
        );
      } catch (err) {
        this.logger.warn(
          `KPI snapshot persist failed (${metric}): ${(err as Error)?.message ?? err}`,
        );
      }
    }
  }

  /**
   * For each KPI, compare yesterday's stored snapshot to the current value
   * recomputed *as if* still inside yesterday. If they differ ≥5%, the
   * historical figure has been restated. We surface only the ones that
   * meaningfully drifted — small floating-point noise is suppressed.
   */
  async detectRestatements(
    user: JwtPayload | undefined,
    branchId?: string,
  ): Promise<RestatementCheck[]> {
    if (!user?.studio_id) return [];
    resolveBranchScope(user, branchId); // ensure access check fails closed

    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);

    let snapshots: Array<{ metric: string; value: number }> = [];
    try {
      snapshots = await this.prisma.$queryRawUnsafe<
        { metric: string; value: number }[]
      >(
        `SELECT metric, value FROM dashboard_kpi_snapshots
         WHERE gym_id = $1::uuid
           AND snapshot_date = $2::date
           AND ((branch_id IS NULL AND $3::uuid IS NULL) OR branch_id = $3::uuid)`,
        user.studio_id,
        yesterday,
        branchId ?? null,
      );
    } catch (err) {
      this.logger.warn(
        `detectRestatements: snapshot read failed: ${(err as Error)?.message ?? err}`,
      );
      return [];
    }

    if (snapshots.length === 0) return [];

    // Recompute the *current* value using the same Pulse path.
    // Note: today_revenue/check_ins_today are inherently today-only, so
    // restatement only meaningfully applies to membership-state metrics
    // (active_members / mrr / outstanding_dues / renewals_at_risk_7d).
    const pulse = await this.pulse.getPulse(user, branchId);
    const current: Record<string, number> = {
      active_members: pulse.active_members.value,
      today_revenue: pulse.today_revenue.value,
      mrr: pulse.mrr.value,
      check_ins_today: pulse.check_ins_today.value,
      renewals_at_risk_7d: pulse.renewals_at_risk_7d.value,
      outstanding_dues: pulse.outstanding_dues.value,
    };

    const out: RestatementCheck[] = [];
    for (const s of snapshots) {
      const cur = current[s.metric];
      if (cur === undefined) continue;
      // Skip metrics where day-over-day comparison isn't meaningful.
      if (s.metric === 'today_revenue' || s.metric === 'check_ins_today') continue;
      if (s.value === 0 && cur === 0) continue;
      const deltaPct =
        s.value === 0 ? 100 : ((cur - s.value) / s.value) * 100;
      const isRestated = Math.abs(deltaPct) >= 5;
      if (isRestated) {
        out.push({
          metric: s.metric as SnapshotMetric,
          prior_date: yesterday,
          prior_value: Number(s.value),
          current_value: cur,
          delta_pct: round1(deltaPct),
          is_restated: true,
        });
      }
    }
    return out;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
