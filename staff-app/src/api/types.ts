/**
 * API response shapes, captured from the LIVE backend rather than inferred.
 * Only the fields the app actually reads are typed — the API returns far more
 * (a member row carries ~30 columns), and typing all of it would rot fast.
 */

/** Standard list envelope: { data, total, page, limit }. */
export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type MembershipSummary = {
  id: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  plan?: { id: string; name: string; price?: number } | null;
};

export type Member = {
  id: string;
  member_code: string;
  full_name: string;
  phone: string;
  email?: string | null;
  status: string;
  branch_id: string;
  join_date?: string | null;
  last_visit_at?: string | null;
  profile_photo_url?: string | null;
  churn_risk?: number | null;
  engagement_score?: number | null;
  /** Newest first per the API's include; [0] is the current membership. */
  memberships?: MembershipSummary[];
};

export type Branch = {
  id: string;
  name: string;
  city?: string | null;
  is_active?: boolean;
};
