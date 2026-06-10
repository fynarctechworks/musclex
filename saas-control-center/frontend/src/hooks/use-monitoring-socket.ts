'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_URL } from '@/lib/constants';
import type { LiveErrorEvent } from '@/types/monitoring';

const MAX_EVENTS = 50;

/**
 * Subscribes to the `/monitoring` socket namespace. Verifies via the admin JWT
 * in the handshake, invalidates the relevant react-query caches on each push,
 * and keeps a rolling buffer of recent events for the live activity feed.
 */
export function useMonitoringSocket() {
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<LiveErrorEvent[]>([]);

  const push = useCallback((event: LiveErrorEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
    qc.invalidateQueries({ queryKey: ['system-errors'] });
    qc.invalidateQueries({ queryKey: ['error-stats'] });
  }, [qc]);

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('scc_access_token')
        : null;
    if (!token) return;

    const socket = io(`${SOCKET_URL}/monitoring`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('error:new', (p: Record<string, unknown>) =>
      push({ ...(p as object), kind: 'new', at: Date.now() } as LiveErrorEvent),
    );
    socket.on('error:updated', (p: Record<string, unknown>) =>
      push({ ...(p as object), kind: 'updated', at: Date.now() } as LiveErrorEvent),
    );
    socket.on('alert:critical', (p: Record<string, unknown>) => {
      push({ ...(p as object), kind: 'alert', at: Date.now() } as LiveErrorEvent);
      qc.invalidateQueries({ queryKey: ['system-alerts'] });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [push, qc]);

  return { connected, events };
}
