/**
 * Pure proration math for mid-cycle plan changes.
 *
 * Industry-standard model (Stripe/Notion/Slack style):
 *   unused_credit  = current_plan_price × (remaining_days / total_days)
 *   remaining_cost = target_plan_price  × (remaining_days / total_days)
 *   amount_to_pay  = max(0, remaining_cost − unused_credit)
 *
 * Upgrades apply immediately for the prorated difference — the billing date
 * does NOT move, and the next renewal bills the full new-plan price.
 * Downgrades and cycle switches are scheduled for the period boundary
 * (no refunds mid-cycle — standard abuse prevention).
 *
 * Kept dependency-free so the money math is trivially unit-testable.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days in a billing cycle. MUST stay in lockstep with
 * SubscriptionPolicyService.computeNextPeriod (monthly=30, quarterly=90,
 * annual=365) or credit and charge would be computed on different bases.
 */
export function cycleDays(billingCycle: string): number {
  return billingCycle === 'annual' ? 365 : billingCycle === 'quarterly' ? 90 : 30;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ProrationResult {
  total_days: number;
  /** Whole days left in the current period, clamped to [0, total_days]. */
  remaining_days: number;
  /** Value of the unused portion of the CURRENT plan. */
  unused_credit: number;
  /** Cost of the TARGET plan for the remaining days. */
  remaining_cost: number;
  /** What the customer pays now: max(0, remaining_cost − unused_credit). */
  subtotal: number;
}

export function computeProration(params: {
  /** Full-cycle price of the current plan (on the current cycle). */
  current_price: number;
  /** Full-cycle price of the target plan (on the current cycle). */
  target_price: number;
  billing_cycle: string;
  /** End of the already-paid period (studio.next_billing_date). */
  period_end: Date;
  now?: Date;
}): ProrationResult {
  const now = params.now ?? new Date();
  const total_days = cycleDays(params.billing_cycle);
  const remaining_days = Math.min(
    total_days,
    Math.max(0, Math.ceil((params.period_end.getTime() - now.getTime()) / DAY_MS)),
  );

  const unused_credit = round2((params.current_price * remaining_days) / total_days);
  const remaining_cost = round2((params.target_price * remaining_days) / total_days);
  const subtotal = Math.max(0, round2(remaining_cost - unused_credit));

  return { total_days, remaining_days, unused_credit, remaining_cost, subtotal };
}

/**
 * How a requested plan change executes:
 *  - immediate_prorated : upgrade mid-period → charge the prorated difference now
 *  - scheduled          : downgrade / cycle switch → applies at the period boundary
 *  - renewal_due        : no active paid period (expired, grace, locked, no billing
 *                         date) → the change happens through the normal renew flow
 *                         at full price, so proration doesn't apply
 */
export type PlanChangeMode = 'immediate_prorated' | 'scheduled' | 'renewal_due';

export function classifyPlanChange(params: {
  /** Full-cycle price of the current plan on the CURRENT cycle. */
  current_price: number;
  /** Full-cycle price of the target plan on the CURRENT cycle. */
  target_price: number;
  cycle_changed: boolean;
  /** lifecycle ACTIVE and next_billing_date is in the future. */
  in_active_paid_period: boolean;
  remaining_days: number;
}): PlanChangeMode {
  if (!params.in_active_paid_period || params.remaining_days <= 0) return 'renewal_due';
  // A cycle switch restructures the period itself — take effect at the boundary.
  if (params.cycle_changed) return 'scheduled';
  if (params.target_price > params.current_price) return 'immediate_prorated';
  // Downgrade (or equal price): no mid-cycle refunds — schedule for period end.
  return 'scheduled';
}
