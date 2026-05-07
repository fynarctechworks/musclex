import { apiClient } from '@/services/api-client';
import type {
  GymReferralStats,
  ValidateCodeResponse,
  CreateReferralPayload,
  RewardRule,
  CreateRulePayload,
  ReferralCampaign,
  ReferralAnalytics,
  PaginatedReferrals,
} from './types';

const BASE = '/referrals';
const ADMIN = '/admin/referrals';

// ── Public / Gym Endpoints ────────────────────────────────────────

export const gymReferralsApi = {
  /** Validate a referral code before using it */
  validateCode: (code: string) =>
    apiClient.get<ValidateCodeResponse>(`${BASE}/validate`, { params: { code } }),

  /** Apply a referral code for the current studio (during or after onboarding) */
  applyCode: (payload: CreateReferralPayload) =>
    apiClient.post<{ referral_id: string }>(BASE, payload),

  /** Get the calling studio's referral stats + reward history */
  getMyStats: () =>
    apiClient.get<GymReferralStats>(`${BASE}/stats`),

  /** Manually trigger subscription event (used by payment webhooks) */
  notifySubscriptionActivated: (payload: {
    studio_id: string;
    plan_id: string;
    billing_cycle: 'monthly' | 'annual';
    amount_paid: number;
    currency: string;
    idempotency_key: string;
  }) =>
    apiClient.post<{ accepted: boolean }>(
      `${BASE}/events/subscription-activated`,
      payload,
    ),
};

// ── Admin Endpoints ───────────────────────────────────────────────

export const gymReferralsAdminApi = {
  // Campaigns
  listCampaigns: () =>
    apiClient.get<ReferralCampaign[]>(`${ADMIN}/campaigns`),

  createCampaign: (data: Partial<ReferralCampaign>) =>
    apiClient.post<ReferralCampaign>(`${ADMIN}/campaigns`, data),

  updateCampaign: (id: string, data: Partial<ReferralCampaign>) =>
    apiClient.patch<ReferralCampaign>(`${ADMIN}/campaigns/${id}`, data),

  // Rules
  listRules: (campaignId?: string) =>
    apiClient.get<RewardRule[]>(`${ADMIN}/rules`, {
      params: campaignId ? { campaign_id: campaignId } : undefined,
    }),

  getRule: (id: string) =>
    apiClient.get<RewardRule>(`${ADMIN}/rules/${id}`),

  createRule: (data: CreateRulePayload) =>
    apiClient.post<RewardRule>(`${ADMIN}/rules`, data),

  updateRule: (id: string, data: Partial<CreateRulePayload>) =>
    apiClient.patch<RewardRule>(`${ADMIN}/rules/${id}`, data),

  deleteRule: (id: string) =>
    apiClient.delete<void>(`${ADMIN}/rules/${id}`),

  // Analytics
  getAnalytics: () =>
    apiClient.get<ReferralAnalytics>(`${ADMIN}/analytics`),

  listAllReferrals: (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<PaginatedReferrals>(ADMIN, { params }),

  getRewardLogs: (params?: { studio_id?: string; page?: number; limit?: number }) =>
    apiClient.get<unknown[]>(`${ADMIN}/reward-logs`, { params }),
};
