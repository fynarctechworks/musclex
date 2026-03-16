import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { checkInsApi, type CheckInFilters } from './api';
import { toast } from 'sonner';

export function useCheckIns(filters?: CheckInFilters) {
  return useQuery({
    queryKey: queryKeys.checkIns.list(filters),
    queryFn: () => checkInsApi.list(filters),
  });
}

export function useRecentCheckIns(branchId?: string, limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.checkIns.all, 'recent', branchId, limit],
    queryFn: () => checkInsApi.list({ branch_id: branchId, limit }),
    refetchInterval: 5000,
  });
}

export function useCheckInHeatmap(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.checkIns.heatmap(branchId),
    queryFn: () => checkInsApi.getHeatmap(branchId),
  });
}

export function useCreateCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkInsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.checkIns.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useFacialCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkInsApi.facial,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.checkIns.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSyncCheckIns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkInsApi.sync,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.checkIns.all });
      toast.success(`Synced ${data.synced} check-ins`);
      if (data.failed > 0) toast.warning(`${data.failed} check-ins failed to sync`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
