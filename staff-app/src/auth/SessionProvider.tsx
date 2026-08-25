import React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import * as store from '@/auth/session-store';
import { setSignOutHandler } from '@/api/client';
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
