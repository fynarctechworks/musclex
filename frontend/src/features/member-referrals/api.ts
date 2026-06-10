import { apiClient } from '@/services/api-client';
import type {
  MemberReferralProgram,
  CreateProgramPayload,
  UpdateProgramPayload,
  MemberReferralRewardRow,
  LeaderboardEntry,
  MemberDashboard,
  MemberReferralValidate,
  MemberReferralFraudSignal,
  MemberReferralOverview,
  MemberReferralProgramStatus,
} from './types';

const PUBLIC = '/member-referrals';
const ADMIN  = '/admin/member-referrals';
const ANALYTICS = '/admin/member-referrals/analytics';

// ── Public ───────────────────────────────────────────────────────

export const memberReferralsApi = {
  validateCode: (code: string) =>
    apiClient.get<MemberReferralValidate>(`${PUBLIC}/validate`, { params: { code } }),

  create: (payload: {
    referrer_code?: string;
    referrer_member_id?: string;
    referred_member_id: string;
  }) => apiClient.post<{ member_referral_id: string }>(PUBLIC, payload),

  myDashboard: (memberId: string) =>
    apiClient.get<MemberDashboard>(`${PUBLIC}/dashboard/${memberId}`),

  leaderboard: (limit = 10) =>
    apiClient.get<LeaderboardEntry[]>(`${PUBLIC}/leaderboard`, { params: { limit } }),

  /** Generate (or fetch) the referral code for a given member. Staff-only. */
  ensureCode: (memberId: string) =>
    apiClient.post<{ member_id: string; referral_code: string }>(
      `${PUBLIC}/${memberId}/ensure-code`,
      {},
    ),
};

// ── Gym-owner admin ──────────────────────────────────────────────

export const memberReferralsAdminApi = {
  overview: () =>
    apiClient.get<MemberReferralOverview>(`${ADMIN}/overview`),

  // Programs
  listPrograms: () =>
    apiClient.get<MemberReferralProgram[]>(`${ADMIN}/programs`),

  createProgram: (data: CreateProgramPayload) =>
    apiClient.post<MemberReferralProgram>(`${ADMIN}/programs`, data),

  updateProgram: (id: string, data: UpdateProgramPayload) =>
    apiClient.patch<MemberReferralProgram>(`${ADMIN}/programs/${id}`, data),

  setProgramStatus: (id: string, status: MemberReferralProgramStatus) =>
    apiClient.post<MemberReferralProgram>(`${ADMIN}/programs/${id}/status`, { status }),

  // Manual override
  manualReward: (memberReferralId: string, body: {
    reward_type: string;
    reward_value: Record<string, unknown>;
    notes?: string;
  }) =>
    apiClient.post<MemberReferralRewardRow>(
      `${ADMIN}/${memberReferralId}/manual-reward`,
      body,
    ),

  revokeReward: (rewardId: string, reason: string) =>
    apiClient.post<MemberReferralRewardRow>(
      `${ADMIN}/rewards/${rewardId}/revoke`,
      { reason },
    ),

  forceTransition: (memberReferralId: string, to_status: string, reason: string) =>
    apiClient.post<{ ok: boolean; from_status: string | null; to_status: string }>(
      `${ADMIN}/${memberReferralId}/force-transition`,
      { to_status, reason },
    ),

  // Fraud
  fraudQueue: (params?: { severity?: string; limit?: number; offset?: number }) =>
    apiClient.get<MemberReferralFraudSignal[]>(`${ADMIN}/fraud-queue`, { params }),

  reviewSignal: (signalId: string, body: {
    decision: 'reviewed_ok' | 'confirmed_fraud';
    notes?: string;
  }) =>
    apiClient.post<MemberReferralFraudSignal>(`${ADMIN}/fraud-signals/${signalId}/review`, body),

  // Analytics
  funnel: (params?: { from?: string; to?: string }) =>
    apiClient.get<{
      total: number;
      awarded: number;
      conversion_pct: number;
      by_status: Array<{ status: string; count: number }>;
    }>(`${ANALYTICS}/funnel`, { params }),

  leaderboard: (params?: { from?: string; to?: string; limit?: number }) =>
    apiClient.get<LeaderboardEntry[]>(`${ANALYTICS}/leaderboard`, { params }),

  rewardCosts: (params?: { from?: string; to?: string }) =>
    apiClient.get<Array<{ reward_type: string; status: string; count: number }>>(
      `${ANALYTICS}/reward-costs`,
      { params },
    ),
};
