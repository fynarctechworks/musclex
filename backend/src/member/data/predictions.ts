/**
 * ────────────────────────────────────────────────────────────────
 * PREDICTIONS — what you could probably do today
 * ────────────────────────────────────────────────────────────────
 *
 * Two published formulas, named so anybody can check them, and neither
 * invented here.
 *
 * RACE TIMES — Riegel (1977): T2 = T1 x (D2 / D1)^1.06
 * The exponent says a distance twice as long takes slightly more than twice
 * as long, which is what actually happens to people.
 *
 * ONE-REP MAX — Epley and Brzycki, averaged.
 * This is the half Strava cannot do. They record weight training as a
 * stopwatch; we know the weight and the reps, so a projected 1RM is available
 * to us and not to them.
 */

/** Riegel's exponent. 1.06 is the published value for trained runners. */
export const RIEGEL_EXPONENT = 1.06;

export interface RacePrediction {
  distanceM: number;
  seconds: number;
  /** Seconds per kilometre, for a pace anybody can act on. */
  pacePerKm: number;
}

/** The distances worth predicting, in metres. */
export const RACE_DISTANCES = [5000, 10000, 21097.5, 42195] as const;

/**
 * Project race times from one known effort.
 *
 * Refuses to extrapolate wildly: Riegel holds reasonably from about a quarter
 * of the known distance to about four times it. Beyond that the formula still
 * returns a number, and that number is fiction — so we return nothing instead
 * of a marathon time predicted from a parkrun.
 */
export function predictRaces(
  bestDistanceM: number,
  bestSeconds: number,
  distances: readonly number[] = RACE_DISTANCES,
): RacePrediction[] {
  if (bestDistanceM <= 0 || bestSeconds <= 0) return [];

  return distances
    .filter((d) => d >= bestDistanceM / 4 && d <= bestDistanceM * 4)
    .map((d) => {
      const seconds = bestSeconds * Math.pow(d / bestDistanceM, RIEGEL_EXPONENT);
      return {
        distanceM: d,
        seconds: Math.round(seconds),
        pacePerKm: Math.round(seconds / (d / 1000)),
      };
    });
}

/* ── Strength ──────────────────────────────────────────────────── */

/** Epley: 1RM = w x (1 + reps/30) */
export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** Brzycki: 1RM = w x 36 / (37 - reps) */
export function brzycki(weight: number, reps: number): number {
  return (weight * 36) / (37 - reps);
}

export interface OneRepMax {
  /** Estimated one-rep max in the same unit as the input weight. */
  value: number;
  /** The set it came from. */
  fromWeight: number;
  fromReps: number;
  /** True when reps were low enough for the estimate to mean much. */
  confident: boolean;
}

/**
 * Estimate a one-rep max from a set.
 *
 * The two formulas are averaged because they disagree, and neither is right:
 * Epley reads high at low reps, Brzycki runs away above about ten. Averaging
 * is not more accurate in principle, but it avoids picking a side and is what
 * most strength calculators do.
 *
 * Above 12 reps this is a fitness test, not a strength one, and the estimate
 * is marked unconfident rather than quietly returned as fact. A single rep
 * needs no formula at all.
 */
export function estimateOneRepMax(weight: number, reps: number): OneRepMax | null {
  if (weight <= 0 || reps <= 0 || reps > 20) return null;
  if (reps === 1) {
    return { value: weight, fromWeight: weight, fromReps: 1, confident: true };
  }
  const value = (epley(weight, reps) + brzycki(weight, reps)) / 2;
  return {
    value: Math.round(value * 10) / 10,
    fromWeight: weight,
    fromReps: reps,
    confident: reps <= 12,
  };
}

/**
 * The best estimate across several sets.
 *
 * The heaviest set is not always the best evidence — 5 reps at 90 kg projects
 * higher than 1 rep at 95 kg, and it should, because it is the harder effort.
 */
export function bestOneRepMax(
  sets: { weight: number; reps: number }[],
): OneRepMax | null {
  let best: OneRepMax | null = null;
  for (const s of sets) {
    const e = estimateOneRepMax(s.weight, s.reps);
    if (!e) continue;
    if (!best || e.value > best.value) best = e;
  }
  return best;
}
