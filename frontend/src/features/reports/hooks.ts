import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { analyticsApi } from './api';
import type {
  AnalyticsFilters,
  RevenueFilters,
  MembershipFilters,
  ClassFilters,
  TrainerFilters,
  MemberBehaviorFilters,
  CampaignAnalyticsFilters,
} from './types';

// ── Dashboard Summary ─────────────────────────────────────

export function useAnalyticsDashboard(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(filters),
    queryFn: () => analyticsApi.dashboard(filters),
  });
}

// ── Daily Metrics ─────────────────────────────────────────

export function useDailyMetrics(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.dailyMetrics(filters),
    queryFn: () => analyticsApi.dailyMetrics(filters),
  });
}

export function useDailyMetricsTrend(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.trend(filters),
    queryFn: () => analyticsApi.dailyMetricsTrend(filters),
  });
}

// ── Revenue ───────────────────────────────────────────────

export function useRevenueAnalytics(filters?: RevenueFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.revenue(filters),
    queryFn: () => analyticsApi.revenue(filters),
  });
}

// ── Memberships ───────────────────────────────────────────

export function useMembershipAnalytics(filters?: MembershipFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.memberships(filters),
    queryFn: () => analyticsApi.memberships(filters),
  });
}

// ── Classes ───────────────────────────────────────────────

export function useClassAnalytics(filters?: ClassFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.classes(filters),
    queryFn: () => analyticsApi.classes(filters),
  });
}

// ── Member Behavior ───────────────────────────────────────

export function useMemberBehavior(filters?: MemberBehaviorFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.memberBehavior(filters),
    queryFn: () => analyticsApi.memberBehavior(filters),
  });
}

export function useChurnRisk(filters?: { branch_id?: string }) {
  return useQuery({
    queryKey: queryKeys.analytics.churnRisk(filters),
    queryFn: () => analyticsApi.churnRisk(filters),
  });
}

// ── Trainers ──────────────────────────────────────────────

export function useTrainerAnalytics(filters?: TrainerFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.trainers(filters),
    queryFn: () => analyticsApi.trainers(filters),
  });
}

export function useTrainerLeaderboard(filters?: TrainerFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.trainerLeaderboard(filters),
    queryFn: () => analyticsApi.trainerLeaderboard(filters),
  });
}

// ── Campaign Analytics ────────────────────────────────────

export function useCampaignAnalytics(filters?: CampaignAnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.analytics.campaigns(filters),
    queryFn: () => analyticsApi.campaigns(filters),
  });
}

// ── Branch Comparison ─────────────────────────────────────

export function useBranchComparison(filters?: AnalyticsFilters & { organization_id?: string }) {
  return useQuery({
    queryKey: queryKeys.analytics.branchComparison(filters),
    queryFn: () => analyticsApi.branchComparison(filters),
    enabled: !!filters?.organization_id,
  });
}
