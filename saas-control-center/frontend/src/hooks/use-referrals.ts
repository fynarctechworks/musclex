import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse } from '@/types';

// ── Types (mirror main backend internal referral surface) ────────

export interface ReferralOverview {
  lifecycle_funnel: Array<{ status: string; count: number }>;
  rewards: Array<{ status: string; reward_type: string; count: number }>;
  wallet_totals: Array<{ entry_type: string; total: string }>;
  fraud: Array<{ severity: string; review_status: string; count: number }>;
  top_risk_referrals: Array<{
    id: string;
    status: string;
    risk_score: number;
    referrer_studio: { name: string };
    referred_studio: { name: string };
  }>;
}

export interface ReferralFunnel {
  total: number;
  rewarded: number;
  conversion_pct: number;
  by_status: Array<{ status: string; count: number }>;
}

export interface TopReferrer {
  studio: { id: string; name: string; referral_code: string; country: string | null };
  rewarded_count: number;
  rewards: Record<string, number>;
}

export interface AttributedRevenue {
  total_revenue: string;
  by_currency: Record<string, number>;
  count: number;
}

export interface TimeToReward {
  count: number;
  avg_hours: number;
  median_hours: number;
}

export interface ReferralFraudSignal {
  id: string;
  referral_id: string | null;
  subject_studio_id: string | null;
  signal_type: string;
  severity: string;
  evidence: Record<string, unknown>;
  review_status: string;
  created_at: string;
  referral?: {
    id: string;
    status: string;
    risk_score: number;
    referral_code: string;
    referrer_studio: { id: string; name: string };
    referred_studio: { id: string; name: string };
  } | null;
  subject?: { id: string; name: string } | null;
}

export interface FraudQueueResponse {
  items: ReferralFraudSignal[];
  total: number;
}

// ── Hooks ────────────────────────────────────────────────────────

