import { apiClient } from '@/lib/api';
import type { MemberDocument, CreateDocumentPayload, UpdateDocumentPayload } from './types';

export const documentsApi = {
  getDocuments: (memberId: string) =>
    apiClient.get<MemberDocument[]>(`/members/${memberId}/documents`),

  uploadDocument: (memberId: string, data: CreateDocumentPayload) =>
    apiClient.post<MemberDocument>(`/members/${memberId}/documents`, data),

  updateDocument: (documentId: string, data: UpdateDocumentPayload) =>
    apiClient.patch<MemberDocument>(`/members/documents/${documentId}`, data),

  deleteDocument: (documentId: string) =>
    apiClient.delete(`/members/documents/${documentId}`),
};
