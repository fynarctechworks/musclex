import { api } from '@/api/client';
import {
  buildSyncBody,
  partitionResults,
  type OutboxRow,
  type OutboxStore,
  type SyncResult,
} from './outbox';

/**
 * Drain the outbox for ONE gym.
 *
 * Separated from React so it can be called from a foreground listener, a
 * manual "Sync now", or a test, and so the tenant argument is explicit at
 * every call site rather than read from ambient state.
 *
 * Never throws: a failed flush is a normal condition (that is the entire
 * point), and a rejected promise here would surface as an unhandled error in
 * an app-state listener.
 */

/** Rows per request. A morning outage can queue a lot; one giant body is worse. */
const BATCH = 50;

export type FlushSummary = { synced: number; kept: number; failed: boolean };

export async function flushOutbox(
  store: OutboxStore,
  gymId: string | null | undefined,
): Promise<FlushSummary> {
  if (!gymId) return { synced: 0, kept: 0, failed: false };

  // Reads are gym-filtered in SQL, so rows queued by another gym are not
  // merely skipped here — they are never loaded.
  const pending = await store.all(gymId).catch(() => [] as OutboxRow[]);
  if (pending.length === 0) return { synced: 0, kept: 0, failed: false };

  let synced = 0;
  let kept = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);

    let results: SyncResult[] | undefined;
    try {
      const res = await api.post<{ results?: SyncResult[] }>(
        '/check-ins/sync',
        buildSyncBody(batch),
      );
      results = res?.results;
    } catch {
      // Still offline, or the server is unwell. Count the attempt and stop —
      // hammering the remaining batches will not go better.
      await store.bumpAttempts(batch.map((r) => r.clientEventId)).catch(() => {});
      return { synced, kept: kept + (pending.length - i), failed: true };
    }

    const { drop, retry } = partitionResults(batch, results);
    await store.remove(drop).catch(() => {});
    await store.bumpAttempts(retry).catch(() => {});

    synced += drop.length;
    kept += retry.length;
  }

  return { synced, kept, failed: false };
}
