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
  amount_due: number;
  currency: string;
}

export interface SubscriptionRenewalPreview {
  period_start: string;
  period_end: string;
  plan: string;
  plan_display_name: string;
  billing_cycle: 'monthly' | 'annual';
  amount: number;
  currency: string;
  plan_changed: boolean;
  cycle_changed: boolean;
  continuity_mode: 'strict';
  days_lost_to_continuity: number;
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
