import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { dashboardApi } from './api';

export function useDashboardKpis(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.kpis(branchId),
    queryFn: () => dashboardApi.getKpis(branchId),
  });
}

export function useRevenueChart(months = 6, branchId?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.revenueChart(months, branchId),
    queryFn: () => dashboardApi.getRevenueChart(months, branchId),
  });
}

export function useActivityFeed(limit = 10) {
  return useQuery({
    queryKey: queryKeys.dashboard.activityFeed(limit),
    queryFn: () => dashboardApi.getActivityFeed(limit),
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.dashboard.alerts(),
    queryFn: () => dashboardApi.getAlerts(),
  });
}

export function useBranchComparison() {
  return useQuery({
    queryKey: queryKeys.dashboard.branchComparison(),
    queryFn: () => dashboardApi.getBranchComparison(),
  });
}
