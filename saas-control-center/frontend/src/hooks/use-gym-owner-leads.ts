import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse } from '@/types';

/**
 * Gym-owner enquiries submitted on the public marketing website.
 *
 * NOT the member-app leads in `use-member-app.ts` — those are registered
 * consumer app users who have not joined a gym yet. These are prospective
 * tenants: gym owners asking about MuscleX before they have an account.
 */

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'LOST',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface GymOwnerLead {
  id: string;
  name: string;
  studio_name: string;
  email: string;
  phone: string;
  branches?: string | null;
  topic?: string | null;
  message: string;
  status: LeadStatus;
  notes?: string | null;
  source: string;
  user_agent?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GymOwnerLeadsPage {
  data: GymOwnerLead[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    statusCounts: Record<string, number>;
  };
}

export function useGymOwnerLeads(params: {
  status?: LeadStatus | 'ALL';
  search?: string;
  page?: number;
}) {
  const { status, search, page = 1 } = params;

  return useQuery({
    queryKey: ['gym-owner-leads', { status, search, page }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (status && status !== 'ALL') qs.set('status', status);
      if (search) qs.set('search', search);
      qs.set('page', String(page));
      // The SCC's ResponseTransformInterceptor hoists `meta` to the TOP level
      // of the envelope ({ success, data, meta }) rather than nesting it under
      // `data`. Reassemble both halves here so callers get one object.
      const { data: envelope } = await api.get<ApiResponse<GymOwnerLead[]>>(
        `/gym-owner-leads?${qs.toString()}`,
      );
      return {
        data: envelope.data,
        meta: (envelope as unknown as { meta: GymOwnerLeadsPage['meta'] }).meta,
      } satisfies GymOwnerLeadsPage;
    },
    // New enquiries arrive without any action in the SCC, so the list goes
    // stale on its own. Poll while the tab is focused.
    refetchInterval: 60_000,
  });
}

export function useUpdateGymOwnerLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...dto
    }: {
      id: string;
      status?: LeadStatus;
      notes?: string;
    }) => {
      const { data } = await api.patch<ApiResponse<GymOwnerLead>>(
        `/gym-owner-leads/${id}`,
        dto,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gym-owner-leads'] }),
  });
}

export function useDeleteGymOwnerLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/gym-owner-leads/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gym-owner-leads'] }),
  });
}
