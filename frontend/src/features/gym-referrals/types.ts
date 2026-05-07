// ── B2B SaaS Gym-to-Gym Referral System Types ────────────────────
// Distinct from member-to-member referrals (features/referrals)

export type ReferralStatus =
  | 'pending'
  | 'completed'
  | 'rewarded'
  | 'expired'
  | 'fraud'
  | 'reversed';

export type RewardType =
  | 'extend_subscription'
  | 'account_credit'
  | 'trial_extension';

export type BillingCycle = 'monthly' | 'annual';

// ── Referral ──────────────────────────────────────────────────────

export interface GymReferral {
  id: string;
  referrer_studio_id: string;
  referred_studio_id: string | null;
  referral_code: string;
  referred_email: string | null;
  status: ReferralStatus;
  rewarded_at: string | null;
  created_at: string;
  updated_at: string;
  referrer_studio?: { id: string; name: string; referral_code: string };
  referred_studio?: { id: string; name: string } | null;
  reward_logs?: RewardLogEntry[];
}

// ── Reward Log (immutable audit trail) ───────────────────────────

export interface RewardLogEntry {
  id?: string;
  reward_type: RewardType;
  reward_value: Record<string, unknown>;
  applied_at: string;
  subscription_extended_from?: string | null;
  subscription_extended_to?: string | null;
  referred_gym?: string;
  status?: 'applied' | 'failed' | 'reversed';
}

// ── Stats ─────────────────────────────────────────────────────────

export interface GymReferralStats {
  referral_code: string;
  subscription_expires_at: string | null;
  stats: {
    total: number;
    pending: number;
    rewarded: number;
  };
  recent_rewards: RewardLogEntry[];
}

// ── Rule Engine ───────────────────────────────────────────────────

export interface RuleConditions {
  plan_ids?: string[];
  billing_cycles?: BillingCycle[];
  min_subscription_amount?: number;
  studio_countries?: string[];
  max_referrals_per_referrer?: number;
}

export interface RewardAction {
  type: RewardType;
  days?: number;
  amount?: number;
  currency?: string;
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

// ── Campaign ──────────────────────────────────────────────────────

export interface ReferralCampaign {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  max_referrals: number | null;
  referrals_count: number;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  rules?: { id: string; name: string; is_active: boolean }[];
}

// ── Admin Analytics ───────────────────────────────────────────────

export interface ReferralAnalytics {
  total_referrals: number;
  total_rewards_applied: number;
  by_status: { status: ReferralStatus; count: number }[];
  rewards_by_type: { type: RewardType; count: number }[];
  top_referrers: {
    studio: { id: string; name: string; referral_code: string };
    rewarded_count: number;
  }[];
}

// ── DTOs ──────────────────────────────────────────────────────────

export interface ValidateCodeResponse {
  valid: boolean;
  referrer_name?: string;
  message?: string;
}

export interface CreateReferralPayload {
  referral_code: string;
  referred_email?: string;
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

export interface PaginatedReferrals {
  data: GymReferral[];
  meta: { total: number; page: number; limit: number; total_pages: number };
}
