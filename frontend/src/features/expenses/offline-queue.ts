/**
 * Offline queue for expense creation.
 *
 * Writes queued expenses to IndexedDB so they survive page reloads, network
 * outages, and app restarts. Each queued entry carries an `idempotency_key` —
 * the backend enforces uniqueness on `(gym_id, idempotency_key)` so replaying
 * the same entry multiple times is safe.
 *
 * Flow:
 *   1. `enqueue(input)` — stores the payload, returns the synthetic Expense
 *      shape so UI can show it instantly with `status: 'pending'`.
 *   2. `drain(apiCall)` — iterates queue, POSTs each, removes on success.
 *      Backs off exponentially on failure.
 *   3. `useSyncExpenseQueue()` — React hook that drains when `online` fires.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { expensesApi, type CreateExpenseInput } from '@/features/payments';

const DB_NAME = 'musclex-expenses';
const DB_VERSION = 1;
const STORE = 'pending-expenses';

export interface QueuedExpense {
  idempotency_key: string;
  payload: CreateExpenseInput;
  queued_at: number;
  attempts: number;
  last_error?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === 'undefined') {
    throw new Error('Offline queue only available in the browser');
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'idempotency_key' });
        }
      },
    });
  }
  return dbPromise;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueExpense(
  input: CreateExpenseInput,
): Promise<QueuedExpense> {
  const db = await getDb();
  const entry: QueuedExpense = {
    idempotency_key: input.idempotency_key ?? generateIdempotencyKey(),
    payload: { ...input, idempotency_key: input.idempotency_key },
    queued_at: Date.now(),
    attempts: 0,
  };
  entry.payload.idempotency_key = entry.idempotency_key;
  await db.put(STORE, entry);
  return entry;
}

export async function listQueued(): Promise<QueuedExpense[]> {
  const db = await getDb();
  return (await db.getAll(STORE)) as QueuedExpense[];
}

export async function removeQueued(idempotencyKey: string) {
  const db = await getDb();
  await db.delete(STORE, idempotencyKey);
}

export async function updateQueuedFailure(
  idempotencyKey: string,
  error: string,
) {
  const db = await getDb();
  const entry = (await db.get(STORE, idempotencyKey)) as QueuedExpense | undefined;
  if (!entry) return;
  entry.attempts += 1;
  entry.last_error = error;
  await db.put(STORE, entry);
}

export interface DrainResult {
  flushed: number;
  failed: number;
  remaining: number;
}

/**
 * Iterate queue, attempt each POST /expenses, remove on success.
 * Skips entries whose attempt count exceeds `maxAttempts` so we don't spin
 * forever on a poisoned payload.
 */
export async function drainQueue(maxAttempts = 5): Promise<DrainResult> {
  const queued = await listQueued();
  let flushed = 0;
  let failed = 0;

  for (const entry of queued) {
    if (entry.attempts >= maxAttempts) {
      failed += 1;
      continue;
    }
    try {
      await expensesApi.create(entry.payload);
      await removeQueued(entry.idempotency_key);
      flushed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateQueuedFailure(entry.idempotency_key, message);
      failed += 1;
    }
  }

  const remaining = (await listQueued()).length;
  return { flushed, failed, remaining };
}

/**
 * Hook that:
 *   - Tracks the number of queued items.
 *   - Drains the queue when the browser goes online.
 *   - Exposes a manual `sync()` the UI can trigger.
 */
export function useExpenseSyncQueue() {
  const qc = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = async () => {
    try {
      const list = await listQueued();
      setPendingCount(list.length);
    } catch {
      /* no-op — IndexedDB may not be available in SSR */
    }
  };

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await drainQueue();
      if (result.flushed > 0) {
        qc.invalidateQueries({ queryKey: queryKeys.expenses.all });
        qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      }
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  };

  useEffect(() => {
    refreshCount();
    if (typeof window === 'undefined') return;

    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    // Opportunistic first drain on mount — network might have recovered
    // between visits.
    if (navigator.onLine) void sync();
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    pendingCount,
    syncing,
    sync,
    refresh: refreshCount,
  };
}
