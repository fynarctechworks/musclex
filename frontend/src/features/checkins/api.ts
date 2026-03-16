import { apiClient } from '@/services/api-client';
import type { CheckIn } from '@/types';
import type { CheckInResponse, FacialCheckInResponse, SyncResult } from './types';

export interface CheckInFilters {
  page?: number;
  limit?: number;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  method?: string;
  member_id?: string;
}

export const checkInsApi = {
  list: (filters?: CheckInFilters) =>
    apiClient.get<{ data: CheckIn[]; total: number }>('/check-ins', { params: filters }),

  create: (data: {
    member_id?: string;
    qr_code?: string;
    branch_id: string;
    checkin_method: string;
    class_id?: string;
  }) => apiClient.post<CheckInResponse>('/check-ins', data),

  facial: (data: { descriptor: number[]; branch_id: string }) =>
    apiClient.post<FacialCheckInResponse>('/check-ins/facial', data),

  getHeatmap: (branchId?: string) =>
    apiClient.get<number[][]>('/check-ins/heatmap', { params: branchId ? { branch_id: branchId } : undefined }),

  sync: (checkIns: Array<{
    member_id: string;
    branch_id: string;
    checkin_method: string;
    checked_in_at: string;
    class_id?: string;
  }>) => apiClient.post<SyncResult>('/check-ins/sync', { check_ins: checkIns }),
};
