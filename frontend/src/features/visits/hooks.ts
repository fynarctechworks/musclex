import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { visitsApi, type VisitFilters } from './api';

export function useMemberVisitStats(memberId: string) {
  return useQuery({
    queryKey: queryKeys.members.visits(memberId),
    queryFn: () => visitsApi.getMemberVisitStats(memberId),
    enabled: !!memberId,
  });
}

export function useVisitsList(filters?: VisitFilters) {
  return useQuery({
    queryKey: queryKeys.checkIns.list(filters),
    queryFn: () => visitsApi.list(filters),
  });
}

export function useVisitHeatmap(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.checkIns.heatmap(branchId),
    queryFn: () => visitsApi.getHeatmap(branchId),
  });
}

export function useAtRiskMembers(risk?: string) {
  return useQuery({
    queryKey: [...queryKeys.members.churnRisk(), risk] as const,
    queryFn: () => visitsApi.getAtRiskMembers(risk),
  });
}
