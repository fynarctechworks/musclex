import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';

/**
 * Analytics surface for both B2B (SaaS-admin) and B2C (gym-owner) referral data.
 *
 * All numbers are computed on-the-fly. For production scale, hot-path metrics
 * should be projected to a materialized view or to the existing DailyGymMetrics.
 */
@Injectable()
export class ReferralAnalyticsService {
  constructor(
    private readonly pub: PublicPrismaService,
    private readonly tenant: TenantPrisma,
  ) {}

  // ════════════════════════════════════════════════════════════════
  // B2B (SaaS admin)
  // ════════════════════════════════════════════════════════════════

  /**
   * Funnel: counts at each lifecycle state.
   * Conversion = rewarded / total.
   */
  async b2bFunnel(opts: { from?: Date; to?: Date } = {}) {
    const where = this.dateWhere(opts);
    const groups = await this.pub.referral.groupBy({
      by:     ['status'],
      where,
      _count: true,
    });
    const total = groups.reduce((a, g) => a + g._count, 0);
    const rewarded = groups.find((g) => g.status === 'rewarded')?._count ?? 0;

    return {
      total,
      rewarded,
      conversion_pct: total ? Number(((rewarded / total) * 100).toFixed(2)) : 0,
      by_status: groups.map((g) => ({ status: g.status, count: g._count })),
    };
  }

  /**
   * Top referring studios by rewarded referral count, with reward totals.
   */
  async b2bTopReferrers(opts: { limit?: number; from?: Date; to?: Date } = {}) {
    const limit = opts.limit ?? 10;
    const where = this.dateWhere(opts);

    const rows = await this.pub.referral.groupBy({
      by:    ['referrer_studio_id'],
      where: { ...where, status: 'rewarded' },
      _count: { referrer_studio_id: true },
      orderBy: { _count: { referrer_studio_id: 'desc' } },
      take:   limit,
    });

    const ids = rows.map((r) => r.referrer_studio_id);
    const [studios, rewardSums] = await Promise.all([
      this.pub.studio.findMany({
        where:  { id: { in: ids } },
        select: { id: true, name: true, referral_code: true, country: true },
      }),
      this.pub.rewardLog.groupBy({
        by:    ['beneficiary_studio_id', 'reward_type'],
        where: { beneficiary_studio_id: { in: ids }, status: 'applied' },
        _count: true,
      }),
    ]);

    const studioMap = Object.fromEntries(studios.map((s) => [s.id, s]));
    const rewardMap: Record<string, Record<string, number>> = {};
    for (const r of rewardSums) {
      if (!rewardMap[r.beneficiary_studio_id]) rewardMap[r.beneficiary_studio_id] = {};
      rewardMap[r.beneficiary_studio_id][r.reward_type] = r._count;
    }

    return rows.map((r) => ({
      studio:         studioMap[r.referrer_studio_id],
      rewarded_count: r._count.referrer_studio_id,
      rewards:        rewardMap[r.referrer_studio_id] ?? {},
    }));
  }

  /**
   * MRR attributed to referrals.
   * Sums amount_paid from event_payload across rewarded referrals.
   */
  async b2bAttributedRevenue(opts: { from?: Date; to?: Date } = {}) {
    const where = this.dateWhere(opts);
    const rewarded = await this.pub.referral.findMany({
      where:  { ...where, status: 'rewarded' },
      select: { id: true },
    });
    const referralIds = rewarded.map((r) => r.id);
    if (!referralIds.length) {
      return { total_revenue: '0.00', currency: 'INR', count: 0 };
    }

    const rows = await this.pub.rewardLog.findMany({
      where:  { referral_id: { in: referralIds }, status: 'applied' },
      select: { event_payload: true },
    });

    let total = 0;
    const currencies: Record<string, number> = {};
    for (const r of rows) {
      const ep = r.event_payload as any;
      const amount = Number(ep?.amountPaid ?? 0);
      const cur = String(ep?.currency ?? 'INR');
      total += amount;
      currencies[cur] = (currencies[cur] ?? 0) + amount;
    }

    return {
      total_revenue: total.toFixed(2),
      by_currency:   currencies,
      count:         rows.length,
    };
  }

  /**
   * Average time-to-reward (created_at → rewarded_at).
   */
  async b2bTimeToReward(opts: { from?: Date; to?: Date } = {}) {
    const where = this.dateWhere(opts);
    const rows = await this.pub.referral.findMany({
      where:  { ...where, status: 'rewarded', rewarded_at: { not: null } },
      select: { created_at: true, rewarded_at: true },
    });

    if (!rows.length) return { count: 0, avg_hours: 0, median_hours: 0 };

    const durations = rows
      .map((r) => (r.rewarded_at!.getTime() - r.created_at.getTime()) / (60 * 60 * 1000))
      .sort((a, b) => a - b);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const median = durations[Math.floor(durations.length / 2)];

    return {
      count:         durations.length,
      avg_hours:     Number(avg.toFixed(2)),
      median_hours:  Number(median.toFixed(2)),
    };
  }

  /**
   * Wallet aggregate: total credits issued, debited, current outstanding, etc.
   */
  async b2bWalletAggregates() {
    const byEntry = await this.pub.referralWalletEntry.groupBy({
      by:    ['entry_type'],
      _sum:  { amount: true },
      _count: true,
    });
    const result: Record<string, { total: string; count: number }> = {};
    for (const r of byEntry) {
      result[r.entry_type] = {
        total: r._sum.amount?.toFixed(2) ?? '0.00',
        count: r._count,
      };
    }
    return result;
  }

