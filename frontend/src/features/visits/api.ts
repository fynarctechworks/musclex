import { apiClient } from '@/services/api-client';
import type { CheckIn } from '@/types';
import type { VisitStats, AtRiskMember } from './types';

export interface VisitFilters {
  page?: number;
  limit?: number;
  member_id?: string;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  method?: string;
}

export const visitsApi = {
  /** Get check-in list with filters (reuses /check-ins endpoint) */
  list: (filters?: VisitFilters) =>
    apiClient.get<{ data: CheckIn[]; total: number }>('/check-ins', { params: filters }),

  /** Get member-specific visit stats */
  getMemberVisitStats: (memberId: string) =>
    apiClient.get<VisitStats>(`/members/${memberId}/visits`),

  /** Get heatmap data (7×24 grid) */
  getHeatmap: (branchId?: string) =>
    apiClient.get<number[][]>('/check-ins/heatmap', {
      params: branchId ? { branch_id: branchId } : undefined,
    }),

  /** Get at-risk / churn-risk members */
  getAtRiskMembers: (risk?: string) =>
    apiClient.get<AtRiskMember[]>('/members/churn-risk', {
      params: risk ? { risk } : undefined,
    }),
};
