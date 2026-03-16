import type { MembershipPlan } from '@/types';

// ─── Membership Plan DTOs ────────────────────────────────────

export interface CreatePlanDto {
  name: string;
  plan_type: MembershipPlan['plan_type'];
  price: number;
  description?: string;
  duration_days?: number;
  total_classes?: number;
  max_classes_per_week?: number;
  max_visits?: number;
  currency?: string;
  multi_branch_access?: boolean;
  grace_period_days?: number;
  auto_renew_enabled?: boolean;
  organization_id?: string;
  branch_id?: string;
}

export type UpdatePlanDto = Partial<CreatePlanDto> & { is_active?: boolean };

// ─── Plan Filters ────────────────────────────────────────────

export interface PlanFilters {
  branch_id?: string;
  plan_type?: string;
  is_active?: string;
}

// ─── Membership Assignment ───────────────────────────────────

export interface AssignMembershipDto {
  plan_id: string;
  branch_id: string;
  start_date?: string;
  auto_renew?: boolean;
  payment_method?: string;
}

// ─── Membership Freeze ──────────────────────────────────────

export interface FreezeMembershipDto {
  start_date: string;
  end_date: string;
  reason?: string;
}

// ─── Membership Renew ───────────────────────────────────────

export interface RenewMembershipDto {
  plan_id: string;
  payment_method: string;
}

// ─── Membership Upgrade / Downgrade (uses renew with new plan) ──

export interface ChangePlanDto {
  plan_id: string;
  payment_method?: string;
  prorate?: boolean;
}

// ─── Membership Cancellation ─────────────────────────────────

export interface CancelMembershipDto {
  reason?: string;
  cancel_at_period_end?: boolean;
}

// ─── Extended MemberMembership with all backend statuses ────

export type MembershipStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'frozen'
  | 'expired'
  | 'cancelled'
  | 'renewed';

// ─── Subscription Summary (for dashboard / analytics) ──────

export interface SubscriptionMetrics {
  active_subscriptions: number;
  mrr: number;
  expiring_this_month: number;
  cancelled_this_month: number;
  trial_members: number;
  churn_rate: number;
  plan_distribution: Array<{
    plan_name: string;
    plan_id: string;
    count: number;
    revenue: number;
  }>;
}

// ─── Plan with active member count (from list endpoint) ─────

export interface MembershipPlanWithStats extends MembershipPlan {
  _count?: { memberships: number };
}
