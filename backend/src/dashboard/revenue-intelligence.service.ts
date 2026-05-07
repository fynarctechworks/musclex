import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';

/**
 * Wave 10 — Revenue Intelligence.
 *
 * Owns the four revenue-mix queries used by the Wave 10 tiles:
 *   - getRevenueMixByPlan
 *   - getRevenueMixByTrainer
 *   - getPaymentMethodBreakdown
 *   - getRefundsDiscountsSummary
 *
 * Extracted from DashboardService per code-review item #5 to keep the
 * core service focused on the original Wave 1–7 surfaces.
 *
 * Security: trainer payloads explicitly select-list only safe fields —
 * `staff.salary` is never returned (TRD §6 / CLAUDE.md).
 */

export interface DateRange {
  from: Date;
  to: Date;
}

export interface RevenueMixItem {
  plan_id?: string;
  plan_name?: string;
  plan_type?: 'monthly' | 'quarterly' | 'annual' | 'pt_package' | 'addon';
  trainer_id?: string;
  trainer_name?: string;
  sessions_count?: number;
  member_count?: number;
  revenue_amount: number;
  share_pct: number;
  delta_pct: number;
}

export interface PaymentMethodItem {
  method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'razorpay' | 'stripe';
  count: number;
  amount: number;
  share_pct: number;
}

export interface RevenueSummary {
  refunds: { count: number; amount: number };
  discounts: { count: number; amount: number };
  tax_collected: number;
  net_revenue: number;
  period_delta: {
    refunds_pct: number;
    discounts_pct: number;
    tax_pct: number;
    net_revenue_pct: number;
  };
}

interface CacheEntry<T> {
  expires_at: number;
  data: T;
}

const CACHE_TTL_MS = 60_000;

@Injectable()
export class RevenueIntelligenceService {
  constructor(private prisma: PrismaService) {}

  private cache = new Map<string, CacheEntry<unknown>>();

  // ─── Helpers (private — local to this service) ───────────────

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expires_at < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  private setCached<T>(key: string, data: T): T {
    this.cache.set(key, { expires_at: Date.now() + CACHE_TTL_MS, data });
    return data;
  }

  private buildCacheKey(prefix: string, parts: Array<string | undefined>): string {
    return `${prefix}:${parts.map((p) => p ?? '*').join('|')}`;
  }

