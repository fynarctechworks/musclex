import { apiClient } from '@/services/api-client';
import type {
  AnalyticsFilters,
  RevenueFilters,
  MembershipFilters,
  ClassFilters,
  TrainerFilters,
  MemberBehaviorFilters,
  CampaignAnalyticsFilters,
  ReportExportParams,
  DashboardSummary,
  DailyGymMetrics,
  TrendDataPoint,
  RevenueAnalyticsResponse,
  MembershipAnalyticsResponse,
  ClassAnalyticsRecord,
  MemberBehaviorResponse,
  ChurnRiskEntry,
  TrainerAnalyticsRecord,
  CampaignAnalyticsResponse,
  BranchComparisonEntry,
} from './types';

// ── Analytics API ─────────────────────────────────────────

export const analyticsApi = {
  dashboard: (filters?: AnalyticsFilters) =>
    apiClient.get<DashboardSummary>('/analytics/dashboard', { params: filters }),

  dailyMetrics: (filters?: AnalyticsFilters) =>
    apiClient.get<DailyGymMetrics[]>('/analytics/daily-metrics', { params: filters }),

  dailyMetricsTrend: (filters?: AnalyticsFilters) =>
    apiClient.get<TrendDataPoint[]>('/analytics/daily-metrics/trend', { params: filters }),

  revenue: (filters?: RevenueFilters) =>
    apiClient.get<RevenueAnalyticsResponse>('/analytics/revenue', { params: filters }),

  memberships: (filters?: MembershipFilters) =>
    apiClient.get<MembershipAnalyticsResponse>('/analytics/memberships', { params: filters }),

  classes: (filters?: ClassFilters) =>
    apiClient.get<ClassAnalyticsRecord[]>('/analytics/classes', { params: filters }),

  memberBehavior: (filters?: MemberBehaviorFilters) =>
    apiClient.get<MemberBehaviorResponse>('/analytics/members/behavior', { params: filters }),

  churnRisk: (filters?: { branch_id?: string }) =>
    apiClient.get<ChurnRiskEntry[]>('/analytics/members/churn-risk', { params: filters }),

  trainers: (filters?: TrainerFilters) =>
    apiClient.get<TrainerAnalyticsRecord[]>('/analytics/trainers', { params: filters }),

  trainerLeaderboard: (filters?: TrainerFilters) =>
    apiClient.get<TrainerAnalyticsRecord[]>('/analytics/trainers/leaderboard', { params: filters }),

  campaigns: (filters?: CampaignAnalyticsFilters) =>
    apiClient.get<CampaignAnalyticsResponse>('/analytics/campaigns', { params: filters }),

  branchComparison: (filters?: AnalyticsFilters & { organization_id?: string }) =>
    apiClient.get<BranchComparisonEntry[]>('/analytics/branch-comparison', { params: filters }),
};

// ── Reports Export API ────────────────────────────────────

export const reportsApi = {
  export: (params: ReportExportParams) =>
    apiClient.get('/reports/export', { params }),

  revenue: (params?: { branch_id?: string; start_date?: string; end_date?: string; format?: string }) =>
    apiClient.get('/reports/revenue', { params }),

  membership: (params?: { branch_id?: string; start_date?: string; end_date?: string; format?: string }) =>
    apiClient.get('/reports/membership', { params }),

  attendance: (params?: { branch_id?: string; start_date?: string; end_date?: string; format?: string }) =>
    apiClient.get('/reports/attendance', { params }),

  trainers: (params?: { branch_id?: string; start_date?: string; end_date?: string; format?: string }) =>
    apiClient.get('/reports/trainers', { params }),

  inventory: (params?: { branch_id?: string; start_date?: string; end_date?: string; format?: string }) =>
    apiClient.get('/reports/inventory', { params }),
};
