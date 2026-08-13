import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { toast } from 'sonner';
import {
  integrationsApi,
  type CreateIntegrationInput,
  type UpdateIntegrationInput,
} from './api';

// ── Queries ───────────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: queryKeys.settings.integrations(),
    queryFn: () => integrationsApi.list(),
  });
}

// ── Mutations ─────────────────────────────────────────────

function useInvalidateIntegrations() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.settings.integrations() });
}

export function useConnectIntegration() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: (data: CreateIntegrationInput) => integrationsApi.create(data),
    onSuccess: () => {
      invalidate();
      toast.success('Integration connected');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateIntegration() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIntegrationInput }) =>
      integrationsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Integration updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleIntegration() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      integrationsApi.toggle(id, enabled),
    onSuccess: (_data, { enabled }) => {
      invalidate();
      toast.success(enabled ? 'Integration enabled' : 'Integration disabled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: (id: string) => integrationsApi.test(id),
    onSuccess: (res) => {
      const ok = res.success === true || res.status === 'ok';
      if (ok) toast.success(res.message || 'Connection test passed');
      else toast.error(res.message || 'Connection test failed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDisconnectIntegration() {
  const invalidate = useInvalidateIntegrations();
  return useMutation({
    mutationFn: (id: string) => integrationsApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Integration disconnected');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
