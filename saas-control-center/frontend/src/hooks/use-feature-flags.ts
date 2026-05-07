import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { FeatureFlag, ApiResponse } from '@/types';

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<FeatureFlag[]>>('/feature-flags');
      return data.data;
    },
  });
}

export function useSetPlanFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      plan_id: string;
      flag_id: string;
      enabled: boolean;
    }) => {
      await api.post('/feature-flags/plan', dto);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-flags'] }),
  });
}

export function useSetTenantFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      tenant_id: string;
      flag_id: string;
      enabled: boolean;
    }) => {
      await api.post('/feature-flags/tenant', dto);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-flags'] }),
  });
}
