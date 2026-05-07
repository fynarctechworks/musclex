// ─── Auth & RBAC ─────────────────────────────────────────────

export type ModuleAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export type PermissionModule =
  | 'dashboard'
  | 'members'
  | 'check_ins'
  | 'payments'
  | 'classes'
  | 'staff'
  | 'marketing'
  | 'ai'
  | 'settings'
  | 'branches'
  | 'reports';

export type PermissionsMap = Partial<Record<PermissionModule, ModuleAction[]>>;

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  studio_id?: string;
  branch_ids: string[];
  permissions?: PermissionsMap;
  onboarding_step?: string;
}

export interface Studio {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  timezone: string;
  currency: string;
  logo_url: string | null;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionsMap;
  is_system: boolean;
  staff_count?: number;
  created_at?: string;
}

// ─── Branch ──────────────────────────────────────────────────

export interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  _count?: { members: number; classes?: number; expenses?: number };
}

// ─── Memberships ─────────────────────────────────────────────

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  plan_type: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'class_pack' | 'custom' | 'day_pass' | 'corporate' | 'family' | 'global_access';
  duration_days?: number;
  total_classes?: number;
  max_classes_per_week?: number;
  max_visits?: number;
  price: number;
  yearly_price?: number | null;
  currency?: string;
  is_active: boolean;
  auto_renew_enabled: boolean;
  multi_branch_access?: boolean;
  grace_period_days?: number;
  organization_id?: string;
  branch_id?: string;
  branch?: { id: string; name: string };
  _count?: { memberships: number };
}

export interface MemberMembership {
  id: string;
  member_id: string;
  plan_id: string;
  branch_id: string;
  start_date: string;
  end_date?: string;
  classes_remaining?: number;
  remaining_visits?: number;
  status: 'pending' | 'active' | 'paused' | 'frozen' | 'expired' | 'cancelled' | 'renewed';
  freeze_start_date?: string;
  freeze_end_date?: string;
  freeze_reason?: string;
  auto_renew?: boolean;
  created_at?: string;
  updated_at?: string;
  plan: MembershipPlan;
  branch?: { id: string; name: string };
}

// ─── Members ─────────────────────────────────────────────────

export interface Member {
  id: string;
  member_code: string;
  branch_id: string;
  full_name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  profile_photo_url?: string;
  checkin_method: string;
  qr_code?: string;
  status: 'active' | 'expiring_soon' | 'expired' | 'frozen' | 'inactive';
  engagement_score: number;
  churn_risk: 'low' | 'medium' | 'high';
  referral_code?: string;
  notes?: string;
  created_at: string;
  branch?: Branch;
  memberships?: MemberMembership[];
  payments?: Payment[];
  check_ins?: CheckIn[];
}

// ─── Check-ins ───────────────────────────────────────────────

export interface CheckIn {
  id: string;
  member_id: string;
  membership_id: string;
  branch_id: string;
  class_id?: string;
  checkin_method: string;
  checked_in_at: string;
  status: 'success' | 'failed' | 'pending';
  failure_reason?: string;
  member?: { full_name: string; member_code: string; profile_photo_url?: string };
  synced_at?: string;
}

// ─── Payments ────────────────────────────────────────────────

export interface Payment {
  id: string;
  member_id: string;
  membership_id?: string;
  branch_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'paid' | 'partial' | 'failed' | 'refunded';
  receipt_number: string;
  invoice_url?: string;
  notes?: string;
  paid_at?: string;
  created_at: string;
  member?: { full_name: string; member_code: string };
}

