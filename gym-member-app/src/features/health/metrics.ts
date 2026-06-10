import type { HealthMetricType } from '../../api/types';
import type { IconName } from '../../design-system';
import { health } from '../../design-system';

export interface MetricMeta {
  label: string;
  unit: string;
  icon: IconName;
  /** How a day's samples roll up for the headline number. */
  agg: 'sum' | 'avg' | 'latest';
  /** Format a daily rollup value for display. */
  format: (v: number) => string;
  /** Per-category accent (One UI principle) — small vibrant mark, not a fill. */
  accent: string;
}

const round = (v: number, d = 0) =>
  (Math.round(v * 10 ** d) / 10 ** d).toLocaleString();

/**
 * Display metadata for the health metrics the dashboard surfaces. Keeping this
 * app-side (not in the contract) lets us tune copy/units without a redeploy.
 * `icon` values must exist in the design-system Icon set; `accent` colours the
 * icon/ring per health domain instead of one uniform tint.
 */
export const METRIC_META: Partial<Record<HealthMetricType, MetricMeta>> = {
  steps: { label: 'Steps', unit: 'steps', icon: 'flash', agg: 'sum', format: (v) => round(v), accent: health.activity },
  calories_active: { label: 'Active energy', unit: 'kcal', icon: 'flame', agg: 'sum', format: (v) => `${round(v)} kcal`, accent: health.activity },
  calories_resting: { label: 'Resting energy', unit: 'kcal', icon: 'flame', agg: 'sum', format: (v) => `${round(v)} kcal`, accent: health.activity },
  active_minutes: { label: 'Active minutes', unit: 'min', icon: 'flash', agg: 'sum', format: (v) => `${round(v)} min`, accent: health.activity },
  distance_m: { label: 'Distance', unit: 'km', icon: 'pin', agg: 'sum', format: (v) => `${round(v / 1000, 2)} km`, accent: health.activity },
  heart_rate: { label: 'Heart rate', unit: 'bpm', icon: 'heart', agg: 'avg', format: (v) => `${round(v)} bpm`, accent: health.heart },
  hr_resting: { label: 'Resting HR', unit: 'bpm', icon: 'heart', agg: 'avg', format: (v) => `${round(v)} bpm`, accent: health.heart },
  hrv: { label: 'HRV', unit: 'ms', icon: 'heart', agg: 'avg', format: (v) => `${round(v)} ms`, accent: health.heart },
  respiratory_rate: { label: 'Respiratory rate', unit: 'br/min', icon: 'heart', agg: 'avg', format: (v) => `${round(v, 1)} br/min`, accent: health.oxygen },
  sleep_duration: { label: 'Sleep', unit: 'h', icon: 'chart', agg: 'sum', format: (v) => `${round(v / 3600, 1)} h`, accent: health.sleep },
  spo2: { label: 'Blood oxygen', unit: '%', icon: 'heart', agg: 'avg', format: (v) => `${round(v, 1)}%`, accent: health.oxygen },
  body_weight: { label: 'Weight', unit: 'kg', icon: 'chart', agg: 'latest', format: (v) => `${round(v, 1)} kg`, accent: health.body },
  body_fat: { label: 'Body fat', unit: '%', icon: 'chart', agg: 'latest', format: (v) => `${round(v, 1)}%`, accent: health.body },
  vo2max: { label: 'VO₂ max', unit: 'ml/kg/min', icon: 'flash', agg: 'latest', format: (v) => round(v, 1), accent: health.body },
  mood: { label: 'Mood', unit: '1–5', icon: 'heart', agg: 'avg', format: (v) => round(v, 1), accent: health.mind },
};

/**
 * Metrics shown on the Home snapshot grid (2×2), in order. Resting HR + sleep
 * are the most glanceable daily signals, paired with steps + active energy.
 * (Water lives on the Nutrition card; "workouts this week" has no rollup yet.)
 */
export const HOME_METRICS: HealthMetricType[] = [
  'steps',
  'hr_resting',
  'sleep_duration',
  'calories_active',
];

export const PROVIDER_LABELS: Record<string, string> = {
  apple_health: 'Apple Health',
  health_connect: 'Health Connect',
  fitbit: 'Fitbit',
  garmin: 'Garmin',
  scale: 'Smart scale',
};
