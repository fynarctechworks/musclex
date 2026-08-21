import { metresBetween, type LatLng } from './polyline';

/**
 * ────────────────────────────────────────────────────────────────
 * SEGMENT MATCHING — did this activity actually cover that segment?
 * ────────────────────────────────────────────────────────────────
 *
 * The database narrows; this decides. PostGIS finds the handful of segments
 * whose start point is anywhere near the track — an index lookup — and then
 * every candidate is verified here, in code that can be unit-tested against
 * exact tracks rather than against a live spatial index.
 *
 * The failure this exists to prevent: awarding somebody a time on a segment
 * they merely drove past the end of. Being near the start proves nothing.
 *
 * Four things must hold:
 *
 *   1. the track passes close to the segment's START
 *   2. and close to its END
 *   3. in that ORDER — the same road ridden the other way is a different
 *      segment, and matching it backwards would put a descent on a climb's
 *      leaderboard
 *   4. and the distance covered between those two points is close to the
 *      segment's own length, so a track that loops away and comes back does
 *      not count
 */

export interface TrackPoint extends LatLng {
  /** Seconds since the activity started. */
  t: number;
}

export interface SegmentShape {
  start: LatLng;
  end: LatLng;
  distanceM: number;
}

export interface Effort {
  elapsedSeconds: number;
  startIndex: number;
  endIndex: number;
}

/** How far off the line a track may be and still count as having ridden it. */
export const MATCH_TOLERANCE_M = 35;
/** How far the covered distance may differ from the segment's own length. */
export const LENGTH_TOLERANCE = 0.25;

/** Index of the track point closest to `target`, searching from `from`. */
function nearestIndex(track: TrackPoint[], target: LatLng, from = 0): { index: number; distance: number } {
  let index = -1;
  let best = Infinity;
  for (let i = from; i < track.length; i++) {
    const d = metresBetween(track[i], target);
    if (d < best) {
      best = d;
      index = i;
    }
  }
  return { index, distance: best };
}

/** Distance along the track between two indices. */
function distanceBetween(track: TrackPoint[], a: number, b: number): number {
  let total = 0;
  for (let i = a + 1; i <= b; i++) total += metresBetween(track[i - 1], track[i]);
  return total;
}

/**
 * The effort this track made on this segment, or null if it did not ride it.
 *
 * Returns the FIRST complete pass. A lap session covering the same segment
 * three times yields one effort — the leaderboard takes one time per activity,
 * and picking the first is honest and predictable, where picking the best
 * would reward doing laps until one comes out fast.
 */
export function matchSegment(track: TrackPoint[], segment: SegmentShape): Effort | null {
  if (track.length < 2 || segment.distanceM <= 0) return null;

  const start = nearestIndex(track, segment.start);
  if (start.index < 0 || start.distance > MATCH_TOLERANCE_M) return null;

  // The end is searched only AFTER the start. Searching the whole track would
  // match a segment ridden backwards, and reversing a climb is a descent.
  const end = nearestIndex(track, segment.end, start.index + 1);
  if (end.index < 0 || end.distance > MATCH_TOLERANCE_M) return null;

  const covered = distanceBetween(track, start.index, end.index);
  const drift = Math.abs(covered - segment.distanceM) / segment.distanceM;
  // A track that wanders off and rejoins covers far more ground than the
  // segment does, and did not ride it.
  if (drift > LENGTH_TOLERANCE) return null;

  const elapsed = Math.round(track[end.index].t - track[start.index].t);
  if (elapsed <= 0) return null;

  return { elapsedSeconds: elapsed, startIndex: start.index, endIndex: end.index };
}

/**
 * Build a track from the stored streams.
 *
 * `latlng` and `time` are written together by the recorder, but a partial
 * upload or a hand-made request could leave them different lengths — so this
 * takes the shorter and never indexes past the end of either.
 */
export function trackFromStreams(
  latlng: unknown,
  time: unknown,
): TrackPoint[] {
  if (!Array.isArray(latlng) || !Array.isArray(time)) return [];
  const n = Math.min(latlng.length, time.length);
  const out: TrackPoint[] = [];
  for (let i = 0; i < n; i++) {
    const pair = latlng[i];
    const t = time[i];
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const [lat, lng] = pair;
    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof t !== 'number') continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    out.push({ lat, lng, t });
  }
  return out;
}
