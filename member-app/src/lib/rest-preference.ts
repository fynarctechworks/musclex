import { kvGet, kvSet } from './kv';

/**
 * ────────────────────────────────────────────────────────────────
 * REST LENGTH — the member's default, not the app's
 * ────────────────────────────────────────────────────────────────
 *
 * Rest was a single `const REST_SECONDS = 90` in session.tsx, applied to
 * everyone. Ninety seconds is a reasonable default and a poor rule: it is
 * short for a heavy triple and long for accessory work, and the member already
 * has +30s and Skip in the timer precisely because the fixed number is so
 * often wrong.
 *
 * DELIBERATELY LOCAL. Putting this on the server profile would mean a schema
 * change, and rest length is a property of how somebody trains today rather
 * than an account fact worth syncing. Storing it on the device costs nothing
 * and needs no migration — and via `kv` it now survives a force-quit, so it is
 * set once rather than every session.
 *
 * What this is NOT: StrongLifts-style rest that shortens after a good set and
 * lengthens after a failure. That reads the outcome of a set and changes the
 * timer under the member, which is a behavioural change rather than a
 * preference, and it was explicitly left out of this slice.
 */

/** The app's default when nothing has been chosen — the previous constant. */
export const DEFAULT_REST_SECONDS = 90;

/** What the picker offers. Ordered short to long. */
export const REST_CHOICES = [60, 90, 120, 180] as const;

const KEY = 'musclex.rest-seconds';

/** Clamped to something a rest timer can sensibly be. */
function sane(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  const v = Math.round(n);
  return v >= 15 && v <= 600 ? v : null;
}

export function readRestSeconds(): number {
  const raw = kvGet(KEY);
  if (raw == null) return DEFAULT_REST_SECONDS;
  return sane(Number(raw)) ?? DEFAULT_REST_SECONDS;
}

export function writeRestSeconds(seconds: number): void {
  const v = sane(seconds);
  // A junk value leaves the stored preference alone rather than replacing a
  // good number with a bad one.
  if (v == null) return;
  kvSet(KEY, String(v));
}
