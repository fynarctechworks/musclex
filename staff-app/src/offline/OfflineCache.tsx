import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';

import { useSession } from '@/auth/SessionProvider';
import {
  OFFLINE_MAX_AGE_MS,
  createPersister,
  scopeKey,
  shouldPersistQuery,
  type CacheScope,
  type KVStore,
} from './persister';
import { createMemoryStore, createSqliteStore, offlineCacheSupported } from './sqlite-store';

/**
 * Binds the query cache to disk for the CURRENT session, and only that session.
 *
 * This sits inside SessionProvider rather than replacing QueryClientProvider at
 * the root, because the scope it must persist under (gym, branch, user) is not
 * known until the session has been read out of SecureStore. Wrapping the root
 * with PersistQueryClientProvider would force a decision about which tenant's
 * cache to open before we know who is signed in — which is precisely the
 * decision that must not be guessed.
 *
 * The invariant it maintains: AT MOST ONE cache blob exists on disk, belonging
 * to the session currently signed in. Every scope change sweeps the rest away,
 * so a stale blob cannot outlive the session that wrote it even if a wipe
 * elsewhere is missed.
 */
export function OfflineCache({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { session, ready } = useSession();

  const store = React.useRef<KVStore | null>(null);
  if (store.current === null) {
    // Web falls back to memory: nothing persists across a reload, which is the
    // right behaviour for a browser tab and keeps `run web` working.
    store.current = offlineCacheSupported() ? createSqliteStore() : createMemoryStore();
  }

  const scope: CacheScope = {
    gymId: session?.studio?.id ?? session?.user?.studio_id ?? null,
    branchId: session?.activeBranchId ?? null,
    userId: session?.user?.id ?? null,
  };
  // A primitive, so the effect re-runs on a real scope change and not on every
  // re-render that happens to rebuild the object.
  const key = session ? scopeKey(scope) : null;

  React.useEffect(() => {
    if (!ready) return;
    const kv = store.current;
    if (!kv) return;

    // Signed out: no cache may remain. Sweep everything.
    if (!key) {
      void kv.removeAllExcept('');
      return;
    }

    let cancelled = false;

    // Drop every other scope's blob before restoring this one. Cheap, and it
    // means a device that has hosted several staffers or gyms is not quietly
    // accumulating their data.
    void kv.removeAllExcept(key);

    const [unsubscribe, restored] = persistQueryClient({
      queryClient,
      persister: createPersister(kv, scope),
      maxAge: OFFLINE_MAX_AGE_MS,
      /*
       * buster is the SECOND line of defence. Even if a blob for another scope
       * were somehow read, react-query compares busters before hydrating and
       * discards a mismatch — so isolation does not rest on the row key alone.
       */
      buster: key,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    });

    restored.catch(() => {
      // Restore already falls back to an empty cache internally; this only
      // stops an unhandled rejection warning on a corrupt blob.
    });

    return () => {
      cancelled = true;
      void cancelled;
      unsubscribe();
    };
    // `scope` is derived from `key`; listing it too would re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, queryClient]);

  return <>{children}</>;
}
