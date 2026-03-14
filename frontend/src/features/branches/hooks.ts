import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { branchesApi, type BranchFilters } from './api';
import { toast } from 'sonner';

export function useBranches(filters?: BranchFilters) {
  return useQuery({
    queryKey: queryKeys.branches.list(filters),
    queryFn: () => branchesApi.list(filters),
  });
}

export function useBranch(id: string) {
  return useQuery({
    queryKey: queryKeys.branches.detail(id),
    queryFn: () => branchesApi.get(id),
    enabled: !!id,
  });
}

export function useBranchSettings(id: string) {
  return useQuery({
    queryKey: queryKeys.branches.settings(id),
    queryFn: () => branchesApi.getSettings(id),
    enabled: !!id,
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: branchesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches.all });
      toast.success('Branch created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      branchesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches.all });
      toast.success('Branch updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: branchesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches.all });
      toast.success('Branch deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBranchSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      branchesApi.updateSettings(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches.all });
      toast.success('Branch settings updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
