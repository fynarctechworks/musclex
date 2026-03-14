import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private getBranchFilter(user?: JwtPayload) {
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) {
      return { branch_id: { in: user.branch_ids } };
    }
    return {};
  }

  async getKpis(user?: JwtPayload) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
    const branchFilter = this.getBranchFilter(user);

    const [
      activeMembers,
      monthlyRevenue,
      totalCheckInsThisMonth,
      totalActiveMembersForAttendance,
      expiringSoon,
    ] = await Promise.all([
      // Active members count
      this.prisma.member.count({
        where: { status: 'active', ...branchFilter },
      }),

      // Monthly revenue (sum of paid payments this month)
      this.prisma.payment.aggregate({
        where: {
          status: 'paid',
          paid_at: { gte: startOfMonth },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),

      // Check-ins this month for attendance rate
      this.prisma.checkIn.count({
        where: {
          checked_in_at: { gte: startOfMonth },
          status: 'success',
          ...branchFilter,
        },
      }),

      // Total active members (denominator for attendance)
      this.prisma.member.count({
        where: { status: 'active', ...branchFilter },
      }),

      // Memberships expiring in next 30 days
      this.prisma.memberMembership.count({
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

  async getRevenueChart(user?: JwtPayload) {
    const now = new Date();
    const months: { month: string; revenue: number }[] = [];
    const branchFilter = this.getBranchFilter(user);

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = start.toLocaleString('en-US', {
        month: 'short',
        year: 'numeric',
      });

      const result = await this.prisma.payment.aggregate({
        where: {
          status: 'paid',
          paid_at: { gte: start, lt: end },
          ...branchFilter,
        },
        _sum: { amount: true },
      });

      months.push({
        month: label,
        revenue: Number(result._sum.amount || 0),
      });
    }

    return months;
  }

  async getActivityFeed() {
    const checkIns = await this.prisma.checkIn.findMany({
      where: { status: 'success' },
      include: {
        member: {
          select: { id: true, full_name: true, member_code: true, profile_photo_url: true },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { checked_in_at: 'desc' },
      take: 10,
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

  async getAlerts() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

    const [inactiveMembers, overduePayments, expiringMemberships] =
      await Promise.all([
        // Members with no check-in in 30 days
        this.prisma.member.findMany({
          where: {
            status: 'active',
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

        // Pending payments older than 7 days
        this.prisma.payment.findMany({
          where: {
            status: 'pending',
            created_at: { lte: new Date(now.getTime() - 7 * 86400000) },
          },
          include: {
            member: {
              select: { id: true, full_name: true, member_code: true },
            },
          },
          take: 20,
          orderBy: { created_at: 'asc' },
        }),

        // Memberships expiring within 7 days
        this.prisma.memberMembership.findMany({
          where: {
            status: 'active',
            end_date: {
              gte: now,
              lte: sevenDaysFromNow,
            },
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

  async getBranchComparison() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const branches = await this.prisma.branch.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
    });

    const stats = await Promise.all(
      branches.map(async (branch) => {
        const [memberCount, revenue, checkIns] = await Promise.all([
          this.prisma.member.count({
            where: { branch_id: branch.id, status: 'active' },
          }),
          this.prisma.payment.aggregate({
            where: {
              branch_id: branch.id,
              status: 'paid',
              paid_at: { gte: startOfMonth },
            },
            _sum: { amount: true },
          }),
          this.prisma.checkIn.count({
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
}
