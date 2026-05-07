import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';

export interface BusinessMetrics {
  growth_rate_30d: number; // %
  growth_rate_mtd: number; // %
  retention_rate_90d: number; // %
  churn_rate_30d: number; // %
  ltv_estimate: number; // currency units
  cac_estimate: number | null; // null when no marketing spend table available
  generated_at: string;
}

/**
 * Business intelligence metrics: growth, retention, churn, LTV, CAC.
 *
 * LTV = avg_monthly_revenue_per_member × (1 / monthly_churn_rate). Rounded to int.
 * Churn = cancelled in last 30d / active members 30d ago.
 * CAC: nullable — there is no marketing_spend table in the current schema, so
 *      CAC is always null. When such a table is added, sum last-30d spend
 *      divided by new members in last 30d.
 */
@Injectable()
export class BusinessMetricsService {
  constructor(private prisma: PrismaService) {}

  private getBranchFilter(user?: JwtPayload, branchId?: string) {
    if (branchId) return { branch_id: branchId };
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) {
      return { branch_id: { in: user.branch_ids } };
    }
    return {};
  }

  async getBusinessMetrics(
    user: JwtPayload,
    branchId?: string,
  ): Promise<BusinessMetrics> {
    const branchFilter = this.getBranchFilter(user, branchId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

    const [
      newLast30,
      newPrev30,
      newMtd,
      activeNow,
      activeAt30dAgo,
      activeAt90dAgo,
      retainedFrom90d,
      cancelledLast30,
      revenueLast30Agg,
      activeMembersForLtv,
    ] = await Promise.all([
      this.prisma.member.count({
        where: { created_at: { gte: thirtyDaysAgo }, ...branchFilter },
      }),
      this.prisma.member.count({
        where: {
          created_at: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          ...branchFilter,
        },
      }),
      this.prisma.member.count({
        where: { created_at: { gte: startOfMonth }, ...branchFilter },
      }),
      this.prisma.member.count({
        where: { status: 'active', ...branchFilter },
      }),
      // Approximation: members that existed (created_at <= 30d ago) and were
      // active at that point — without history table, use current actives whose
      // membership was already running 30d ago.
      this.prisma.member.count({
        where: {
          created_at: { lte: thirtyDaysAgo },
          memberships: {
            some: { start_date: { lte: thirtyDaysAgo } },
          },
          ...branchFilter,
        },
      }),
      this.prisma.member.count({
        where: {
          created_at: { lte: ninetyDaysAgo },
          memberships: {
            some: { start_date: { lte: ninetyDaysAgo } },
          },
          ...branchFilter,
        },
      }),
      // Members that joined ≥90d ago AND still have at least one currently
      // active membership.
      this.prisma.member.count({
        where: {
          created_at: { lte: ninetyDaysAgo },
          memberships: { some: { status: 'active' } },
          ...branchFilter,
        },
      }),
      this.prisma.memberMembership.count({
        where: {
          status: { in: ['cancelled', 'expired'] },
          updated_at: { gte: thirtyDaysAgo },
          ...branchFilter,
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'paid',
          paid_at: { gte: thirtyDaysAgo },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),
      this.prisma.member.count({
        where: { status: 'active', ...branchFilter },
      }),
    ]);

    const growth_rate_30d =
      newPrev30 > 0
        ? Math.round(((newLast30 - newPrev30) / newPrev30) * 1000) / 10
        : newLast30 > 0
          ? 100
          : 0;

    const daysIntoMonth = Math.max(1, now.getDate());
    const daysInPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
    ).getDate();
    const startPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const sameDayPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      Math.min(daysIntoMonth, daysInPrevMonth),
    );
    const newPrevMtd = await this.prisma.member.count({
      where: {
        created_at: { gte: startPrevMonth, lt: sameDayPrevMonth },
        ...branchFilter,
      },
    });

    const growth_rate_mtd =
      newPrevMtd > 0
        ? Math.round(((newMtd - newPrevMtd) / newPrevMtd) * 1000) / 10
        : newMtd > 0
          ? 100
          : 0;

    const retention_rate_90d =
      activeAt90dAgo > 0
        ? Math.round((retainedFrom90d / activeAt90dAgo) * 1000) / 10
        : 0;

    const churn_rate_30d =
      activeAt30dAgo > 0
        ? Math.round((cancelledLast30 / activeAt30dAgo) * 1000) / 10
        : 0;

    // LTV: avg_monthly_revenue_per_member × (1 / monthly_churn_rate)
    const revenueLast30 = Number(revenueLast30Agg._sum.amount ?? 0);
    const avgMonthlyRevenuePerMember =
      activeMembersForLtv > 0 ? revenueLast30 / activeMembersForLtv : 0;
    const monthlyChurnFrac = churn_rate_30d / 100;
    const ltv_estimate =
      monthlyChurnFrac > 0
        ? Math.round(avgMonthlyRevenuePerMember / monthlyChurnFrac)
        : Math.round(avgMonthlyRevenuePerMember * 12); // fallback: 12 months

    // CAC — no marketing_spend table exists in the current Prisma schema, so
    // we can't compute it. Return null.
    const cac_estimate: number | null = null;

    return {
      growth_rate_30d,
      growth_rate_mtd,
      retention_rate_90d,
      churn_rate_30d,
      ltv_estimate,
      cac_estimate,
      generated_at: new Date().toISOString(),
    };
  }
}
