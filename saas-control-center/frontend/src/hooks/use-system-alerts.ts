import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SystemAlert } from '@/types/monitoring';

interface AlertFilters {
  page?: number;
  limit?: number;
  acknowledged?: boolean;
  severity?: string;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; total_pages: number };
}

export function useSystemAlerts(filters: AlertFilters = {}) {
  return useQuery({
    queryKey: ['system-alerts', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      const { data } = await api.get(`/system-alerts?${params}`);
      return data as Paginated<SystemAlert>;
    },
  });
}

export function useAckAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/system-alerts/${id}/ack`);
      return data.data as SystemAlert;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-alerts'] }),
  });
}
