import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Tenant, ApiResponse } from '@/types';

interface TenantFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  plan_id?: string;
}

export function useTenants(filters: TenantFilters = {}) {
  return useQuery({
    queryKey: ['tenants', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '')
          params.set(key, String(value));
      });
      const { data } = await api.get(`/tenants?${params}`);
      return data as {
        data: Tenant[];
        meta: { total: number; page: number; limit: number; total_pages: number };
      };
    },
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenants', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Tenant>>(`/tenants/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenant: Partial<Tenant>) => {
      const { data } = await api.post<ApiResponse<Tenant>>('/tenants', tenant);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });
}

export function useSuspendTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<Tenant>>(
        `/tenants/${id}/suspend`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });
}

export function useActivateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<Tenant>>(
        `/tenants/${id}/activate`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });
}
