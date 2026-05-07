import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AuditLog } from '@/types';

interface AuditFilters {
  page?: number;
  limit?: number;
  action?: string;
  entity_type?: string;
}

export function useAuditLogs(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '')
          params.set(key, String(value));
      });
      const { data } = await api.get(`/audit-logs?${params}`);
      return data as {
        data: AuditLog[];
        meta: { total: number; page: number; limit: number; total_pages: number };
      };
    },
  });
}
