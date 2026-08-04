import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../../prisma/tenant-task-runner';
import { CronLockService } from '../../common/services/cron-lock.service';

/**
 * Road B: these crons run off-request with no tenant scope. Each one wraps its
 * per-gym body in `tasks.forEachTenant(...)`, which lists every studio from the
 * REGISTRY and runs the body inside that gym's tenant context (schema resolved
 * from `studios.schema_name`, never derived from `gym_id`). Inside the body,
 * `this.tenant.client.*` is bound to that one gym's physical schema — so the
 * enumeration that used to scan all gyms out of `studio_template` is now a
 * per-gym query. The cron lock still wraps the whole sweep (one runner).
 */
@Injectable()
export class MetricsAggregationJob {
  private readonly logger = new Logger(MetricsAggregationJob.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly tasks: TenantTaskRunner,
    private readonly cronLock: CronLockService,
  ) {}

  // ─── Hourly: Daily Gym Metrics ───────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async aggregateDailyMetrics() {
    await this.cronLock.withLock('cron:daily_metrics', async () => {
      this.logger.log('Aggregating daily gym metrics...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      try {
        const summary = await this.tasks.forEachTenant(async ({ gymId }) => {
          const branches = await this.tenant.client.branch.findMany({
            where: { is_active: true },
            select: { id: true, organization_id: true },
          });
          for (const branch of branches) {
            await this.aggregateBranchDailyMetrics(branch.id, branch.organization_id, gymId, today);
          }
        });

        this.logger.log(`Daily metrics aggregated across ${summary.ok}/${summary.total} gyms`);
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
        this.tenant.client.payment.aggregate({
          where: {
            branch_id: branchId,
            paid_at: { gte: date, lt: nextDay },
            // Payment.status is only ever 'pending' | 'paid' | 'refunded';
            // 'completed' never matched a row.
            status: 'paid',
          },
          _sum: { amount: true },
        }),
        this.tenant.client.member.count({
          where: {
            branch_id: branchId,
            created_at: { gte: date, lt: nextDay },
          },
        }),
        this.tenant.client.member.count({
          where: { branch_id: branchId, status: 'active' },
        }),
        this.tenant.client.checkIn.count({
          where: {
            branch_id: branchId,
            checked_in_at: { gte: date, lt: nextDay },
          },
        }),
        this.tenant.client.classSession.count({
          where: {
            branch_id: branchId,
            start_time: { gte: date, lt: nextDay },
            status: 'completed',
          },
        }),
        this.tenant.client.posSaleItem.aggregate({
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

    // organization_id is nullable and part of the compound unique key: '' is
    // not valid uuid input, and Postgres unique indexes treat NULLs as
    // distinct so an upsert by that key can never match NULL-org rows.
    // findFirst + update/create instead — single writer under the cron lock.
    const metricsData = {
      total_revenue: totalRevenue,
      new_members: newMembers,
      active_members: activeMembers,
      total_visits: visits,
      classes_held: classesHeld,
      products_sold: totalProductsSold,
    };
    const existing = await this.tenant.client.dailyGymMetrics.findFirst({
      where: { organization_id: organizationId, branch_id: branchId, date },
      select: { id: true },
    });
    if (existing) {
      await this.tenant.client.dailyGymMetrics.update({
        where: { id: existing.id },
        data: metricsData,
      });
    } else {
      await this.tenant.client.dailyGymMetrics.create({
        data: {
          gym_id: gymId,
          organization_id: organizationId,
          branch_id: branchId,
          date,
          ...metricsData,
        },
      });
    }
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

        const summary = await this.tasks.forEachTenant(async ({ gymId }) => {
          const branches = await this.tenant.client.branch.findMany({
            where: { is_active: true },
            select: { id: true, organization_id: true },
          });
          for (const branch of branches) {
            await this.aggregateBranchRevenue(branch.id, branch.organization_id, gymId, yesterday, today);
          }
        });

        this.logger.log(`Revenue analytics aggregated across ${summary.ok}/${summary.total} gyms`);
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
    const membershipRevenue = await this.tenant.client.payment.aggregate({
      where: {
        branch_id: branchId,
        paid_at: { gte: periodStart, lt: periodEnd },
        // Payment.status is only ever 'pending' | 'paid' | 'refunded'.
        status: 'paid',
        // Membership revenue = payments tied to a membership; the previous
        // payment_method filter categorized by method, not by what was sold.
        membership_id: { not: null },
      },
      _sum: { amount: true },
      _count: true,
    });

    // PT revenue lives in TrainerRevenue (written when a session completes).
    // The previous query summed ALL payments, double-counting membership.
    const ptRevenue = await this.tenant.client.trainerRevenue.aggregate({
      where: {
        branch_id: branchId,
        created_at: { gte: periodStart, lt: periodEnd },
      },
      _sum: { revenue_amount: true },
      _count: true,
    });

    const retailRevenue = await this.tenant.client.posSale.aggregate({
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
      { type: 'personal_training', amount: ptRevenue._sum?.revenue_amount ?? 0, count: ptRevenue._count ?? 0 },
      { type: 'retail', amount: retailRevenue._sum?.total_amount ?? 0, count: retailRevenue._count ?? 0 },
    ];

    // Same nullable-org compound-key problem as dailyGymMetrics — see there.
    for (const rt of revenueTypes) {
      const existing = await this.tenant.client.revenueAnalytics.findFirst({
        where: {
          organization_id: organizationId,
          branch_id: branchId,
          revenue_type: rt.type,
          period_start: periodStart,
          period_end: periodEnd,
        },
        select: { id: true },
      });
      if (existing) {
        await this.tenant.client.revenueAnalytics.update({
          where: { id: existing.id },
          data: { amount: rt.amount, transaction_count: rt.count },
        });
      } else {
        await this.tenant.client.revenueAnalytics.create({
          data: {
            gym_id: gymId,
            organization_id: organizationId,
            branch_id: branchId,
            revenue_type: rt.type,
            amount: rt.amount,
            transaction_count: rt.count,
            period_start: periodStart,
            period_end: periodEnd,
          },
        });
      }
    }
  }

  // ─── Backfill (scripts/backfill-analytics.ts — never scheduled) ──

  /**
   * Re-aggregates one historical day for every gym/branch: daily metrics,
   * revenue analytics, and membership analytics. Idempotent — re-running a
   * day overwrites that day's rows. Membership counts that are point-in-time
   * (total_active, churn base) reflect the state at RUN time, not the
   * historical date; period-scoped counts (revenue, signups, cancellations)
   * are historically accurate.
   */
  async backfillDay(day: Date) {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.tasks.forEachTenant(async ({ gymId }) => {
      const branches = await this.tenant.client.branch.findMany({
        where: { is_active: true },
        select: { id: true, organization_id: true },
      });
      for (const branch of branches) {
        await this.aggregateBranchDailyMetrics(branch.id, branch.organization_id, gymId, dayStart);
        await this.aggregateBranchRevenue(branch.id, branch.organization_id, gymId, dayStart, nextDay);
        await this.aggregateBranchMembership(branch.id, branch.organization_id, gymId, dayStart, nextDay);
      }
    });
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

        const summary = await this.tasks.forEachTenant(async ({ gymId }) => {
          const branches = await this.tenant.client.branch.findMany({
            where: { is_active: true },
            select: { id: true, organization_id: true },
          });
          for (const branch of branches) {
            await this.aggregateBranchMembership(branch.id, branch.organization_id, gymId, yesterday, today);
          }
        });

        this.logger.log(`Membership analytics aggregated across ${summary.ok}/${summary.total} gyms`);
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
      this.tenant.client.memberMembership.count({
        where: { branch_id: branchId, status: 'active' },
      }),
      this.tenant.client.memberMembership.count({
        where: {
          branch_id: branchId,
          status: 'renewed',
          updated_at: { gte: periodStart, lt: periodEnd },
        },
      }),
      this.tenant.client.memberMembership.count({
        where: {
          branch_id: branchId,
          status: 'cancelled',
          updated_at: { gte: periodStart, lt: periodEnd },
        },
      }),
      this.tenant.client.memberMembership.count({
        where: {
          branch_id: branchId,
          created_at: { gte: periodStart, lt: periodEnd },
        },
      }),
    ]);

    const totalBase = active + cancellations;
    const churnRate = totalBase > 0 ? (cancellations / totalBase) * 100 : 0;

    // Same nullable-org compound-key problem as dailyGymMetrics — see there.
    // plan_id is null for this branch-level rollup ('' was invalid uuid input).
    const analyticsData = {
      total_active: active,
      renewals,
      cancellations,
      new_signups: newSignups,
      churn_rate: churnRate,
    };
    const existing = await this.tenant.client.membershipAnalytics.findFirst({
      where: {
        organization_id: organizationId,
        branch_id: branchId,
        plan_id: null,
        period_start: periodStart,
        period_end: periodEnd,
      },
      select: { id: true },
    });
    if (existing) {
      await this.tenant.client.membershipAnalytics.update({
        where: { id: existing.id },
        data: analyticsData,
      });
    } else {
      await this.tenant.client.membershipAnalytics.create({
        data: {
          gym_id: gymId,
          organization_id: organizationId,
          branch_id: branchId,
          period_start: periodStart,
          period_end: periodEnd,
          ...analyticsData,
        },
      });
    }
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

        const summary = await this.tasks.forEachTenant(async ({ gymId }) => {
          const templates = await this.tenant.client.classTemplate.findMany({
            where: { is_active: true },
            select: { id: true, branch_id: true },
          });
          for (const tmpl of templates) {
            if (!tmpl.branch_id) continue;
            await this.aggregateClassTemplate(tmpl.id, tmpl.branch_id, gymId, weekAgo, today);
          }
        });

        this.logger.log(`Class analytics aggregated across ${summary.ok}/${summary.total} gyms`);
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
    const sessions = await this.tenant.client.classSession.findMany({
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

    await this.tenant.client.classAnalytics.upsert({
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
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const summary = await this.tasks.forEachTenant(async () => {
          const members = await this.tenant.client.member.findMany({
            where: { status: 'active' },
            select: { id: true, branch_id: true, gym_id: true, last_visit_at: true },
          });
          for (const member of members) {
            await this.computeMemberEngagement(member, now, thirtyDaysAgo);
          }
        });

        this.logger.log(`Member behavior aggregated across ${summary.ok}/${summary.total} gyms`);
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
      this.tenant.client.checkIn.count({
        where: {
          member_id: member.id,
          checked_in_at: { gte: thirtyDaysAgo },
        },
      }),
      this.tenant.client.classAttendance.count({
        where: {
          member_id: member.id,
          attendance_status: { in: ['present', 'late'] },
          check_in_time: { gte: thirtyDaysAgo },
        },
      }),
      this.tenant.client.trainerSession.count({
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

    await this.tenant.client.memberBehaviorAnalytics.create({
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

    await this.tenant.client.member.update({
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

        const summary = await this.tasks.forEachTenant(async ({ gymId }) => {
          const trainers = await this.tenant.client.staff.findMany({
            where: {
              status: 'active',
              role: { in: ['trainer', 'senior_trainer', 'head_trainer'] },
            },
            select: { id: true, branch_id: true },
          });
          for (const trainer of trainers) {
            await this.aggregateTrainer(trainer.id, trainer.branch_id, gymId, weekAgo, today);
          }
        });

        this.logger.log(`Trainer analytics aggregated across ${summary.ok}/${summary.total} gyms`);
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
      this.tenant.client.trainerSession.count({
        where: {
          trainer_id: trainerId,
          session_date: { gte: periodStart, lt: periodEnd },
          status: 'completed',
        },
      }),
      this.tenant.client.trainerSession.groupBy({
        by: ['member_id'],
        where: {
          trainer_id: trainerId,
          session_date: { gte: periodStart, lt: periodEnd },
        },
      }),
      this.tenant.client.trainerRevenue.aggregate({
        where: {
          trainer_id: trainerId,
          created_at: { gte: periodStart, lt: periodEnd },
        },
        _sum: { revenue_amount: true },
      }),
    ]);

    // Same nullable-compound-key trap as dailyGymMetrics/membershipAnalytics
    // above: branch_id is `String? @db.Uuid` inside the unique key, so '' is
    // invalid uuid input and a NULL branch can never match by that key anyway.
    const trainerData = {
      sessions_conducted: sessions,
      members_trained: uniqueMembers.length,
      revenue_generated: revenue._sum?.revenue_amount ?? 0,
    };
    const existingTrainer = await this.tenant.client.trainerAnalytics.findFirst({
      where: {
        trainer_id: trainerId,
        branch_id: branchId,
        period_start: periodStart,
        period_end: periodEnd,
      },
      select: { id: true },
    });
    if (existingTrainer) {
      await this.tenant.client.trainerAnalytics.update({
        where: { id: existingTrainer.id },
        data: trainerData,
      });
    } else {
      await this.tenant.client.trainerAnalytics.create({
        data: {
          gym_id: gymId,
          trainer_id: trainerId,
          branch_id: branchId,
          period_start: periodStart,
          period_end: periodEnd,
          ...trainerData,
        },
      });
    }
  }

  // ─── Weekly: Campaign Analytics ──────────────────────────────

  @Cron(CronExpression.EVERY_WEEK)
  async aggregateCampaignAnalytics() {
    await this.cronLock.withLock('cron:campaign_analytics', async () => {
      this.logger.log('Aggregating campaign analytics...');

      try {
        const summary = await this.tasks.forEachTenant(async ({ gymId }) => {
          const campaigns = await this.tenant.client.campaign.findMany({
            where: { status: { in: ['sent', 'completed'] } },
            select: { id: true },
          });
          for (const campaign of campaigns) {
            await this.aggregateCampaign(campaign.id, gymId);
          }
        });

        this.logger.log(`Campaign analytics aggregated across ${summary.ok}/${summary.total} gyms`);
      } catch (error) {
        this.logger.error('Failed to aggregate campaign analytics', error);
      }
    });
  }

  private async aggregateCampaign(campaignId: string, gymId: string) {
    const audience = await this.tenant.client.campaignAudience.groupBy({
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

    await this.tenant.client.campaignAnalyticsRecord.create({
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
