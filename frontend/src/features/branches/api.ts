import { apiClient } from '@/services/api-client';

export interface BranchFilters {
  organization_id?: string;
  region_id?: string;
  status?: string;
}

export const branchesApi = {
  list: (filters?: BranchFilters) =>
    apiClient.get('/branches', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/branches/${id}`),

  create: (data: {
    name: string;
    organization_id?: string;
    region_id?: string;
    code?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    email?: string;
    status?: 'active' | 'inactive' | 'temporarily_closed' | 'coming_soon';
    opening_time?: string;
    closing_time?: string;
  }) => apiClient.post('/branches', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/branches/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/branches/${id}`),

  getSettings: (id: string) =>
    apiClient.get(`/branches/${id}/settings`),

  updateSettings: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/branches/${id}/settings`, data),
};
