import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MemberVisitsService {
  constructor(private prisma: PrismaService) {}

  async getVisits(
    memberId: string,
    filters?: {
      branch_id?: string;
      date_from?: string;
      date_to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    const { branch_id, date_from, date_to, page = 1, limit = 50 } = filters || {};
    const skip = (page - 1) * limit;

    const where: any = { member_id: memberId };
    if (branch_id) where.branch_id = branch_id;
    if (date_from || date_to) {
      where.checked_in_at = {};
      if (date_from) where.checked_in_at.gte = new Date(date_from);
      if (date_to) where.checked_in_at.lte = new Date(date_to);
    }

    const [data, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          membership: { select: { id: true, plan: { select: { name: true } } } },
        },
        skip,
        take: limit,
        orderBy: { checked_in_at: 'desc' },
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getVisitStreak(memberId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    // Get all check-in dates for the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const checkIns = await this.prisma.checkIn.findMany({
      where: {
        member_id: memberId,
        status: 'success',
        checked_in_at: { gte: ninetyDaysAgo },
      },
      select: { checked_in_at: true },
      orderBy: { checked_in_at: 'desc' },
    });

    // Calculate unique visit days
    const visitDays = new Set(
      checkIns.map((ci) => ci.checked_in_at.toISOString().slice(0, 10)),
    );

    // Calculate current streak
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      if (visitDays.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break; // streak broken (skip today if no visit yet)
      }
    }

    // Calculate weekly frequency
    const weeks: Record<string, number> = {};
    for (const dateStr of visitDays) {
      const d = new Date(dateStr);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      weeks[weekKey] = (weeks[weekKey] || 0) + 1;
    }
    const weekValues = Object.values(weeks);
    const avgPerWeek = weekValues.length > 0
      ? Math.round((weekValues.reduce((a, b) => a + b, 0) / weekValues.length) * 10) / 10
      : 0;

    return {
      current_streak: streak,
      total_visits_90_days: visitDays.size,
      avg_visits_per_week: avgPerWeek,
      visit_days: Array.from(visitDays).sort().reverse(),
    };
  }

  async getAttendanceByMonth(memberId: string, months = 6) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const checkIns = await this.prisma.checkIn.findMany({
      where: {
        member_id: memberId,
        status: 'success',
        checked_in_at: { gte: since },
      },
      select: { checked_in_at: true },
      orderBy: { checked_in_at: 'asc' },
    });

    const monthlyData: Record<string, number> = {};
    for (const ci of checkIns) {
      const key = ci.checked_in_at.toISOString().slice(0, 7); // YYYY-MM
      monthlyData[key] = (monthlyData[key] || 0) + 1;
    }

    return Object.entries(monthlyData).map(([month, count]) => ({ month, count }));
  }
}
