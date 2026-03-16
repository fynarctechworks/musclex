// ── Analytics Query Filters ───────────────────────────────

export interface AnalyticsFilters {
  branch_id?: string;
  start_date?: string;
  end_date?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}

export interface RevenueFilters extends AnalyticsFilters {
  revenue_type?: 'membership' | 'personal_training' | 'classes' | 'retail' | 'other';
}

export interface MembershipFilters extends AnalyticsFilters {
  plan_id?: string;
}

export interface ClassFilters extends AnalyticsFilters {
  class_template_id?: string;
}

export interface TrainerFilters extends AnalyticsFilters {
  trainer_id?: string;
}

export interface MemberBehaviorFilters {
  branch_id?: string;
  churn_risk?: 'low' | 'medium' | 'high' | 'critical';
  min_engagement?: number;
  max_engagement?: number;
  page?: number;
  limit?: number;
}

export interface CampaignAnalyticsFilters {
  campaign_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface ReportExportParams {
  report_type: 'revenue' | 'membership' | 'attendance' | 'trainer' | 'inventory' | 'daily_metrics';
  format: 'csv' | 'pdf';
  branch_id?: string;
  start_date?: string;
  end_date?: string;
}

// ── Daily Gym Metrics ─────────────────────────────────────

export interface DailyGymMetrics {
  id: string;
  organization_id: string | null;
  branch_id: string | null;
  date: string;
  total_revenue: number;
  new_members: number;
  active_members: number;
  total_visits: number;
  classes_held: number;
  products_sold: number;
  created_at: string;
}

// ── Trend Data Point ──────────────────────────────────────

export interface TrendDataPoint {
  date: string;
  total_revenue: number;
  new_members: number;
  active_members: number;
  total_visits: number;
  classes_held: number;
  products_sold: number;
}

// ── Revenue Analytics ─────────────────────────────────────

export interface RevenueAnalyticsRecord {
  id: string;
  revenue_type: string;
  amount: number;
  transaction_count: number;
  period_start: string;
  period_end: string;
}

export interface RevenueAnalyticsResponse {
  records: RevenueAnalyticsRecord[];
  totals: Array<{
    revenue_type: string;
    _sum: { amount: number; transaction_count: number };
  }>;
}

// ── Membership Analytics ──────────────────────────────────

export interface MembershipAnalyticsRecord {
  id: string;
  plan_id: string | null;
  total_active: number;
  renewals: number;
  cancellations: number;
  new_signups: number;
  churn_rate: number;
  period_start: string;
  period_end: string;
  plan?: { name: string } | null;
}

export interface MembershipAnalyticsResponse {
  records: MembershipAnalyticsRecord[];
  summary: {
    _sum: {
      total_active: number | null;
      renewals: number | null;
      cancellations: number | null;
      new_signups: number | null;
    };
    _avg: { churn_rate: number | null };
  };
}

// ── Class Analytics ───────────────────────────────────────

export interface ClassAnalyticsRecord {
  id: string;
  class_template_id: string | null;
  total_sessions: number;
  total_bookings: number;
  average_attendance: number;
  no_show_rate: number;
  occupancy_rate: number;
  period_start: string;
  period_end: string;
  class_template?: { name: string; category: string } | null;
}

// ── Member Behavior Analytics ─────────────────────────────

export interface MemberBehaviorRecord {
  id: string;
  member_id: string;
  visit_frequency: number;
  classes_attended: number;
  pt_sessions: number;
  last_visit_date: string | null;
  days_since_visit: number;
  engagement_score: number;
  churn_risk: 'low' | 'medium' | 'high' | 'critical';
  member?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface MemberBehaviorResponse {
  records: MemberBehaviorRecord[];
  total: number;
  page: number;
  limit: number;
}

// ── Churn Risk Summary ────────────────────────────────────

export interface ChurnRiskEntry {
  churn_risk: string;
  _count: number;
  _avg: { engagement_score: number | null };
}

// ── Trainer Analytics ─────────────────────────────────────

export interface TrainerAnalyticsRecord {
  id: string;
  trainer_id: string;
  sessions_conducted: number;
  members_trained: number;
  average_rating: number;
  revenue_generated: number;
  no_show_rate: number;
  period_start: string;
  period_end: string;
  trainer?: {
    first_name: string;
    last_name: string;
    specializations: string[];
  } | null;
}

// ── Campaign Analytics ────────────────────────────────────

export interface CampaignAnalyticsRecord {
  id: string;
  campaign_id: string;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  bounced: number;
  revenue_generated: number;
  campaign?: {
    name: string;
    segment: string;
    channels: string[];
  } | null;
}

export interface CampaignAnalyticsSummary {
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  bounced: number;
  revenue_generated: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
}

export interface CampaignAnalyticsResponse {
  records: CampaignAnalyticsRecord[];
  summary: CampaignAnalyticsSummary;
}

// ── Dashboard Summary ─────────────────────────────────────

export interface DashboardSummary {
  today: DailyGymMetrics | null;
  revenue_breakdown: Array<{ revenue_type: string; _sum: { amount: number } }>;
  membership_summary: {
    _sum: { total_active: number | null; new_signups: number | null };
    _avg: { churn_rate: number | null };
  };
  top_classes: Array<{
    class_template_id: string;
    _sum: { total_bookings: number };
    class_template?: { name: string } | null;
  }>;
}

// ── Branch Comparison ─────────────────────────────────────

export interface BranchComparisonEntry {
  branch_id: string;
  _sum: {
    total_revenue: number;
    new_members: number;
    active_members: number;
    total_visits: number;
  };
}

// ── Report Tab ────────────────────────────────────────────

export type ReportTab = 'overview' | 'revenue' | 'members' | 'attendance' | 'marketing' | 'trainers' | 'subscriptions';
