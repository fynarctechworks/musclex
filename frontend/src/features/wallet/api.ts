import { apiClient } from '@/services/api-client';
import type {
  Wallet,
  LoyaltyConfig,
  TopUpPayload,
  UpsertLoyaltyConfigPayload,
  PaginatedWalletTransactions,
} from './types';

export const walletApi = {
  getWallet: (memberId: string) =>
    apiClient.get<Wallet>(`/members/${memberId}/wallet`),

  getTransactions: (memberId: string, page = 1, limit = 50) =>
    apiClient.get<PaginatedWalletTransactions>(`/members/${memberId}/wallet/transactions`, {
      params: { page, limit },
    }),

  topUp: (data: TopUpPayload) =>
    apiClient.post<unknown>('/wallet/topup', data),

  getLoyaltyConfig: () =>
    apiClient.get<LoyaltyConfig | null>('/loyalty/config'),

  upsertLoyaltyConfig: (data: UpsertLoyaltyConfigPayload) =>
    apiClient.put<LoyaltyConfig>('/loyalty/config', data),
};
