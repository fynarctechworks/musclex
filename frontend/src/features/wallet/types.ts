export interface Wallet {
  id: string;
  member_id: string;
  balance: number;
  points_balance: number;
  created_at: string;
  updated_at: string;
}

export type WalletTransactionType =
  | 'topup'
  | 'purchase'
  | 'refund'
  | 'points_earn'
  | 'points_redeem'
  | 'cashback'
  | 'adjustment';

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: WalletTransactionType;
  amount: number;
  points: number;
  balance_after: number;
  points_after: number;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
}

export interface LoyaltyConfig {
  id: string;
  gym_id: string;
  is_active: boolean;
  points_per_currency: number;
  redeem_value_per_point: number;
  min_redeem_points: number;
  created_at: string;
  updated_at: string;
}

export interface TopUpPayload {
  member_id: string;
  amount: number;
  notes?: string;
  created_by?: string;
}

export interface UpsertLoyaltyConfigPayload {
  is_active?: boolean;
  points_per_currency?: number;
  redeem_value_per_point?: number;
  min_redeem_points?: number;
}

export interface PaginatedWalletTransactions {
  data: WalletTransaction[];
  total: number;
  page: number;
  limit: number;
}
