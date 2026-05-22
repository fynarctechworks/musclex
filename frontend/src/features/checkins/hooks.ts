import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { checkInsApi, type CheckInFilters } from './api';
import { getLastCorrelationId } from '@/services/api-client';
import { toast } from 'sonner';

export function useCheckIns(filters?: CheckInFilters) {
  return useQuery({
    queryKey: queryKeys.checkIns.list(filters),
    queryFn: () => checkInsApi.list(filters),
  });
}

export function useRecentCheckIns(
  branchId?: string,
  limit = 20,
  options?: { realtimeActive?: boolean },
) {
  const realtime = options?.realtimeActive === true;
  return useQuery({
    queryKey: [...queryKeys.checkIns.all, 'recent', branchId, limit],
    queryFn: () => checkInsApi.list({ branch_id: branchId, limit }),
    refetchInterval: realtime ? false : 30000,
  });
}

export function useCheckInHeatmap(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.checkIns.heatmap(branchId),
    queryFn: () => checkInsApi.getHeatmap(branchId),
  });
}

/**
 * Drop a Sentry breadcrumb so a check-in attempt is traceable end-to-end:
 *   getLastCorrelationId() === X-Correlation-Id on the request
 *                          === correlation_id stamped on the backend log
 *                          === correlation_id on the persisted CheckInEvent
 *                          === correlation_id echoed back via WS
 *
 * If a member calls support 10 minutes later saying "my check-in failed at
 * 4:15", you find the matching breadcrumb in their session replay, copy the
 * correlation_id, and paste it into the backend log search.
 */
async function emitCheckInBreadcrumb(
  outcome: 'success' | 'failure' | 'denied',
  detail: Record<string, unknown>,
) {
  if (typeof window === 'undefined') return;
  try {
    const Sentry = await import('@sentry/nextjs').catch(() => null);
    if (!Sentry) return;
    Sentry.addBreadcrumb({
      level: outcome === 'success' ? 'info' : outcome === 'denied' ? 'warning' : 'error',
      category: 'check-in',
      message: `check-in ${outcome}`,
      data: {
        ...detail,
        correlation_id: getLastCorrelationId(),
      },
      timestamp: Date.now() / 1000,
    });
  } catch {
    // Breadcrumbs are best-effort.
  }
}

export function useCreateCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkInsApi.create,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.checkIns.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      // Breadcrumb either way — a denied check-in is still a request
      // worth logging for support.
      const isSuccess = (res as { success?: boolean })?.success === true;
      const failureReason = (res as { failure_reason?: string })?.failure_reason;
      void emitCheckInBreadcrumb(isSuccess ? 'success' : 'denied', {
        member_id: (res as { check_in?: { member_id?: string } })?.check_in?.member_id,
        failure_reason: failureReason,
      });
    },
    onError: (err: Error) => {
      void emitCheckInBreadcrumb('failure', { error: err.message });
      toast.error(err.message);
    },
  });
}

export function useFacialCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkInsApi.facial,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.checkIns.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      const isSuccess = (res as { success?: boolean })?.success === true;
      void emitCheckInBreadcrumb(isSuccess ? 'success' : 'denied', {
        confidence: (res as { confidence?: number })?.confidence,
        failure_reason: (res as { failure_reason?: string })?.failure_reason,
      });
    },
    onError: (err: Error) => {
      void emitCheckInBreadcrumb('failure', { error: err.message });
      toast.error(err.message);
    },
  });
}

export function useSyncCheckIns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkInsApi.sync,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.checkIns.all });
      toast.success(`Synced ${data.synced} check-ins`);
      if (data.failed > 0) toast.warning(`${data.failed} check-ins failed to sync`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
