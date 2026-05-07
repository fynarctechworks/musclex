import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CronLockService } from '../../common/services/cron-lock.service';

@Injectable()
export class MetricsAggregationJob {
  private readonly logger = new Logger(MetricsAggregationJob.name);

  constructor(private prisma: PrismaService, private cronLock: CronLockService) {}

  // ─── Hourly: Daily Gym Metrics ───────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async aggregateDailyMetrics() {
    await this.cronLock.withLock('cron:daily_metrics', async () => {
      this.logger.log('Aggregating daily gym metrics...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      try {
        const branches = await this.prisma.branch.findMany({
          where: { is_active: true },
          select: { id: true, organization_id: true, gym_id: true },
        });

        for (const branch of branches) {
          await this.aggregateBranchDailyMetrics(branch.id, branch.organization_id, branch.gym_id, today);
        }

        this.logger.log(`Daily metrics aggregated for ${branches.length} branches`);
      } catch (error) {
        this.logger.error('Failed to aggregate daily metrics', error);
      }
    });
  }

  private async aggregateBranchDailyMetrics(
    branchId: string,
    organizationId: string | null,
    gymId: string,
    date: Date,
  ) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const [revenue, newMembers, activeMembers, visits, classesHeld, productsSold] =
      await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            branch_id: branchId,
            paid_at: { gte: date, lt: nextDay },
            status: 'completed',
          },
          _sum: { amount: true },
        }),
        this.prisma.member.count({
          where: {
            branch_id: branchId,
            created_at: { gte: date, lt: nextDay },
          },
        }),
        this.prisma.member.count({
          where: { branch_id: branchId, status: 'active' },
        }),
        this.prisma.checkIn.count({
          where: {
            branch_id: branchId,
            checked_in_at: { gte: date, lt: nextDay },
          },
        }),
        this.prisma.classSession.count({
          where: {
            branch_id: branchId,
            start_time: { gte: date, lt: nextDay },
            status: 'completed',
          },
        }),
        this.prisma.posSaleItem.aggregate({
          where: {
            sale: {
              branch_id: branchId,
              created_at: { gte: date, lt: nextDay },
              status: 'completed',
            },
          },
          _sum: { quantity: true },
        }),
      ]);

    const totalRevenue = revenue._sum?.amount ?? 0;
    const totalProductsSold = productsSold._sum?.quantity ?? 0;

    await this.prisma.dailyGymMetrics.upsert({
      where: {
        organization_id_branch_id_date: {
          organization_id: organizationId ?? '',
          branch_id: branchId,
          date,
        },
      },
      create: {
        gym_id: gymId,
        organization_id: organizationId,
        branch_id: branchId,
        date,
        total_revenue: totalRevenue,
        new_members: newMembers,
        active_members: activeMembers,
        total_visits: visits,
        classes_held: classesHeld,
        products_sold: totalProductsSold,
      },
      update: {
        total_revenue: totalRevenue,
        new_members: newMembers,
        active_members: activeMembers,
        total_visits: visits,
        classes_held: classesHeld,
        products_sold: totalProductsSold,
      },
    });
  }

  // ─── Nightly: Revenue Analytics ──────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async aggregateRevenueAnalytics() {
    await this.cronLock.withLock('cron:revenue_analytics', async () => {
      this.logger.log('Aggregating revenue analytics...');

      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const branches = await this.prisma.branch.findMany({
          where: { is_active: true },
          select: { id: true, organization_id: true, gym_id: true },
        });

        for (const branch of branches) {
          await this.aggregateBranchRevenue(branch.id, branch.organization_id, branch.gym_id, yesterday, today);
        }

        this.logger.log(`Revenue analytics aggregated for ${branches.length} branches`);
      } catch (error) {
        this.logger.error('Failed to aggregate revenue analytics', error);
      }
    });
  }

  private async aggregateBranchRevenue(
    branchId: string,
    organizationId: string | null,
    gymId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const membershipRevenue = await this.prisma.payment.aggregate({
      where: {
        branch_id: branchId,
        paid_at: { gte: periodStart, lt: periodEnd },
        status: 'completed',
        payment_method: { in: ['card', 'upi', 'cash'] },
      },
      _sum: { amount: true },
      _count: true,
    });

    const ptRevenue = await this.prisma.payment.aggregate({
      where: {
        branch_id: branchId,
        paid_at: { gte: periodStart, lt: periodEnd },
        status: 'completed',
      },
      _sum: { amount: true },
      _count: true,
    });

    const retailRevenue = await this.prisma.posSale.aggregate({
      where: {
        branch_id: branchId,
        created_at: { gte: periodStart, lt: periodEnd },
        status: 'completed',
      },
      _sum: { total_amount: true },
      _count: true,
    });

    const revenueTypes = [
      { type: 'membership', amount: membershipRevenue._sum?.amount ?? 0, count: membershipRevenue._count ?? 0 },
      { type: 'personal_training', amount: ptRevenue._sum?.amount ?? 0, count: ptRevenue._count ?? 0 },
      { type: 'retail', amount: retailRevenue._sum?.total_amount ?? 0, count: retailRevenue._count ?? 0 },
    ];

    for (const rt of revenueTypes) {
      await this.prisma.revenueAnalytics.upsert({
        where: {
          organization_id_branch_id_revenue_type_period_start_period_end: {
            organization_id: organizationId ?? '',
            branch_id: branchId,
            revenue_type: rt.type,
            period_start: periodStart,
            period_end: periodEnd,
          },
        },
        create: {
          gym_id: gymId,
          organization_id: organizationId,
          branch_id: branchId,
          revenue_type: rt.type,
          amount: rt.amount,
          transaction_count: rt.count,
          period_start: periodStart,
          period_end: periodEnd,
        },
        update: {
          amount: rt.amount,
          transaction_count: rt.count,
        },
      });
    }
  }

  // ─── Nightly: Membership Analytics ───────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async aggregateMembershipAnalytics() {
    await this.cronLock.withLock('cron:membership_analytics', async () => {
      this.logger.log('Aggregating membership analytics...');

      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const branches = await this.prisma.branch.findMany({
          where: { is_active: true },
          select: { id: true, organization_id: true, gym_id: true },
        });

        for (const branch of branches) {
          await this.aggregateBranchMembership(branch.id, branch.organization_id, branch.gym_id, yesterday, today);
        }

        this.logger.log(`Membership analytics aggregated for ${branches.length} branches`);
      } catch (error) {
        this.logger.error('Failed to aggregate membership analytics', error);
      }
    });
  }

  private async aggregateBranchMembership(
    branchId: string,
    organizationId: string | null,
    gymId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const [active, renewals, cancellations, newSignups] = await Promise.all([
      this.prisma.memberMembership.count({
        where: { branch_id: branchId, status: 'active' },
      }),
      this.prisma.memberMembership.count({
        where: {
          branch_id: branchId,
          status: 'renewed',
          updated_at: { gte: periodStart, lt: periodEnd },
        },
      }),
      this.prisma.memberMembership.count({
        where: {
          branch_id: branchId,
          status: 'cancelled',
          updated_at: { gte: periodStart, lt: periodEnd },
        },
      }),
      this.prisma.memberMembership.count({
        where: {
          branch_id: branchId,
          created_at: { gte: periodStart, lt: periodEnd },
        },
      }),
    ]);

    const totalBase = active + cancellations;
    const churnRate = totalBase > 0 ? (cancellations / totalBase) * 100 : 0;

    await this.prisma.membershipAnalytics.upsert({
      where: {
        organization_id_branch_id_plan_id_period_start_period_end: {
          organization_id: organizationId ?? '',
          branch_id: branchId,
          plan_id: '',
          period_start: periodStart,
          period_end: periodEnd,
        },
      },
      create: {
        gym_id: gymId,
        organization_id: organizationId,
        branch_id: branchId,
        total_active: active,
        renewals,
        cancellations,
        new_signups: newSignups,
        churn_rate: churnRate,
        period_start: periodStart,
        period_end: periodEnd,
      },
      update: {
        total_active: active,
        renewals,
        cancellations,
        new_signups: newSignups,
        churn_rate: churnRate,
      },
    });
  }

  // ─── Nightly: Class Analytics ────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async aggregateClassAnalytics() {
    await this.cronLock.withLock('cron:class_analytics', async () => {
      this.logger.log('Aggregating class analytics...');

      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const templates = await this.prisma.classTemplate.findMany({
          where: { is_active: true },
          select: { id: true, branch_id: true, gym_id: true },
        });

        for (const tmpl of templates) {
          if (!tmpl.branch_id) continue;
          await this.aggregateClassTemplate(tmpl.id, tmpl.branch_id, tmpl.gym_id, weekAgo, today);
        }

        this.logger.log(`Class analytics aggregated for ${templates.length} templates`);
      } catch (error) {
        this.logger.error('Failed to aggregate class analytics', error);
      }
    });
  }

  private async aggregateClassTemplate(
    templateId: string,
    branchId: string,
    gymId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const sessions = await this.prisma.classSession.findMany({
      where: {
        template_id: templateId,
        branch_id: branchId,
        start_time: { gte: periodStart, lt: periodEnd },
      },
      include: {
        attendance: true,
      },
    });

    const totalSessions = sessions.length;
    if (totalSessions === 0) return;

    let totalBookings = 0;
    let totalAttended = 0;
    let totalCapacity = 0;
    let noShows = 0;

    for (const session of sessions) {
      const attended = session.attendance.filter((a) => a.attendance_status === 'present' || a.attendance_status === 'late').length;
      const absent = session.attendance.filter((a) => a.attendance_status === 'no_show').length;
      totalAttended += attended;
      totalBookings += session.attendance.length;
      noShows += absent;
      totalCapacity += session.capacity ?? 0;
    }

    const avgAttendance = totalSessions > 0 ? totalAttended / totalSessions : 0;
    const noShowRate = totalBookings > 0 ? (noShows / totalBookings) * 100 : 0;
    const occupancyRate = totalCapacity > 0 ? (totalAttended / totalCapacity) * 100 : 0;

    await this.prisma.classAnalytics.upsert({
      where: {
        class_template_id_branch_id_period_start_period_end: {
          class_template_id: templateId,
          branch_id: branchId,
          period_start: periodStart,
          period_end: periodEnd,
        },
      },
      create: {
        gym_id: gymId,
        class_template_id: templateId,
        branch_id: branchId,
        total_sessions: totalSessions,
        total_bookings: totalBookings,
        average_attendance: avgAttendance,
        no_show_rate: noShowRate,
        occupancy_rate: occupancyRate,
        period_start: periodStart,
        period_end: periodEnd,
      },
      update: {
        total_sessions: totalSessions,
        total_bookings: totalBookings,
        average_attendance: avgAttendance,
        no_show_rate: noShowRate,
        occupancy_rate: occupancyRate,
      },
    });
  }

  // ─── Nightly: Member Behavior / Engagement ───────────────────

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async aggregateMemberBehavior() {
    await this.cronLock.withLock('cron:member_behavior', async () => {
      this.logger.log('Aggregating member behavior analytics...');

      try {
        const members = await this.prisma.member.findMany({
          where: { status: 'active' },
          select: { id: true, branch_id: true, gym_id: true, last_visit_at: true },
        });

        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        for (const member of members) {
          await this.computeMemberEngagement(member, now, thirtyDaysAgo);
        }

        this.logger.log(`Member behavior aggregated for ${members.length} members`);
      } catch (error) {
        this.logger.error('Failed to aggregate member behavior', error);
      }
    });
  }

  private async computeMemberEngagement(
    member: { id: string; branch_id: string; gym_id: string; last_visit_at: Date | null },
    now: Date,
    thirtyDaysAgo: Date,
  ) {
    const [visits, classesAttended, ptSessions] = await Promise.all([
      this.prisma.checkIn.count({
        where: {
          member_id: member.id,
          checked_in_at: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.classAttendance.count({
        where: {
          member_id: member.id,
          attendance_status: { in: ['present', 'late'] },
          check_in_time: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.trainerSession.count({
        where: {
          member_id: member.id,
          status: 'completed',
          session_date: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const visitFrequency = visits / 4.3;
    const daysSinceVisit = member.last_visit_at
      ? Math.floor((now.getTime() - new Date(member.last_visit_at).getTime()) / 86400000)
      : 999;

    let score = 0;
    score += Math.min(visitFrequency * 15, 45);
    score += Math.min(classesAttended * 5, 25);
    score += Math.min(ptSessions * 10, 20);
    if (daysSinceVisit <= 3) score += 10;
    score = Math.min(Math.round(score), 100);

    let churnRisk = 'low';
    if (daysSinceVisit >= 30 || score < 15) churnRisk = 'critical';
    else if (daysSinceVisit >= 14 || score < 30) churnRisk = 'high';
    else if (daysSinceVisit >= 7 || score < 50) churnRisk = 'medium';

    const computedAt = new Date();

    await this.prisma.memberBehaviorAnalytics.create({
      data: {
        gym_id: member.gym_id,
        member_id: member.id,
        branch_id: member.branch_id,
        visit_frequency: visitFrequency,
        classes_attended: classesAttended,
        pt_sessions: ptSessions,
        last_visit_date: member.last_visit_at,
        days_since_visit: daysSinceVisit,
        engagement_score: score,
        churn_risk: churnRisk,
        computed_at: computedAt,
      },
    });

    await this.prisma.member.update({
      where: { id: member.id },
      data: { engagement_score: score, churn_risk: churnRisk },
    });
  }

  // ─── Nightly: Trainer Analytics ──────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async aggregateTrainerAnalytics() {
    await this.cronLock.withLock('cron:trainer_analytics', async () => {
      this.logger.log('Aggregating trainer analytics...');

      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const trainers = await this.prisma.staff.findMany({
          where: {
            status: 'active',
            role: { in: ['trainer', 'senior_trainer', 'head_trainer'] },
          },
          select: { id: true, branch_id: true, gym_id: true },
        });

        for (const trainer of trainers) {
          await this.aggregateTrainer(trainer.id, trainer.branch_id, trainer.gym_id, weekAgo, today);
        }

        this.logger.log(`Trainer analytics aggregated for ${trainers.length} trainers`);
      } catch (error) {
        this.logger.error('Failed to aggregate trainer analytics', error);
      }
    });
  }

  private async aggregateTrainer(
    trainerId: string,
    branchId: string | null,
    gymId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const [sessions, uniqueMembers, revenue] = await Promise.all([
      this.prisma.trainerSession.count({
        where: {
          trainer_id: trainerId,
          session_date: { gte: periodStart, lt: periodEnd },
          status: 'completed',
        },
      }),
      this.prisma.trainerSession.groupBy({
        by: ['member_id'],
        where: {
          trainer_id: trainerId,
          session_date: { gte: periodStart, lt: periodEnd },
        },
      }),
      this.prisma.trainerRevenue.aggregate({
        where: {
          trainer_id: trainerId,
          created_at: { gte: periodStart, lt: periodEnd },
        },
        _sum: { revenue_amount: true },
      }),
    ]);

    await this.prisma.trainerAnalytics.upsert({
      where: {
        trainer_id_branch_id_period_start_period_end: {
          trainer_id: trainerId,
          branch_id: branchId ?? '',
          period_start: periodStart,
          period_end: periodEnd,
        },
      },
      create: {
        gym_id: gymId,
        trainer_id: trainerId,
        branch_id: branchId,
        sessions_conducted: sessions,
        members_trained: uniqueMembers.length,
        revenue_generated: revenue._sum?.revenue_amount ?? 0,
        period_start: periodStart,
        period_end: periodEnd,
      },
      update: {
        sessions_conducted: sessions,
        members_trained: uniqueMembers.length,
        revenue_generated: revenue._sum?.revenue_amount ?? 0,
      },
    });
  }

  // ─── Weekly: Campaign Analytics ──────────────────────────────

  @Cron(CronExpression.EVERY_WEEK)
  async aggregateCampaignAnalytics() {
    await this.cronLock.withLock('cron:campaign_analytics', async () => {
      this.logger.log('Aggregating campaign analytics...');

      try {
        const campaigns = await this.prisma.campaign.findMany({
          where: { status: { in: ['sent', 'completed'] } },
          select: { id: true, gym_id: true },
        });

        for (const campaign of campaigns) {
          await this.aggregateCampaign(campaign.id, campaign.gym_id);
        }

        this.logger.log(`Campaign analytics aggregated for ${campaigns.length} campaigns`);
      } catch (error) {
        this.logger.error('Failed to aggregate campaign analytics', error);
      }
    });
  }

  private async aggregateCampaign(campaignId: string, gymId: string) {
    const audience = await this.prisma.campaignAudience.groupBy({
      by: ['status'],
      where: { campaign_id: campaignId },
      _count: { _all: true },
    });

    const statusMap = new Map(audience.map((a) => [a.status, a._count._all]));

    const sent = Number(statusMap.get('sent') ?? 0) +
                 Number(statusMap.get('delivered') ?? 0) +
                 Number(statusMap.get('opened') ?? 0) +
                 Number(statusMap.get('clicked') ?? 0);
    const opened = Number(statusMap.get('opened') ?? 0) + Number(statusMap.get('clicked') ?? 0);
    const clicked = Number(statusMap.get('clicked') ?? 0);
    const bounced = Number(statusMap.get('bounced') ?? 0);

    await this.prisma.campaignAnalyticsRecord.create({
      data: {
        gym_id: gymId,
        campaign_id: campaignId,
        sent,
        opened,
        clicked,
        bounced,
        converted: 0,
      },
    });
  }
}
