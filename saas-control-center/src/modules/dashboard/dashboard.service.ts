import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../config/redis.module';
import { SubscriptionStatus, TenantStatus, PaymentStatus } from '@prisma/client';

const CACHE_TTL = 30; // 30 seconds for dashboard metrics (keep data fresh)

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async getMetrics() {
    const cacheKey = 'dashboard:metrics';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      activeSubscriptions,
      pastDueSubscriptions,
      expiringSoon,
      mrr,
      recentRevenue,
      churnedLastMonth,
      newTenantsLastMonth,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.TRIAL } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED } }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      // Past-due: failed auto-renewals awaiting admin follow-up (C5).
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.PAST_DUE },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          end_date: { lte: sevenDaysFromNow, gte: now },
        },
      }),
      // MRR via SQL aggregate — single round-trip, scales with active sub count.
      // Tables are schema-qualified (scc.*): $queryRaw is NOT auto-qualified like
      // Prisma model queries, and the pgbouncer transaction pooler doesn't keep a
      // session search_path — so an unqualified `subscriptions` 500s with
      // "relation does not exist". (subscription_plans also exists in public, so
      // qualifying additionally pins the join to the correct table.)
      this.prisma.$queryRaw<Array<{ mrr: number | string | null }>>`
        SELECT COALESCE(SUM(p.price_monthly), 0)::float AS mrr
          FROM scc.subscriptions s
          JOIN scc.subscription_plans p ON s.plan_id = p.id
         WHERE s.status = 'ACTIVE'
      `,
      // Revenue last 30 days
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          created_at: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),
      // Churned (expired/canceled) last 30 days
      this.prisma.subscription.count({
        where: {
          status: { in: [SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELED] },
          updated_at: { gte: thirtyDaysAgo },
        },
      }),
      // New tenants last 30 days
      this.prisma.tenant.count({
        where: { created_at: { gte: thirtyDaysAgo } },
      }),
    ]);

    const mrrValue = Number(mrr[0]?.mrr ?? 0);
    const totalAtStartOfMonth = totalTenants - newTenantsLastMonth + churnedLastMonth;
    const churnRate = totalAtStartOfMonth > 0
      ? Math.round((churnedLastMonth / totalAtStartOfMonth) * 10000) / 100
      : 0;

    const result = {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        trial: trialTenants,
        suspended: suspendedTenants,
        new_last_30d: newTenantsLastMonth,
      },
      subscriptions: {
        active: activeSubscriptions,
        past_due: pastDueSubscriptions,
        expiring_soon: expiringSoon,
        churned_last_30d: churnedLastMonth,
      },
      revenue: {
        mrr: mrrValue,
        arr: mrrValue * 12,
        last_30d: Number(recentRevenue._sum.amount || 0),
      },
      churn_rate: churnRate,
    };

    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async clearCache(): Promise<void> {
    await this.redis.del('dashboard:metrics');
  }
}
