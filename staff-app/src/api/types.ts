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

export type Payment = {
  id: string;
  /** Int on this column today, but treat as Money — see format.ts. */
  amount: number | string;
  currency?: string | null;
  payment_method: string;
  status: string;
  receipt_number?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

export type CheckIn = {
  id: string;
  checkin_method: string;
  checked_in_at: string;
  status: string;
  branch_id?: string | null;
};

/** GET /members/:id — unlike the list, this includes ALL memberships. */
export type MemberDetail = Member & {
  date_of_birth?: string | null;
  gender?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  payments?: Payment[];
  check_ins?: CheckIn[];
};

export type Branch = {
  id: string;
  name: string;
  city?: string | null;
  is_active?: boolean;
};

/** One metric from GET /dashboard/pulse. Deltas may be null on a new gym. */
export type PulseMetric = {
  value: number;
  delta_pct?: number | null;
  delta_abs?: number | null;
  delta_label?: string | null;
  sparkline?: number[];
  as_of?: string;
};

export type DashboardPulse = Record<string, PulseMetric>;

export type DashboardKpis = {
  active_members: number;
  monthly_revenue: number;
  avg_attendance_rate: number;
  expiring_soon_count: number;
};

export type DashboardAlert = {
  id: string;
  severity: 'high' | 'medium' | 'low' | string;
  message: string;
};

export type ActivityItem = {
  id: string;
  type: string;
  message: string;
  member_name?: string | null;
  member_code?: string | null;
  branch_name?: string | null;
  method?: string | null;
  timestamp: string;
};

export type ClassSession = {
  id: string;
  name: string;
  category?: string | null;
  start_time: string;
  end_time: string;
  capacity: number;
  enrolled_count?: number | null;
  waitlist_count?: number | null;
  status: string;
  trainer?: { full_name?: string | null } | null;
  branch?: { name?: string | null } | null;
};

export type Product = {
  id: string;
  product_name: string;
  /** Prisma Decimal — arrives as a STRING. Use toAmount()/formatCurrency(). */
  price: number | string;
  sku?: string | null;
  brand?: string | null;
  status?: string | null;
};

export type StaffRow = {
  id: string;
  user_id?: string | null;
  full_name: string;
  role?: string | null;
};

/** One booked member on a class session, as `/classes/bookings/session/:id` returns. */
export type ClassBooking = {
  id: string;
  member_id: string;
  booking_status: string;
  /** present | late | no_show | cancelled — absent until a trainer marks it. */
  attendance_status?: string | null;
  member?: {
    id: string;
    full_name: string;
    member_code?: string | null;
    phone?: string | null;
  } | null;
};

/**
 * The register, as `/classes/bookings/attendance/:id` returns it.
 *
 * A SEPARATE table from bookings: `class_bookings` records who signed up,
 * `class_attendance` records who actually turned up. The roster endpoint does
 * not carry attendance, so a screen showing both has to merge them.
 */
export type SessionAttendance = {
  session_id: string;
  attendance: Array<{
    member_id: string;
    attendance_status: string;
    check_in_time?: string | null;
  }>;
  summary?: Record<string, number>;
};

export type SessionRoster = {
  session_id: string;
  capacity: number;
  enrolled_count?: number | null;
  waitlist_count?: number | null;
  bookings: ClassBooking[];
  waitlist: ClassBooking[];
};
