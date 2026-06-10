/**
 * Step → distance → calorie math for the on-device pedometer. The phone only
 * reports a step COUNT; distance and calories are derived from the member's body
 * metrics (height drives stride, weight drives energy). These are estimates from
 * well-established formulas — clearly derived, never fabricated sensor data.
 */

/** Walking stride length (m) ≈ height × 0.414 (standard gait estimate). */
export function strideMeters(heightCm: number): number {
  const h = heightCm > 0 ? heightCm : 170;
  return (h / 100) * 0.414;
}

/** Distance walked for a step count, in metres. */
export function distanceMeters(steps: number, heightCm: number): number {
  return Math.max(0, steps) * strideMeters(heightCm);
}

/**
 * Calories burned walking a distance. kcal ≈ distance(km) × weight(kg) × 0.9 —
 * the common net-walking approximation (~MET 3.5 at a normal pace).
 */
export function kcalFromSteps(steps: number, heightCm: number, weightKg: number): number {
  const km = distanceMeters(steps, heightCm) / 1000;
  const w = weightKg > 0 ? weightKg : 70;
  return km * w * 0.9;
}

/** Instantaneous speed (km/h) from a step delta over a time delta. */
export function speedKmh(deltaSteps: number, deltaMs: number, heightCm: number): number {
  if (deltaMs <= 0 || deltaSteps <= 0) return 0;
  const metres = deltaSteps * strideMeters(heightCm);
  const mps = metres / (deltaMs / 1000);
  return Math.max(0, Math.min(mps * 3.6, 25)); // clamp out sensor bursts (>25km/h)
}

/** Cadence in steps per minute from a step delta over a time delta. */
export function cadenceSpm(deltaSteps: number, deltaMs: number): number {
  if (deltaMs <= 0 || deltaSteps <= 0) return 0;
  return Math.round((deltaSteps / (deltaMs / 1000)) * 60);
}

/** Local YYYY-MM-DD (the tracker's day boundary is the member's local midnight). */
export function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local midnight (start of today) — used to seed iOS historical step queries. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