  /**
   * Cohort-style daily counts of new referrals + rewarded referrals.
   */
  async b2bDailyTrend(opts: { from: Date; to: Date }) {
    const rows = await this.pub.$queryRaw<
      Array<{ day: Date; created: bigint; rewarded: bigint }>
    >`
      SELECT
        date_trunc('day', r.created_at) AS day,
        COUNT(*)::bigint                  AS created,
        COUNT(*) FILTER (WHERE r.status = 'rewarded')::bigint AS rewarded
      FROM "public"."referrals" r
      WHERE r.created_at >= ${opts.from} AND r.created_at <= ${opts.to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((r) => ({
      day:      r.day.toISOString().slice(0, 10),
      created:  Number(r.created),
      rewarded: Number(r.rewarded),
    }));
  }

  // ════════════════════════════════════════════════════════════════
  // B2C (gym owner)
  // ════════════════════════════════════════════════════════════════

  async b2cFunnel(opts: { from?: Date; to?: Date } = {}) {
    const gymId = this.requireGym();
    const where = { gym_id: gymId, ...this.dateWhere(opts) };

    const groups = await this.tenant.client.memberReferral.groupBy({
      by:     ['reward_status'],
      where,
      _count: true,
    });
    const total = groups.reduce((a, g) => a + g._count, 0);
    const awarded = groups.find((g) => g.reward_status === 'awarded')?._count ?? 0;

    return {
      total,
      awarded,
      conversion_pct: total ? Number(((awarded / total) * 100).toFixed(2)) : 0,
      by_status: groups.map((g) => ({ status: g.reward_status, count: g._count })),
    };
  }

  async b2cLeaderboard(opts: { limit?: number; from?: Date; to?: Date } = {}) {
    const gymId = this.requireGym();
    const limit = opts.limit ?? 10;

    const rows = await this.tenant.client.memberReferral.groupBy({
      by:    ['referrer_member_id'],
      where: { gym_id: gymId, reward_status: 'awarded', ...this.dateWhere(opts) },
      _count: { referrer_member_id: true },
      orderBy: { _count: { referrer_member_id: 'desc' } },
      take:   limit,
    });

    const ids = rows.map((r) => r.referrer_member_id);
    const members = await this.tenant.client.member.findMany({
      where:  { id: { in: ids } },
      select: { id: true, full_name: true, referral_code: true, profile_photo_url: true },
    });
    const byId = Object.fromEntries(members.map((m) => [m.id, m]));

    return rows.map((r, i) => ({
      rank:             i + 1,
      member:           byId[r.referrer_member_id],
      successful_count: r._count.referrer_member_id,
    }));
  }

  async b2cRewardCosts(opts: { from?: Date; to?: Date } = {}) {
    const gymId = this.requireGym();
    const rows = await this.tenant.client.memberReferralReward.groupBy({
      by:    ['reward_type', 'status'],
      where: { gym_id: gymId, ...this.dateWhere(opts, 'applied_at') },
      _count: true,
    });
    return rows.map((r) => ({
      reward_type: r.reward_type,
      status:      r.status,
      count:       r._count,
    }));
  }

  // ════════════════════════════════════════════════════════════════
  // Member-facing dashboard
  // ════════════════════════════════════════════════════════════════

  /**
   * Per-member dashboard data: code, given/received/awarded counts,
   * recent activity timeline, rank on the gym leaderboard.
   */
  async memberDashboard(memberId: string) {
    const gymId = this.requireGym();

    const [member, given, awardedCount, rewards, allTimeLeaderboard] = await Promise.all([
      this.tenant.client.member.findUnique({
        where:  { id: memberId },
        select: { id: true, full_name: true, referral_code: true, gym_id: true },
      }),
      this.tenant.client.memberReferral.findMany({
        where:   { referrer_member_id: memberId, gym_id: gymId },
        orderBy: { created_at: 'desc' },
        take:    20,
        include: { referred: { select: { full_name: true } } },
      }),
      this.tenant.client.memberReferral.count({
        where: { referrer_member_id: memberId, gym_id: gymId, reward_status: 'awarded' },
      }),
      this.tenant.client.memberReferralReward.findMany({
        where:   { beneficiary_member_id: memberId, gym_id: gymId },
        orderBy: { applied_at: 'desc' },
        take:    10,
      }),
      this.b2cLeaderboard({ limit: 100 }),
    ]);

    const rank = allTimeLeaderboard.findIndex((r) => r.member?.id === memberId) + 1 || null;

    return {
      referral_code: member?.referral_code,
      stats: {
        total_given: given.length,
        awarded:     awardedCount,
        pending:     given.filter((g) => g.reward_status === 'pending').length,
      },
      rank,
      timeline: given.map((g) => ({
        id:           g.id,
        referred:     g.referred?.full_name,
        status:       g.reward_status,
        created_at:   g.created_at,
        awarded_at:   g.awarded_at,
      })),
      rewards,
    };
  }

  // ── helpers ─────────────────────────────────────────────────────

  private dateWhere(opts: { from?: Date; to?: Date }, field = 'created_at') {
    if (!opts.from && !opts.to) return {};
    return {
      [field]: {
        ...(opts.from && { gte: opts.from }),
        ...(opts.to   && { lte: opts.to   }),
      },
    } as any;
  }

  private requireGym(): string {
    const id = getTenantGymId();
    if (!id) throw new Error('Tenant context required for B2C analytics');
    return id;
  }
}
