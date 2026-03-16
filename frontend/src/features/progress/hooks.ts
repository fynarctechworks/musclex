import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { progressApi } from './api';
import { toast } from 'sonner';
import type { CreateBodyStatPayload, CreateProgressPhotoPayload } from './types';

export function useBodyStats(memberId: string) {
  return useQuery({
    queryKey: queryKeys.members.bodyStats(memberId),
    queryFn: () => progressApi.getBodyStats(memberId),
    enabled: !!memberId,
  });
}

export function useProgressSummary(memberId: string) {
  return useQuery({
    queryKey: queryKeys.members.progressSummary(memberId),
    queryFn: () => progressApi.getProgressSummary(memberId),
    enabled: !!memberId,
  });
}

export function useProgressPhotos(memberId: string) {
  return useQuery({
    queryKey: queryKeys.members.progressPhotos(memberId),
    queryFn: () => progressApi.getProgressPhotos(memberId),
    enabled: !!memberId,
  });
}

export function useCreateBodyStat(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBodyStatPayload) => progressApi.createBodyStat(memberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.bodyStats(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.progressSummary(memberId) });
      toast.success('Measurement recorded');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBodyStat(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ statsId, data }: { statsId: string; data: Partial<CreateBodyStatPayload> }) =>
      progressApi.updateBodyStat(statsId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.bodyStats(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.progressSummary(memberId) });
      toast.success('Measurement updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBodyStat(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (statsId: string) => progressApi.deleteBodyStat(statsId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.bodyStats(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.progressSummary(memberId) });
      toast.success('Measurement deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateProgressPhoto(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProgressPhotoPayload) => progressApi.createProgressPhoto(memberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.progressPhotos(memberId) });
      toast.success('Photo added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteProgressPhoto(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => progressApi.deleteProgressPhoto(photoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.progressPhotos(memberId) });
      toast.success('Photo deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
