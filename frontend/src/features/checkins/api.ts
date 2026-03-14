import { apiClient } from '@/services/api-client';
import type { CheckIn } from '@/types';

export interface CheckInFilters {
  page?: number;
  limit?: number;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  method?: string;
}

export const checkInsApi = {
  list: (filters?: CheckInFilters) =>
    apiClient.get<{ data: CheckIn[]; total: number }>('/check-ins', { params: filters }),

  create: (data: { member_id: string; branch_id: string; method: string; membership_id?: string }) =>
    apiClient.post<CheckIn>('/check-ins', data),

  facial: (data: { branch_id: string; face_descriptor: number[] }) =>
    apiClient.post<CheckIn>('/check-ins/facial', data),

  getHeatmap: (branchId?: string) =>
    apiClient.get('/check-ins/heatmap', { params: branchId ? { branch_id: branchId } : undefined }),

  sync: (checkIns: Array<{ member_id: string; branch_id: string; method: string; checked_in_at: string }>) =>
    apiClient.post('/check-ins/sync', { check_ins: checkIns }),
};
