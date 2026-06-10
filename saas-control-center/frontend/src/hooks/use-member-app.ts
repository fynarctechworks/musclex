import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse } from '@/types';

// ── Response shapes (mirror member-app-analytics.service) ──────────
export interface MemberAppOverview {
  totalRegistrations: number;
  firstOpens: number;
  dau: number;
  wau: number;
  mau: number;
  onboardingStarted: number;
  onboardingCompleted: number;
  completionPct: number;
  withMembership: number;
  withoutMembership: number;
  expired: number;
  newToday: number;
  newThisWeek: number;
  newThisMonth: number;
  onboardingCompletionRate: number;
  membershipConversionRate: number;
  stickiness: number;
}
export interface SegmentRow {
  key: string;
  label: string;
  count: number;
}
export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  pctOfTop: number;
  pctOfPrev: number;
}
export interface AppUserRow {
  id: string;
  name: string;
  phone: string;
  city: string;
  registeredAt: string | null;
  lastActiveAt: string | null;
  onboardingStatus: string;
  referralSource: string;
  gymName: string | null;
  membershipStatus: 'member' | 'expired' | 'lead';
  usage: string;
}
export interface UsersPage {
  items: AppUserRow[];
  total: number;
  page: number;
  limit: number;
}
export interface ReferralSource {
  source: string;
  registrations: number;
  conversions: number;
  conversionPct: number;
}
export interface GrowthPoint {
  day: string;
  registrations: number;
}

export function useMemberAppOverview() {
  return useQuery({
    queryKey: ['member-app', 'overview'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MemberAppOverview>>('/member-app/overview');
      return data.data;
    },
  });
}

export function useMemberAppGrowth(days = 30) {
  return useQuery({
    queryKey: ['member-app', 'growth', days],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ points: GrowthPoint[] }>>(
        `/member-app/growth?days=${days}`,
      );
      return data.data.points;
    },
  });
}

export function useMemberAppSegments() {
  return useQuery({
    queryKey: ['member-app', 'segments'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ segments: SegmentRow[]; total: number }>>(
        '/member-app/segments',
      );
      return data.data;
    },
  });
}

export function useMemberAppFunnel() {
  return useQuery({
    queryKey: ['member-app', 'funnel'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ steps: FunnelStep[] }>>('/member-app/funnel');
      return data.data.steps;
    },
  });
}

export function useMemberAppUsers(
  type: 'leads' | 'crm',
  params: { search?: string; city?: string; page?: number },
) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.city) qs.set('city', params.city);
  if (params.page) qs.set('page', String(params.page));
  return useQuery({
    queryKey: ['member-app', type, params],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<UsersPage>>(
        `/member-app/${type}?${qs.toString()}`,
      );
      return data.data;
    },
  });
}

export function useMemberAppReferrals() {
  return useQuery({
    queryKey: ['member-app', 'referrals'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ sources: ReferralSource[] }>>(
        '/member-app/referrals',
      );
      return data.data.sources;
    },
  });
}

export function useMemberAppCampaignAudiences() {
  return useQuery({
    queryKey: ['member-app', 'campaign-audiences'],
    queryFn: async () => {
      const { data } = await api.get<
        ApiResponse<{ audiences: { segment: string; label: string; size: number }[]; note: string }>
      >('/member-app/campaign-audiences');
      return data.data;
    },
  });
}

export interface Campaign {
  id: string;
  title: string;
  body: string;
  target_segment: string;
  status: string;
  recipients: number;
  sent_count: number;
  failed_count: number;
  opened: number;
  clicked: number;
  sent_at: string | null;
  created_at: string;
}

export interface Automation {
  id: string;
  key: string;
  title: string;
  body: string;
  target_segment: string;
  deep_link: string | null;
  enabled: boolean;
  cooldown_days: number;
  last_run_at: string | null;
  sent: number;
  opened: number;
  clicked: number;
}

export function useMemberAppCampaigns() {
  return useQuery({
    queryKey: ['member-app', 'campaigns'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ campaigns: Campaign[] }>>(
        '/member-app/campaigns',
      );
      return data.data.campaigns;
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      body: string;
      targetSegment: string;
      deepLink?: string;
    }) => {
      const { data } = await api.post('/member-app/campaigns', input);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-app', 'campaigns'] }),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/member-app/campaigns/${id}/send`);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-app', 'campaigns'] }),
  });
}

export function useAutomations() {
  return useQuery({
    queryKey: ['member-app', 'automations'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ automations: Automation[] }>>(
        '/member-app/automations',
      );
      return data.data.automations;
    },
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, patch }: { key: string; patch: Partial<Pick<Automation, 'enabled' | 'cooldown_days'>> & { title?: string; body?: string; deepLink?: string } }) => {
      const body: Record<string, unknown> = {};
      if (patch.enabled !== undefined) body.enabled = patch.enabled;
      if (patch.cooldown_days !== undefined) body.cooldownDays = patch.cooldown_days;
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.body !== undefined) body.body = patch.body;
      if (patch.deepLink !== undefined) body.deepLink = patch.deepLink;
      const { data } = await api.patch(`/member-app/automations/${key}`, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-app', 'automations'] }),
  });
}

export function useRunAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { data } = await api.post(`/member-app/automations/${key}/run`);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-app', 'automations'] }),
  });
}

export interface ReferralChain {
  shares: number;
  referredRegistrations: number;
  referredConversions: number;
  referralConversionRate: number;
  revenue: number;
  topReferrers: {
    name: string;
    referralCode: string | null;
    referrals: number;
    conversions: number;
  }[];
}

export function useReferralChain() {
  return useQuery({
    queryKey: ['member-app', 'referral-chain'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ReferralChain>>(
        '/member-app/referral-chain',
      );
      return data.data;
    },
  });
}
