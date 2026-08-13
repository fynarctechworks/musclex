/**
 * Mirror of backend SubscriptionContext + status DTO.
 * Single import location for every subscription-related component.
 */

export type SubscriptionLifecycleStatus =
  | 'active'
  | 'grace_period'
  | 'locked'
  | 'suspended';

export interface SubscriptionContext {
  status: SubscriptionLifecycleStatus;
  plan: string;
  billing_cycle: string;
  expires_at: string | null;
  grace_until: string | null;
  locked_at: string | null;
  days_until_expiry: number | null;
  grace_days_remaining: number | null;
  can_mutate: boolean;
}

export interface SubscriptionStatusResponse {
  subscription: SubscriptionContext;
  plan: {
    name: string;
    display_name: string;
    monthly_price: number;
    annual_price: number;
    billing_cycle: string;
    grace_days: number;
  };
  timeline: {
    subscription_start: string | null;
    next_billing_date: string | null;
    trial_ends_at: string | null;
    grace_until: string | null;
    locked_at: string | null;
    suspended_at: string | null;
  };
  /** GST-inclusive total — the figure the customer will actually be charged. */
  amount_due: number;
  amount_due_subtotal?: number;
  gst_percent?: number;
  gst_label?: string;
  gst_amount?: number;
  currency: string;
  /** Scheduled downgrade / cycle switch, if any — applies at effective_at. */
  pending_change: PendingPlanChange | null;
}

export interface PendingPlanChange {
  target_plan: string;
  target_cycle: 'monthly' | 'annual';
  effective_at: string;
  scheduled_at?: string;
}

export interface SubscriptionRenewalPreview {
  period_start: string;
  period_end: string;
  plan: string;
  plan_display_name: string;
  billing_cycle: 'monthly' | 'annual';
  /** GST-inclusive total — matches the charge to the paisa. */
  amount: number;
  subtotal?: number;
  gst_percent?: number;
  gst_label?: string;
  gst_amount?: number;
  currency: string;
  plan_changed: boolean;
  cycle_changed: boolean;
  /** True when this renewal consumes a previously scheduled plan change. */
  applies_scheduled_change?: boolean;
  continuity_mode: 'strict';
  days_lost_to_continuity: number;
}

/**
 * Server-decided execution mode for a plan change:
 *  - immediate_prorated : upgrade — pay the prorated difference now
 *  - scheduled          : downgrade / cycle switch — applies at period end
 *  - renewal_due        : no active paid period — use the renew checkout
 */
export type PlanChangeMode = 'immediate_prorated' | 'scheduled' | 'renewal_due';

export interface PlanChangePreview {
  mode: PlanChangeMode;
  change_type: 'upgrade' | 'downgrade' | 'cycle_change' | 'lateral';
  current: {
    plan: string;
    display_name: string;
    billing_cycle: 'monthly' | 'annual';
    price: number;
    period_end: string | null;
  };
  target: {
    plan: string;
    display_name: string;
    billing_cycle: 'monthly' | 'annual';
    price: number;
  };
  proration: {
    total_days: number;
    remaining_days: number;
    unused_credit: number;
    remaining_cost: number;
  } | null;
  subtotal: number;
  gst_percent: number;
  gst_label: string;
  gst_amount: number;
  total: number;
  effective_at: string | null;
  currency: string;
  pending_change: PendingPlanChange | null;
}

export interface SubscriptionLockedError {
  statusCode: 403;
  error_code: 'SUBSCRIPTION_LOCKED';
  message: string;
  subscription: {
    status: SubscriptionLifecycleStatus;
    plan: string;
    expires_at: string | null;
    grace_until: string | null;
    locked_at: string | null;
  };
}
