import type { BodyStats } from '@/api/types';

/**
 * ────────────────────────────────────────────────────────────────
 * PROGRESS — reading a member's measurements honestly
 * ────────────────────────────────────────────────────────────────
 *
 * Every numeric field arrives as a Prisma `Decimal` serialised to a STRING,
 * so nothing here may assume `number`. This is the same defect that shipped
 * `₹NaN` to the web app when the interceptor flattened Decimals — the fix
 * there was server-side, but a client that does `value * 2` on "72.5" is
 * making the same assumption from the other end.
 */

/** Coerce an API numeric (number | string | null) to a number, or null. */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The series for a metric, OLDEST FIRST.
 *
 * The API returns newest-first (it is a history list), but a chart reads left
 * to right through time. Reversing at the point of charting rather than
 * changing the list order keeps both readers correct.
 *
 * Records missing this metric are dropped rather than zero-filled: a gym that
 * weighed somebody but did not measure their waist has no waist datum, and
 * plotting that as 0 invents a collapse that never happened.
 */
export function seriesFor(stats: BodyStats[], metric: keyof BodyStats): number[] {
  return stats
    .slice()
    .reverse()
    .map((s) => toNumber(s[metric]))
    .filter((n): n is number => n !== null);
}

/** The most recent record that actually carries this metric. */
export function latestWith(stats: BodyStats[], metric: keyof BodyStats): BodyStats | null {
  // The list is newest-first, so the first hit is the latest.
  return stats.find((s) => toNumber(s[metric]) !== null) ?? null;
}

export type Delta = { from: number; to: number; change: number } | null;

/**
 * Change between the first and last reading of a metric.
 *
 * Returns null for a single reading. "No change" and "only one measurement"
 * are different facts, and showing 0.0 for the latter tells a member their
 * training did nothing when in truth nobody has measured them twice.
 */
export function deltaFor(stats: BodyStats[], metric: keyof BodyStats): Delta {
  const series = seriesFor(stats, metric);
  if (series.length < 2) return null;
  const from = series[0];
  const to = series[series.length - 1];
  return { from, to, change: to - from };
}
