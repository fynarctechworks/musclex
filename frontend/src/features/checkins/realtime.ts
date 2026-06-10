'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { queryKeys } from '@/services/query-client';

/**
 * Server-to-client event payloads (mirror backend/src/check-ins/check-in.events.ts)
 */
export interface CheckInRecordedEvent {
  gym_id: string;
  branch_id: string;
  check_in_id: string;
  check_in_event_id: string;
  member: { id: string; full_name: string; member_code: string };
  method: string;
  source: string;
  recorded_at: string;
  class_id: string | null;
  /** Same correlation id the originator put in X-Correlation-Id. Allows
   *  the originating tab to recognize its own write coming back over WS
   *  and skip duplicate UI feedback. */
  correlation_id?: string;
}

export interface CheckInDeniedEvent {
  gym_id: string;
  branch_id: string;
  check_in_event_id: string;
  member: { id: string; full_name: string; member_code: string };
  denial_reason: string;
  message: string;
  recorded_at: string;
  correlation_id?: string;
}

export interface OccupancyUpdatedEvent {
  gym_id: string;
  branch_id: string;
  current: number;
  as_of: string;
}

export type CheckInRealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseCheckInRealtimeOptions {
  branchId: string | null | undefined;
  enabled?: boolean;
  onRecorded?: (event: CheckInRecordedEvent) => void;
  onDenied?: (event: CheckInDeniedEvent) => void;
  onOccupancy?: (event: OccupancyUpdatedEvent) => void;
}

/**
 * Subscribe to the per-branch check-in WebSocket stream.
 *
 * Replaces the 30s `useRecentCheckIns` polling. Returns:
 *   - `status` so the UI can show "Live" / "Reconnecting…" / "Offline"
 *   - `lastEventAt` for staleness indicators
 *
 * Invalidation strategy (rush-hour safe):
 *   Every event used to call `qc.invalidateQueries({ queryKey: dashboard.all })`
 *   synchronously, refetching ~25 dashboard queries per check-in. With 30
 *   check-ins/min that's a refetch storm.
 *
 *   We now COALESCE invalidations through `createInvalidationCoalescer`:
 *   each call schedules a single rAF/setTimeout flush; subsequent events
 *   within the window just union their keys into the pending set. End
 *   result: one batched invalidation per ~350ms, regardless of event rate.
 *
 *   Push callbacks (onRecorded / onDenied / onOccupancy) still fire
 *   per-event so the UI can show toasts, sounds, etc. immediately — only
 *   the cache invalidation is debounced.
 */
export function useCheckInRealtime(opts: UseCheckInRealtimeOptions) {
  const { branchId, enabled = true, onRecorded, onDenied, onOccupancy } = opts;
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<CheckInRealtimeStatus>('idle');
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  // Keep latest callback refs without re-running the effect.
  const onRecordedRef = useRef(onRecorded);
  const onDeniedRef = useRef(onDenied);
  const onOccupancyRef = useRef(onOccupancy);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
    onDeniedRef.current = onDenied;
    onOccupancyRef.current = onOccupancy;
  }, [onRecorded, onDenied, onOccupancy]);

  useEffect(() => {
    if (!enabled || !branchId) {
      setStatus('idle');
      return;
    }

    const token = readAccessToken();
    if (!token) {
      setStatus('error');
      return;
    }

    const baseUrl = computeSocketBaseUrl();
    setStatus('connecting');

    const socket = io(`${baseUrl}/check-ins`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    // One coalescer per socket lifetime so it tears down with the
    // disconnect.
    const coalesce = createInvalidationCoalescer(qc, 350);

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('check_in.subscribe', { branch_id: branchId });
    });

    socket.on('disconnect', () => setStatus('disconnected'));

    socket.on('connect_error', () => setStatus('error'));

    socket.on('check_in.recorded', (event: CheckInRecordedEvent) => {
      if (event.branch_id !== branchId) return;
      setLastEventAt(new Date());
      // A successful check-in changes: feed list, today's KPI, occupancy,
      // pulse, activity feed, heatmap. We invalidate by prefix; the
      // coalescer batches so a rush of events ≈ one refetch.
      coalesce.invalidate([
        queryKeys.checkIns.all,
        queryKeys.dashboard.kpis(),
        queryKeys.dashboard.pulse(),
        queryKeys.dashboard.occupancy(),
        queryKeys.dashboard.activityFeed(),
        queryKeys.dashboard.heatmap(),
        queryKeys.dashboard.tiles(),
      ]);
      onRecordedRef.current?.(event);
    });

    socket.on('check_in.overridden', (event: CheckInRecordedEvent) => {
      if (event.branch_id !== branchId) return;
      setLastEventAt(new Date());
      coalesce.invalidate([
        queryKeys.checkIns.all,
        queryKeys.dashboard.kpis(),
        queryKeys.dashboard.activityFeed(),
      ]);
      onRecordedRef.current?.(event);
    });

    socket.on('check_in.denied', (event: CheckInDeniedEvent) => {
      if (event.branch_id !== branchId) return;
      setLastEventAt(new Date());
      // Denials only affect the audit feed; no KPI swing. Cheaper.
      coalesce.invalidate([queryKeys.checkIns.all]);
      onDeniedRef.current?.(event);
    });

    socket.on('occupancy.updated', (event: OccupancyUpdatedEvent) => {
      if (event.branch_id !== branchId) return;
      setLastEventAt(new Date());
      // Surgical: just the occupancy panel.
      coalesce.invalidate([queryKeys.dashboard.occupancy()]);
      onOccupancyRef.current?.(event);
    });

    return () => {
      try {
        socket.emit('check_in.unsubscribe', { branch_id: branchId });
      } catch {
        /* ignore */
      }
      coalesce.dispose();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [branchId, enabled, qc]);

  return { status, lastEventAt, isLive: status === 'connected' };
}

/**
 * Coalesces React Query invalidations over a rolling window so a burst
 * of WS events results in ONE batched invalidation instead of N. We use
 * a JSON serialization of each queryKey to dedupe — sufficient because
 * all keys here are arrays of primitives.
 *
 * Window default 350ms is short enough that the UI still feels live but
 * long enough to absorb a turnstile rush.
 */
function createInvalidationCoalescer(qc: QueryClient, windowMs: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pending: Map<string, readonly any[]> = new Map();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const keys = Array.from(pending.values());
    pending = new Map();
    for (const k of keys) {
      qc.invalidateQueries({ queryKey: k });
    }
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invalidate(keys: ReadonlyArray<readonly any[]>) {
      for (const k of keys) {
        pending.set(JSON.stringify(k), k);
      }
      if (timer == null) timer = setTimeout(flush, windowMs);
    },
    dispose() {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      pending.clear();
    },
  };
}

function computeSocketBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  try {
    const u = new URL(apiUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return apiUrl.replace(/\/api\/v\d+\/?$/, '');
  }
}

function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem('auth-store');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}
