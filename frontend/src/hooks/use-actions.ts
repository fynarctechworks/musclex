"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import { toast } from "sonner";

export type ActionSeverity = "high" | "medium" | "low";
export type ActionKind =
  | "renewal_at_risk"
  | "renewal_imminent"
  | "dues_overdue"
  | "payment_failed"
  | "class_overfill"
  | "trainer_no_show"
  | "lead_cold"
  | "inactive_member"
  | "branch_underperform"
  | "anomaly_check_ins_low"
  | "anomaly_check_ins_high"
  | "anomaly_revenue_low"
  | "anomaly_revenue_high";

export interface ActionEvidence {
  summary: string;
  metric?: string;
  value?: number;
  baseline?: number;
  stdev?: number;
  z_score?: number;
  delta_pct?: number;
  source: string;
}

export interface ServerActionItem {
  id: string;
  kind: ActionKind;
  severity: ActionSeverity;
  title: string;
  reason?: string;
  impact_amount?: number;
  currency?: string;
  cta_label?: string;
  cta_href?: string;
  refs: {
    member_id?: string;
    member_ids?: string[];
    invoice_id?: string;
    payment_id?: string;
    session_id?: string;
    lead_id?: string;
    branch_id?: string;
  };
  generated_at: string;
  snoozed_until?: string | null;
  evidence?: ActionEvidence;
}

export interface ActionReceipt {
  id: string;
  action_id: string;
  action_kind: string;
  receipt_type: "resolved" | "dismissed" | "snoozed" | "bulk_resolved";
  created_at: string;
  actor_user_id: string | null;
  payload: Record<string, unknown> | null;
}

interface UseActionsArgs {
  branchId?: string;
  enabled?: boolean;
}

/**
 * Server-backed Action Stack. Replaces the Wave-1 client-side derivation.
 * Mutations support optimistic updates so dismiss/snooze feels instant.
 */
export function useActions({ branchId, enabled = true }: UseActionsArgs = {}) {
  const qc = useQueryClient();
  const params = branchId ? { branch_id: branchId } : undefined;
  const key = queryKeys.dashboard.actions(branchId);

  const query = useQuery<ServerActionItem[]>({
    queryKey: key,
    queryFn: () => apiClient.get("/dashboard/actions", { params }),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Optimistically remove an item by id, return rollback fn.
  const optimisticallyRemove = (id: string) => {
    const prev = qc.getQueryData<ServerActionItem[]>(key) ?? [];
    qc.setQueryData<ServerActionItem[]>(
      key,
      prev.filter((a) => a.id !== id),
    );
    return () => qc.setQueryData(key, prev);
  };

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/dashboard/actions/${encodeURIComponent(id)}/dismiss`, {
        branch_id: branchId,
      }),
    onMutate: (id) => ({ rollback: optimisticallyRemove(id) }),
    onError: (err, _id, ctx) => {
      ctx?.rollback?.();
      toast.error("Couldn't dismiss action — try again.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.actionReceipts() });
    },
  });

  const snooze = useMutation({
    mutationFn: ({ id, hours }: { id: string; hours: number }) =>
      apiClient.post(`/dashboard/actions/${encodeURIComponent(id)}/snooze`, {
        hours,
        branch_id: branchId,
      }),
    onMutate: ({ id }) => ({ rollback: optimisticallyRemove(id) }),
    onError: (err, _vars, ctx) => {
      ctx?.rollback?.();
      toast.error("Couldn't snooze action — try again.");
    },
    onSuccess: (_data, vars) => {
      toast.success(`Snoozed for ${vars.hours}h`);
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.actionReceipts() });
    },
  });

  const resolve = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload?: Record<string, unknown>;
    }) =>
      apiClient.post(`/dashboard/actions/${encodeURIComponent(id)}/resolve`, {
        branch_id: branchId,
        payload,
      }),
    onMutate: ({ id }) => ({ rollback: optimisticallyRemove(id) }),
    onError: (err, _vars, ctx) => {
      ctx?.rollback?.();
      toast.error("Couldn't resolve action — try again.");
    },
    onSuccess: () => {
      toast.success("Resolved");
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.pulse() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.actionReceipts() });
    },
  });

  return {
    actions: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    dismiss: (id: string) => dismiss.mutate(id),
    snooze: (id: string, hours = 24) => snooze.mutate({ id, hours }),
    resolve: (id: string, payload?: Record<string, unknown>) =>
      resolve.mutate({ id, payload }),
  };
}

export function useActionReceipts(limit = 25) {
  return useQuery<ActionReceipt[]>({
    queryKey: queryKeys.dashboard.actionReceipts(limit),
    queryFn: () =>
      apiClient.get("/dashboard/action-receipts", {
        params: { limit, since_days: 7 },
      }),
    staleTime: 30_000,
  });
}
