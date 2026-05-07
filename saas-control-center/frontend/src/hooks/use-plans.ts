import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SubscriptionPlan, ApiResponse } from '@/types';

export function usePlans(includeInactive = false) {
  return useQuery({
    queryKey: ['plans', { includeInactive }],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SubscriptionPlan[]>>(
        `/plans${includeInactive ? '?include_inactive=true' : ''}`,
      );
      return data.data;
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Record<string, any>) => {
      const { data } = await api.post<ApiResponse<SubscriptionPlan>>(
        '/plans',
        plan,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...plan
    }: Record<string, any> & { id: string }) => {
      const { data } = await api.patch<ApiResponse<SubscriptionPlan>>(
        `/plans/${id}`,
        plan,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useTogglePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<SubscriptionPlan>>(
        `/plans/${id}/toggle`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useToggleFeatured() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiResponse<SubscriptionPlan>>(
        `/plans/${id}/featured`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<ApiResponse<{ success: boolean }>>(
        `/plans/${id}`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}
