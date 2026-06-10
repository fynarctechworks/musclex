import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { walletApi } from './api';
import { toast } from 'sonner';
import type { TopUpPayload, UpsertLoyaltyConfigPayload } from './types';

export function useWallet(memberId: string) {
  return useQuery({
    queryKey: queryKeys.wallet.member(memberId),
    queryFn: () => walletApi.getWallet(memberId),
    enabled: !!memberId,
  });
}

export function useWalletTransactions(memberId: string, page = 1, limit = 50) {
  return useQuery({
    queryKey: queryKeys.wallet.transactions(memberId, { page, limit }),
    queryFn: () => walletApi.getTransactions(memberId, page, limit),
    enabled: !!memberId,
  });
}

export function useTopUpWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TopUpPayload) => walletApi.topUp(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet.all });
      toast.success('Wallet topped up');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useLoyaltyConfig() {
  return useQuery({
    queryKey: queryKeys.wallet.loyaltyConfig(),
    queryFn: () => walletApi.getLoyaltyConfig(),
  });
}

export function useUpsertLoyaltyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertLoyaltyConfigPayload) => walletApi.upsertLoyaltyConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet.loyaltyConfig() });
      toast.success('Loyalty settings saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
