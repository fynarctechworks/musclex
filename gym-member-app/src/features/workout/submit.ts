import { api } from '../../api/endpoints';
import { NetworkError } from '../../api/client';
import { enqueue } from '../../offline/outbox';
import { uuid } from '../../lib/uuid';
import type { SetLog, WorkoutLogResult } from '../../api/types';

/**
 * Log workout sets. Online → returns the server result (so PRs can be
 * celebrated). Offline → queues under the same idempotency key and returns null;
 * it reconciles on reconnect (server dedupes, no double-count). TRD §8.
 */
export async function submitWorkoutLog(
  workoutId: string,
  sets: SetLog[],
): Promise<WorkoutLogResult | null> {
  const key = uuid();
  try {
    return await api.logWorkout(workoutId, sets, key);
  } catch (err) {
    if (err instanceof NetworkError) {
      await enqueue({ kind: 'workout_log', workoutId, sets }, key);
      return null;
    }
    throw err;
  }
}
