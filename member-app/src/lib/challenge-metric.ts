import type { GroupChallenge } from '../api/types';

/**
 * How a challenge's raw number is shown.
 *
 * The metric decides the unit, and getting it wrong is the kind of bug nobody
 * reports — "312" next to a name looks plausible whether it means kilometres,
 * minutes or workouts. Kept in one place so the list, the board and the
 * progress bar can never disagree.
 */

export type Metric = GroupChallenge['metric'];

export const METRIC_LABEL: Record<Metric, string> = {
  distance_m: 'Distance',
  elapsed_seconds: 'Time',
  activity_count: 'Activities',
  elevation_m: 'Climbing',
};

/** A stored value rendered for a person, with its unit. */
export function formatMetric(metric: Metric, value: number): string {
  switch (metric) {
    case 'distance_m':
      return `${(value / 1000).toFixed(1)} km`;
    case 'elapsed_seconds': {
      const h = Math.floor(value / 3600);
      const m = Math.round((value % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    case 'elevation_m':
      return `${Math.round(value)} m`;
    default:
      return `${value}`;
  }
}

/** Portion of the target reached, 0–1. Zero when the challenge has no target. */
export function progress(target: number | null, value: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(1, Math.max(0, value / target));
}

/** "8 days left", "last day", "finished". */
export function daysLeft(endsOn: string, now: Date = new Date()): string {
  const end = new Date(`${endsOn}T23:59:59`);
  const ms = end.getTime() - now.getTime();
  if (ms < 0) return 'finished';
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'last day';
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}
