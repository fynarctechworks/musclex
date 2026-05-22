// Frontend types for the B2C (Member → Member) referral system.

export type MemberReferralRewardStatus = 'pending' | 'awarded' | 'expired';

export type MemberReferralProgramStatus = 'active' | 'paused' | 'ended';

export type MemberReferralRewardType = 'discount' | 'free_days' | 'cash' | 'free_class';

export interface MemberReferralProgram {
  id:            string;
  gym_id:        string;
  program_name:  string;
  reward_type:   MemberReferralRewardType | string;
  reward_value:  string;            // Decimal serialized
  min_referrals: number;
  max_rewards:   number | null;
  status:        MemberReferralProgramStatus | string;
  start_date:    string | null;
  end_date:      string | null;
  created_at:    string;
  updated_at:    string;
}

export interface CreateProgramPayload {
  program_name: string;
  reward_type:  MemberReferralRewardType;
  reward_value: number;
  min_referrals?: number;
  max_rewards?:   number;
  start_date?:    string;
  end_date?:      string;
}

export type UpdateProgramPayload = Partial<CreateProgramPayload> & {
  status?: MemberReferralProgramStatus;
};

export interface MemberReferralRewardRow {
  id:                  string;
  gym_id:              string;
  member_referral_id:  string;
  program_id:          string | null;
  beneficiary_member_id: string;
  reward_type:         string;
  reward_value:        Record<string, unknown>;
  status:              string;
  applied_at:          string;
  claimed_at:          string | null;
  expires_at:          string | null;
  reversed_at:         string | null;
  reversed_reason:     string | null;
  notes:               string | null;
}

export interface LeaderboardEntry {
  rank: number;
  member: {
    id:                string;
    full_name:         string;
    referral_code:     string | null;
    profile_photo_url: string | null;
  };
  successful_count: number;
}

export interface MemberDashboard {
  referral_code: string | null;
  stats: {
    total_given: number;
    awarded:     number;
    pending:     number;
  };
  rank: number | null;
  timeline: Array<{
    id:         string;
    referred:   string | null;
    status:     string;
    created_at: string;
    awarded_at: string | null;
  }>;
  rewards: MemberReferralRewardRow[];
}

export interface MemberReferralValidate {
  valid:         boolean;
  referrer_name?: string;
  gym_id?:       string;
  message?:      string;
}

export interface MemberReferralFraudSignal {
  id:                 string;
  gym_id:             string;
  member_referral_id: string | null;
  subject_member_id:  string | null;
  signal_type:        string;
  severity:           'low' | 'medium' | 'high' | 'critical' | string;
  evidence:           Record<string, unknown>;
  review_status:      'pending' | 'reviewed_ok' | 'confirmed_fraud' | string;
  created_at:         string;
}

export interface MemberReferralOverview {
  by_reward_status: Array<{ status: string; count: number }>;
  programs: Array<{
    id:           string;
    program_name: string;
    status:       string;
    reward_type:  string;
    reward_value: string;
  }>;
  rewards: Array<{ status: string; type: string; count: number }>;
  leaderboard: LeaderboardEntry[];
}
