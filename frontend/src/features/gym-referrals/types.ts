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
  | 'trial_extension'
  | 'wallet_credit';

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

// ── Phase 3: Admin overrides & fraud queue ───────────────────────

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FraudReviewStatus = 'pending' | 'reviewed_ok' | 'confirmed_fraud';

export interface FraudSignal {
  id:                 string;
  referral_id:        string | null;
  subject_studio_id:  string | null;
  signal_type:        string;
  severity:           FraudSeverity | string;
  evidence:           Record<string, unknown>;
  review_status:      FraudReviewStatus | string;
  reviewed_by:        string | null;
  reviewed_at:        string | null;
  reviewer_notes:     string | null;
  created_at:         string;
  referral?: {
    id:               string;
    status:           ReferralStatus;
    risk_score:       number;
    referral_code:    string;
    referrer_studio:  { id: string; name: string };
    referred_studio:  { id: string; name: string };
  } | null;
  subject?: { id: string; name: string } | null;
}

export interface FraudQueueResponse {
  items: FraudSignal[];
  total: number;
}

export interface LifecycleEvent {
  id:          string;
  referral_id: string;
  from_status: string | null;
  to_status:   string;
  actor_type:  string;
  actor_id:    string | null;
  payload:     Record<string, unknown>;
  occurred_at: string;
}

// ── Phase 3: Wallet ──────────────────────────────────────────────

export interface WalletEntry {
  id:                  string;
  wallet_id:           string;
  entry_type:          'credit' | 'debit' | 'reversal' | 'expiry' | string;
  amount:              string;          // Decimal serialized; signed
  currency:            string;
  source_type:         string;
  source_id:           string | null;
  reward_log_id:       string | null;
  reverses_entry_id:   string | null;
  idempotency_key:     string;
  expires_at:          string | null;
  description:         string | null;
  metadata:            Record<string, unknown>;
  created_at:          string;
}

export interface WalletView {
  balance:  string;
  currency: string;
  entries:  WalletEntry[];
}

// ── Phase 3: Overview ────────────────────────────────────────────

export interface AdminOverview {
  lifecycle_funnel: Array<{ status: string; count: number }>;
  rewards: Array<{ status: string; reward_type: string; count: number }>;
  wallet_totals: Array<{ entry_type: string; total: string }>;
  fraud: Array<{ severity: string; review_status: string; count: number }>;
  top_risk_referrals: Array<{
    id:         string;
    status:     string;
    risk_score: number;
    referrer_studio: { name: string };
    referred_studio: { name: string };
  }>;
}

// ── Phase 4: Analytics ──────────────────────────────────────────

export interface FunnelResponse {
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

export interface DailyTrendRow {
  day: string;
  created: number;
  rewarded: number;
}
