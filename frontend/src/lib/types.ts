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

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionsMap;
  is_system: boolean;
  staff_count?: number;
  created_at?: string;
}

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

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  plan_type: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'class_pack' | 'custom';
  duration_days?: number;
  total_classes?: number;
  max_classes_per_week?: number;
  price: number;
  is_active: boolean;
  auto_renew_enabled: boolean;
  branch_id?: string;
  branch?: { id: string; name: string };
}

export interface MemberMembership {
  id: string;
  member_id: string;
  plan_id: string;
  branch_id: string;
  start_date: string;
  end_date?: string;
  classes_remaining?: number;
  status: 'active' | 'frozen' | 'expired' | 'cancelled';
  freeze_start_date?: string;
  freeze_end_date?: string;
  freeze_reason?: string;
  plan: MembershipPlan;
}

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
  member?: { full_name: string; member_code: string };
}

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

export interface Expense {
  id: string;
  branch_id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  receipt_url?: string;
}

export interface DashboardKPIs {
  active_members: number;
  monthly_revenue: number;
  avg_attendance_rate: number;
  expiring_soon_count: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  module: string;
  entity_id?: string;
  entity_type?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}
