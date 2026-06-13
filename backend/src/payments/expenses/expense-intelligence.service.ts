import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { ExpenseMetricsService } from './expense-metrics.service';

@Injectable()
export class ExpenseIntelligenceService {
  constructor(
    private readonly tenant: TenantPrisma,
    private readonly metrics: ExpenseMetricsService,
  ) {}

  // ───────────────────────────────────────────────────────────────
  // Profit & Loss — revenue − refunds − expenses
  // ───────────────────────────────────────────────────────────────
  async getProfitLoss(branchId: string, dateFrom?: string, dateTo?: string) {
    const now = new Date();
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = dateTo ? new Date(dateTo) : now;

    const [payments, refunds, expenseMetrics] = await Promise.all([
      this.tenant.client.payment.findMany({
        where: {
          branch_id: branchId,
          status: 'paid',
          paid_at: { gte: from, lte: to },
        },
        select: { amount: true },
      }),
      this.tenant.client.refund.findMany({
        where: {
          payment: { branch_id: branchId },
          status: 'processed',
          processed_at: { gte: from, lte: to },
        },
        select: { refund_amount: true },
      }),
      this.tenant.client.expense.findMany({
        where: {
          branch_id: branchId,
          expense_date: { gte: from, lte: to },
          // skip the pre-reversal "frozen" row (status='reversed', reference_id=null)
          OR: [
            { status: 'confirmed' },
            { reference_id: { not: null } }, // reversal entries themselves
          ],
        },
        select: { amount: true, category: true, category_id: true },
      }),
    ]);

    const revenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const refundTotal = refunds.reduce((s, r) => s + Number(r.refund_amount), 0);
    const expenseTotal = expenseMetrics.reduce((s, e) => s + Number(e.amount), 0);
    const netRevenue = revenue - refundTotal;

    const byCategory = new Map<string, number>();
    for (const e of expenseMetrics) {
      const key = e.category_id ?? e.category ?? 'other';
      byCategory.set(key, (byCategory.get(key) ?? 0) + Number(e.amount));
    }

    return {
      branch_id: branchId,
      period: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      revenue,
      refunds: refundTotal,
      net_revenue: netRevenue,
      expenses: expenseTotal,
      net_profit: netRevenue - expenseTotal,
      margin_percent:
        netRevenue > 0 ? Math.round(((netRevenue - expenseTotal) / netRevenue) * 100) : 0,
      expenses_by_category: Array.from(byCategory.entries()).map(([k, v]) => ({
        category: k,
        total: v,
      })),
    };
  }

  // ───────────────────────────────────────────────────────────────
  // Cashflow prediction — naive but effective moving average + σ
  // ───────────────────────────────────────────────────────────────
  async predictCashflow(branchId: string) {
    const trend = await this.metrics.getMonthlyTrend(branchId, 6);
    if (trend.length === 0) {
      return {
        branch_id: branchId,
        history: [],
        predicted_next_month: 0,
        confidence: 'low' as const,
        anomalies: [] as Array<{ month: string; total: number; z_score: number }>,
      };
    }

    const totals = trend.map((t) => t.total);
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const variance =
      totals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / totals.length;
    const stddev = Math.sqrt(variance);

    // Linear trend (slope of last N points, x=0..n-1)
    const n = totals.length;
    const xMean = (n - 1) / 2;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (totals[i] - mean);
      den += (i - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const predicted = Math.max(0, Math.round(mean + slope * ((n - 1) / 2 + 1)));

    // Anomaly flags: months > 2σ from mean
    const anomalies = trend
      .map((t, i) => ({
        month: t.month,
        total: t.total,
        z_score: stddev === 0 ? 0 : (totals[i] - mean) / stddev,
      }))
      .filter((a) => Math.abs(a.z_score) > 2);

    const confidence: 'high' | 'medium' | 'low' =
      n >= 6 && stddev / (mean || 1) < 0.25
        ? 'high'
        : n >= 3
          ? 'medium'
          : 'low';

    return {
      branch_id: branchId,
      history: trend,
      mean_monthly_burn: Math.round(mean),
      stddev_monthly_burn: Math.round(stddev),
      predicted_next_month: predicted,
      trend_slope: Math.round(slope),
      confidence,
      anomalies,
    };
  }

  // ───────────────────────────────────────────────────────────────
  // Recurring pattern detection
  // Groups by (category_id, vendor-normalized, amount ±5%) and flags
  // patterns that appeared ≥3 distinct months.
  // ───────────────────────────────────────────────────────────────
  async detectRecurringPatterns(branchId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const expenses = await this.tenant.client.expense.findMany({
      where: {
        branch_id: branchId,
        expense_date: { gte: sixMonthsAgo },
        status: 'confirmed',
      },
      select: {
        id: true,
        category_id: true,
        category: true,
        vendor: true,
        description: true,
        amount: true,
        expense_date: true,
      },
    });

    // Bucket: signature = category + vendor-or-desc + rounded amount bucket (±5%)
    const buckets = new Map<
      string,
      {
        category: string | null;
        vendor: string | null;
        description: string;
        amounts: number[];
        months: Set<string>;
        last_expense_id: string;
      }
    >();

    for (const e of expenses) {
      const vendor = (e.vendor ?? '').trim().toLowerCase();
      const descKey = vendor || e.description.trim().toLowerCase().slice(0, 40);
      const amt = Number(e.amount);
      const amtBucket = Math.round(amt / (amt * 0.05 + 1));
      const sig = `${e.category_id ?? e.category ?? ''}::${descKey}::${amtBucket}`;
      const monthKey = e.expense_date.toISOString().slice(0, 7);

      if (!buckets.has(sig)) {
        buckets.set(sig, {
          category: e.category_id ?? e.category,
          vendor: e.vendor,
          description: e.description,
          amounts: [],
          months: new Set(),
          last_expense_id: e.id,
        });
      }
      const b = buckets.get(sig)!;
      b.amounts.push(amt);
      b.months.add(monthKey);
      b.last_expense_id = e.id;
    }

    const recurring = Array.from(buckets.values())
      .filter((b) => b.months.size >= 3)
      .map((b) => {
        const avg = b.amounts.reduce((a, x) => a + x, 0) / b.amounts.length;
        return {
          category: b.category,
          vendor: b.vendor,
          description: b.description,
          average_amount: Math.round(avg),
          months_observed: b.months.size,
          total_spent: Math.round(b.amounts.reduce((a, x) => a + x, 0)),
          last_expense_id: b.last_expense_id,
        };
      })
      .sort((a, b) => b.total_spent - a.total_spent);

    return {
      branch_id: branchId,
      window_months: 6,
      recurring,
    };
  }

  // ───────────────────────────────────────────────────────────────
  // Composite bundle for the frontend Intelligence Panel
  // ───────────────────────────────────────────────────────────────
  async getIntelligenceBundle(branchId: string) {
    const [pl, cashflow, recurring] = await Promise.all([
      this.getProfitLoss(branchId),
      this.predictCashflow(branchId),
      this.detectRecurringPatterns(branchId),
    ]);
    return { profit_loss: pl, cashflow, recurring };
  }
}
