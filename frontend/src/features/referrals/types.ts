export interface MemberReferral {
  id: string;
  referrer_member_id: string;
  referred_member_id: string;
  reward_status: 'pending' | 'awarded' | 'expired';
  reward_type: 'discount' | 'free_days' | 'cash' | null;
  reward_value: number | null;
  awarded_at: string | null;
  created_at: string;
  referrer?: {
    id: string;
    full_name: string;
    member_code: string;
    profile_photo_url: string | null;
  };
  referred?: {
    id: string;
    full_name: string;
    member_code: string;
    profile_photo_url: string | null;
  };
}

export interface CreateReferralPayload {
  referrer_member_id: string;
  referred_member_id: string;
  reward_type?: string;
  reward_value?: number;
}

export interface UpdateReferralStatusPayload {
  reward_status: 'pending' | 'awarded' | 'expired';
}

export interface ReferralStats {
  total: number;
  by_status: {
    pending: number;
    awarded: number;
    expired: number;
  };
}
