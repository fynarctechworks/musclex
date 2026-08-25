import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import type {
  ActivityItem, Branch, DashboardAlert, DashboardKpis, DashboardPulse, Member,
  MemberDetail, Paginated,
} from '@/api/types';

/**
 * React Query hooks.
 *
 * Query keys start with the resource name and carry every input that changes
 * the result, so `invalidateQueries({ queryKey: ['members'] })` clears all
 * member lists regardless of filter.
 *
 * Note the cache is wiped wholesale on sign-out, workspace switch and branch
 * change (see SessionProvider) — keys deliberately do NOT include the gym or
 * branch id, because relying on key uniqueness for tenant separation would be
 * one forgotten key away from a cross-tenant leak.
 */

export const keys = {
  branches: ['branches'] as const,
  dashboard: ['dashboard'] as const,
  members: (params?: MemberListParams) => ['members', params ?? {}] as const,
  member: (id: string) => ['member', id] as const,
};

export function useBranches() {
  return useQuery({
    queryKey: keys.branches,
    // Branch lists change rarely; a long stale time avoids refetching on every
    // screen that shows the branch switcher.
    staleTime: 10 * 60_000,
    queryFn: () => api.get<Branch[]>('/branches'),
  });
}

/**
 * Dashboard.
 *
 * The four calls are separate queries rather than one aggregate so a single
 * slow or failing section (alerts hit several tables) cannot blank the whole
 * screen — each renders its own loading/error state.
 */
export function useDashboardKpis() {
  return useQuery({
    queryKey: [...keys.dashboard, 'kpis'],
    staleTime: 60_000,
    queryFn: () => api.get<DashboardKpis>('/dashboard/kpis'),
  });
}

export function useDashboardPulse() {
  return useQuery({
    queryKey: [...keys.dashboard, 'pulse'],
    staleTime: 60_000,
    queryFn: () => api.get<DashboardPulse>('/dashboard/pulse'),
  });
}

export function useDashboardAlerts() {
  return useQuery({
    queryKey: [...keys.dashboard, 'alerts'],
    queryFn: () => api.get<DashboardAlert[]>('/dashboard/alerts'),
  });
}

export function useActivityFeed() {
  return useQuery({
    queryKey: [...keys.dashboard, 'activity'],
    // The live check-in feed is the point of this section; keep it fresh.
    staleTime: 15_000,
    queryFn: () => api.get<ActivityItem[]>('/dashboard/activity-feed'),
  });
}

export type MemberListParams = {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export function useMembers(params: MemberListParams = {}) {
  const { limit = 20, ...rest } = params;
  return useQuery({
    queryKey: keys.members({ ...rest, limit }),
    queryFn: () => api.get<Paginated<Member>>('/members', { params: { ...rest, limit } }),
  });
}

export function useMember(id: string | undefined) {
  return useQuery({
    queryKey: keys.member(id ?? ''),
    enabled: Boolean(id),
    // Detail returns ALL memberships (the list only returns active ones), plus
    // payments and check-ins.
    queryFn: () => api.get<MemberDetail>(`/members/${id}`),
  });
}

/**
 * Manual check-in.
 *
 * `client_event_id` is a client-generated idempotency key. A gym doorway has
 * poor signal and staff double-tap; without it a retry records a second visit
 * and can consume a second class credit. The key is generated ONCE per attempt
 * and reused across retries.
 */
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; clientEventId: string; branchId?: string | null }) =>
      api.post<{ id: string; status?: string }>('/check-ins', {
        member_id: input.memberId,
        checkin_method: 'manual',
        client_event_id: input.clientEventId,
        source: 'staff_mobile',
        ...(input.branchId ? { branch_id: input.branchId } : {}),
      }),
    onSuccess: () => {
      // A check-in changes last_visit_at and the dashboard feed.
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Invalidate every member list — use after any mutation that changes one. */
export function useInvalidateMembers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['members'] });
}

export { useMutation };