  private resolveDateRange(range?: DateRange): DateRange {
    if (range?.from && range?.to) return range;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to: now };
  }

  private getPreviousRange({ from, to }: DateRange): DateRange {
    const span = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - span);
    return { from: prevFrom, to: prevTo };
  }

  private branchScopeFilter(
    user?: JwtPayload,
    branchId?: string,
  ): { branch_id?: string | { in: string[] } } {
    if (branchId) return { branch_id: branchId };
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) return { branch_id: { in: user.branch_ids } };
    return {};
  }

  private branchScopeKey(user?: JwtPayload, branchId?: string): string {
    if (branchId) return `b:${branchId}`;
    const f = this.branchScopeFilter(user);
    if (!f.branch_id) return 'b:all';
    if (typeof f.branch_id === 'string') return `b:${f.branch_id}`;
    return `b:${[...f.branch_id.in].sort().join(',')}`;
  }

  private mapPlanType(
    raw: string | null | undefined,
  ): 'monthly' | 'quarterly' | 'annual' | 'pt_package' | 'addon' {
    switch (raw) {
      case 'monthly':
        return 'monthly';
      case 'quarterly':
        return 'quarterly';
      case 'half_yearly':
      case 'yearly':
        return 'annual';
      case 'class_pack':
        return 'pt_package';
      default:
        return 'addon';
    }
  }

  // ─── Public API ──────────────────────────────────────────────

  async getRevenueMixByPlan(
    user?: JwtPayload,
    branchId?: string,
    dateRange?: DateRange,
  ): Promise<RevenueMixItem[]> {
    const range = this.resolveDateRange(dateRange);
    const cacheKey = this.buildCacheKey('rmix:plan', [
      user?.studio_id,
      this.branchScopeKey(user, branchId),
      range.from.toISOString(),
      range.to.toISOString(),
    ]);
    const cached = this.getCached<RevenueMixItem[]>(cacheKey);
    if (cached) return cached;

    const branchFilter = this.branchScopeFilter(user, branchId);
    const prevRange = this.getPreviousRange(range);

    const [currentPayments, prevPayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          status: 'paid',
          paid_at: { gte: range.from, lte: range.to },
          ...branchFilter,
        },
        select: {
          amount: true,
          member_id: true,
          membership: { select: { plan: { select: { id: true, name: true, plan_type: true } } } },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: 'paid',
          paid_at: { gte: prevRange.from, lte: prevRange.to },
          ...branchFilter,
        },
        select: {
          amount: true,
          membership: { select: { plan: { select: { id: true } } } },
        },
      }),
    ]);

    const grouped = new Map<
      string,
      { plan_id: string; plan_name: string; plan_type: string; revenue: number; members: Set<string> }
    >();
    for (const p of currentPayments) {
      const plan = p.membership?.plan;
      const planId = plan?.id ?? 'addon';
      const planName = plan?.name ?? 'Add-ons / Other';
      const planType = plan?.plan_type ?? 'addon';
      const existing =
        grouped.get(planId) ??
        { plan_id: planId, plan_name: planName, plan_type: planType, revenue: 0, members: new Set<string>() };
      existing.revenue += Number(p.amount);
      if (p.member_id) existing.members.add(p.member_id);
      grouped.set(planId, existing);
    }

    const prevByPlan = new Map<string, number>();
    for (const p of prevPayments) {
      const planId = p.membership?.plan?.id ?? 'addon';
      prevByPlan.set(planId, (prevByPlan.get(planId) ?? 0) + Number(p.amount));
    }

    const totalRevenue = Array.from(grouped.values()).reduce((s, r) => s + r.revenue, 0);

    const result: RevenueMixItem[] = Array.from(grouped.values())
      .map((row) => {
        const prev = prevByPlan.get(row.plan_id) ?? 0;
        const delta_pct =
          prev > 0
            ? Math.round(((row.revenue - prev) / prev) * 1000) / 10
            : row.revenue > 0
              ? 100
              : 0;
        return {
          plan_id: row.plan_id,
          plan_name: row.plan_name,
          plan_type: this.mapPlanType(row.plan_type),
          revenue_amount: Math.round(row.revenue * 100) / 100,
          member_count: row.members.size,
          share_pct:
            totalRevenue > 0 ? Math.round((row.revenue / totalRevenue) * 1000) / 10 : 0,
          delta_pct,
        };
      })
      .sort((a, b) => b.revenue_amount - a.revenue_amount);

    return this.setCached(cacheKey, result);
  }

  async getRevenueMixByTrainer(
    user?: JwtPayload,
    branchId?: string,
    dateRange?: DateRange,
  ): Promise<RevenueMixItem[]> {
    const range = this.resolveDateRange(dateRange);
    const cacheKey = this.buildCacheKey('rmix:trainer', [
      user?.studio_id,
      this.branchScopeKey(user, branchId),
      range.from.toISOString(),
      range.to.toISOString(),
    ]);
    const cached = this.getCached<RevenueMixItem[]>(cacheKey);
    if (cached) return cached;

    const branchFilter = this.branchScopeFilter(user, branchId);
    const prevRange = this.getPreviousRange(range);

    const [current, prev] = await Promise.all([
      this.prisma.trainerRevenue.findMany({
        where: {
          created_at: { gte: range.from, lte: range.to },
          ...branchFilter,
        },
        select: {
          revenue_amount: true,
          trainer_id: true,
          session_id: true,
          // SECURITY: select only safe fields — never staff.salary (TRD §6).
          trainer: { select: { id: true, full_name: true } },
        },
      }),
      this.prisma.trainerRevenue.findMany({
        where: {
          created_at: { gte: prevRange.from, lte: prevRange.to },
          ...branchFilter,
        },
        select: {
          revenue_amount: true,
          trainer_id: true,
        },
      }),
    ]);

    const grouped = new Map<
      string,
      { trainer_id: string; trainer_name: string; revenue: number; sessions: Set<string> }
    >();
    for (const row of current) {
      const id = row.trainer_id;
      const existing =
        grouped.get(id) ??
        {
          trainer_id: id,
          trainer_name: row.trainer?.full_name ?? 'Unknown',
          revenue: 0,
          sessions: new Set<string>(),
        };
      existing.revenue += Number(row.revenue_amount);
      if (row.session_id) existing.sessions.add(row.session_id);
      grouped.set(id, existing);
    }

    const prevByTrainer = new Map<string, number>();
    for (const r of prev) {
      prevByTrainer.set(
        r.trainer_id,
        (prevByTrainer.get(r.trainer_id) ?? 0) + Number(r.revenue_amount),
      );
    }

    const total = Array.from(grouped.values()).reduce((s, r) => s + r.revenue, 0);

    const result: RevenueMixItem[] = Array.from(grouped.values())
      .map((r) => {
        const prevVal = prevByTrainer.get(r.trainer_id) ?? 0;
        const delta_pct =
          prevVal > 0
            ? Math.round(((r.revenue - prevVal) / prevVal) * 1000) / 10
            : r.revenue > 0
              ? 100
              : 0;
        return {
          trainer_id: r.trainer_id,
          trainer_name: r.trainer_name,
          sessions_count: r.sessions.size,
          revenue_amount: Math.round(r.revenue * 100) / 100,
          share_pct: total > 0 ? Math.round((r.revenue / total) * 1000) / 10 : 0,
          delta_pct,
        };
      })
      .sort((a, b) => b.revenue_amount - a.revenue_amount);

    return this.setCached(cacheKey, result);
  }

  async getPaymentMethodBreakdown(
    user?: JwtPayload,
    branchId?: string,
    dateRange?: DateRange,
  ): Promise<PaymentMethodItem[]> {
    const range = this.resolveDateRange(dateRange);
    const cacheKey = this.buildCacheKey('pmethod', [
      user?.studio_id,
      this.branchScopeKey(user, branchId),
      range.from.toISOString(),
      range.to.toISOString(),
    ]);
    const cached = this.getCached<PaymentMethodItem[]>(cacheKey);
    if (cached) return cached;

    const branchFilter = this.branchScopeFilter(user, branchId);

    const groups = await this.prisma.payment.groupBy({
      by: ['payment_method'],
      where: {
        status: 'paid',
        paid_at: { gte: range.from, lte: range.to },
        ...branchFilter,
      },
      _count: { _all: true },
      _sum: { amount: true },
    });

    const totalAmount = groups.reduce((s, g) => s + Number(g._sum.amount || 0), 0);

    const allowed: PaymentMethodItem['method'][] = [
      'cash',
      'card',
      'upi',
      'bank_transfer',
      'razorpay',
      'stripe',
    ];

    const result: PaymentMethodItem[] = groups
      .filter((g) => allowed.includes(g.payment_method as PaymentMethodItem['method']))
      .map((g) => {
        const amt = Number(g._sum.amount || 0);
        return {
          method: g.payment_method as PaymentMethodItem['method'],
          count: g._count._all,
          amount: Math.round(amt * 100) / 100,
          share_pct: totalAmount > 0 ? Math.round((amt / totalAmount) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return this.setCached(cacheKey, result);
  }

  async getRefundsDiscountsSummary(
    user?: JwtPayload,
    branchId?: string,
    dateRange?: DateRange,
  ): Promise<RevenueSummary> {
    const range = this.resolveDateRange(dateRange);
    const cacheKey = this.buildCacheKey('rsummary', [
      user?.studio_id,
      this.branchScopeKey(user, branchId),
      range.from.toISOString(),
      range.to.toISOString(),
    ]);
    const cached = this.getCached<RevenueSummary>(cacheKey);
    if (cached) return cached;

    const branchFilter = this.branchScopeFilter(user, branchId);
    const prevRange = this.getPreviousRange(range);

    // Refunds don't carry branch_id directly — scope through their parent payment.
    const refundBranchFilter: { payment?: { branch_id: string | { in: string[] } } } =
      branchFilter.branch_id
        ? { payment: { branch_id: branchFilter.branch_id } }
        : {};

    const [
      grossRevenue,
      refundCount,
      refundAggregate,
      invoiceAggregate,
      prevGross,
      prevRefundAggregate,
      prevInvoiceAggregate,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: 'paid',
          paid_at: { gte: range.from, lte: range.to },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),
      this.prisma.refund.count({
        where: {
          status: 'processed',
          processed_at: { gte: range.from, lte: range.to },
          ...refundBranchFilter,
        },
      }),
      this.prisma.refund.aggregate({
        where: {
          status: 'processed',
          processed_at: { gte: range.from, lte: range.to },
          ...refundBranchFilter,
        },
        _sum: { refund_amount: true },
      }),
      this.prisma.memberInvoice.aggregate({
        where: {
          issued_at: { gte: range.from, lte: range.to },
          ...branchFilter,
        },
        _sum: { discount_amount: true, tax_amount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'paid',
          paid_at: { gte: prevRange.from, lte: prevRange.to },
          ...branchFilter,
        },
        _sum: { amount: true },
      }),
      this.prisma.refund.aggregate({
        where: {
          status: 'processed',
          processed_at: { gte: prevRange.from, lte: prevRange.to },
          ...refundBranchFilter,
        },
        _sum: { refund_amount: true },
      }),
      this.prisma.memberInvoice.aggregate({
        where: {
          issued_at: { gte: prevRange.from, lte: prevRange.to },
          ...branchFilter,
        },
        _sum: { discount_amount: true, tax_amount: true },
      }),
    ]);

    const discountCount = await this.prisma.memberInvoice.count({
      where: {
        issued_at: { gte: range.from, lte: range.to },
        discount_amount: { gt: 0 },
        ...branchFilter,
      },
    });

    const gross = Number(grossRevenue._sum.amount || 0);
    const refundsAmt = Number(refundAggregate._sum.refund_amount || 0);
    const discountsAmt = Number(invoiceAggregate._sum.discount_amount || 0);
    const taxAmt = Number(invoiceAggregate._sum.tax_amount || 0);
    const net = gross - refundsAmt;

    const prevGrossAmt = Number(prevGross._sum.amount || 0);
    const prevRefundsAmt = Number(prevRefundAggregate._sum.refund_amount || 0);
    const prevDiscountsAmt = Number(prevInvoiceAggregate._sum.discount_amount || 0);
    const prevTaxAmt = Number(prevInvoiceAggregate._sum.tax_amount || 0);
    const prevNet = prevGrossAmt - prevRefundsAmt;

    const pctDelta = (curr: number, prev: number): number => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    const result: RevenueSummary = {
      refunds: {
        count: refundCount,
        amount: Math.round(refundsAmt * 100) / 100,
      },
      discounts: {
        count: discountCount,
        amount: Math.round(discountsAmt * 100) / 100,
      },
      tax_collected: Math.round(taxAmt * 100) / 100,
      net_revenue: Math.round(net * 100) / 100,
      period_delta: {
        refunds_pct: pctDelta(refundsAmt, prevRefundsAmt),
        discounts_pct: pctDelta(discountsAmt, prevDiscountsAmt),
        tax_pct: pctDelta(taxAmt, prevTaxAmt),
        net_revenue_pct: pctDelta(net, prevNet),
      },
    };

    return this.setCached(cacheKey, result);
  }
}
