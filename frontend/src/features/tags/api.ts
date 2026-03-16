import { apiClient } from '@/services/api-client';
import type { MemberTag, MemberTagAssignment, CreateTagPayload } from './types';

export const tagsApi = {
  getAllTags: () =>
    apiClient.get<MemberTag[]>('/members/tags/all'),

  createTag: (data: CreateTagPayload) =>
    apiClient.post<MemberTag>('/members/tags', data),

  deleteTag: (tagId: string) =>
    apiClient.delete(`/members/tags/${tagId}`),

  getMemberTags: (memberId: string) =>
    apiClient.get<MemberTagAssignment[]>(`/members/${memberId}/tags`),

  assignTag: (memberId: string, tagId: string) =>
    apiClient.post<MemberTagAssignment>(`/members/${memberId}/tags`, { tag_id: tagId }),

  removeTag: (memberId: string, tagId: string) =>
    apiClient.delete(`/members/${memberId}/tags/${tagId}`),
};
