import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import {
  campaignsApi,
  messageTemplatesApi,
  workflowsApi,
  referralProgramsApi,
  leadsApi,
  type CampaignFilters,
  type LeadFilters,
  type MessageTemplateFilters,
  type WorkflowFilters,
} from './api';
import { toast } from 'sonner';

// ── Campaigns ─────────────────────────────────────────────

export function useCampaigns(filters?: CampaignFilters) {
  return useQuery({
    queryKey: queryKeys.marketing.campaigns(filters),
    queryFn: () => campaignsApi.list(filters),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.marketing.campaignDetail(id),
    queryFn: () => campaignsApi.get(id),
    enabled: !!id,
  });
}

export function useCampaignAnalytics(id: string) {
  return useQuery({
    queryKey: queryKeys.marketing.campaignAnalytics(id),
    queryFn: () => campaignsApi.getAnalytics(id),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: campaignsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Campaign created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      campaignsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Campaign updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: campaignsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Campaign deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: campaignsApi.send,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Campaign sent');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Message Templates ─────────────────────────────────────

export function useMessageTemplates(filters?: MessageTemplateFilters) {
  return useQuery({
    queryKey: queryKeys.marketing.templates(filters),
    queryFn: () => messageTemplatesApi.list(filters),
  });
}

export function useCreateMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: messageTemplatesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Template created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      messageTemplatesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Template updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: messageTemplatesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Template deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Workflows ─────────────────────────────────────────────

export function useWorkflows(filters?: WorkflowFilters) {
  return useQuery({
    queryKey: queryKeys.marketing.workflows(filters),
    queryFn: () => workflowsApi.list(filters),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: queryKeys.marketing.workflow(id),
    queryFn: () => workflowsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workflowsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Workflow created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      workflowsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Workflow updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Referral Programs ─────────────────────────────────────

export function useReferralPrograms(filters?: { organization_id?: string; status?: string }) {
  return useQuery({
    queryKey: queryKeys.marketing.referralPrograms(filters),
    queryFn: () => referralProgramsApi.list(filters),
  });
}

export function useReferralStats() {
  return useQuery({
    queryKey: queryKeys.marketing.referralStats(),
    queryFn: () => referralProgramsApi.stats(),
  });
}

export function useCreateReferralProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: referralProgramsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Referral program created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Leads ─────────────────────────────────────────────────

export function useLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: queryKeys.marketing.leads(filters),
    queryFn: () => leadsApi.list(filters),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: queryKeys.marketing.leadDetail(id),
    queryFn: () => leadsApi.get(id),
    enabled: !!id,
  });
}

export function useLeadActivities(leadId: string) {
  return useQuery({
    queryKey: queryKeys.marketing.leadActivities(leadId),
    queryFn: () => leadsApi.getActivities(leadId),
    enabled: !!leadId,
  });
}

export function useLeadFunnel(filters?: { organization_id?: string; branch_id?: string; start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: queryKeys.marketing.leadFunnel(filters),
    queryFn: () => leadsApi.funnel(filters),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Lead created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      leadsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Lead updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddLeadActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: Parameters<typeof leadsApi.addActivity>[1] }) =>
      leadsApi.addActivity(leadId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
      toast.success('Activity added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
