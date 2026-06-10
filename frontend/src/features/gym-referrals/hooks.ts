import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { gymReferralsApi, gymReferralsAdminApi } from './api';
import type { CreateReferralPayload, CreateRulePayload } from './types';

// ── Query Keys ────────────────────────────────────────────────────

export const gymReferralKeys = {
  all:       ['gym-referrals'] as const,
  myStats:   () => [...gymReferralKeys.all, 'my-stats'] as const,
  validate:  (code: string) => [...gymReferralKeys.all, 'validate', code] as const,

  // admin
  analytics: () => [...gymReferralKeys.all, 'analytics'] as const,
  rules:     (cId?: string) => [...gymReferralKeys.all, 'rules', cId] as const,
  rule:      (id: string) => [...gymReferralKeys.all, 'rule', id] as const,
  campaigns: () => [...gymReferralKeys.all, 'campaigns'] as const,
  list:      (filters?: unknown) => [...gymReferralKeys.all, 'list', filters] as const,
  logs:      (filters?: unknown) => [...gymReferralKeys.all, 'logs', filters] as const,
};

// ── Gym (User) Hooks ──────────────────────────────────────────────

export function useMyReferralStats() {
  return useQuery({
    queryKey: gymReferralKeys.myStats(),
    queryFn:  () => gymReferralsApi.getMyStats(),
    staleTime: 30_000,
  });
}

export function useValidateReferralCode(code: string) {
  return useQuery({
    queryKey: gymReferralKeys.validate(code),
    queryFn:  () => gymReferralsApi.validateCode(code),
    enabled:  code.length === 6,
    staleTime: 60_000,
    retry: false,
  });
}

