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
