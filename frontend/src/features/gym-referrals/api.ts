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
  AdminOverview,
  FraudQueueResponse,
  FraudSignal,
  FraudSeverity,
  LifecycleEvent,
  WalletView,
  FunnelResponse,
  TopReferrer,
  AttributedRevenue,
  TimeToReward,
  DailyTrendRow,
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

  // ── Phase 3: Overview ──
  overview: () =>
    apiClient.get<AdminOverview>(`${ADMIN}/overview`),

  // ── Phase 3: Fraud queue ──
  fraudQueue: (params?: {
    severity?: FraudSeverity | string;
    review_status?: string;
    limit?: number;
    offset?: number;
  }) =>
    apiClient.get<FraudQueueResponse>(`${ADMIN}/fraud-queue`, { params }),

  reviewSignal: (signalId: string, body: {
    decision: 'reviewed_ok' | 'confirmed_fraud';
    notes?: string;
  }) =>
    apiClient.post<FraudSignal>(`${ADMIN}/fraud-signals/${signalId}/review`, body),

  // ── Phase 3: Lifecycle history + force-transition ──
  getLifecycle: (referralId: string) =>
    apiClient.get<LifecycleEvent[]>(`${ADMIN}/${referralId}/lifecycle`),

  forceTransition: (referralId: string, body: { to_status: string; reason: string }) =>
    apiClient.post<{ ok: boolean; from_status: string; to_status: string }>(
      `${ADMIN}/${referralId}/force-transition`,
      body,
    ),

  recomputeRisk: (referralId: string) =>
    apiClient.post<{ referral_id: string; risk_score: number }>(
      `${ADMIN}/${referralId}/recompute-risk`,
      {},
    ),

  // ── Phase 3: Reward revocation ──
  revokeReward: (rewardLogId: string, reason: string) =>
    apiClient.post<{ ok: boolean; log_id: string }>(
      `${ADMIN}/reward-logs/${rewardLogId}/revoke`,
      { reason },
    ),

  // ── Phase 3: Wallet ops ──
  getWallet: (studioId: string) =>
    apiClient.get<WalletView>(`${ADMIN}/wallets/${studioId}`),

  freezeWallet: (studioId: string, reason: string) =>
    apiClient.post<{ ok: boolean }>(`${ADMIN}/wallets/${studioId}/freeze`, { reason }),

  unfreezeWallet: (studioId: string) =>
    apiClient.post<{ ok: boolean }>(`${ADMIN}/wallets/${studioId}/unfreeze`, {}),

  manualAdjustment: (body: {
    studio_id: string;
    amount: number;          // signed
    currency?: string;
    reason: string;
  }) =>
    apiClient.post<unknown>(`${ADMIN}/wallets/manual-adjustment`, body),

  // ── Phase 4: Analytics ──
  analyticsFunnel: (params?: { from?: string; to?: string }) =>
    apiClient.get<FunnelResponse>(`${ADMIN}/analytics/funnel`, { params }),

  analyticsTopReferrers: (params?: { from?: string; to?: string; limit?: number }) =>
    apiClient.get<TopReferrer[]>(`${ADMIN}/analytics/top-referrers`, { params }),

  analyticsAttributedRevenue: (params?: { from?: string; to?: string }) =>
    apiClient.get<AttributedRevenue>(`${ADMIN}/analytics/attributed-revenue`, { params }),

  analyticsTimeToReward: (params?: { from?: string; to?: string }) =>
    apiClient.get<TimeToReward>(`${ADMIN}/analytics/time-to-reward`, { params }),

  analyticsWalletAggregates: () =>
    apiClient.get<Record<string, { total: string; count: number }>>(
      `${ADMIN}/analytics/wallet-aggregates`,
    ),

  analyticsDailyTrend: (params: { from: string; to: string }) =>
    apiClient.get<DailyTrendRow[]>(`${ADMIN}/analytics/daily-trend`, { params }),
};
