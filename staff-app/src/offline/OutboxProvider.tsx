import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/auth/SessionProvider';
import { makeRow, type OutboxStore } from './outbox';
import { flushOutbox, type FlushSummary } from './flush';
import { createMemoryOutbox, createSqliteOutbox, offlineCacheSupported } from './sqlite-store';

/**
 * Owns the queued-check-in outbox and decides when to drain it.
 *
 * Draining is triggered by app FOREGROUND rather than a timer. The signal we
 * actually have is "the staffer just picked the phone up", which correlates
 * well with walking back into range, and costs nothing while the app sits on
 * the counter. A poll would spend battery all shift to learn the same thing
 * later. (Detecting connectivity properly would need NetInfo — a dependency
 * that is not approved; see DECISIONS.md.)
 */
type OutboxContextValue = {
  /** Rows waiting for this gym. */
  pending: number;
  /** Queue a check-in taken while offline. */
  enqueue: (input: { memberId: string; branchId: string; memberName: string }) => Promise<void>;
  /** Try to drain now. Safe to call when empty or offline. */
  flush: () => Promise<FlushSummary>;
};

const OutboxContext = React.createContext<OutboxContextValue | null>(null);

export function useOutbox(): OutboxContextValue {
  const ctx = React.useContext(OutboxContext);
  if (!ctx) throw new Error('useOutbox must be used inside <OutboxProvider>');
  return ctx;
}

export function OutboxProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [pending, setPending] = React.useState(0);

  const store = React.useRef<OutboxStore | null>(null);
  if (store.current === null) {
    store.current = offlineCacheSupported() ? createSqliteOutbox() : createMemoryOutbox();
  }

  const gymId = session?.studio?.id ?? session?.user?.studio_id ?? null;

  const refreshCount = React.useCallback(async () => {
    const s = store.current;
    if (!s || !gymId) { setPending(0); return; }
    setPending(await s.count(gymId).catch(() => 0));
  }, [gymId]);

  const flush = React.useCallback(async (): Promise<FlushSummary> => {
    const s = store.current;
    if (!s || !gymId) return { synced: 0, kept: 0, failed: false };

    const summary = await flushOutbox(s, gymId);
    await refreshCount();

    // Rows that landed changed attendance and last_visit_at on the server.
    if (summary.synced > 0) {
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
    return summary;
  }, [gymId, queryClient, refreshCount]);

  const enqueue = React.useCallback(
    async (input: { memberId: string; branchId: string; memberName: string }) => {
      const s = store.current;
      if (!s || !gymId) return;
      await s.add(makeRow({ ...input, gymId }));
      await refreshCount();
    },
    [gymId, refreshCount],
  );

  // Session changed: drop anything belonging to a different gym before it can
  // ever be flushed under this one's token.
  React.useEffect(() => {
    const s = store.current;
    if (!s) return;
    if (!gymId) { setPending(0); return; }
    void s.purgeOtherGyms(gymId).then(refreshCount).catch(() => {});
  }, [gymId, refreshCount]);

  // Drain on return to foreground, and once on mount.
  React.useEffect(() => {
    if (!gymId) return;
    void flush();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void flush();
    });
    return () => { sub.remove(); };
  }, [gymId, flush]);

  const value = React.useMemo(() => ({ pending, enqueue, flush }), [pending, enqueue, flush]);

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}
