// ── Campaign Types ─────────────────────────────────────

export type CampaignSegment = 'all' | 'active' | 'expiring' | 'expired' | 'new' | 'inactive';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type ChannelType = 'email' | 'sms' | 'whatsapp' | 'push';

export interface Campaign {
  id: string;
  name: string;
  segment: CampaignSegment;
  segment_filters?: Record<string, unknown>;
  channels: string[];
  message_template: string;
  status: CampaignStatus;
  scheduled_at?: string;
  sent_count: number;
  delivered_count: number;
  created_by_staff_id: string;
  created_at: string;
  updated_at: string;
}

export type AudienceStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced';

export interface CampaignAudienceMember {
  id: string;
  campaign_id: string;
  member_id: string;
  status: AudienceStatus;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  member?: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string;
  };
}

export interface CampaignAnalytics {
  id: string;
  campaign_id: string;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  bounced: number;
  revenue_generated: number;
}

// ── Message Template Types ────────────────────────────────

export type TemplateChannel = 'email' | 'sms' | 'whatsapp' | 'push_notification';

export interface MessageTemplate {
  id: string;
  template_name: string;
  channel: TemplateChannel;
  subject?: string;
  content: string;
  variables?: string[];
  is_active: boolean;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

// ── Automation Workflow Types ─────────────────────────────

export type TriggerEvent =
  | 'member_registered'
  | 'member_renewed'
  | 'membership_expiring'
  | 'member_inactive'
  | 'lead_created'
  | 'class_missed'
  | 'birthday'
  | 'payment_failed';
export type WorkflowStatus = 'active' | 'paused' | 'archived';
export type ActionType = 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_push' | 'assign_task' | 'update_status';

export interface WorkflowAction {
  id: string;
  workflow_id: string;
  action_order: number;
  action_type: ActionType;
  delay_minutes?: number;
  template_id?: string;
  action_config?: Record<string, unknown>;
}

export interface AutomationWorkflow {
  id: string;
  workflow_name: string;
  trigger_event: TriggerEvent;
  trigger_config?: Record<string, unknown>;
  status: WorkflowStatus;
  organization_id?: string;
  actions?: WorkflowAction[];
  created_at: string;
  updated_at: string;
}

// ── Referral Program Types ────────────────────────────────

export type RewardType = 'discount' | 'free_days' | 'cash' | 'free_class';

export interface ReferralProgram {
  id: string;
  program_name: string;
  reward_type: RewardType;
  reward_value: number;
  min_referrals?: number;
  max_rewards?: number;
  start_date?: string;
  end_date?: string;
  status: string;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

// ── Lead Types ────────────────────────────────────────────

export type LeadSource = 'website' | 'instagram' | 'facebook_ads' | 'walk_in' | 'referral' | 'google_ads';
export type LeadStatus = 'new' | 'contacted' | 'trial_scheduled' | 'converted' | 'lost';

export interface Lead {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  lead_source: LeadSource;
  status: LeadStatus;
  assigned_staff_id?: string;
  notes?: string;
  converted_member_id?: string;
  organization_id?: string;
  branch_id?: string;
  created_at: string;
  updated_at: string;
}

export type ActivityType = 'call' | 'email' | 'visit' | 'trial_booking' | 'note' | 'status_change';

export interface LeadActivity {
  id: string;
  lead_id: string;
  staff_id?: string;
  activity_type: ActivityType;
  notes?: string;
  created_at: string;
}

export interface LeadFunnel {
  new: number;
  contacted: number;
  trial_scheduled: number;
  converted: number;
  lost: number;
}

// ── Push Notification Types ───────────────────────────────

export interface PushNotification {
  id: string;
  member_id: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  status: string;
  sent_at?: string;
  read_at?: string;
  created_at: string;
}
