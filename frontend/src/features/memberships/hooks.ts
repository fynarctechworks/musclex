import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { plansApi, memberMembershipsApi, subscriptionMetricsApi } from './api';
import type {
  CreatePlanDto,
  UpdatePlanDto,
  PlanFilters,
  AssignMembershipDto,
  FreezeMembershipDto,
  RenewMembershipDto,
  ChangePlanDto,
  CancelMembershipDto,
} from './types';
import { toast } from 'sonner';

// ─── Plan Query Hooks ────────────────────────────────────────

export function useMembershipPlans(filters?: PlanFilters) {
  return useQuery({
    queryKey: queryKeys.memberships.plans(filters),
    queryFn: () => plansApi.list(filters),
  });
}

export function useMembershipPlan(id: string) {
  return useQuery({
    queryKey: queryKeys.memberships.detail(id),
    queryFn: () => plansApi.getById(id),
    enabled: !!id,
  });
}

// ─── Plan Mutation Hooks ─────────────────────────────────────

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlanDto) => plansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memberships.all });
      toast.success('Plan created successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePlanDto) => plansApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memberships.all });
      toast.success('Plan updated successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memberships.all });
      toast.success('Plan deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDuplicatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansApi.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.memberships.all });
      toast.success('Plan duplicated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Member Membership Hooks ─────────────────────────────────

export function useMemberMemberships(memberId: string) {
  return useQuery({
    queryKey: [...queryKeys.members.detail(memberId), 'memberships'] as const,
    queryFn: () => memberMembershipsApi.listByMember(memberId),
    enabled: !!memberId,
  });
}

export function useAssignMembership(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignMembershipDto) => memberMembershipsApi.assign(memberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Membership assigned');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useFreezeMembership(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FreezeMembershipDto) => memberMembershipsApi.freeze(memberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Membership paused');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnfreezeMembership(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => memberMembershipsApi.unfreeze(memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Membership resumed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRenewMembership(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RenewMembershipDto) => memberMembershipsApi.renew(memberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Membership renewed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Upgrade / Downgrade Hook ────────────────────────────────

export function useChangePlan(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ChangePlanDto) => memberMembershipsApi.changePlan(memberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      qc.invalidateQueries({ queryKey: queryKeys.memberships.all });
      toast.success('Plan changed successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Cancel Subscription Hook ────────────────────────────────

export function useCancelMembership(membershipId: string, memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: CancelMembershipDto) => memberMembershipsApi.cancel(membershipId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      qc.invalidateQueries({ queryKey: queryKeys.memberships.all });
      toast.success('Membership cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Subscription Metrics Hook ───────────────────────────────

export function useSubscriptionMetrics(branchId?: string) {
  return useQuery({
    queryKey: [...queryKeys.memberships.all, 'metrics', branchId] as const,
    queryFn: () => subscriptionMetricsApi.getMetrics(branchId),
  });
}
