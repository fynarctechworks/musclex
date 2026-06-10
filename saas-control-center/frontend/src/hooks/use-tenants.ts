import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Tenant, ApiResponse, TenantOperationalDetail } from '@/types';

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

export function useTenantOperational(id: string | null) {
  return useQuery({
    queryKey: ['tenant-operational', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TenantOperationalDetail>>(
        `/tenants/${id}/operational`,
      );
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

export function useChangeTenantPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, plan_id }: { id: string; plan_id: string }) => {
      const { data } = await api.patch<ApiResponse<unknown>>(
        `/tenants/${id}/plan`,
        { plan_id },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

export function useSyncTenants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<
        ApiResponse<{ imported: number; updated: number; total: number }>
      >('/tenants/sync');
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useImpersonateTenant() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<{ token: string; expires_at?: string }>>(
        `/tenants/${id}/impersonate`,
      );
      return data.data;
    },
  });
}