export interface ExpenseCategory {
  id: string;
  branch_id: string | null;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export type ExpensePaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'card';
export type ExpenseStatus = 'confirmed' | 'pending' | 'reversed';

export interface Expense {
  id: string;
  branch_id: string;
  /** Legacy slug — kept for back-compat; prefer category_ref.name for display */
  category: string;
  category_id?: string | null;
  category_ref?: ExpenseCategory | null;
  description: string;
  /** Signed amount — reversals are stored as negative values */
  amount: number;
  currency: string;
  expense_date: string;
  receipt_url?: string | null;
  vendor?: string | null;
  notes?: string | null;
  payment_method: ExpensePaymentMethod;
  status: ExpenseStatus;
  /** When this row IS a reversal, points to the original expense id */
  reference_id?: string | null;
  idempotency_key?: string | null;
  recorded_by_staff_id: string;
  recorded_by?: { id: string; full_name: string } | null;
  branch?: { id: string; name: string } | null;
  reversed_by?: Expense[];
  created_at: string;
}

export interface ExpenseTimelineGroup {
  date: string;
  total: number;
  count: number;
  expenses: Expense[];
}

export interface ExpenseTimelineResponse {
  groups: ExpenseTimelineGroup[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ExpenseSummary {
  today: { total: number; count: number };
  month: { total: number; count: number; period: string };
  by_category: Array<{
    category_id: string | null;
    slug?: string | null;
    name: string;
    total: number;
    count: number;
  }>;
}

export interface ExpenseProfitLoss {
  range: { from: string; to: string };
  revenue: number;
  refunds: number;
  expenses: number;
  net_profit: number;
  expenses_by_category: Array<{
    category_id: string | null;
    name: string;
    total: number;
  }>;
}

export interface ExpenseCashflowForecast {
  trend: Array<{ period: string; total: number }>;
  predicted_next_month: number;
  confidence: number;
  anomalies: Array<{
    period: string;
    total: number;
    expected: number;
    deviation: number;
  }>;
}

export interface ExpenseRecurringPattern {
  key: string;
  category_id: string | null;
  category_name: string;
  vendor: string | null;
  average_amount: number;
  months_observed: number;
  last_seen: string;
}

export interface ExpenseIntelligenceBundle {
  profit_loss: ExpenseProfitLoss;
  cashflow: ExpenseCashflowForecast;
  recurring: ExpenseRecurringPattern[];
}

// ─── Staff ───────────────────────────────────────────────────

export interface Staff {
  id: string;
  user_id?: string;
  branch_ids: string[];
  full_name: string;
  role: 'owner' | 'manager' | 'trainer' | 'front_desk';
  role_id?: string;
  custom_role?: Role;
  phone: string;
  email?: string;
  specializations: string[];
  salary?: number;
  performance_score: number;
  is_active: boolean;
  joined_at?: string;
}

// ─── Classes ─────────────────────────────────────────────────

export interface ClassItem {
  id: string;
  branch_id: string;
  trainer_id: string;
  name: string;
  category: string;
  room?: string;
  capacity: number;
  duration_minutes: number;
  starts_at: string;
  status: string;
  trainer?: Staff;
  enrollments?: ClassEnrollment[];
}

export interface ClassEnrollment {
  id: string;
  class_id: string;
  member_id: string;
  status: 'enrolled' | 'waitlisted' | 'cancelled' | 'attended';
  waitlist_position?: number;
  member?: Member;
}

export interface ClassSession {
  id: string;
  class_id?: string;
  template_id?: string;
  branch_id: string;
  trainer_id?: string;
  room_id?: string;
  title: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  trainer?: { full_name: string };
  room?: { name: string };
}

// ─── Marketing ───────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  segment: string;
  channels: string[];
  message_template: string;
  status: string;
  scheduled_at?: string;
  sent_count: number;
  delivered_count: number;
  created_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  status: 'new' | 'contacted' | 'interested' | 'trial' | 'converted' | 'lost';
  lead_source?: string;
  assigned_staff_id?: string;
  notes?: string;
  created_at: string;
}

// ─── Dashboard ───────────────────────────────────────────────

export interface DashboardKPIs {
  total_members: number;
  active_members: number;
  new_members_this_month: number;
  revenue_this_month: number;
  revenue_change_percent: number;
  check_ins_today: number;
  active_plans: number;
  active_staff: number;
  expiring_soon: number;
  monthly_revenue: number;
  avg_attendance_rate: number;
  expiring_soon_count: number;
}

/**
 * One Pulse Strip KPI — the canonical "value + delta + sparkline + freshness"
 * shape used by the world-#1 dashboard. Empty `sparkline` array means the
 * series is not synthesized cheaply yet; render the card without a sparkline
 * rather than faking data.
 */
export interface PulseKpi {
  value: number;
  delta_pct: number | null;
  delta_abs: number | null;
  delta_label: string;
  sparkline: number[];
  as_of: string;
}

export interface PulseKpis {
  active_members: PulseKpi;
  today_revenue: PulseKpi;
  mrr: PulseKpi;
  check_ins_today: PulseKpi;
  renewals_at_risk_7d: PulseKpi & { value_at_stake: number };
  outstanding_dues: PulseKpi & {
    invoice_count: number;
    oldest_age_days: number;
  };
  generated_at: string;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  expenses: number;
}

export interface ActivityFeedItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  action_url?: string;
}

// ─── Audit ───────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  user_id: string;
  module: string;
  action: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  user?: { full_name: string; email: string };
}

