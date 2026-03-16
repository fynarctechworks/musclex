import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { referralsApi } from './api';
import { toast } from 'sonner';
import type { CreateReferralPayload, UpdateReferralStatusPayload } from './types';

export function useMemberReferrals(memberId: string) {
  return useQuery({
    queryKey: queryKeys.members.referrals(memberId),
    queryFn: () => referralsApi.getMemberReferrals(memberId),
    enabled: !!memberId,
  });
}

export function useReferralStats() {
  return useQuery({
    queryKey: queryKeys.marketing.referralStats(),
    queryFn: () => referralsApi.getStats(),
  });
}

export function useCreateReferral(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReferralPayload) => referralsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.referrals(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.marketing.referralStats() });
      toast.success('Referral created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateReferralStatus(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ referralId, data }: { referralId: string; data: UpdateReferralStatusPayload }) =>
      referralsApi.updateStatus(referralId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.referrals(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.marketing.referralStats() });
      toast.success('Referral status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
