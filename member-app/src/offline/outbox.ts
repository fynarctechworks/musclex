import { api } from '../api/endpoints';
import { ApiError, OfflineError, uuid } from '../api/client';
import type { SetLog } from '../api/types';
import { store, type StoredItem } from './store';

/**
 * ────────────────────────────────────────────────────────────────
 * OFFLINE OUTBOX
 * ────────────────────────────────────────────────────────────────
 *
 * Gyms are basements. A member must be able to log a whole workout with no
 * signal and have it land intact later, so every write goes through here:
 *
 *   1. persist with a client-generated idempotency key
 *   2. try to send immediately
 *   3. on network failure, leave it queued and flush later
 *
 * The key is generated ONCE and reused on every retry. The server dedupes on
 * it (`workout_logs.client_key` is unique per gym), so a retry hours later
 * cannot double-log. That guarantee is what makes queueing safe at all.
 *
 * A 4xx is NOT retryable — the request was refused, not lost — so those are
 * dropped from the queue rather than retried forever.
 */

export type OutboxKind = 'workout_log' | 'checkin' | 'water' | 'meal';

export type OutboxRow = StoredItem & { kind: OutboxKind };

type Payloads = {
  /** `workoutId` present = logged against a trainer assignment. */
  workout_log: {
    sets: SetLog[];
    workoutId?: string | null;
    /** When the session happened — preserved so a queued log keeps its date. */
    startedAt?: string;
    endedAt?: string;
  };
  checkin: Record<string, never>;
  water: { amountMl: number };
  meal: { items: unknown[]; mealType: string };
};

/** Send one queued item. Throws OfflineError if it never reached the server. */
async function send(kind: OutboxKind, payload: any, key: string): Promise<void> {
  switch (kind) {
    case 'workout_log':
      // Same key either way, so a queued set can be retried for hours without
      // risking a duplicate — and a queued assigned session stays assigned.
      {
        const span = { startedAt: payload.startedAt, endedAt: payload.endedAt };
        await (payload.workoutId
          ? api.logAssignedWorkout(payload.workoutId, payload.sets, key, span)
          : api.logFreestyle(payload.sets, key, span));
      }
      return;
    case 'checkin':
      await api.checkIn(key);
      return;
    case 'water':
      await api.logWater(payload.amountMl, key);
      return;
    case 'meal':
      await api.logMeal(payload, key);
      return;
  }
}

async function enqueue(kind: OutboxKind, payload: unknown, key: string) {
  const s = await store();
  await s.put({ key, kind, payload, createdAt: Date.now(), attempts: 0 });
}

async function remove(key: string) {
  const s = await store();
  await s.remove(key);
}

async function noteFailure(key: string) {
  const s = await store();
  const existing = (await s.all()).find((i) => i.key === key);
  if (existing) await s.put({ ...existing, attempts: existing.attempts + 1 });
}

/**
 * Write through the outbox.
 *
 * Returns `{ queued: true }` when the request could not reach the server — the
 * caller should tell the member it is saved and will sync, NOT that it failed.
 * Anything else the server actually refused is thrown.
 */
export async function write<K extends OutboxKind>(
  kind: K,
  payload: Payloads[K],
  key = uuid(),
): Promise<{ queued: boolean; result?: unknown }> {
  await enqueue(kind, payload, key);
  try {
    const result = await send(kind, payload, key);
    await remove(key);
    return { queued: false, result };
  } catch (err) {
    if (err instanceof OfflineError) {
      await noteFailure(key);
      return { queued: true };
    }
    // The server refused it. Retrying will not change that, so stop carrying it.
    await remove(key);
    throw err;
  }
}

export async function pendingCount(): Promise<number> {
  return (await store()).all().then((r) => r.length);
}

export async function listPending(): Promise<OutboxRow[]> {
  return (await store()).all() as Promise<OutboxRow[]>;
}

let flushing = false;

/**
 * Drain the queue oldest-first. Stops at the first network failure — if one
 * request cannot reach the server, the next will not either, and hammering a
 * dead connection wastes battery.
 */
export async function flush(): Promise<{ sent: number; remaining: number }> {
  if (flushing) return { sent: 0, remaining: await pendingCount() };
  flushing = true;
  let sent = 0;
  try {
    for (const row of await listPending()) {
      try {
        await send(row.kind, row.payload, row.key);
        await remove(row.key);
        sent += 1;
      } catch (err) {
        if (err instanceof OfflineError) break;
        if (err instanceof ApiError) {
          await remove(row.key); // refused, not lost
          continue;
        }
        await noteFailure(row.key);
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, remaining: await pendingCount() };
}
