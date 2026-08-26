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
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  capacity?: number | null;
  opening_time?: string | null;
  closing_time?: string | null;
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
  /**
   * Stock rows, one per branch. An empty array means no stock record exists —
   * which is NOT the same as zero stock, and is exactly what made every POS
   * sale fail with "insufficient stock" while the shop looked fully stocked.
   */
  inventory?: Array<{
    stock_quantity?: number | null;
    reserved_quantity?: number | null;
    reorder_level?: number | null;
  }>;
};

export type StaffRow = {
  id: string;
  user_id?: string | null;
  full_name: string;
  role?: string | null;
  employee_code?: string | null;
  job_title?: string | null;
  employment_type?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  is_active?: boolean;
  joined_at?: string | null;
  branch?: { id: string; name: string } | null;
  /**
   * Owner/brand_owner ONLY — StripSecretsInterceptor removes it for every
   * other role, so it is absent rather than null in most sessions. Verified:
   * owner receives it, accountant and trainer do not.
   */
  salary?: number | string | null;
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

/** One body-measurement record. Everything past `id` is optional — a gym records what it records. */
export type BodyStats = {
  id: string;
  member_id: string;
  recorded_at: string;
  weight?: number | string | null;
  body_fat?: number | string | null;
  muscle_mass?: number | string | null;
  bmi?: number | string | null;
  chest?: number | string | null;
  waist?: number | string | null;
  hips?: number | string | null;
  arms?: number | string | null;
  thighs?: number | string | null;
  notes?: string | null;
};

/** A one-to-one PT session, as `/trainer/sessions` returns it. */
export type TrainerSession = {
  id: string;
  trainer_id: string;
  member_id: string;
  branch_id: string;
  session_date: string;
  session_duration: number;
  /** personal_training | group_training | rehab_session | assessment */
  session_type?: string | null;
  /** scheduled | completed | cancelled | no_show */
  status: string;
  notes?: string | null;
  trainer?: { id: string; full_name: string } | null;
  member?: { id: string; full_name: string } | null;
  branch?: { id: string; name: string } | null;
};

/** One movement in the gym's exercise library. */
export type Exercise = {
  id: string;
  name: string;
  muscle_group?: string | null;
  equipment?: string | null;
  media_url?: string | null;
  instructions?: string | null;
  is_active?: boolean;
};

/** An exercise as it appears inside a plan, with its prescription. */
export type PlanExercise = {
  id: string;
  exercise_id: string;
  position?: number | null;
  target_sets?: number | null;
  target_reps?: number | null;
  target_weight?: number | string | null;
  rest_seconds?: number | null;
  notes?: string | null;
  exercise?: Exercise | null;
};

export type WorkoutPlan = {
  id: string;
  title: string;
  description?: string | null;
  /** weight_loss | muscle_gain | endurance | general_fitness */
  goal?: string | null;
  /** beginner | intermediate | advanced */
  difficulty?: string | null;
  is_template?: boolean;
  is_active?: boolean;
  created_by?: { id: string; full_name: string } | null;
  /** Present on the detail endpoint; absent from the list. */
  exercises?: PlanExercise[];
};

/** An expense. `amount` is a Prisma Decimal serialised to a string. */
export type Expense = {
  id: string;
  branch_id: string;
  category?: string | null;
  category_id?: string | null;
  description: string;
  amount: number | string;
  currency?: string | null;
  expense_date: string;
  vendor?: string | null;
  notes?: string | null;
  payment_method?: string | null;
  status?: string | null;
  receipt_url?: string | null;
  branch?: { id: string; name: string } | null;
  category_ref?: { id: string; name: string; slug?: string | null } | null;
};

export type ExpenseSummary = {
  today: { date: string; total: number; count: number };
  month: { month: string; total: number; count: number };
  by_category: Array<{
    category_id: string;
    name: string;
    slug?: string | null;
    total: number;
    count: number;
  }>;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  slug?: string | null;
  icon?: string | null;
  color?: string | null;
};

/** `/financial-reports/dashboard` — the accountant's headline numbers. */
export type FinanceDashboard = {
  total_revenue_this_month: number;
  total_revenue_prev_month: number;
  revenue_growth_percent: number;
  pending_payments: number;
  refund_total_this_month: number;
  refund_rate: number;
  active_members: number;
  active_subscriptions: number;
  average_member_value: number;
  monthly_recurring_revenue: number;
};

/** `/financial-reports/monthly` — one month's P&L. */
export type MonthlyReport = {
  period: string;
  gross_revenue: number;
  total_refunds: number;
  net_revenue: number;
  total_expenses: number;
  profit: number;
  transaction_count: number;
  by_payment_method: Record<string, number>;
  daily_revenue: Record<string, number>;
  expenses_by_category: Record<string, number>;
};

/** A membership plan the gym sells. `price` is a Decimal — may arrive as a string. */
export type MembershipPlan = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  duration_days?: number | null;
  duration_months?: number | null;
  is_active?: boolean;
  features?: string[] | null;
  max_members?: number | null;
};

/** One recorded visit, as `/check-ins` returns it. */
export type Visit = {
  id: string;
  member_id: string;
  branch_id?: string | null;
  class_id?: string | null;
  checkin_method?: string | null;
  checked_in_at: string;
  check_out_at?: string | null;
  /** success | denied | … — a denied attempt is still a recorded event. */
  status?: string | null;
  failure_reason?: string | null;
  member?: { full_name?: string | null; member_code?: string | null } | null;
  branch?: { name?: string | null } | null;
};

/**
 * The studio's own settings, from `/settings/studio`.
 *
 * A superset of `Studio` (which is what the session carries). Most fields are
 * optional and commonly null on a young gym.
 */
export type StudioSettings = {
  id: string;
  name: string;
  slug?: string | null;
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  business_name?: string | null;
  business_type?: string | null;
  timezone?: string | null;
  currency?: string | null;
  logo_url?: string | null;
  /** Billing / plan — READ ONLY here; changing a plan is a web/gateway flow. */
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  trial_ends_at?: string | null;
  next_billing_date?: string | null;
  billing_cycle?: string | null;
  lifecycle_status?: string | null;
  two_factor_enabled?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  gstin?: string | null;
};
