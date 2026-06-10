import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  SystemError,
  SystemErrorDetail,
  ErrorSeverity,
  ErrorStatus,
} from '@/types/monitoring';

export interface ErrorFilters {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
  source?: string;
  environment?: string;
  module?: string;
  tenant_id?: string;
  q?: string;
  from?: string;
  to?: string;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; total_pages: number };
}

export function useSystemErrors(filters: ErrorFilters = {}) {
  return useQuery({
    queryKey: ['system-errors', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      const { data } = await api.get(`/system-errors?${params}`);
      return data as Paginated<SystemError>;
    },
  });
}

export function useSystemError(id: string) {
  return useQuery({
    queryKey: ['system-errors', id],
    queryFn: async () => {
      const { data } = await api.get(`/system-errors/${id}`);
      return data.data as SystemErrorDetail;
    },
    enabled: !!id,
  });
}

export interface UpdateErrorPayload {
  status?: ErrorStatus;
  severity?: ErrorSeverity;
  assigned_to?: string;
  resolution_note?: string;
}

export function useUpdateError(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateErrorPayload) => {
      const { data } = await api.patch(`/system-errors/${id}`, payload);
      return data.data as SystemError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-errors'] });
      qc.invalidateQueries({ queryKey: ['error-stats'] });
    },
  });
}

export function useBulkResolve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ids: string[]; resolution_note?: string }) => {
      const { data } = await api.post('/system-errors/bulk-resolve', payload);
      return data.data as { resolved: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-errors'] });
      qc.invalidateQueries({ queryKey: ['error-stats'] });
    },
  });
}
