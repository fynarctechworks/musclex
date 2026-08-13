import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/services/query-client';
import { automationsApi, type WorkflowFilters } from './api';
import type { UpdateWorkflowInput, WorkflowActionInput } from './types';

// Shares the marketing query-key namespace so this page, the legacy
// /marketing/automation page, and /marketing/templates stay cache-coherent.

export function useAutomationWorkflows(filters?: WorkflowFilters) {
  return useQuery({
    queryKey: queryKeys.marketing.workflows(filters),
    queryFn: () => automationsApi.list(filters),
  });
}

export function useAutomationTemplates(filters?: { channel?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: queryKeys.marketing.templates(filters),
    queryFn: () => automationsApi.listTemplates(filters),
  });
}

function useInvalidateMarketing() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.marketing.all });
}

export function useCreateWorkflow() {
  const invalidate = useInvalidateMarketing();
  return useMutation({
    mutationFn: automationsApi.create,
    onSuccess: () => {
      invalidate();
      toast.success('Automation created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWorkflow() {
  const invalidate = useInvalidateMarketing();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkflowInput }) =>
      automationsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Automation updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWorkflow() {
  const invalidate = useInvalidateMarketing();
  return useMutation({
    mutationFn: automationsApi.delete,
    onSuccess: () => {
      invalidate();
      toast.success('Automation deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddWorkflowAction() {
  const invalidate = useInvalidateMarketing();
  return useMutation({
    mutationFn: ({ workflowId, action }: { workflowId: string; action: WorkflowActionInput }) =>
      automationsApi.addAction(workflowId, action),
    onSuccess: () => {
      invalidate();
      toast.success('Action added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveWorkflowAction() {
  const invalidate = useInvalidateMarketing();
  return useMutation({
    mutationFn: ({ workflowId, actionId }: { workflowId: string; actionId: string }) =>
      automationsApi.removeAction(workflowId, actionId),
    onSuccess: () => {
      invalidate();
      toast.success('Action removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSeedStarterPack() {
  const invalidate = useInvalidateMarketing();
  return useMutation({
    mutationFn: automationsApi.seedDefaults,
    onSuccess: () => {
      invalidate();
      toast.success('Starter automations created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateTemplate() {
  const invalidate = useInvalidateMarketing();
  return useMutation({
    mutationFn: automationsApi.createTemplate,
    onSuccess: () => {
      invalidate();
      toast.success('Template created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
