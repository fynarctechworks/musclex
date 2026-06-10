import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export interface Discount {
  id: string;
  name: string;
  plan_id?: string | null;
  type: 'PERCENTAGE' | 'FLAT';
  value: string | number;
  code?: string | null;
  valid_from: string;
  valid_to: string;
  max_uses?: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
  plan?: { id: string; name: string } | null;
}

export function useDiscounts(includeExpired = false) {
  return useQuery({
    queryKey: ['discounts', { includeExpired }],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Discount[]>>(
        `/discounts${includeExpired ? '?include_expired=true' : ''}`,
      );
      return data.data;
    },
  });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const { data } = await api.post<ApiResponse<Discount>>('/discounts', dto);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discounts'] }),
  });
}

export function useUpdateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: Record<string, unknown> & { id: string }) => {
      const { data } = await api.patch<ApiResponse<Discount>>(`/discounts/${id}`, dto);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discounts'] }),
  });
}
