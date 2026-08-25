import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import type { Branch, Member, Paginated } from '@/api/types';

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
    queryFn: () => api.get<Member>(`/members/${id}`),
  });
}

/** Invalidate every member list — use after any mutation that changes one. */
export function useInvalidateMembers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['members'] });
}

export { useMutation };
