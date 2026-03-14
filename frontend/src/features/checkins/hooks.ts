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

export function useCheckInHeatmap(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.checkIns.heatmap(branchId),
    queryFn: () => checkInsApi.getHeatmap(branchId),
  });
}

export function useCreateCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { member_id: string; branch_id: string; method: string; membership_id?: string }) =>
      checkInsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.checkIns.all });
      toast.success('Check-in recorded');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useFacialCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { branch_id: string; face_descriptor: number[] }) =>
      checkInsApi.facial(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.checkIns.all });
      toast.success('Facial check-in successful');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
