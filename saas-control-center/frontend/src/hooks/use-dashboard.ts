import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DashboardMetrics, ApiResponse } from '@/types';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DashboardMetrics>>(
        '/dashboard/metrics',
      );
      return data.data;
    },
    refetchInterval: 30 * 1000, // refresh every 30s
    staleTime: 0, // always consider data stale so it refetches on mount
  });
}

export function useRefreshDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiResponse<DashboardMetrics>>(
        '/dashboard/metrics/refresh',
      );
      return data.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['dashboard', 'metrics'], data);
    },
  });
}