export function useReferralOverview() {
  return useQuery({
    queryKey: ['referrals', 'overview'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ReferralOverview>>('/referrals/overview');
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useReferralFunnel(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['referrals', 'funnel', range],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ReferralFunnel>>(
        '/referrals/analytics/funnel',
        { params: range },
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useReferralTopReferrers(params?: { from?: string; to?: string; limit?: number }) {
  return useQuery({
    queryKey: ['referrals', 'top-referrers', params],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TopReferrer[]>>(
        '/referrals/analytics/top-referrers',
        { params },
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useReferralAttributedRevenue(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['referrals', 'attributed-revenue', range],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttributedRevenue>>(
        '/referrals/analytics/attributed-revenue',
        { params: range },
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useReferralTimeToReward(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['referrals', 'time-to-reward', range],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TimeToReward>>(
        '/referrals/analytics/time-to-reward',
        { params: range },
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useReferralFraudQueue(params?: {
  severity?: string;
  review_status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['referrals', 'fraud-queue', params],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<FraudQueueResponse>>(
        '/referrals/fraud-queue',
        { params },
      );
      return data.data;
    },
    staleTime: 15_000,
  });
}

export function useReviewReferralSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      signalId,
      decision,
      notes,
    }: {
      signalId: string;
      decision: 'reviewed_ok' | 'confirmed_fraud';
      notes?: string;
    }) => {
      const { data } = await api.post<ApiResponse<unknown>>(
        `/referrals/fraud-signals/${signalId}/review`,
        { decision, notes },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', 'fraud-queue'] });
      qc.invalidateQueries({ queryKey: ['referrals', 'overview'] });
    },
  });
}

// ── Reward Rules ─────────────────────────────────────────────────

export type RewardActionType =
  | 'extend_subscription'
  | 'trial_extension'
  | 'account_credit'
  | 'wallet_credit';

export interface RewardAction {
  type: RewardActionType;
  days?: number;
  amount?: number;
  currency?: string;
  expires_in_days?: number;
}

export interface RuleConditions {
  plan_ids?: string[];
  billing_cycles?: ('monthly' | 'annual')[];
  min_subscription_amount?: number;
  studio_countries?: string[];
  max_referrals_per_referrer?: number;
}

export interface RewardRule {
  id: string;
  name: string;
  description: string | null;
  campaign_id: string | null;
  is_active: boolean;
  priority: number;
  conditions: RuleConditions;
  rewards: RewardAction[];
  max_uses: number | null;
  uses_count: number;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  campaign?: { id: string; name: string } | null;
}

export interface SubscriptionPlanLite {
  id: string;
  name: string;
  display_name: string;
  monthly_price: string;
  annual_price: string;
}

export interface CreateRulePayload {
  name: string;
  description?: string;
  campaign_id?: string;
  is_active?: boolean;
  priority?: number;
  conditions: RuleConditions;
  rewards: RewardAction[];
  max_uses?: number;
  valid_from?: string;
  valid_until?: string;
}

export function useReferralRules(campaignId?: string) {
  return useQuery({
    queryKey: ['referrals', 'rules', campaignId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<RewardRule[]>>('/referrals/rules', {
        params: campaignId ? { campaign_id: campaignId } : undefined,
      });
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['referrals', 'plans'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SubscriptionPlanLite[]>>('/referrals/plans');
      return data.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRulePayload) => {
      const { data } = await api.post<ApiResponse<RewardRule>>('/referrals/rules', payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', 'rules'] });
    },
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: payload }: { id: string; data: Partial<CreateRulePayload> }) => {
      const { data } = await api.patch<ApiResponse<RewardRule>>(`/referrals/rules/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', 'rules'] });
    },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<ApiResponse<unknown>>(`/referrals/rules/${id}`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', 'rules'] });
    },
  });
}

// ── Campaigns ────────────────────────────────────────────────────

export interface ReferralCampaign {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  rules?: { id: string; name: string; is_active: boolean }[];
}

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  is_active?: boolean;
  valid_from?: string;
  valid_until?: string;
}

export function useReferralCampaigns() {
  return useQuery({
    queryKey: ['referrals', 'campaigns'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ReferralCampaign[]>>('/referrals/campaigns');
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCampaignPayload) => {
      const { data } = await api.post<ApiResponse<ReferralCampaign>>('/referrals/campaigns', payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', 'campaigns'] });
    },
  });
}

// ── Wallet ───────────────────────────────────────────────────────

export interface WalletEntry {
  id: string;
  entry_type: string;
  amount: string;
  currency: string;
  source_type: string;
  description: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface WalletView {
  balance: string;
  currency: string;
  entries: WalletEntry[];
}

export function useReferralWallet(studioId: string | null) {
  return useQuery({
    queryKey: ['referrals', 'wallet', studioId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<WalletView>>(`/referrals/wallets/${studioId}`);
      return data.data;
    },
    enabled: !!studioId,
    staleTime: 15_000,
  });
}

export function useFreezeWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ studioId, reason }: { studioId: string; reason: string }) => {
      const { data } = await api.post<ApiResponse<unknown>>(
        `/referrals/wallets/${studioId}/freeze`,
        { reason },
      );
      return data.data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['referrals', 'wallet', v.studioId] }),
  });
}

export function useUnfreezeWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (studioId: string) => {
      const { data } = await api.post<ApiResponse<unknown>>(
        `/referrals/wallets/${studioId}/unfreeze`,
        {},
      );
      return data.data;
    },
    onSuccess: (_d, sid) => qc.invalidateQueries({ queryKey: ['referrals', 'wallet', sid] }),
  });
}

export function useManualWalletAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      studio_id: string;
      amount: number;
      currency?: string;
      reason: string;
    }) => {
      const { data } = await api.post<ApiResponse<unknown>>(
        '/referrals/wallets/manual-adjustment',
        body,
      );
      return data.data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['referrals', 'wallet', v.studio_id] }),
  });
}
