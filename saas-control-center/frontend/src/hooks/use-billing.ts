import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Payment, ApiResponse } from '@/types';

interface PaymentFilters {
  page?: number;
  limit?: number;
  status?: string;
  tenant_id?: string;
  gateway?: string;
}

export function usePayments(filters: PaymentFilters = {}) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '')
          params.set(key, String(value));
      });
      const { data } = await api.get(`/billing/payments?${params}`);
      return data as {
        data: Payment[];
        meta: { total: number; page: number; limit: number; total_pages: number };
      };
    },
  });
}

export function useRetryPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<Payment>>(
        `/billing/payments/${id}/retry`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<Payment>>(
        `/billing/payments/${id}/refund`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}
