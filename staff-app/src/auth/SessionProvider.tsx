import React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import * as store from '@/auth/session-store';
import { setCrashContext } from '@/observability/sentry';
import { setSignOutHandler } from '@/api/client';
import { registerForPush, unregisterForPush } from '@/push/push-registration';
import type { Session } from '@/auth/types';

/**
 * Session context.
 *
 * Wraps the module-level session store so components re-render on change,
 * while the API client keeps reading it synchronously from outside React.
 *
 * CRITICAL: signing out and switching workspace both clear the React Query
 * cache. A cache that survives either is a cross-tenant leak in the UI even
 * when the backend is perfectly scoped — gym A's member list would still be
 * sitting in memory after switching to gym B.
 */
type SessionContextValue = {
  session: Session | null;
  /** False until SecureStore has been read once — gate navigation on this. */
  ready: boolean;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  setActiveBranch: (branchId: string | null) => Promise<void>;
  switchWorkspace: (session: Session) => Promise<void>;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** Convenience: the signed-in user, or null. */
export function useCurrentUser() {
  return useSession().session?.user ?? null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = React.useState<Session | null>(store.getSession());
  const [ready, setReady] = React.useState(store.isLoaded());

  /*
   * Keep crash reports attributable to a gym and a role WITHOUT identifying a
   * person: staff row id, role and gym id only. Cleared on sign-out, so a
   * crash after signing out is not filed against the person who left.
   */
  React.useEffect(() => {
    setCrashContext(
      session
        ? {
            staffId: session.user?.id ?? null,
            role: session.user?.role ?? null,
            gymId: session.studio?.id ?? session.user?.studio_id ?? null,
          }
        : null,
    );
  }, [session]);

  /*
   * Register on sign-in and on every workspace switch. The server upserts on
   * (token, gym), so a switch ADDS the new gym rather than moving the device —
   * a staffer working two studios should be reachable in both.
   */
  const gymId = session?.studio?.id ?? session?.user?.studio_id ?? null;
  React.useEffect(() => {
    if (!gymId) return;
    void registerForPush();
  }, [gymId]);

  React.useEffect(() => {
    const unsub = store.subscribe(setSession);
    if (!store.isLoaded()) {
      void store.loadSession().finally(() => setReady(true));
    }
    return () => { unsub(); };
  }, []);

  const wipeCache = React.useCallback(() => {
    queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  const signOut = React.useCallback(async () => {
    /*
     * Order matters: /staff-push/unregister is authenticated, so it has to go
     * out while the session still exists. Clearing first would turn it into a
     * 401 and leave the handset registered — which on a shared front-desk
     * phone means the next person to hold it keeps receiving this gym's
     * alerts. It never blocks sign-out: a failure is logged, and the server
     * re-points the device to whoever signs in next.
     */
    try {
      await unregisterForPush();
    } catch {
      // unregisterForPush already swallows its own network errors; this is the
      // backstop that guarantees the guarantee. Nothing about push may ever
      // leave someone unable to sign out of a shared phone.
    }
    wipeCache();
    await store.clearSession();
  }, [wipeCache]);

  // The API client raises this when a refresh fails, so an expired session
  // lands on sign-in instead of leaving the app in a half-authenticated state.
  React.useEffect(() => {
    setSignOutHandler(() => { void signOut(); });
  }, [signOut]);

  const value = React.useMemo<SessionContextValue>(() => ({
    session,
    ready,
    signIn: (s) => store.saveSession(s),
    signOut,
    setActiveBranch: (branchId) => {
      // Branch is a server-side scope (X-Active-Branch-Id), so cached rows from
      // the previous branch are stale by definition.
      wipeCache();
      return store.patchSession({ activeBranchId: branchId });
    },
    switchWorkspace: async (s) => {
      wipeCache();
      await store.saveSession(s);
    },
  }), [session, ready, signOut, wipeCache]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
