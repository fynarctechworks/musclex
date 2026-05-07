'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api';

/**
 * Decode a JWT payload without verifying it.
 * Used to peek at user_metadata — the guard still verifies on the server.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64 → decoded string
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Self-healing session sync.
 *
 * Problem: When the backend updates `user_metadata.studio_id` during onboarding
 * via `supabase.auth.admin.updateUserById`, the client's existing access_token
 * does NOT reflect the change — the JWT payload is frozen at issue time.
 *
 * Without studio_id in the JWT, TenantMiddleware can't resolve the tenant
 * schema and all tenant-scoped queries (branches, plans, members, etc.) hit
 * the empty public schema and return zero results.
 *
 * Fix: On AppLayout mount, peek at the access_token. If it's missing studio_id
 * in user_metadata but the auth store has a studio (implying onboarding is done),
 * call /auth/refresh to get a fresh JWT with current metadata, then invalidate
 * react-query cache so data refetches with the correct tenant context.
 */
export function useSessionSync() {
  const queryClient = useQueryClient();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const studio = useAuthStore((s) => s.studio);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || ranRef.current) return;

    const state = useAuthStore.getState();
    const accessToken = state.accessToken;
    const refreshToken = state.refreshToken;
    if (!accessToken || !refreshToken) return;

    const payload = decodeJwtPayload(accessToken);
    const tokenStudioId = payload?.user_metadata?.studio_id;

    // Token already has studio_id — no action needed
    if (tokenStudioId) {
      ranRef.current = true;
      return;
    }

    // Token is stale. Refresh once, then invalidate cached queries.
    ranRef.current = true;
    apiClient
      .post<{
        access_token: string;
        refresh_token: string;
        user?: any;
        studio?: any;
      }>('/auth/refresh', { refresh_token: refreshToken })
      .then((res) => {
        const current = useAuthStore.getState();
        current.setAuth({
          user: res.user || current.user!,
          studio: res.studio || current.studio,
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        // Force all tenant-scoped queries to refetch with the new token
        queryClient.invalidateQueries();
      })
      .catch(() => {
        // Silent — user can still navigate; if API calls keep 401ing,
        // the api-client's 401 handler will redirect to /login
      });
  }, [hasHydrated, isAuthenticated, studio, queryClient]);
}
