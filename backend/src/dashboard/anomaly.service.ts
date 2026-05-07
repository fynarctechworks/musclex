import { Injectable } from '@nestjs/common';

export type AnomalyKind =
  | 'check_ins_low'
  | 'check_ins_high'
  | 'revenue_low'
  | 'revenue_high';

export interface Anomaly {
  kind: AnomalyKind;
  severity: 'high' | 'medium' | 'low';
  /** The metric name in human terms (e.g. "Check-ins today"). */
  metric: string;
  /** Today's observed value. */
  value: number;
  /** Baseline (mean of trailing window, excluding today). */
  baseline: number;
  /** Standard deviation of the baseline window. */
  stdev: number;
  /** Deviation in standard-deviation units. */
  z_score: number;
  /** Percentage deviation from baseline. */
  delta_pct: number;
  /** Human-readable summary used as the action item title. */
  summary: string;
  /** "Why we said this" — full evidence sentence. */
  why: string;
}

/**
 * Pure-function anomaly detector. Operates on a 14-point series ending
 * with TODAY's value, plus today's value reported separately for the
 * "live" comparison. Flags an anomaly when:
 *   - |z-score| ≥ 2.0 (≈95% one-sided), AND
 *   - |delta_pct| ≥ 25%, AND
 *   - baseline window has at least 7 non-zero days (otherwise data is too sparse)
 *
 * Severity:
 *   - high   when |z| ≥ 3 OR |delta_pct| ≥ 50%
 *   - medium when |z| ≥ 2.5 OR |delta_pct| ≥ 35%
 *   - low    otherwise
 *
 * The cutoffs are deliberately conservative — false positives erode
 * trust in the Action Stack faster than false negatives.
 */
@Injectable()
export class AnomalyService {
  detect(input: {
    series_14d: number[];
    today_value: number;
    metric: 'check_ins' | 'revenue';
  }): Anomaly | null {
    const { series_14d, today_value, metric } = input;
    if (!Array.isArray(series_14d) || series_14d.length < 8) return null;

    // Baseline = the 13 days BEFORE today (exclude today's bucket itself).
    const baselineDays = series_14d.slice(0, -1);
    const nonZero = baselineDays.filter((v) => v > 0);
    if (nonZero.length < 7) return null;

    const baseline = mean(baselineDays);
    const stdev = stdDev(baselineDays);
    if (baseline <= 0) return null;
    if (stdev <= 0) return null;

    const z = (today_value - baseline) / stdev;
    const deltaPct = ((today_value - baseline) / baseline) * 100;

    if (Math.abs(z) < 2 || Math.abs(deltaPct) < 25) return null;

    const direction = today_value < baseline ? 'low' : 'high';
    const kind = (
      metric === 'check_ins'
        ? direction === 'low'
          ? 'check_ins_low'
          : 'check_ins_high'
        : direction === 'low'
          ? 'revenue_low'
          : 'revenue_high'
    ) as AnomalyKind;

    const severity =
      Math.abs(z) >= 3 || Math.abs(deltaPct) >= 50
        ? 'high'
        : Math.abs(z) >= 2.5 || Math.abs(deltaPct) >= 35
          ? 'medium'
          : 'low';

    const metricLabel =
      metric === 'check_ins' ? 'Check-ins' : "Today's revenue";
    const dirWord = direction === 'low' ? 'down' : 'up';
    const summary = `${metricLabel} ${dirWord} ${Math.abs(deltaPct).toFixed(0)}% vs the 13-day baseline`;
    const why =
      `${metricLabel} is at ${formatNumber(today_value, metric === 'revenue')} today vs ` +
      `a 13-day mean of ${formatNumber(baseline, metric === 'revenue')} ` +
      `(σ=${formatNumber(stdev, metric === 'revenue')}, z=${z.toFixed(2)}). ` +
      `That's ${Math.abs(deltaPct).toFixed(0)}% ${dirWord}.`;

    return {
      kind,
      severity,
      metric: metricLabel,
      value: round2(today_value),
      baseline: round2(baseline),
      stdev: round2(stdev),
      z_score: round2(z),
      delta_pct: round2(deltaPct),
      summary,
      why,
    };
  }
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance =
    xs.reduce((acc, v) => acc + (v - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatNumber(n: number, isCurrency: boolean): string {
  if (isCurrency) return `₹${Math.round(n).toLocaleString()}`;
  return Math.round(n).toLocaleString();
}
