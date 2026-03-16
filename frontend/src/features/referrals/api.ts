import { apiClient } from '@/services/api-client';
import type {
  MemberReferral,
  CreateReferralPayload,
  UpdateReferralStatusPayload,
  ReferralStats,
} from './types';

export const referralsApi = {
  /** Get all referrals for a member (given + received) */
  getMemberReferrals: (memberId: string) =>
    apiClient.get<MemberReferral[]>(`/members/${memberId}/referrals`),

  /** Create a new referral record */
  create: (data: CreateReferralPayload) =>
    apiClient.post<MemberReferral>('/members/referrals', data),

  /** Update referral status (pending → awarded → expired) */
  updateStatus: (referralId: string, data: UpdateReferralStatusPayload) =>
    apiClient.patch<MemberReferral>(`/members/referrals/${referralId}`, data),

  /** Get global referral stats */
  getStats: (organizationId?: string) =>
    apiClient.get<ReferralStats>('/referral-programs/stats', {
      params: organizationId ? { organization_id: organizationId } : undefined,
    }),
};
