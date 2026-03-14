import { apiClient } from '@/services/api-client';

// ── Campaigns ─────────────────────────────────────────────

export interface CampaignFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const campaignsApi = {
  list: (filters?: CampaignFilters) =>
    apiClient.get('/campaigns', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/campaigns/${id}`),

  create: (data: {
    name: string;
    segment: 'all' | 'active' | 'expiring' | 'expired' | 'new' | 'inactive';
    segment_filters?: Record<string, unknown>;
    channels: string[];
    message_template: string;
    created_by_staff_id: string;
    scheduled_at?: string;
  }) => apiClient.post('/campaigns', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/campaigns/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/campaigns/${id}`),

  send: (id: string) =>
    apiClient.post(`/campaigns/${id}/send`),

  getAudience: (id: string, filters?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get(`/campaigns/${id}/audience`, { params: filters }),

  updateAudienceMember: (campaignId: string, memberId: string, status: string) =>
    apiClient.patch(`/campaigns/${campaignId}/audience/${memberId}`, { status }),

  getAnalytics: (id: string) =>
    apiClient.get(`/campaigns/${id}/analytics`),
};

// ── Message Templates ─────────────────────────────────────

export interface MessageTemplateFilters {
  organization_id?: string;
  channel?: string;
  is_active?: boolean;
  search?: string;
}

export const messageTemplatesApi = {
  list: (filters?: MessageTemplateFilters) =>
    apiClient.get('/message-templates', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/message-templates/${id}`),

  create: (data: {
    template_name: string;
    channel: 'email' | 'sms' | 'whatsapp' | 'push_notification';
    subject?: string;
    content: string;
    variables?: string[];
    organization_id?: string;
  }) => apiClient.post('/message-templates', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/message-templates/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/message-templates/${id}`),
};

// ── Automation Workflows ──────────────────────────────────

export interface WorkflowFilters {
  organization_id?: string;
  trigger_event?: string;
  status?: string;
}

export interface WorkflowAction {
  action_order?: number;
  action_type: 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_push' | 'assign_task' | 'update_status';
  delay_minutes?: number;
  template_id?: string;
  action_config?: Record<string, unknown>;
}

export const workflowsApi = {
  list: (filters?: WorkflowFilters) =>
    apiClient.get('/workflows', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/workflows/${id}`),

  create: (data: {
    workflow_name: string;
    trigger_event: 'membership_expiring' | 'member_inactive' | 'lead_created' | 'class_missed' | 'birthday' | 'payment_failed';
    trigger_config?: Record<string, unknown>;
    organization_id?: string;
    actions?: WorkflowAction[];
  }) => apiClient.post('/workflows', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/workflows/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/workflows/${id}`),

  addAction: (workflowId: string, action: WorkflowAction) =>
    apiClient.post(`/workflows/${workflowId}/actions`, action),

  removeAction: (workflowId: string, actionId: string) =>
    apiClient.delete(`/workflows/${workflowId}/actions/${actionId}`),
};

// ── Referral Programs ─────────────────────────────────────

export const referralProgramsApi = {
  list: (filters?: { organization_id?: string; status?: string }) =>
    apiClient.get('/referral-programs', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/referral-programs/${id}`),

  stats: (organizationId?: string) =>
    apiClient.get('/referral-programs/stats', { params: organizationId ? { organization_id: organizationId } : undefined }),

  create: (data: {
    program_name: string;
    reward_type: 'discount' | 'free_days' | 'cash' | 'free_class';
    reward_value: number;
    min_referrals?: number;
    max_rewards?: number;
    start_date?: string;
    end_date?: string;
    organization_id?: string;
  }) => apiClient.post('/referral-programs', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/referral-programs/${id}`, data),
};

// ── Push Notifications ────────────────────────────────────

export const pushNotificationsApi = {
  send: (data: { member_id: string; title: string; message: string; data?: Record<string, unknown> }) =>
    apiClient.post('/push-notifications', data),

  forMember: (memberId: string, filters?: { page?: number; limit?: number }) =>
    apiClient.get(`/push-notifications/${memberId}`, { params: filters }),

  markRead: (id: string) =>
    apiClient.patch(`/push-notifications/${id}/read`),
};

// ── Leads ─────────────────────────────────────────────────

export interface LeadFilters {
  organization_id?: string;
  branch_id?: string;
  status?: string;
  lead_source?: string;
  assigned_staff_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const leadsApi = {
  list: (filters?: LeadFilters) =>
    apiClient.get('/leads', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/leads/${id}`),

  create: (data: {
    full_name: string;
    email?: string;
    phone?: string;
    lead_source: 'website' | 'instagram' | 'facebook_ads' | 'walk_in' | 'referral' | 'google_ads';
    organization_id?: string;
    branch_id?: string;
    assigned_staff_id?: string;
    notes?: string;
  }) => apiClient.post('/leads', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/leads/${id}`, data),

  funnel: (filters?: { organization_id?: string; branch_id?: string; start_date?: string; end_date?: string }) =>
    apiClient.get('/leads/funnel', { params: filters }),

  addActivity: (leadId: string, data: {
    staff_id?: string;
    activity_type: 'call' | 'email' | 'visit' | 'trial_booking' | 'note' | 'status_change';
    notes?: string;
  }) => apiClient.post(`/leads/${leadId}/activities`, data),

  getActivities: (leadId: string, filters?: { page?: number; limit?: number }) =>
    apiClient.get(`/leads/${leadId}/activities`, { params: filters }),
};
