import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { JwtPayload } from '../common';

export interface RevenueForecast {
  /** Trailing actuals the projection is built from, oldest first. */
  history: Array<{ month: string; revenue: number }>;
  /** Month currently in progress. */
  current_month: {
    month: string;
    collected_so_far: number;
    /** Run-rate projection for the full month. */
    projected_total: number;
    days_elapsed: number;
    days_in_month: number;
  };
  /** Next month, from trailing average + trend, tempered by known expiries. */
  next_month: {
    month: string;
    projected: number;
    /** Rough band — this is a run-rate model, not a statistical forecast. */
    range_low: number;
    range_high: number;
  };
  /** Renewals already known to fall due next month. */
  committed_next_month: {
    memberships_expiring: number;
    value_at_risk: number;
  };
  confidence: 'low' | 'medium';
  method: string;
  generated_at: string;
}

/**
 * Revenue forecasting.
 *
 * The dashboard had no forward-looking number at all — `business-metrics`
 * computes trailing MRR/churn/LTV and stops. The AI advisor was asked for
 * "revenue forecast" in the roadmap but had nothing to read.
 *
 * This is deliberately a TRANSPARENT run-rate model, not a black box:
 *   - current month = collected-so-far extrapolated by days elapsed
 *   - next month    = trailing 3-month average, nudged by the month-over-month
 *                     trend, floored at zero
 *   - the band is ±the observed volatility of the trailing months
 *
 * `confidence` is capped at 'medium' on purpose. With a handful of months of
 * history and no seasonality model, claiming 'high' would be dishonest — and
 * the AI advisor surfaces this text to owners.
 */
@Injectable()
export class RevenueForecastService {
  private readonly logger = new Logger(RevenueForecastService.name);
  private static readonly TRAILING_MONTHS = 6;

  constructor(private readonly tenant: TenantPrisma) {}

  private branchFilter(user?: JwtPayload, branchId?: string) {
    if (branchId) return { branch_id: branchId };
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) return { branch_id: { in: user.branch_ids } };
    return {};
  }

  private monthKey(d: Date): string {
    return d.toISOString().slice(0, 7);
  }

  async getForecast(user?: JwtPayload, branchId?: string): Promise<RevenueForecast> {
    const now = new Date();
    const scope = this.branchFilter(user, branchId);

    // Window start: first day of the month TRAILING_MONTHS back.
    const start = new Date(now.getFullYear(), now.getMonth() - RevenueForecastService.TRAILING_MONTHS, 1);

    const payments = await this.tenant.client.payment.findMany({
      where: { ...scope, status: 'paid', paid_at: { gte: start } },
      select: { amount: true, paid_at: true },
    });

    // Bucket by calendar month.
    const byMonth = new Map<string, number>();
    for (const p of payments) {
      if (!p.paid_at) continue;
      const key = this.monthKey(p.paid_at);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(p.amount));
    }

    const currentKey = this.monthKey(now);
    const history: Array<{ month: string; revenue: number }> = [];
    for (let i = RevenueForecastService.TRAILING_MONTHS; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = this.monthKey(d);
      history.push({ month: key, revenue: Math.round(byMonth.get(key) ?? 0) });
    }

    // ── Current month: straight-line run rate on days elapsed ──
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const collected = Math.round(byMonth.get(currentKey) ?? 0);
    const projectedTotal = Math.round((collected / Math.max(daysElapsed, 1)) * daysInMonth);

    // ── Next month: trailing average nudged by trend ──
    // Only use months that actually have data; a gym three months old
    // shouldn't have its average dragged down by three zero months.
    const nonEmpty = history.filter((h) => h.revenue > 0);
    const basis = nonEmpty.slice(-3);
    const avg = basis.length ? basis.reduce((s, h) => s + h.revenue, 0) / basis.length : 0;

    // Month-over-month delta across the basis, damped by half — run-rate
    // trends overshoot badly when extrapolated at full strength.
    let trend = 0;
    if (basis.length >= 2) {
      const deltas: number[] = [];
      for (let i = 1; i < basis.length; i++) {
        deltas.push(basis[i].revenue - basis[i - 1].revenue);
      }
      trend = (deltas.reduce((s, d) => s + d, 0) / deltas.length) * 0.5;
    }

    const nextProjected = Math.max(0, Math.round(avg + trend));

    // Band = observed spread of the basis months, min ±10%.
    const spread = basis.length
      ? Math.max(...basis.map((b) => b.revenue)) - Math.min(...basis.map((b) => b.revenue))
      : 0;
    const halfBand = Math.max(Math.round(spread / 2), Math.round(nextProjected * 0.1));

    // ── Committed: memberships already due to expire next month ──
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const expiring = await this.tenant.client.memberMembership.findMany({
      where: {
        ...scope,
        status: 'active',
        end_date: { gte: nextMonthStart, lt: nextMonthEnd },
      },
      select: { plan: { select: { price: true } } },
    });
    const valueAtRisk = expiring.reduce((s, m) => s + Number(m.plan?.price ?? 0), 0);

    return {
      history,
      current_month: {
        month: currentKey,
        collected_so_far: collected,
        projected_total: projectedTotal,
        days_elapsed: daysElapsed,
        days_in_month: daysInMonth,
      },
      next_month: {
        month: this.monthKey(nextMonthStart),
        projected: nextProjected,
        range_low: Math.max(0, nextProjected - halfBand),
        range_high: nextProjected + halfBand,
      },
      committed_next_month: {
        memberships_expiring: expiring.length,
        value_at_risk: Math.round(valueAtRisk),
      },
      // Two months of history is the floor for saying anything useful.
      confidence: basis.length >= 3 ? 'medium' : 'low',
      method:
        'Run-rate: current month extrapolated by days elapsed; next month = ' +
        '3-month trailing average plus half the observed month-over-month trend. ' +
        'No seasonality modelling — treat as a directional estimate.',
      generated_at: new Date().toISOString(),
    };
  }
}
