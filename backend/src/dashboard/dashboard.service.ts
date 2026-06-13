import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { JwtPayload } from '../common';

// Wave 10 revenue types live in revenue-intelligence.service.ts now.
// Re-exported here for back-compat with any external import that still
// reads them from this module.
export type {
  DateRange,
  RevenueMixItem,
  PaymentMethodItem,
  RevenueSummary,
} from './revenue-intelligence.service';

@Injectable()
export class DashboardService {
  constructor(
    private pub: PublicPrismaService,
    private tenant: TenantPrisma,
  ) {}

  private getBranchFilter(
    user?: JwtPayload,
    branchId?: string,
  ): { branch_id?: string | { in: string[] } } {
    if (branchId) return { branch_id: branchId };
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) {
      return { branch_id: { in: user.branch_ids } };
    }
    return {};
  }

  async getKpis(user?: JwtPayload, branchId?: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
    const branchFilter = this.getBranchFilter(user, branchId);

    const [
      activeMembers,
      monthlyRevenue,
      totalCheckInsThisMonth,
      totalActiveMembersForAttendance,
      expiringSoon,
    ] = await Promise.all([
      // Active members count
      this.tenant.client.member.count({
        where: { status: 'active', ...branchFilter },
      }),

      // Monthly revenue (sum of paid payments this month)
      this.tenant.client.payment.aggregate({
        where: {
          status: 'paid',
          paid_at: { gte: startOfMonth },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),

      // Check-ins this month for attendance rate
      this.tenant.client.checkIn.count({
        where: {
          checked_in_at: { gte: startOfMonth },
          status: 'success',
          ...branchFilter,
        },
      }),

      // Total active members (denominator for attendance)
      this.tenant.client.member.count({
        where: { status: 'active', ...branchFilter },
      }),

      // Memberships expiring in next 30 days
      this.tenant.client.memberMembership.count({
        where: {
          status: 'active',
          end_date: {
            gte: now,
            lte: thirtyDaysFromNow,
          },
          ...branchFilter,
        },
      }),
    ]);

    // Calculate average attendance rate
    // Days elapsed this month
    const daysElapsed = Math.max(1, now.getDate());
    const expectedCheckIns = totalActiveMembersForAttendance * daysElapsed;
    const avgAttendanceRate =
      expectedCheckIns > 0
        ? Math.round((totalCheckInsThisMonth / expectedCheckIns) * 100)
        : 0;

    return {
      active_members: activeMembers,
      monthly_revenue: Number(monthlyRevenue._sum.amount || 0),
      avg_attendance_rate: avgAttendanceRate,
      expiring_soon_count: expiringSoon,
    };
  }

  async getRevenueChart(user?: JwtPayload, months = 12, branchId?: string) {
    const now = new Date();
    const monthsBack = Math.min(Math.max(months || 12, 1), 24);
    const earliest = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
    const branchFilter = this.getBranchFilter(user, branchId);

    // Single query: aggregate 12 months of revenue using Prisma groupBy
    const branchWhere = branchFilter.branch_id
      ? { branch_id: branchFilter.branch_id }
      : {};

    const results = await this.tenant.client.payment.groupBy({
      by: ['paid_at'],
      where: {
        status: 'paid',
        paid_at: { gte: earliest },
        ...branchWhere,
      },
      _sum: { amount: true },
    });

    // Build month map for the requested window
    const monthMap = new Map<string, number>();
    const monthLabels: { key: string; label: string }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthMap.set(key, 0);
      monthLabels.push({ key, label });
    }

    // Aggregate results into month buckets
    for (const row of results) {
      if (row.paid_at) {
        const d = new Date(row.paid_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const current = monthMap.get(key) || 0;
        monthMap.set(key, current + Number(row._sum.amount || 0));
      }
    }

    return monthLabels.map(({ key, label }) => ({
      month: label,
      revenue: monthMap.get(key) || 0,
    }));
  }

  async getActivityFeed(user?: JwtPayload, branchId?: string, limit = 10) {
    const branchFilter = this.getBranchFilter(user, branchId);
    const safeLimit = Math.min(Math.max(limit || 10, 1), 50);
    const checkIns = await this.tenant.client.checkIn.findMany({
      where: { status: 'success', ...branchFilter },
      include: {
        member: {
          select: { id: true, full_name: true, member_code: true, profile_photo_url: true },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { checked_in_at: 'desc' },
      take: safeLimit,
    });

    return checkIns.map((ci) => ({
      id: ci.id,
      type: 'check_in',
      message: `${ci.member.full_name} (${ci.member.member_code}) checked in at ${ci.branch.name} via ${ci.checkin_method.replace('_', ' ')}`,
      member_name: ci.member.full_name,
      member_code: ci.member.member_code,
      member_photo: ci.member.profile_photo_url,
      branch_name: ci.branch.name,
      method: ci.checkin_method,
      timestamp: ci.checked_in_at,
    }));
  }

  async getAlerts(user?: JwtPayload, branchId?: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
    const branchFilter = this.getBranchFilter(user, branchId);

    const [inactiveMembers, overduePayments, expiringMemberships] =
      await Promise.all([
        this.tenant.client.member.findMany({
          where: {
            status: 'active',
            ...branchFilter,
            check_ins: {
              none: {
                checked_in_at: { gte: thirtyDaysAgo },
              },
            },
          },
          select: {
            id: true,
            full_name: true,
            member_code: true,
            phone: true,
            branch: { select: { id: true, name: true } },
          },
          take: 20,
        }),

        this.tenant.client.payment.findMany({
          where: {
            status: 'pending',
            created_at: { lte: new Date(now.getTime() - 7 * 86400000) },
            ...branchFilter,
          },
          include: {
            member: {
              select: { id: true, full_name: true, member_code: true },
            },
          },
          take: 20,
          orderBy: { created_at: 'asc' },
        }),

        this.tenant.client.memberMembership.findMany({
          where: {
            status: 'active',
            end_date: {
              gte: now,
              lte: sevenDaysFromNow,
            },
            ...branchFilter,
          },
          include: {
            member: {
              select: { id: true, full_name: true, member_code: true, phone: true },
            },
            plan: { select: { id: true, name: true } },
          },
          take: 20,
          orderBy: { end_date: 'asc' },
        }),
      ]);

    const alerts: { id: string; severity: 'high' | 'medium' | 'low'; message: string }[] = [];

    expiringMemberships.forEach((m) => {
      const daysLeft = m.end_date
        ? Math.ceil((new Date(m.end_date).getTime() - now.getTime()) / 86400000)
        : 0;
      alerts.push({
        id: m.id,
        severity: daysLeft <= 3 ? 'high' : 'medium',
        message: `${m.member.full_name} (${m.member.member_code}) — membership expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      });
    });

    overduePayments.forEach((p) => {
      alerts.push({
        id: p.id,
        severity: 'high',
        message: `Overdue payment from ${p.member.full_name} (${p.member.member_code}) — pending since ${new Date(p.created_at).toLocaleDateString()}`,
      });
    });

    inactiveMembers.forEach((m) => {
      alerts.push({
        id: m.id,
        severity: 'low',
        message: `${m.full_name} (${m.member_code}) has not checked in for 30+ days`,
      });
    });

    return alerts;
  }

  async getBranchComparison(user?: JwtPayload) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // Owners see every branch; staff see only their assigned branches.
    const branchScope =
      user?.role === 'owner' || !user?.branch_ids?.length
        ? {}
        : { id: { in: user.branch_ids } };

    const branches = await this.tenant.client.branch.findMany({
      where: { is_active: true, ...branchScope },
      select: { id: true, name: true },
    });

    const stats = await Promise.all(
      branches.map(async (branch) => {
        const [memberCount, revenue, checkIns] = await Promise.all([
          this.tenant.client.member.count({
            where: { branch_id: branch.id, status: 'active' },
          }),
          this.tenant.client.payment.aggregate({
            where: {
              branch_id: branch.id,
              status: 'paid',
              paid_at: { gte: startOfMonth },
            },
            _sum: { amount: true },
          }),
          this.tenant.client.checkIn.count({
            where: {
              branch_id: branch.id,
              checked_in_at: { gte: startOfMonth },
              status: 'success',
            },
          }),
        ]);

        return {
          branch_id: branch.id,
          branch_name: branch.name,
          active_members: memberCount,
          monthly_revenue: Number(revenue._sum.amount || 0),
          monthly_check_ins: checkIns,
        };
      }),
    );

    return stats;
  }

  /**
   * "First-run" checklist on the dashboard. Each flag is true once the
   * studio has at least one row in the corresponding entity. Used by the
   * SetupChecklist component to nudge owners through onboarding.
   */
  async getSetupStatus(user?: JwtPayload, branchId?: string) {
    const branchFilter = this.getBranchFilter(user, branchId);

    const [
      branchCount,
      planCount,
      memberCount,
      staffCount,
      classTemplateCount,
      gymRow,
    ] = await Promise.all([
      this.tenant.client.branch.count({ where: { is_active: true } }),
      this.tenant.client.membershipPlan.count({ where: { is_active: true } }),
      this.tenant.client.member.count({ where: { ...branchFilter } }),
      this.tenant.client.staff.count({ where: { is_active: true } }),
      // Tolerate older schemas where the table name might differ.
      (this.tenant.client as { classTemplate?: { count: (a?: unknown) => Promise<number> } })
        .classTemplate?.count?.()
        .catch(() => 0) ?? Promise.resolve(0),
      this.pub.studio
        .findFirst({ where: { id: user?.studio_id }, select: { id: true, name: true } })
        .catch(() => null),
    ]);

    return {
      has_branches: branchCount > 0,
      has_plans: planCount > 0,
      has_members: memberCount > 0,
      has_staff: staffCount > 0,
      has_classes: classTemplateCount > 0,
      has_gym_setup: !!gymRow?.name,
    };
  }
}
