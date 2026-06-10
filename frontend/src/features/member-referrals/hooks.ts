import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { memberReferralsApi, memberReferralsAdminApi } from './api';
import type {
  CreateProgramPayload,
  UpdateProgramPayload,
  MemberReferralProgramStatus,
} from './types';

export const memberReferralKeys = {
  all:        ['member-referrals'] as const,
  validate:   (code: string) => [...memberReferralKeys.all, 'validate', code] as const,
  dashboard:  (memberId: string) => [...memberReferralKeys.all, 'dashboard', memberId] as const,
  leaderboard:() => [...memberReferralKeys.all, 'leaderboard'] as const,

  // admin
  overview:   () => [...memberReferralKeys.all, 'overview'] as const,
  programs:   () => [...memberReferralKeys.all, 'programs'] as const,
  fraudQueue: (filters?: unknown) => [...memberReferralKeys.all, 'fraud-queue', filters] as const,
  funnel:     (range?: unknown) => [...memberReferralKeys.all, 'funnel', range] as const,
  rewardCosts:(range?: unknown) => [...memberReferralKeys.all, 'reward-costs', range] as const,
};

// ── Public ──

export function useMemberReferralDashboard(memberId: string | null) {
  return useQuery({
    queryKey: memberReferralKeys.dashboard(memberId ?? ''),
    queryFn:  () => memberReferralsApi.myDashboard(memberId!),
    enabled:  !!memberId,
    staleTime: 30_000,
  });
}

export function useMemberLeaderboard(limit = 10) {
  return useQuery({
    queryKey: memberReferralKeys.leaderboard(),
    queryFn:  () => memberReferralsApi.leaderboard(limit),
    staleTime: 60_000,
  });
}

/** Generate (or fetch) a member's referral code. Idempotent. */
export function useEnsureMemberCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => memberReferralsApi.ensureCode(memberId),
    onSuccess: (data) => {
      toast.success(`Code generated: ${data.referral_code}`);
      // Invalidate the surrounding member detail cache so the profile re-fetches.
      qc.invalidateQueries({ queryKey: ['members', 'detail', data.member_id] });
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: memberReferralKeys.dashboard(data.member_id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Gym-owner admin ──

export function useMemberReferralOverview() {
  return useQuery({
    queryKey: memberReferralKeys.overview(),
    queryFn:  () => memberReferralsAdminApi.overview(),
    staleTime: 30_000,
  });
}

export function useMemberReferralPrograms() {
  return useQuery({
    queryKey: memberReferralKeys.programs(),
    queryFn:  () => memberReferralsAdminApi.listPrograms(),
    staleTime: 30_000,
  });
}

export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProgramPayload) =>
      memberReferralsAdminApi.createProgram(payload),
    onSuccess: () => {
      toast.success('Program created');
      qc.invalidateQueries({ queryKey: memberReferralKeys.programs() });
      qc.invalidateQueries({ queryKey: memberReferralKeys.overview() });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProgramPayload }) =>
      memberReferralsAdminApi.updateProgram(id, data),
    onSuccess: () => {
      toast.success('Program updated');
      qc.invalidateQueries({ queryKey: memberReferralKeys.programs() });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetProgramStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MemberReferralProgramStatus }) =>
      memberReferralsAdminApi.setProgramStatus(id, status),
    onSuccess: () => {
      toast.success('Program status updated');
      qc.invalidateQueries({ queryKey: memberReferralKeys.programs() });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMemberReferralFraudQueue(params?: {
  severity?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: memberReferralKeys.fraudQueue(params),
    queryFn:  () => memberReferralsAdminApi.fraudQueue(params),
    staleTime: 15_000,
  });
}

export function useReviewMemberSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ signalId, ...body }: {
      signalId: string;
      decision: 'reviewed_ok' | 'confirmed_fraud';
      notes?: string;
    }) => memberReferralsAdminApi.reviewSignal(signalId, body),
    onSuccess: () => {
      toast.success('Signal reviewed');
      qc.invalidateQueries({ queryKey: memberReferralKeys.fraudQueue() });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Analytics ────────────────────────────────────────────────────

export function useMemberReferralFunnel(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: memberReferralKeys.funnel(range),
    queryFn:  () => memberReferralsAdminApi.funnel(range),
    staleTime: 60_000,
  });
}

export function useMemberReferralRewardCosts(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: memberReferralKeys.rewardCosts(range),
    queryFn:  () => memberReferralsAdminApi.rewardCosts(range),
    staleTime: 60_000,
  });
}

export function useMemberReferralLeaderboardAdmin(params?: { from?: string; to?: string; limit?: number }) {
  return useQuery({
    queryKey: [...memberReferralKeys.leaderboard(), params],
    queryFn:  () => memberReferralsAdminApi.leaderboard(params),
    staleTime: 60_000,
  });
}