// ─── Common ──────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SearchResult {
  entity: string;
  id: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
}

// ─── Dashboard Wave 8–14 ─────────────────────────────────────

export interface DashboardTile {
  id: string;
  label: string;
  capabilities: string[];
  default_size: 1 | 2 | 3;
  default_visible: boolean;
  role_visibility: string[];
}

// Wave 9
export interface Occupancy {
  current: number;
  peak_today: number;
  capacity: number | null;
  last_check_in_at: string | null;
  as_of: string;
}

export interface TodaysClass {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  trainer_name: string | null;
  booked: number;
  capacity: number;
  fill_pct: number;
  status: 'upcoming' | 'in_progress' | 'completed';
}

// Wave 10
export type RevenueMixGroupBy = 'plan' | 'trainer';

export interface RevenueMixItem {
  plan_id?: string;
  plan_name?: string;
  plan_type?: string;
  trainer_id?: string;
  trainer_name?: string;
  revenue_amount: number;
  member_count?: number;
  sessions_count?: number;
  share_pct: number;
  delta_pct?: number | null;
}

export type PaymentMethodKey = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'razorpay' | 'stripe';

export interface PaymentMethodItem {
  method: PaymentMethodKey;
  count: number;
  amount: number;
  share_pct: number;
}

export interface RevenueSummary {
  refunds: { count: number; amount: number };
  discounts: { count: number; amount: number };
  tax_collected: number;
  net_revenue: number;
  period_delta: {
    refunds_pct: number;
    discounts_pct: number;
    tax_pct: number;
    net_revenue_pct: number;
  };
}

// Wave 11
export interface CohortRetention {
  cohort_month: string;
  size: number;
  retention: number[];
}

export interface CohortsResponse {
  cohorts: CohortRetention[];
  generated_at: string;
}
/** @deprecated use CohortsResponse */
export type CohortResponse = CohortsResponse;

export interface SegmentMemberSample {
  id: string;
  name: string;
  photo_url: string | null;
  signal: string;
}

export interface Segment {
  count: number;
  members_at_risk_amount?: number;
  sample: SegmentMemberSample[];
}
/** @deprecated use Segment */
export type MemberSegment = Segment;

export interface SegmentsResponse {
  high_value: Segment;
  frequent_visitors: Segment;
  low_engagement: Segment;
  recently_joined: Segment;
  recently_cancelled: Segment;
  inactive: Segment;
  generated_at: string;
}

export interface BusinessMetrics {
  growth_rate_30d: number;
  growth_rate_mtd: number;
  retention_rate_90d: number;
  churn_rate_30d: number;
  ltv_estimate: number;
  cac_estimate: number | null;
  generated_at: string;
}

// Wave 12
export interface FootfallHeatmap {
  cells: number[][];
  max_value: number;
  average: number;
  outliers: Array<{ day_of_week: number; hour: number; value: number; z_score: number }>;
  generated_at: string;
  window_days: number;
}

// Wave 13
export interface HealthState {
  healthy: boolean;
  latency_ms?: number;
  message?: string;
}

export interface SystemStatus {
  api: HealthState;
  database: HealthState;
  redis: HealthState;
  websocket: HealthState;
  scanner: HealthState;
  sync_lag_seconds: number;
  queued_webhooks: number;
  generated_at: string;
}

export interface InventoryCategoryRow {
  category_id: string | null;
  category: string;
  items_count: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  value_in_stock: number;
  sales_30d_count: number;
  sales_30d_amount: number;
}

export interface LowStockItem {
  product_id: string;
  product_name: string;
  sku: string | null;
  category: string;
  branch_id: string;
  branch_name: string | null;
  stock_quantity: number;
  reorder_level: number;
  shortfall: number;
}

export interface InventoryDashboardResponse {
  categories: InventoryCategoryRow[];
  low_stock_items: LowStockItem[];
  total_value_in_stock: number;
  total_low_stock_count: number;
  generated_at: string;
  note?: string;
}
/** @deprecated use InventoryDashboardResponse */
export type InventoryDashboard = InventoryDashboardResponse;

// Wave 14
export interface LayoutTile {
  id: string;
  visible: boolean;
  size: 1 | 2 | 3;
  order: number;
}

export interface DashboardLayout {
  tiles: LayoutTile[];
  version: number;
  is_default: boolean;
}
