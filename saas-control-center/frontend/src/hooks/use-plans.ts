import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SubscriptionPlan, ApiResponse } from '@/types';

export function usePlans(includeInactive = false) {
  return useQuery({
    queryKey: ['plans', { includeInactive }],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SubscriptionPlan[]>>(
        `/plans${includeInactive ? '?include_inactive=true' : ''}`,
      );
      return data.data;
    },
  });
}

export interface AssignablePlan {
  id: string;
  name: string;
  price_monthly: number;
}

/**
 * Plans valid for tenant assignment, returned from the scc table that
 * `Tenant.plan_id` references — so the selected id is always a valid FK target.
 * Use this for the Add-Tenant / change-plan pickers (NOT usePlans, which lists
 * the public onboarding catalog with different UUIDs).
 */
export function useAssignablePlans() {
  return useQuery({
    queryKey: ['plans', 'assignable'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AssignablePlan[]>>(
        '/plans/assignable',
      );
      return data.data;
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Record<string, any>) => {
      const { data } = await api.post<ApiResponse<SubscriptionPlan>>(
        '/plans',
        plan,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...plan
    }: Record<string, any> & { id: string }) => {
      const { data } = await api.patch<ApiResponse<SubscriptionPlan>>(
        `/plans/${id}`,
        plan,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useTogglePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<SubscriptionPlan>>(
        `/plans/${id}/toggle`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useToggleFeatured() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiResponse<SubscriptionPlan>>(
        `/plans/${id}/featured`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export interface GstSettings {
  gst_enabled: boolean;
  gst_percent: number;
  gst_label: string;
}

/** Platform-wide subscription GST rate (applied on top of plan prices). */
export function useGstSettings() {
  return useQuery({
    queryKey: ['plans', 'gst'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<GstSettings>>('/plans/billing/gst');
      return data.data;
    },
  });
}

export function useUpdateGstSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GstSettings) => {
      const { data } = await api.put<ApiResponse<GstSettings>>(
        '/plans/billing/gst',
        payload,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans', 'gst'] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<ApiResponse<{ success: boolean }>>(
        `/plans/${id}`,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });
}
