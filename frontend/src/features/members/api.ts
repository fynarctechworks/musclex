import { apiClient } from '@/services/api-client';
import type { Member, PaginatedResponse } from '@/types';

export interface CreateMemberDto {
  branch_id: string;
  full_name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  checkin_method?: string;
}

export interface MemberFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  branch_id?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export const membersApi = {
  list: (filters?: MemberFilters) =>
    apiClient.get<PaginatedResponse<Member>>('/members', { params: filters }),

  getById: (id: string) =>
    apiClient.get<Member>(`/members/${id}`),

  create: (data: CreateMemberDto) =>
    apiClient.post<Member>('/members', data),

  update: (id: string, data: Partial<CreateMemberDto>) =>
    apiClient.patch<Member>(`/members/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/members/${id}`),

  getProfile: (id: string) =>
    apiClient.get(`/members/${id}/profile`),

  getBodyStats: (id: string) =>
    apiClient.get(`/members/${id}/body-stats`),

  getVisits: (id: string) =>
    apiClient.get(`/members/${id}/visits`),

  getNotes: (id: string) =>
    apiClient.get(`/members/${id}/notes`),

  addNote: (id: string, content: string) =>
    apiClient.post(`/members/${id}/notes`, { content }),

  getTags: (id: string) =>
    apiClient.get(`/members/${id}/tags`),

  getDocuments: (id: string) =>
    apiClient.get(`/members/${id}/documents`),

  freeze: (id: string, data: { reason: string; end_date?: string }) =>
    apiClient.post(`/members/${id}/freeze`, data),

  unfreeze: (id: string) =>
    apiClient.post(`/members/${id}/unfreeze`),

  renew: (id: string, data: { plan_id: string }) =>
    apiClient.post(`/members/${id}/renew`, data),

  getChurnRisk: () =>
    apiClient.get('/members/churn-risk'),

  setFaceDescriptor: (id: string, descriptor: number[]) =>
    apiClient.post(`/members/${id}/face-descriptor`, { face_descriptor: descriptor }),
};
