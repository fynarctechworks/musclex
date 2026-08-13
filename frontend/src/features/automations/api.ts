import { apiClient } from '@/services/api-client';
import type {
  AutomationWorkflow,
  CreateTemplateInput,
  CreateWorkflowInput,
  MessageTemplate,
  UpdateWorkflowInput,
  WorkflowActionInput,
  WorkflowActionRow,
} from './types';

export interface WorkflowFilters {
  organization_id?: string;
  status?: string;
  trigger_event?: string;
}

export const automationsApi = {
  // ── Workflows ───────────────────────────────────────────
  list: (filters?: WorkflowFilters) =>
    apiClient.get<AutomationWorkflow[]>('/workflows', { params: filters }),

  create: (data: CreateWorkflowInput) =>
    apiClient.post<AutomationWorkflow>('/workflows', data),

  update: (id: string, data: UpdateWorkflowInput) =>
    apiClient.patch<AutomationWorkflow>(`/workflows/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/workflows/${id}`),

  addAction: (workflowId: string, action: WorkflowActionInput) =>
    apiClient.post<WorkflowActionRow>(`/workflows/${workflowId}/actions`, action),

  removeAction: (workflowId: string, actionId: string) =>
    apiClient.delete<{ success: boolean }>(`/workflows/${workflowId}/actions/${actionId}`),

  /** Seeds a starter pack of default templates + workflows (idempotent). */
  seedDefaults: () =>
    apiClient.post<{ workflows: Array<{ id: string; trigger_event: string; created: boolean }> }>(
      '/workflows/seed-defaults',
    ),

  // ── Message templates ───────────────────────────────────
  listTemplates: (filters?: { channel?: string; is_active?: boolean }) =>
    apiClient.get<MessageTemplate[]>('/message-templates', { params: filters }),

  createTemplate: (data: CreateTemplateInput) =>
    apiClient.post<MessageTemplate>('/message-templates', data),
};
