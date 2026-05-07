import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../config/redis.module';
import { PaymentStatus } from '@prisma/client';

const ANALYTICS_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  /**
   * Revenue trend: monthly revenue for the past N months.
   * Uses a single raw SQL query with generate_series to avoid N+1.
   */
  async getRevenueTrend(months: number = 12) {
    const cacheKey = `analytics:revenue_trend:${months}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const results = await this.prisma.$queryRaw<Array<{ month: string; revenue: number; count: number }>>`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', NOW()) - (${months - 1} || ' months')::interval,
          date_trunc('month', NOW()),
          '1 month'::interval
        )::date as month_start
      )
      SELECT
        to_char(m.month_start, 'YYYY-MM') as month,
        COALESCE(SUM(p.amount::numeric), 0)::float as revenue,
        COUNT(p.id)::int as count
      FROM months m
      LEFT JOIN payments p ON
        p.status = 'PAID'
        AND p.created_at >= m.month_start
        AND p.created_at < m.month_start + '1 month'::interval
      GROUP BY m.month_start
      ORDER BY m.month_start
    `;

    await this.redis.setex(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(results));
    return results;
  }

  /**
   * Plan distribution: how many tenants on each plan.
   */
  async getPlanDistribution() {
    const cacheKey = 'analytics:plan_distribution';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const plans = await this.prisma.subscriptionPlan.findMany({
      select: {
        id: true,
        name: true,
        price_monthly: true,
        _count: { select: { tenants: true } },
      },
      orderBy: { sort_order: 'asc' },
    });

    const total = plans.reduce((sum, p) => sum + p._count.tenants, 0);

    const result = plans.map((p) => ({
      plan_id: p.id,
      plan_name: p.name,
      price_monthly: Number(p.price_monthly),
      tenant_count: p._count.tenants,
      percentage: total > 0
        ? Math.round((p._count.tenants / total) * 10000) / 100
        : 0,
    }));

    await this.redis.setex(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(result));
    return result;
  }

  /**
   * Growth metrics: tenant signups per month.
   * Uses a single raw SQL query with generate_series to avoid N+1.
   */
  async getGrowthMetrics(months: number = 12) {
    const cacheKey = `analytics:growth_metrics:${months}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const results = await this.prisma.$queryRaw<Array<{ month: string; signups: number; cumulative: number }>>`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', NOW()) - (${months - 1} || ' months')::interval,
          date_trunc('month', NOW()),
          '1 month'::interval
        )::date as month_start
      ),
      monthly_signups AS (
        SELECT
          m.month_start,
          COUNT(t.id)::int as signups
        FROM months m
        LEFT JOIN tenants t ON
          t.created_at >= m.month_start
          AND t.created_at < m.month_start + '1 month'::interval
        GROUP BY m.month_start
      )
      SELECT
        to_char(ms.month_start, 'YYYY-MM') as month,
        ms.signups,
        (SUM(ms.signups) OVER (ORDER BY ms.month_start))::int as cumulative
      FROM monthly_signups ms
      ORDER BY ms.month_start
    `;

    // Add prior count to cumulative
    const priorCount = await this.prisma.tenant.count({
      where: {
        created_at: {
          lt: new Date(new Date().getFullYear(), new Date().getMonth() - months + 1, 1),
        },
      },
    });

    const finalResults = results.map(r => ({
      ...r,
      cumulative: Number(r.cumulative) + priorCount,
    }));

    await this.redis.setex(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(finalResults));
    return finalResults;
  }

  /**
   * Subscription status breakdown.
   */
  async getSubscriptionBreakdown() {
    const grouped = await this.prisma.subscription.groupBy({
      by: ['status'],
      _count: true,
    });

    return grouped.map((g) => ({
      status: g.status,
      count: g._count,
    }));
  }
}
