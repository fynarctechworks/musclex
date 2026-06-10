import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Subscription, ApiResponse } from '@/types';

interface SubFilters {
  page?: number;
  limit?: number;
  status?: string;
  tenant_id?: string;
}

export function useSubscriptions(filters: SubFilters = {}) {
  return useQuery({
    queryKey: ['subscriptions', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '')
          params.set(key, String(value));
      });
      const { data } = await api.get(`/subscriptions?${params}`);
      return data as {
        data: Subscription[];
        meta: { total: number; page: number; limit: number; total_pages: number };
      };
    },
  });
}

export function useExpiringSubscriptions(days = 7) {
  return useQuery({
    queryKey: ['subscriptions', 'expiring', days],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Subscription[]>>(
        `/subscriptions/expiring?days=${days}`,
      );
      return data.data;
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<Subscription>>(
        `/subscriptions/${id}/cancel`,
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
