import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { membersApi, type MemberFilters, type CreateMemberDto } from './api';
import { toast } from 'sonner';

export function useMembers(filters?: MemberFilters) {
  return useQuery({
    queryKey: queryKeys.members.list(filters),
    queryFn: () => membersApi.list(filters),
  });
}

export function useMember(id: string) {
  return useQuery({
    queryKey: queryKeys.members.detail(id),
    queryFn: () => membersApi.getById(id),
    enabled: !!id,
  });
}

export function useMemberProfile(id: string) {
  return useQuery({
    queryKey: queryKeys.members.profile(id),
    queryFn: () => membersApi.getProfile(id),
    enabled: !!id,
  });
}

export function useMemberBodyStats(id: string) {
  return useQuery({
    queryKey: queryKeys.members.bodyStats(id),
    queryFn: () => membersApi.getBodyStats(id),
    enabled: !!id,
  });
}

export function useMemberNotes(id: string) {
  return useQuery({
    queryKey: queryKeys.members.notes(id),
    queryFn: () => membersApi.getNotes(id),
    enabled: !!id,
  });
}

export function useChurnRisk() {
  return useQuery({
    queryKey: queryKeys.members.churnRisk(),
    queryFn: () => membersApi.getChurnRisk(),
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMemberDto) => membersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Member created successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateMemberDto> & Record<string, unknown>) => membersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Member updated successfully');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => membersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Member deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useFreezeMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason: string; end_date: string }) => membersApi.freeze(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Membership frozen');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnfreezeMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => membersApi.unfreeze(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Membership unfrozen');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRenewMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { plan_id: string; payment_method?: string }) => membersApi.renew(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Membership renewed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeactivateMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => membersApi.update(id, { status: 'inactive' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Member deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActivateMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => membersApi.update(id, { status: 'active' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      toast.success('Member activated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSaveMemberNotes(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => membersApi.addNote(id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.members.notes(id) });
      toast.success('Notes saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
