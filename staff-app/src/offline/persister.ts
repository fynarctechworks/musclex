import type { Persister, PersistedClient } from '@tanstack/query-persist-client-core';
import type { Query } from '@tanstack/react-query';

/**
 * ────────────────────────────────────────────────────────────────
 * OFFLINE CACHE — what survives the process, and what must not
 * ────────────────────────────────────────────────────────────────
 *
 * Gyms have basements, thick walls and bad signal. The plan asks for offline
 * READ: the dashboard, member list and schedule stay legible with no network,
 * instead of the honest-but-useless error state.
 *
 * Persisting a cache to disk changes the tenant-isolation problem in a way
 * that deserves stating plainly. In memory, "clear the cache on workspace
 * switch" is sufficient because the process boundary does the rest. On disk
 * the cache OUTLIVES the process, so a missed wipe is no longer a short window
 * — it is permanent until something else overwrites it.
 *
 * So isolation here does not rest on the wipe alone. Three independent things
 * have to fail before one gym could see another's rows:
 *
 *  1. SCOPE — each session's blob is stored under its own row key, derived
 *     from gym + branch + user. Another session reads a different row.
 *  2. BUSTER — react-query discards a restored cache whose buster does not
 *     match the current one, before hydrating anything. Same derivation.
 *  3. WIPE — sign-out and workspace switch delete the row outright.
 *
 * (1) and (2) are belt and braces on purpose: (3) is the one that depends on
 * app code running at the right moment, and that is exactly the kind of thing
 * that breaks quietly.
 */

/** Bump when the cached SHAPE changes, to discard blobs we can no longer read. */
const SCHEMA_VERSION = 'v1';

/**
 * How stale offline data may be before it is dropped entirely.
 *
 * Not a comfort setting. A cached membership that expired overnight would
 * otherwise still read "active" at the door tomorrow morning, and the desk
 * would wave somebody through on it. Twelve hours keeps a cache useful across
 * one shift and never across two.
 */
export const OFFLINE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Query key prefixes that are allowed to persist.
 *
 * An ALLOWLIST, not a denylist. The default has to be "does not touch disk",
 * because the failure mode of forgetting to exclude something is silent and
 * the failure mode of forgetting to include something is a screen that says
 * "no connection" — visible, and harmless.
 *
 * These three are what the plan promises offline and nothing more.
 */
const PERSISTED_PREFIXES = ['dashboard', 'members', 'schedule'] as const;

export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  // Never persist a failed or still-loading query: restoring an error as
  // though it were data is worse than having no cache at all.
  if (query.state.status !== 'success') return false;

  const head = query.queryKey?.[0];
  if (typeof head !== 'string') return false;
  return (PERSISTED_PREFIXES as readonly string[]).includes(head);
}

/**
 * The identity a cached blob belongs to.
 *
 * Branch is included because branch is a data boundary the same way gym is —
 * a staffer switching from Andheri to Bandra must not see Andheri's member
 * list sitting there, even though both are the same tenant.
 */
export interface CacheScope {
  gymId?: string | null;
  branchId?: string | null;
  userId?: string | null;
}

/**
 * Derive the row key / buster for a scope.
 *
 * Deterministic and total: an absent field becomes a literal so that
 * `{gym: 'a', branch: null}` and `{gym: null, branch: 'a'}` cannot collide
 * into the same string.
 */
export function scopeKey(scope: CacheScope): string {
  const part = (v?: string | null) => (v && v.length > 0 ? v : '-');
  return [SCHEMA_VERSION, part(scope.gymId), part(scope.branchId), part(scope.userId)].join(':');
}

/** Minimal key/value surface, so the persister can be tested without SQLite. */
export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** Drop every row EXCEPT the one named — how a switch reclaims disk. */
  removeAllExcept(key: string): Promise<void>;
}

export function createPersister(store: KVStore, scope: CacheScope): Persister {
  const key = scopeKey(scope);

  return {
    async persistClient(client: PersistedClient) {
      try {
        await store.set(key, JSON.stringify(client));
      } catch {
        // A full disk must not take the app down. Losing the offline cache is
        // a degraded experience; throwing here would be a crash on every
        // successful query.
      }
    },

    async restoreClient() {
      try {
        const raw = await store.get(key);
        if (!raw) return undefined;
        return JSON.parse(raw) as PersistedClient;
      } catch {
        // Corrupt or truncated blob — treat as absent. Do NOT rethrow: a bad
        // cache would otherwise brick startup on every launch.
        return undefined;
      }
    },

    async removeClient() {
      try {
        await store.remove(key);
      } catch {
        /* nothing useful to do */
      }
    },
  };
}
