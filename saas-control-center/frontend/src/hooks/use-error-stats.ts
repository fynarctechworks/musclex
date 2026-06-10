import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ErrorStats } from '@/types/monitoring';

export function useErrorStats() {
  return useQuery({
    queryKey: ['error-stats'],
    queryFn: async () => {
      const { data } = await api.get('/system-errors/stats');
      return data.data as ErrorStats;
    },
    refetchInterval: 30_000,
  });
}
