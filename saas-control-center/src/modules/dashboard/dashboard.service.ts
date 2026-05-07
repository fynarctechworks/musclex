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
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          end_date: { lte: sevenDaysFromNow, gte: now },
        },
      }),
      // MRR: sum of monthly prices for all active subscriptions
      this.prisma.subscription.findMany({
        where: { status: SubscriptionStatus.ACTIVE },
        include: { plan: { select: { price_monthly: true } } },
      }),
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

    const mrrValue = mrr.reduce((sum, s) => sum + Number(s.plan?.price_monthly || 0), 0);
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
