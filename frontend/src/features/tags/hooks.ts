import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { tagsApi } from './api';
import { toast } from 'sonner';
import type { CreateTagPayload } from './types';

export function useAllTags() {
  return useQuery({
    queryKey: queryKeys.members.allTags(),
    queryFn: () => tagsApi.getAllTags(),
  });
}

export function useMemberTags(memberId: string) {
  return useQuery({
    queryKey: queryKeys.members.tags(memberId),
    queryFn: () => tagsApi.getMemberTags(memberId),
    enabled: !!memberId,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTagPayload) => tagsApi.createTag(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.allTags() });
      toast.success('Tag created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.deleteTag(tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.allTags() });
      toast.success('Tag deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAssignTag(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.assignTag(memberId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.tags(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.allTags() });
      toast.success('Tag assigned');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveTag(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.removeTag(memberId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.tags(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.allTags() });
      toast.success('Tag removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
