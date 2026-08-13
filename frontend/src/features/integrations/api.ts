import { apiClient } from '@/services/api-client';

// ── Integrations (gym-level third-party connections) ──────

export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending_setup';

export interface IntegrationRow {
  id: string;
  provider: string;
  display_name: string;
  /** Secrets come back masked (••••1234) — never render as editable values. */
  config: Record<string, unknown>;
  status: IntegrationStatus;
  is_enabled: boolean;
  last_synced_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface IntegrationCatalogEntry {
  provider: string;
  name: string;
  category: string;
  description: string;
  config_fields: string[];
}

/** Backend returns { provider, status: 'ok'|'error', message } — tolerate both shapes. */
export interface IntegrationTestResult {
  success?: boolean;
  status?: string;
  message: string;
}

export interface CreateIntegrationInput {
  provider: string;
  display_name: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateIntegrationInput {
  display_name?: string;
  config?: Record<string, unknown>;
  is_enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export const integrationsApi = {
  list: () => apiClient.get<IntegrationRow[]>('/integrations'),

  catalog: () => apiClient.get<IntegrationCatalogEntry[]>('/integrations/catalog'),

  create: (data: CreateIntegrationInput) =>
    apiClient.post<IntegrationRow>('/integrations', data),

  update: (id: string, data: UpdateIntegrationInput) =>
    apiClient.patch<IntegrationRow>(`/integrations/${id}`, data),

  toggle: (id: string, enabled: boolean) =>
    apiClient.patch<IntegrationRow>(`/integrations/${id}/toggle`, { enabled }),

  test: (id: string) =>
    apiClient.post<IntegrationTestResult>(`/integrations/${id}/test`),

  remove: (id: string) =>
    apiClient.delete(`/integrations/${id}`),
};
