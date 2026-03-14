import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  AnalyticsQueryDto,
  RevenueQueryDto,
  MembershipQueryDto,
  ClassQueryDto,
  TrainerQueryDto,
  MemberBehaviorQueryDto,
  CampaignAnalyticsQueryDto,
} from '../dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ─── Executive Dashboard ─────────────────────────────────────

  async getDashboardSummary(query: AnalyticsQueryDto) {
    const where = this.buildDateFilter(query);
    const branchWhere = query.branch_id ? { branch_id: query.branch_id } : {};

    const [latestMetrics, revenueByType, membershipSummary, topClasses] =
      await Promise.all([
        this.prisma.dailyGymMetrics.findFirst({
          where: { ...where, ...branchWhere },
          orderBy: { date: 'desc' },
        }),
        this.getRevenueBreakdown(query),
        this.getMembershipSummary(query),
        this.getTopClasses(query),
      ]);

    return {
      today: latestMetrics,
      revenue_breakdown: revenueByType,
      membership_summary: membershipSummary,
      top_classes: topClasses,
    };
  }

  // ─── Daily Gym Metrics ───────────────────────────────────────

  async getDailyMetrics(query: AnalyticsQueryDto) {
    const where = this.buildDateFilter(query);
    const branchWhere = query.branch_id ? { branch_id: query.branch_id } : {};

    return this.prisma.dailyGymMetrics.findMany({
      where: { ...where, ...branchWhere },
      orderBy: { date: 'desc' },
      take: 90,
    });
  }

  async getDailyMetricsTrend(query: AnalyticsQueryDto) {
    const where = this.buildDateFilter(query);
    const branchWhere = query.branch_id ? { branch_id: query.branch_id } : {};

    const metrics = await this.prisma.dailyGymMetrics.findMany({
      where: { ...where, ...branchWhere },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        total_revenue: true,
        new_members: true,
        active_members: true,
        total_visits: true,
        classes_held: true,
        products_sold: true,
      },
    });

    return metrics;
  }

  // ─── Revenue Analytics ───────────────────────────────────────

  async getRevenueAnalytics(query: RevenueQueryDto) {
    const where: Prisma.RevenueAnalyticsWhereInput = {};
    if (query.organization_id) where.organization_id = query.organization_id;
    if (query.branch_id) where.branch_id = query.branch_id;
    if (query.revenue_type) where.revenue_type = query.revenue_type;
    if (query.start_date || query.end_date) {
      where.period_start = {};
      if (query.start_date) where.period_start.gte = new Date(query.start_date);
      if (query.end_date) where.period_start.lte = new Date(query.end_date);
    }

    const records = await this.prisma.revenueAnalytics.findMany({
      where,
      orderBy: { period_start: 'desc' },
      take: 100,
    });

    const totals = await this.prisma.revenueAnalytics.groupBy({
      by: ['revenue_type'],
      where,
      _sum: { amount: true, transaction_count: true },
    });

    return { records, totals };
  }

  private async getRevenueBreakdown(query: AnalyticsQueryDto) {
    const where: Prisma.RevenueAnalyticsWhereInput = {};
    if (query.organization_id) where.organization_id = query.organization_id;
    if (query.branch_id) where.branch_id = query.branch_id;
    if (query.start_date || query.end_date) {
      where.period_start = {};
      if (query.start_date) where.period_start.gte = new Date(query.start_date);
      if (query.end_date) where.period_start.lte = new Date(query.end_date);
    }

    return this.prisma.revenueAnalytics.groupBy({
      by: ['revenue_type'],
      where,
      _sum: { amount: true, transaction_count: true },
    });
  }

  // ─── Membership Analytics ────────────────────────────────────

  async getMembershipAnalytics(query: MembershipQueryDto) {
    const where: Prisma.MembershipAnalyticsWhereInput = {};
    if (query.organization_id) where.organization_id = query.organization_id;
    if (query.branch_id) where.branch_id = query.branch_id;
    if (query.plan_id) where.plan_id = query.plan_id;
    if (query.start_date || query.end_date) {
      where.period_start = {};
      if (query.start_date) where.period_start.gte = new Date(query.start_date);
      if (query.end_date) where.period_start.lte = new Date(query.end_date);
    }

    const records = await this.prisma.membershipAnalytics.findMany({
      where,
      include: { plan: { select: { name: true, plan_type: true } } },
      orderBy: { period_start: 'desc' },
      take: 100,
    });

    const summary = await this.prisma.membershipAnalytics.aggregate({
      where,
      _sum: {
        total_active: true,
        renewals: true,
        cancellations: true,
        new_signups: true,
      },
      _avg: { churn_rate: true },
    });

    return { records, summary };
  }

  private async getMembershipSummary(query: AnalyticsQueryDto) {
    const where: Prisma.MembershipAnalyticsWhereInput = {};
    if (query.organization_id) where.organization_id = query.organization_id;
    if (query.branch_id) where.branch_id = query.branch_id;

    // Latest period summary
    const latest = await this.prisma.membershipAnalytics.findFirst({
      where,
      orderBy: { period_end: 'desc' },
    });

    return latest;
  }

  // ─── Class Analytics ─────────────────────────────────────────

  async getClassAnalytics(query: ClassQueryDto) {
    const where: Prisma.ClassAnalyticsWhereInput = {};
    if (query.branch_id) where.branch_id = query.branch_id;
    if (query.class_template_id) where.class_template_id = query.class_template_id;
    if (query.start_date || query.end_date) {
      where.period_start = {};
      if (query.start_date) where.period_start.gte = new Date(query.start_date);
      if (query.end_date) where.period_start.lte = new Date(query.end_date);
    }

    const records = await this.prisma.classAnalytics.findMany({
      where,
      include: {
        class_template: { select: { name: true, category: true } },
      },
      orderBy: { total_bookings: 'desc' },
      take: 50,
    });

    return records;
  }

  private async getTopClasses(query: AnalyticsQueryDto) {
    const where: Prisma.ClassAnalyticsWhereInput = {};
    if (query.branch_id) where.branch_id = query.branch_id;

    return this.prisma.classAnalytics.findMany({
      where,
      include: {
        class_template: { select: { name: true, category: true } },
      },
      orderBy: { average_attendance: 'desc' },
      take: 5,
    });
  }

  // ─── Member Behavior Analytics ───────────────────────────────

  async getMemberBehavior(query: MemberBehaviorQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.MemberBehaviorAnalyticsWhereInput = {};
    if (query.branch_id) where.branch_id = query.branch_id;
    if (query.churn_risk) where.churn_risk = query.churn_risk;
    if (query.min_engagement !== undefined || query.max_engagement !== undefined) {
      where.engagement_score = {};
      if (query.min_engagement !== undefined) where.engagement_score.gte = query.min_engagement;
      if (query.max_engagement !== undefined) where.engagement_score.lte = query.max_engagement;
    }

    const [records, total] = await Promise.all([
      this.prisma.memberBehaviorAnalytics.findMany({
        where,
        include: {
          member: {
            select: {
              full_name: true,
              email: true,
              phone: true,
              status: true,
              profile_photo_url: true,
            },
          },
        },
        orderBy: { engagement_score: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.memberBehaviorAnalytics.count({ where }),
    ]);

    return { records, total, page, limit };
  }

  async getChurnRiskSummary(branchId?: string) {
    const where: Prisma.MemberBehaviorAnalyticsWhereInput = {};
    if (branchId) where.branch_id = branchId;

    const riskDistribution = await this.prisma.memberBehaviorAnalytics.groupBy({
      by: ['churn_risk'],
      where,
      _count: true,
      _avg: { engagement_score: true },
    });

    return riskDistribution;
  }

  // ─── Trainer Analytics ───────────────────────────────────────

  async getTrainerAnalytics(query: TrainerQueryDto) {
    const where: Prisma.TrainerAnalyticsWhereInput = {};
    if (query.branch_id) where.branch_id = query.branch_id;
    if (query.trainer_id) where.trainer_id = query.trainer_id;
    if (query.start_date || query.end_date) {
      where.period_start = {};
      if (query.start_date) where.period_start.gte = new Date(query.start_date);
      if (query.end_date) where.period_start.lte = new Date(query.end_date);
    }

    const records = await this.prisma.trainerAnalytics.findMany({
      where,
      include: {
        trainer: {
          select: { full_name: true, specializations: true },
        },
      },
      orderBy: { revenue_generated: 'desc' },
      take: 50,
    });

    return records;
  }

  async getTrainerLeaderboard(branchId?: string) {
    const where: Prisma.TrainerAnalyticsWhereInput = {};
    if (branchId) where.branch_id = branchId;

    // Get the most recent period per trainer
    const trainers = await this.prisma.trainerAnalytics.findMany({
      where,
      include: {
        trainer: {
          select: { full_name: true, specializations: true },
        },
      },
      orderBy: [{ period_end: 'desc' }, { revenue_generated: 'desc' }],
      distinct: ['trainer_id'],
      take: 20,
    });

    return trainers;
  }

  // ─── Campaign Analytics ──────────────────────────────────────

  async getCampaignAnalytics(query: CampaignAnalyticsQueryDto) {
    const where: Prisma.CampaignAnalyticsRecordWhereInput = {};
    if (query.campaign_id) where.campaign_id = query.campaign_id;
    if (query.start_date || query.end_date) {
      where.computed_at = {};
      if (query.start_date) where.computed_at.gte = new Date(query.start_date);
      if (query.end_date) where.computed_at.lte = new Date(query.end_date);
    }

    const records = await this.prisma.campaignAnalyticsRecord.findMany({
      where,
      include: {
        campaign: { select: { name: true, segment: true, channels: true, status: true } },
      },
      orderBy: { computed_at: 'desc' },
      take: 50,
    });

    // Summary across all campaigns in range
    const summary = await this.prisma.campaignAnalyticsRecord.aggregate({
      where,
      _sum: {
        sent: true,
        opened: true,
        clicked: true,
        converted: true,
        bounced: true,
        revenue_generated: true,
      },
    });

    const totalSent = summary._sum.sent ?? 0;
    return {
      records,
      summary: {
        ...summary._sum,
        open_rate: totalSent > 0 ? ((summary._sum.opened ?? 0) / totalSent) * 100 : 0,
        click_rate: totalSent > 0 ? ((summary._sum.clicked ?? 0) / totalSent) * 100 : 0,
        conversion_rate: totalSent > 0 ? ((summary._sum.converted ?? 0) / totalSent) * 100 : 0,
      },
    };
  }

  // ─── Branch Comparison ───────────────────────────────────────

  async getBranchComparison(organizationId: string, startDate?: string, endDate?: string) {
    const where: Prisma.DailyGymMetricsWhereInput = {
      organization_id: organizationId,
    };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const comparison = await this.prisma.dailyGymMetrics.groupBy({
      by: ['branch_id'],
      where,
      _sum: {
        total_revenue: true,
        new_members: true,
        total_visits: true,
        classes_held: true,
        products_sold: true,
      },
      _avg: {
        active_members: true,
      },
    });

    // Enrich with branch names
    const branchIds = comparison
      .map((c: { branch_id: string | null }) => c.branch_id)
      .filter((id): id is string => id !== null);
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });
    const branchMap = new Map(branches.map((b: { id: string; name: string }) => [b.id, b.name]));

    return comparison.map((c: { branch_id: string | null }) => ({
      ...c,
      branch_name: c.branch_id ? branchMap.get(c.branch_id) : 'All Branches',
    }));
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private buildDateFilter(query: AnalyticsQueryDto): Prisma.DailyGymMetricsWhereInput {
    const where: Prisma.DailyGymMetricsWhereInput = {};
    if (query.organization_id) where.organization_id = query.organization_id;
    if (query.start_date || query.end_date) {
      where.date = {};
      if (query.start_date) where.date.gte = new Date(query.start_date);
      if (query.end_date) where.date.lte = new Date(query.end_date);
    }
    return where;
  }
}
