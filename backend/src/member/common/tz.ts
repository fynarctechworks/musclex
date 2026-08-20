/**
 * The member's UTC offset, taken from the device.
 *
 * Days are a fact about where the member is standing, not about where the
 * server runs. Streaks, active days and the training calendar are all keyed by
 * calendar day, so every one of them needs this — and they must all parse it
 * the same way, or two surfaces disagree about what day it is.
 *
 * Kept in one file for that reason: a second copy of this clamp is exactly the
 * kind of duplicate definition that has drifted here before.
 */

/** Real world offsets run from UTC-12 (Baker Island) to UTC+14 (Kiritimati). */
const MIN = -720;
const MAX = 840;

/**
 * Parse a `tz` query value into minutes EAST of UTC. IST sends 330.
 *
 * Falls back to 0 (UTC) rather than throwing: a missing or malformed offset
 * should degrade to a defensible day boundary, not refuse to show someone
 * their own streak.
 */
export function tzOffset(raw?: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < MIN || n > MAX) return 0;
  return Math.trunc(n);
}
