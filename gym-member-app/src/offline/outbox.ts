import { api } from '../api/endpoints';
import { MemberApiError, NetworkError } from '../api/client';
import type { CheckInRequest, BodyMetricInput, SetLog } from '../api/types';
import { uuid } from '../lib/uuid';
import { getDb } from './db';

/**
 * Offline outbox (TRD §8). Writes are enqueued with a client idempotency key,
 * shown optimistically, and synced on reconnect/foreground. The server dedupes
 * by idempotency key so a retried action never double-counts.
 */
export type OutboxKind = 'checkin' | 'metric' | 'workout_log';

interface CheckinPayload {
  kind: 'checkin';
  body: CheckInRequest;
}
interface MetricPayload {
  kind: 'metric';
  body: BodyMetricInput;
}
interface WorkoutLogPayload {
  kind: 'workout_log';
  workoutId: string;
  sets: SetLog[];
}
export type OutboxPayload = CheckinPayload | MetricPayload | WorkoutLogPayload;

export interface OutboxRow {
  id: string;
  kind: OutboxKind;
  idempotencyKey: string;
  status: 'pending' | 'done' | 'failed';
  attempts: number;
  createdAt: number;
}

const MAX_ATTEMPTS = 8;

/**
 * Queue a write. Returns the idempotency key so the caller can dedupe UI state.
 * Pass `key` to reuse an idempotency key from a failed direct attempt so the
 * server dedupes the eventual retry against it.
 */
export async function enqueue(
  payload: OutboxPayload,
  key?: string,
): Promise<string> {
  const db = await getDb();
  const id = uuid();
  const idempotencyKey = key ?? uuid();
  await db.runAsync(
    `INSERT INTO outbox (id, kind, payload, idempotency_key, status, attempts, created_at)
     VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
    id,
    payload.kind,
    JSON.stringify(payload),
    idempotencyKey,
    Date.now(),
  );
  return idempotencyKey;
}

async function send(payload: OutboxPayload, idempotencyKey: string): Promise<void> {
  switch (payload.kind) {
    case 'checkin':
      await api.checkIn(payload.body, idempotencyKey);
      return;
    case 'metric':
      await api.addMetric(payload.body, idempotencyKey);
      return;
    case 'workout_log':
      await api.logWorkout(payload.workoutId, payload.sets, idempotencyKey);
      return;
  }
}

let syncing = false;

/**
 * Drain pending rows in creation order. Idempotent and safe to call often
 * (foreground, reconnect, after enqueue). Returns count successfully synced.
 */
export async function sync(): Promise<number> {
  if (syncing) return 0;
  syncing = true;
  let done = 0;
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string;
      payload: string;
      idempotency_key: string;
      attempts: number;
    }>(
      `SELECT id, payload, idempotency_key, attempts FROM outbox
       WHERE status = 'pending' ORDER BY created_at ASC`,
    );

    for (const row of rows) {
      const payload = JSON.parse(row.payload) as OutboxPayload;
      try {
        await send(payload, row.idempotency_key);
        await db.runAsync(`UPDATE outbox SET status = 'done' WHERE id = ?`, row.id);
        done++;
      } catch (err) {
        if (err instanceof NetworkError) {
          // Still offline — stop; remaining rows stay pending.
          break;
        }
        const attempts = row.attempts + 1;
        const permanent =
          err instanceof MemberApiError && !err.retryable && err.status < 500;
        const status = permanent || attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
        await db.runAsync(
          `UPDATE outbox SET attempts = ?, status = ?, last_error = ? WHERE id = ?`,
          attempts,
          status,
          err instanceof Error ? err.message : String(err),
          row.id,
        );
      }
    }
  } finally {
    syncing = false;
  }
  return done;
}

/** Count of rows not yet confirmed by the server (for a "syncing N" indicator). */
export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM outbox WHERE status = 'pending'`,
  );
  return r?.n ?? 0;
}

/** Remove rows already confirmed (housekeeping; call occasionally). */
export async function vacuumDone(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM outbox WHERE status = 'done'`);
}
