import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';

/**
 * Executes the advisor's read-only analytics tools against the tenant client.
 *
 * Scope safety: no tool takes a gym/branch identifier from the model — every
 * query runs on `this.tenant.client`, which is already bound to the caller's
 * gym. A hallucinated tool argument therefore cannot widen scope; the worst it
 * can do is ask for a silly date range.
 */
@Injectable()
export class AiToolRunnerService {
  private readonly logger = new Logger(AiToolRunnerService.name);

  constructor(private readonly tenant: TenantPrisma) {}

  /** Parse a model-supplied date, falling back to a sane default. */
  private day(value: unknown, fallback: Date): Date {
    if (typeof value !== 'string') return fallback;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? fallback : d;
  }

  async run(name: string, input: Record<string, unknown>): Promise<unknown> {
    try {
      switch (name) {
        case 'get_revenue_summary':
          return await this.revenueSummary(input);
        case 'get_membership_stats':
          return await this.membershipStats();
        case 'get_member_counts':
          return await this.memberCounts(input);
        case 'get_attendance_summary':
          return await this.attendanceSummary(input);
        case 'get_churn_risk':
          return await this.churnRisk();
        case 'get_outstanding_dues':
          return await this.outstandingDues();
        case 'get_top_trainers':
          return await this.topTrainers(input);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      this.logger.warn(`AI tool ${name} failed: ${(err as Error).message}`);
      // Return the error to the model rather than throwing — it can explain
      // the gap to the user instead of the whole turn failing.
      return { error: 'This data could not be retrieved.' };
    }
  }

  private async revenueSummary(input: Record<string, unknown>) {
    const end = this.day(input.end_date, new Date());
    const start = this.day(
      input.start_date,
      new Date(end.getTime() - 30 * 86400000),
    );

    const rows = await this.tenant.client.payment.groupBy({
      by: ['payment_method'],
      where: { status: 'paid', paid_at: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const byMethod = rows.map((r) => ({
      payment_method: r.payment_method,
      amount: Number(r._sum.amount ?? 0),
      transactions: r._count._all,
    }));

    return {
      period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
      total_revenue: byMethod.reduce((s, r) => s + r.amount, 0),
      total_transactions: byMethod.reduce((s, r) => s + r.transactions, 0),
      by_payment_method: byMethod,
      currency: 'INR',
    };
  }

  private async membershipStats() {
    const statuses = ['active', 'frozen', 'expired', 'cancelled'];
    const counts = await Promise.all(
      statuses.map((s) =>
        this.tenant.client.memberMembership.count({ where: { status: s } }),
      ),
    );
    const sevenDays = new Date(Date.now() + 7 * 86400000);
    const [expiringSoon, autoRenew] = await Promise.all([
      this.tenant.client.memberMembership.count({
        where: { status: 'active', end_date: { gte: new Date(), lte: sevenDays } },
      }),
      this.tenant.client.memberMembership.count({
        where: { status: 'active', auto_renew: true },
      }),
    ]);

    return {
      ...Object.fromEntries(statuses.map((s, i) => [s, counts[i]])),
      expiring_within_7_days: expiringSoon,
      auto_renew_enabled: autoRenew,
    };
  }

  private async memberCounts(input: Record<string, unknown>) {
    const days = typeof input.joined_within_days === 'number' ? input.joined_within_days : 30;
    const since = new Date(Date.now() - days * 86400000);

    const grouped = await this.tenant.client.member.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const recent = await this.tenant.client.member.count({
      where: { created_at: { gte: since } },
    });

    return {
      by_status: grouped.map((g) => ({ status: g.status, count: g._count._all })),
      total: grouped.reduce((s, g) => s + g._count._all, 0),
      [`joined_last_${days}_days`]: recent,
    };
  }

  private async attendanceSummary(input: Record<string, unknown>) {
    const end = this.day(input.end_date, new Date());
    const start = this.day(
      input.start_date,
      new Date(end.getTime() - 7 * 86400000),
    );

    const rows = await this.tenant.client.checkIn.findMany({
      where: { status: 'success', checked_in_at: { gte: start, lt: end } },
      select: { member_id: true, checked_in_at: true },
    });

    const byHour = new Map<number, number>();
    for (const r of rows) {
      if (!r.checked_in_at) continue;
      const h = r.checked_in_at.getHours();
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }
    const peak = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
      total_visits: rows.length,
      unique_members: new Set(rows.map((r) => r.member_id)).size,
      busiest_hour: peak ? { hour: peak[0], visits: peak[1] } : null,
    };
  }

  private async churnRisk() {
    const grouped = await this.tenant.client.member.groupBy({
      by: ['churn_risk'],
      where: { status: 'active' },
      _count: { _all: true },
      _avg: { engagement_score: true },
    });

    return {
      by_risk: grouped.map((g) => ({
        risk: g.churn_risk ?? 'unscored',
        members: g._count._all,
        avg_engagement_score: g._avg.engagement_score
          ? Math.round(Number(g._avg.engagement_score))
          : null,
      })),
      note:
        'Risk is computed nightly from visit recency and activity. "unscored" ' +
        'means the member has not been through the scoring job yet.',
    };
  }

  private async outstandingDues() {
    const invoices = await this.tenant.client.memberInvoice.findMany({
      where: { status: { in: ['pending', 'partial'] } },
      select: { total_amount: true, issued_at: true },
    });

    const oldest = invoices.reduce<Date | null>((acc, i) => {
      if (!i.issued_at) return acc;
      return !acc || i.issued_at < acc ? i.issued_at : acc;
    }, null);

    return {
      total_outstanding: invoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0),
      invoice_count: invoices.length,
      oldest_invoice_age_days: oldest
        ? Math.floor((Date.now() - oldest.getTime()) / 86400000)
        : null,
      currency: 'INR',
    };
  }

  private async topTrainers(input: Record<string, unknown>) {
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 5;
    const rows = await this.tenant.client.trainerAnalytics.findMany({
      orderBy: [{ period_end: 'desc' }, { sessions_conducted: 'desc' }],
      distinct: ['trainer_id'],
      take: limit,
      include: { trainer: { select: { full_name: true } } },
    });

    return {
      trainers: rows.map((r) => ({
        name: r.trainer?.full_name ?? 'Unknown',
        sessions_conducted: r.sessions_conducted,
        members_trained: r.members_trained,
        revenue_generated: Number(r.revenue_generated ?? 0),
        period_end: r.period_end?.toISOString().slice(0, 10) ?? null,
      })),
      note:
        'Sourced from the nightly trainer-analytics rollup, so very recent ' +
        'sessions may not be reflected yet.',
    };
  }
}
