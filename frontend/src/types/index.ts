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

export interface Expense {
  id: string;
  branch_id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  paid_at: string;
  expense_date: string;
  receipt_url?: string;
  vendor?: string;
  payment_method?: string;
  notes?: string;
  created_at: string;
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
  expiring_soon: number;
  monthly_revenue: number;
  avg_attendance_rate: number;
  expiring_soon_count: number;
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
