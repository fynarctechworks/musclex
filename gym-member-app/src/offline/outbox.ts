import { api } from '../api/endpoints';
import { MemberApiError, NetworkError } from '../api/client';
import type {
  CheckInRequest,
  BodyMetricInput,
  SetLog,
  MealLogInput,
  WaterLogInput,
} from '../api/types';
import { uuid } from '../lib/uuid';
import {
  insertOutbox,
  listPendingOutbox,
  markOutboxDone,
  updateOutboxAttempt,
  countPendingOutbox,
  deleteDoneOutbox,
} from './db';

/**
 * Offline outbox (TRD §8). Writes are enqueued with a client idempotency key,
 * shown optimistically, and synced on reconnect/foreground. The server dedupes
 * by idempotency key so a retried action never double-counts.
 */
export type OutboxKind =
  | 'checkin'
  | 'metric'
  | 'workout_log'
  | 'meal'
  | 'water'
  | 'chat';

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
interface MealPayload {
  kind: 'meal';
  body: MealLogInput;
}
interface WaterPayload {
  kind: 'water';
  body: WaterLogInput;
}
interface ChatPayload {
  kind: 'chat';
  trainerId: string;
  body: string;
}
export type OutboxPayload =
  | CheckinPayload
  | MetricPayload
  | WorkoutLogPayload
  | MealPayload
  | WaterPayload
  | ChatPayload;

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
  const idempotencyKey = key ?? uuid();
  await insertOutbox({
    id: uuid(),
    kind: payload.kind,
    payload: JSON.stringify(payload),
    idempotencyKey,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  });
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
    case 'meal':
      await api.logMeal(payload.body, idempotencyKey);
      return;
    case 'water':
      await api.logWater(payload.body, idempotencyKey);
      return;
    case 'chat':
      await api.sendChatMessage(payload.trainerId, payload.body, idempotencyKey);
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
    const rows = await listPendingOutbox();

    for (const row of rows) {
      const payload = JSON.parse(row.payload) as OutboxPayload;
      try {
        await send(payload, row.idempotencyKey);
        await markOutboxDone(row.id);
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
        await updateOutboxAttempt(
          row.id,
          attempts,
          status,
          err instanceof Error ? err.message : String(err),
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
  return countPendingOutbox();
}

/** Remove rows already confirmed (housekeeping; call occasionally). */
export async function vacuumDone(): Promise<void> {
  await deleteDoneOutbox();
}
