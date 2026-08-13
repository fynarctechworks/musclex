// ── Automations (workflows + message templates) ───────────
// Shapes mirror backend/src/marketing/automation.service.ts responses.

// Keep in sync with TRIGGER_EVENTS in
// backend/src/marketing/dto/automation.dto.ts.
export type TriggerEvent =
  | 'membership_expiring'
  | 'birthday'
  | 'lead_created'
  | 'class_reminder'
  | 'member_registered'
  | 'member_renewed'
  | 'member_inactive'
  | 'class_missed'
  | 'payment_failed';

export type WorkflowStatus = 'active' | 'paused' | 'archived';

/** Executable action types only — assign_task/update_status exist in the DB
 *  but no executor runs them, so the UI never offers them. */
export type ActionType = 'send_whatsapp' | 'send_email' | 'send_sms' | 'send_push';

export type TemplateChannel = 'email' | 'sms' | 'whatsapp' | 'push_notification';

export interface MessageTemplate {
  id: string;
  template_name: string;
  channel: TemplateChannel;
  subject?: string | null;
  content: string;
  variables?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowActionRow {
  id: string;
  action_order: number;
  action_type: string; // may include legacy assign_task/update_status rows
  delay_minutes?: number | null;
  template_id?: string | null;
  action_config?: Record<string, unknown> | null;
  template?: { id: string; template_name: string; channel: string } | null;
}

export interface AutomationWorkflow {
  id: string;
  workflow_name: string;
  trigger_event: TriggerEvent | string;
  trigger_config?: Record<string, unknown> | null;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
  actions: WorkflowActionRow[];
  _count?: { actions: number };
}

// ── Inputs ────────────────────────────────────────────────

export interface WorkflowActionInput {
  action_order?: number;
  action_type: ActionType;
  delay_minutes?: number;
  template_id?: string;
  action_config?: Record<string, unknown>;
}

export interface CreateWorkflowInput {
  workflow_name: string;
  trigger_event: TriggerEvent;
  trigger_config?: Record<string, unknown>;
  actions?: WorkflowActionInput[];
}

export interface UpdateWorkflowInput {
  workflow_name?: string;
  trigger_event?: TriggerEvent;
  trigger_config?: Record<string, unknown>;
  status?: WorkflowStatus;
}

export interface CreateTemplateInput {
  template_name: string;
  channel: TemplateChannel;
  subject?: string;
  content: string;
  variables?: string[];
}

// ── UI metadata ───────────────────────────────────────────

/** Only these triggers actually fire today: membership_expiring + birthday via
 *  the daily 10:00 sweep, class_reminder via the hourly sweep, and
 *  lead_created / member_registered / member_renewed on their events. The rest
 *  are stored but have no executor yet. */
export const LIVE_TRIGGERS: ReadonlySet<string> = new Set([
  'membership_expiring',
  'birthday',
  'lead_created',
  'class_reminder',
  'member_registered',
  'member_renewed',
]);

export const TRIGGER_META: Record<
  TriggerEvent,
  { label: string; hint: string }
> = {
  membership_expiring: {
    label: 'Membership expiring',
    hint: 'Runs in the daily 10:00 sweep, N days before a membership expires.',
  },
  birthday: {
    label: 'Member birthday',
    hint: 'Runs in the daily 10:00 sweep on each member’s birthday.',
  },
  lead_created: {
    label: 'New lead created',
    hint: 'Runs immediately when a lead is created.',
  },
  class_reminder: {
    label: 'Class reminder',
    hint: 'Runs hourly, N hours before a booked class starts (default 24).',
  },
  member_registered: {
    label: 'New member joined',
    hint: 'Runs immediately when a member is created.',
  },
  member_renewed: {
    label: 'Membership renewed',
    hint: 'Runs immediately when a membership is renewed.',
  },
  member_inactive: {
    label: 'Member inactive',
    hint: 'Not wired to an executor yet — the workflow is saved but will not fire.',
  },
  class_missed: {
    label: 'Class missed',
    hint: 'Not wired to an executor yet — the workflow is saved but will not fire.',
  },
  payment_failed: {
    label: 'Payment failed',
    hint: 'Not wired to an executor yet — the workflow is saved but will not fire.',
  },
};

export const ACTION_META: Record<
  ActionType,
  { label: string; channel: TemplateChannel }
> = {
  send_whatsapp: { label: 'Send WhatsApp', channel: 'whatsapp' },
  send_email: { label: 'Send Email', channel: 'email' },
  send_sms: { label: 'Send SMS', channel: 'sms' },
  send_push: { label: 'Send Push Notification', channel: 'push_notification' },
};

export const CHANNEL_LABEL: Record<TemplateChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  push_notification: 'Push',
};

/** Variables supported in template message bodies. */
export const TEMPLATE_VARIABLES = [
  '{{member_name}}',
  '{{plan_name}}',
  '{{expiry_date}}',
  '{{gym_name}}',
  '{{days_left}}',
  '{{lead_name}}',
] as const;
