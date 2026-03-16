import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { documentsApi } from './api';
import { toast } from 'sonner';
import type { CreateDocumentPayload, UpdateDocumentPayload } from './types';

export function useDocuments(memberId: string) {
  return useQuery({
    queryKey: queryKeys.members.documents(memberId),
    queryFn: () => documentsApi.getDocuments(memberId),
    enabled: !!memberId,
  });
}

export function useUploadDocument(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentPayload) => documentsApi.uploadDocument(memberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.documents(memberId) });
      toast.success('Document uploaded');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDocument(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, data }: { documentId: string; data: UpdateDocumentPayload }) =>
      documentsApi.updateDocument(documentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.documents(memberId) });
      toast.success('Document updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDocument(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => documentsApi.deleteDocument(documentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.documents(memberId) });
      toast.success('Document deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
