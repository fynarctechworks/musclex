import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { posApi } from './api';
import { toast } from 'sonner';
import { captureError, Source } from '@/lib/observability/capture';
import type { CreatePosSalePayload, CreateReturnPayload, SalesFilters } from './types';

export function useSales(filters?: SalesFilters) {
  return useQuery({
    queryKey: queryKeys.pos.sales(filters),
    queryFn: () => posApi.getSales(filters),
  });
}

export function useSale(id: string) {
  return useQuery({
    queryKey: queryKeys.pos.sale(id),
    queryFn: () => posApi.getSale(id),
    enabled: !!id,
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePosSalePayload) => posApi.createSale(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pos.all });
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success('Sale completed');
    },
    onError: (err: Error) => {
      toast.error(err.message);
      captureError(Source.POS, err, { module: 'pos-checkout', severity: 'HIGH' });
    },
  });
}

export function useDailyReport(branchId: string, date?: string) {
  return useQuery({
    queryKey: queryKeys.pos.dailyReport(branchId, date),
    queryFn: () => posApi.getDailyReport(branchId, date),
    enabled: !!branchId,
  });
}

export function useTopProducts(filters?: { branch_id?: string; start_date?: string; end_date?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.pos.topProducts(filters),
    queryFn: () => posApi.getTopProducts(filters),
  });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReturnPayload) => posApi.createReturn(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pos.all });
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success('Return processed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
