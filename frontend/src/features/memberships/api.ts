import { apiClient } from '@/services/api-client';
import type { MembershipPlan, MemberMembership } from '@/types';
import type {
  CreatePlanDto,
  UpdatePlanDto,
  PlanFilters,
  AssignMembershipDto,
  FreezeMembershipDto,
  RenewMembershipDto,
  ChangePlanDto,
  CancelMembershipDto,
  MembershipPlanWithStats,
  SubscriptionMetrics,
} from './types';

// ─── Membership Plans API ────────────────────────────────────

export const plansApi = {
  list: (filters?: PlanFilters) =>
    apiClient.get<MembershipPlanWithStats[]>('/membership-plans', { params: filters }),

  getById: (id: string) =>
    apiClient.get<MembershipPlan>(`/membership-plans/${id}`),

  create: (data: CreatePlanDto) =>
    apiClient.post<MembershipPlan>('/membership-plans', data),

  update: (id: string, data: UpdatePlanDto) =>
    apiClient.patch<MembershipPlan>(`/membership-plans/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/membership-plans/${id}`),

  duplicate: (id: string) =>
    apiClient.get<MembershipPlan>(`/membership-plans/${id}`).then((plan) => {
      const { id: _planId, ...rest } = plan as MembershipPlan & Record<string, unknown>;
      void _planId;
      return apiClient.post<MembershipPlan>('/membership-plans', {
        ...rest,
        name: `${plan.name} (Copy)`,
      });
    }),
};

// ─── Member Membership API ───────────────────────────────────

export const memberMembershipsApi = {
  /** Assign a new membership to a member */
  assign: (memberId: string, data: AssignMembershipDto) =>
    apiClient.post<MemberMembership>(`/members/${memberId}/memberships`, data),

  /** Get all memberships for a member (included in member detail, but explicit endpoint) */
  listByMember: (memberId: string) =>
    apiClient.get<MemberMembership[]>(`/members/${memberId}/memberships`),

  /** Freeze a member's membership */
  freeze: (memberId: string, data: FreezeMembershipDto) =>
    apiClient.post(`/members/${memberId}/freeze`, data),

  /** Unfreeze / resume a member's membership */
  unfreeze: (memberId: string) =>
    apiClient.post(`/members/${memberId}/unfreeze`),

  /** Renew a member's membership */
  renew: (memberId: string, data: RenewMembershipDto) =>
    apiClient.post(`/members/${memberId}/renew`, data),

  /** Upgrade / downgrade — renew with a different plan */
  changePlan: (memberId: string, data: ChangePlanDto) =>
    apiClient.post(`/members/${memberId}/renew`, {
      plan_id: data.plan_id,
      payment_method: data.payment_method ?? 'cash',
    }),

  /** Cancel a membership by its membership ID (uses /memberships/:id/cancel) */
  cancel: (membershipId: string, data?: CancelMembershipDto) =>
    apiClient.post(`/memberships/${membershipId}/cancel`, {
      reason: data?.reason ?? 'Membership cancelled',
    }),
};

// ─── Subscription Metrics API ────────────────────────────────

export const subscriptionMetricsApi = {
  /** Get subscription metrics for dashboard */
  getMetrics: (branchId?: string) =>
    apiClient.get<SubscriptionMetrics>('/analytics/memberships', {
      params: branchId ? { branch_id: branchId } : undefined,
    }),
};
