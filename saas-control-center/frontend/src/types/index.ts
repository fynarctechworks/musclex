export interface Admin {
  id: string;
  email: string;
  name: string;
  mfa_enabled?: boolean;
  last_login_at?: string;
  backup_codes_remaining?: number;
}

export interface LoginResponse {
  requires_mfa: boolean;
  // When requires_mfa = false:
  access_token?: string;
  refresh_token?: string;
  admin?: Admin;
  // When requires_mfa = true:
  mfa_session_token?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  owner_name: string;
  phone?: string;
  logo_url?: string;
  account_type: 'gym';
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';
  plan_id?: string;
  plan?: SubscriptionPlan;
  max_members: number;
  max_branches: number;
  max_staff: number;
  is_active: boolean;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
  _count?: { subscriptions: number; payments: number };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_branches: number;
  max_members: number;
  max_staff: number;
  storage_limit_gb: number;
  api_access: boolean;
  features: Record<string, boolean>;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  discount_percent: number | null;
  discount_label: string | null;
  discount_expires_at: string | null;
  effective_monthly_price: number;
  effective_annual_price: number;
  is_discount_active: boolean;
  plan_type: 'regular';
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' | 'TRIALING';
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  canceled_at?: string;
  tenant?: Pick<Tenant, 'id' | 'name' | 'slug'>;
  plan?: Pick<SubscriptionPlan, 'id' | 'name' | 'monthly_price'>;
}

export interface Payment {
  id: string;
  tenant_id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  gateway?: string;
  gateway_payment_id?: string;
  retry_count: number;
  created_at: string;
  tenant?: Pick<Tenant, 'id' | 'name' | 'slug'>;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  is_global: boolean;
  plan_flags: Array<{
    id: string;
    plan_id: string;
    enabled: boolean;
    plan: { id: string; name: string };
  }>;
  tenant_flags: Array<{
    id: string;
    tenant_id: string;
    enabled: boolean;
    tenant: { id: string; name: string };
  }>;
}

export interface DashboardMetrics {
  tenants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    new_last_30d: number;
  };
  subscriptions: {
    active: number;
    expiring_soon: number;
    churned_last_30d: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    last_30d: number;
  };
  churn_rate: number;
}

export interface AuditLog {
  id: string;
  action: string;
  admin_id?: string;
  entity_type: string;
  entity_id?: string;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string;
  created_at: string;
  admin?: { id: string; email: string; name: string };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    data: T[];
    meta: {
      total: number;
      page: number;
      limit: number;
      total_pages: number;
    };
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface RevenueTrend {
  month: string;
  revenue: number;
  count: number;
}

export interface GrowthMetric {
  month: string;
  signups: number;
  cumulative: number;
}

export interface PlanDistribution {
  plan_id: string;
  plan_name: string;
  price_monthly: number;
  tenant_count: number;
  percentage: number;
}
