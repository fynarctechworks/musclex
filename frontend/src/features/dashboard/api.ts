import { apiClient } from '@/services/api-client';
import type { DashboardKPIs, RevenueDataPoint, ActivityFeedItem, Alert } from '@/types';

export const dashboardApi = {
  getKpis: (branchId?: string) =>
    apiClient.get<DashboardKPIs>('/dashboard/kpis', { params: branchId ? { branch_id: branchId } : undefined }),

  getRevenueChart: (months = 6, branchId?: string) =>
    apiClient.get<RevenueDataPoint[]>('/dashboard/revenue-chart', { params: { months, branch_id: branchId } }),

  getActivityFeed: (limit = 10) =>
    apiClient.get<ActivityFeedItem[]>('/dashboard/activity-feed', { params: { limit } }),

  getAlerts: () =>
    apiClient.get<Alert[]>('/dashboard/alerts'),

  getBranchComparison: () =>
    apiClient.get('/dashboard/branch-comparison'),
};