export function useApplyReferralCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateReferralPayload) =>
      gymReferralsApi.applyCode(payload),
    onSuccess: () => {
      toast.success('Referral code applied!');
      qc.invalidateQueries({ queryKey: gymReferralKeys.myStats() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Admin Hooks ───────────────────────────────────────────────────

export function useAdminReferralAnalytics() {
  return useQuery({
    queryKey: gymReferralKeys.analytics(),
    queryFn:  () => gymReferralsAdminApi.getAnalytics(),
    staleTime: 60_000,
  });
}

export function useAdminReferralRules(campaignId?: string) {
  return useQuery({
    queryKey: gymReferralKeys.rules(campaignId),
    queryFn:  () => gymReferralsAdminApi.listRules(campaignId),
    staleTime: 30_000,
  });
}

export function useAdminReferralRule(id: string) {
  return useQuery({
    queryKey: gymReferralKeys.rule(id),
    queryFn:  () => gymReferralsAdminApi.getRule(id),
    enabled:  !!id,
  });
}

export function useAdminCampaigns() {
  return useQuery({
    queryKey: gymReferralKeys.campaigns(),
    queryFn:  () => gymReferralsAdminApi.listCampaigns(),
    staleTime: 30_000,
  });
}

export function useAdminAllReferrals(filters?: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: gymReferralKeys.list(filters),
    queryFn:  () => gymReferralsAdminApi.listAllReferrals(filters),
    staleTime: 30_000,
  });
}

export function useAdminRewardLogs(filters?: { studio_id?: string; page?: number }) {
  return useQuery({
    queryKey: gymReferralKeys.logs(filters),
    queryFn:  () => gymReferralsAdminApi.getRewardLogs(filters),
    staleTime: 30_000,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRulePayload) =>
      gymReferralsAdminApi.createRule(data),
    onSuccess: () => {
      toast.success('Rule created');
      qc.invalidateQueries({ queryKey: gymReferralKeys.rules() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateRulePayload>) =>
      gymReferralsAdminApi.updateRule(id, data),
    onSuccess: () => {
      toast.success('Rule updated');
      qc.invalidateQueries({ queryKey: gymReferralKeys.rules() });
      qc.invalidateQueries({ queryKey: gymReferralKeys.rule(id) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gymReferralsAdminApi.deleteRule(id),
    onSuccess: () => {
      toast.success('Rule deleted');
      qc.invalidateQueries({ queryKey: gymReferralKeys.rules() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<import('./types').ReferralCampaign>) =>
      gymReferralsAdminApi.createCampaign(data),
    onSuccess: () => {
      toast.success('Campaign created');
      qc.invalidateQueries({ queryKey: gymReferralKeys.campaigns() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      gymReferralsAdminApi.updateCampaign(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gymReferralKeys.campaigns() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ════════════════════════════════════════════════════════════════
// Phase 3/4: Admin overrides, fraud queue, wallet, analytics
// ════════════════════════════════════════════════════════════════

export const gymReferralAdminKeys = {
  overview:   () => [...gymReferralKeys.all, 'overview'] as const,
  fraudQueue: (f?: unknown) => [...gymReferralKeys.all, 'fraud-queue', f] as const,
  lifecycle:  (id: string) => [...gymReferralKeys.all, 'lifecycle', id] as const,
  wallet:     (sid: string) => [...gymReferralKeys.all, 'wallet', sid] as const,
  funnel:     (r?: unknown) => [...gymReferralKeys.all, 'funnel', r] as const,
  topReferrers: (r?: unknown) => [...gymReferralKeys.all, 'top-referrers', r] as const,
  attributedRevenue: (r?: unknown) => [...gymReferralKeys.all, 'attributed-revenue', r] as const,
  timeToReward: (r?: unknown) => [...gymReferralKeys.all, 'time-to-reward', r] as const,
  walletAggregates: () => [...gymReferralKeys.all, 'wallet-aggregates'] as const,
  dailyTrend: (r?: unknown) => [...gymReferralKeys.all, 'daily-trend', r] as const,
};

export function useAdminOverview() {
  return useQuery({
    queryKey: gymReferralAdminKeys.overview(),
    queryFn:  () => gymReferralsAdminApi.overview(),
    staleTime: 30_000,
  });
}

export function useFraudQueue(params?: {
  severity?: string;
  review_status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: gymReferralAdminKeys.fraudQueue(params),
    queryFn:  () => gymReferralsAdminApi.fraudQueue(params),
    staleTime: 15_000,
  });
}

export function useReviewSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ signalId, ...body }: {
      signalId: string;
      decision: 'reviewed_ok' | 'confirmed_fraud';
      notes?: string;
    }) => gymReferralsAdminApi.reviewSignal(signalId, body),
    onSuccess: () => {
      toast.success('Signal reviewed');
      qc.invalidateQueries({ queryKey: gymReferralAdminKeys.fraudQueue() });
      qc.invalidateQueries({ queryKey: gymReferralAdminKeys.overview() });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReferralLifecycle(referralId: string | null) {
  return useQuery({
    queryKey: gymReferralAdminKeys.lifecycle(referralId ?? ''),
    queryFn:  () => gymReferralsAdminApi.getLifecycle(referralId!),
    enabled:  !!referralId,
  });
}

export function useForceTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ referralId, ...body }: {
      referralId: string;
      to_status: string;
      reason: string;
    }) => gymReferralsAdminApi.forceTransition(referralId, body),
    onSuccess: (_d, vars) => {
      toast.success(`Transition forced → ${vars.to_status}`);
      qc.invalidateQueries({ queryKey: gymReferralKeys.list() });
      qc.invalidateQueries({ queryKey: gymReferralAdminKeys.lifecycle(vars.referralId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardLogId, reason }: { rewardLogId: string; reason: string }) =>
      gymReferralsAdminApi.revokeReward(rewardLogId, reason),
    onSuccess: () => {
      toast.success('Reward revoked');
      qc.invalidateQueries({ queryKey: gymReferralKeys.logs() });
      qc.invalidateQueries({ queryKey: gymReferralAdminKeys.overview() });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useWallet(studioId: string | null) {
  return useQuery({
    queryKey: gymReferralAdminKeys.wallet(studioId ?? ''),
    queryFn:  () => gymReferralsAdminApi.getWallet(studioId!),
    enabled:  !!studioId,
    staleTime: 15_000,
  });
}

export function useFreezeWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studioId, reason }: { studioId: string; reason: string }) =>
      gymReferralsAdminApi.freezeWallet(studioId, reason),
    onSuccess: (_d, vars) => {
      toast.success('Wallet frozen');
      qc.invalidateQueries({ queryKey: gymReferralAdminKeys.wallet(vars.studioId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnfreezeWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studioId: string) => gymReferralsAdminApi.unfreezeWallet(studioId),
    onSuccess: (_d, sid) => {
      toast.success('Wallet unfrozen');
      qc.invalidateQueries({ queryKey: gymReferralAdminKeys.wallet(sid) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useManualWalletAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gymReferralsAdminApi.manualAdjustment,
    onSuccess: (_d, vars) => {
      toast.success('Wallet adjusted');
      qc.invalidateQueries({ queryKey: gymReferralAdminKeys.wallet(vars.studio_id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Phase 4: Analytics ──

export function useAnalyticsFunnel(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: gymReferralAdminKeys.funnel(range),
    queryFn:  () => gymReferralsAdminApi.analyticsFunnel(range),
    staleTime: 60_000,
  });
}

export function useAnalyticsTopReferrers(params?: { from?: string; to?: string; limit?: number }) {
  return useQuery({
    queryKey: gymReferralAdminKeys.topReferrers(params),
    queryFn:  () => gymReferralsAdminApi.analyticsTopReferrers(params),
    staleTime: 60_000,
  });
}

export function useAttributedRevenue(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: gymReferralAdminKeys.attributedRevenue(range),
    queryFn:  () => gymReferralsAdminApi.analyticsAttributedRevenue(range),
    staleTime: 60_000,
  });
}

export function useTimeToReward(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: gymReferralAdminKeys.timeToReward(range),
    queryFn:  () => gymReferralsAdminApi.analyticsTimeToReward(range),
    staleTime: 60_000,
  });
}

export function useWalletAggregates() {
  return useQuery({
    queryKey: gymReferralAdminKeys.walletAggregates(),
    queryFn:  () => gymReferralsAdminApi.analyticsWalletAggregates(),
    staleTime: 60_000,
  });
}

export function useDailyTrend(range: { from: string; to: string } | null) {
  return useQuery({
    queryKey: gymReferralAdminKeys.dailyTrend(range),
    queryFn:  () => gymReferralsAdminApi.analyticsDailyTrend(range!),
    enabled:  !!range,
    staleTime: 60_000,
  });
}
