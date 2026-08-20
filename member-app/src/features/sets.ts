import { toKg, type WeightUnit } from '../lib/units';
import type { SetLog } from '../api/types';

export interface WorkingSet {
  kg: string;
  reps: string;
  /** Seconds, for interval exercises. Kept as a string like the others. */
  secs: string;
  done: boolean;
}

export interface SessionBlock {
  id: string;
  name: string;
  /** Decides whether this block logs weight x reps or seconds. */
  trackingType?: 'reps' | 'duration';
  sets: WorkingSet[];
}

/**
 * Turn a running session into the payload the server accepts.
 *
 * Only completed sets count — a half-filled row the member never ticked is not
 * a set they did. Set numbers are assigned per exercise AFTER filtering, so
 * skipping set 2 and completing set 3 still sends 1,2 rather than a gap the
 * server would have to interpret.
 *
 * Values are strings in the UI so a half-typed "6" never becomes 6kg on blur;
 * they are coerced here, at the boundary.
 *
 * `displayUnit` is what the member TYPED in. Storage is always kg, so this is
 * the single point where pounds become kilos. Getting it wrong writes 138 into
 * a column that means kilograms and silently corrupts every PR and volume
 * total that follows, so the conversion lives here and nowhere else.
 */
export function toPayload(blocks: SessionBlock[], displayUnit: WeightUnit = 'kg'): SetLog[] {
  const out: SetLog[] = [];
  for (const b of blocks) {
    b.sets
      .filter((s) => s.done)
      .forEach((s, i) => {
        const timed = b.trackingType === 'duration';
        out.push({
          exerciseId: b.id,
          setNumber: i + 1,
          // A timed set still writes reps 0 / weight 0 rather than omitting
          // them: the columns are NOT NULL and old readers expect numbers.
          reps: timed ? 0 : Math.round(Number(s.reps) || 0),
          weight: timed ? 0 : toKg(Number(s.kg) || 0, displayUnit),
          ...(timed ? { durationSeconds: Math.round(Number(s.secs) || 0) } : {}),
          unit: 'kg',
        });
      });
  }
  return out;
}

/**
 * Total kg moved. Timed sets contribute nothing — a 60-second plank moves no
 * load, and counting it as zero is honest where inventing a number would not
 * be.
 */
export function totalVolume(payload: SetLog[]): number {
  return payload.reduce((a, s) => a + s.weight * s.reps, 0);
}

/** Total seconds under tension across the timed sets in a session. */
export function totalDuration(payload: SetLog[]): number {
  return payload.reduce((a, s) => a + (s.durationSeconds ?? 0), 0);
}
