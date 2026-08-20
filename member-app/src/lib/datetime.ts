/**
 * Date formatting used across the app. Members read times, not timestamps —
 * "Today · 5:49 PM" beats "19/08/2026, 05:49:48" everywhere it appears.
 */

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Tomorrow", or "Sat 23 Aug". */
export function dayOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Today · 5:49 PM" — the one-line form used in cards. */
export function whenOf(iso: string): string {
  return `${dayOf(iso)} · ${timeOf(iso)}`;
}

/** "12 Aug" — compact, for history rows. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
