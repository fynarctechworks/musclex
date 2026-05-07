import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  RevenueTrend,
  GrowthMetric,
  PlanDistribution,
  ApiResponse,
} from '@/types';

export function useRevenueTrend(months = 12) {
  return useQuery({
    queryKey: ['analytics', 'revenue', months],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<RevenueTrend[]>>(
        `/analytics/revenue-trend?months=${months}`,
      );
      return data.data;
    },
  });
}

export function useGrowthMetrics(months = 12) {
  return useQuery({
    queryKey: ['analytics', 'growth', months],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<GrowthMetric[]>>(
        `/analytics/growth?months=${months}`,
      );
      return data.data;
    },
  });
}

export function usePlanDistribution() {
  return useQuery({
    queryKey: ['analytics', 'plan-distribution'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<PlanDistribution[]>>(
        '/analytics/plan-distribution',
      );
      return data.data;
    },
  });
}
