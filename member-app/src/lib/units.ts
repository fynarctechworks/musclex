/**
 * ────────────────────────────────────────────────────────────────
 * UNITS
 * ────────────────────────────────────────────────────────────────
 *
 * Storage is ALWAYS metric — `weightKg`, `heightCm`, and every logged set.
 * Units are a display preference converted at the edge, never a second way to
 * store the same number. Storing whatever the member happened to be using
 * means every aggregate (volume, PRs, trends) has to know which unit each row
 * was written in, and one missed conversion silently corrupts history.
 *
 * So: convert on read, convert back on write, and let the database stay in one
 * language.
 */

export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ft';

const LB_PER_KG = 2.2046226218;
const CM_PER_INCH = 2.54;

/* ── weight ──────────────────────────────────────────────────── */

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

/**
 * Weights are entered in gym increments, so round to something a plate can
 * actually make: 0.5 kg or 1 lb. Showing 137.78924 lb for 62.5 kg is precision
 * nobody asked for and can't load onto a bar.
 */
export function roundWeight(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? Math.round(value) : Math.round(value * 2) / 2;
}

/** "62.5 kg" / "138 lb". `compact` drops the space for dense rows. */
export function formatWeight(
  kg: number | null | undefined,
  unit: WeightUnit,
  compact = false,
): string {
  if (kg == null) return '--';
  const v = roundWeight(fromKg(kg, unit), unit);
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return compact ? `${n}${unit}` : `${n} ${unit}`;
}

/** Volume totals are large, so they round to whole units and group thousands. */
export function formatVolume(kg: number, unit: WeightUnit): string {
  return `${Math.round(fromKg(kg, unit)).toLocaleString()} ${unit}`;
}

/* ── height ──────────────────────────────────────────────────── */

/** Feet+inches is two numbers, so height formats rather than converts. */
export function formatHeight(cm: number | null | undefined, unit: HeightUnit): string {
  if (cm == null) return '--';
  if (unit === 'cm') return `${Math.round(cm)} cm`;
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  // 11.6" rounds to 12"; carry it rather than printing 5'12".
  return inches === 12 ? `${feet + 1}'0"` : `${feet}'${inches}"`;
}

export function cmFromFeetInches(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export function feetInchesFromCm(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return inches === 12 ? { feet: feet + 1, inches: 0 } : { feet, inches };
}

export const weightLabel = (unit: WeightUnit) => (unit === 'lb' ? 'lb' : 'kg');
