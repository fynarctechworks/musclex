/**
 * ────────────────────────────────────────────────────────────────
 * BODY MAP — which muscles have been worked, and how much
 * ────────────────────────────────────────────────────────────────
 *
 * The regions below are a SCHEMATIC, not an anatomical drawing. A stylised
 * body made of simple shapes reads instantly at phone size and stays
 * maintainable; a traced anatomical illustration would look better in a
 * screenshot and be unmaintainable the first time a muscle is added.
 *
 * Strava ships a muscle map inferred from a stopwatch. Ours is built from the
 * actual target muscle of every set logged, which is data they do not have.
 */

export type Side = 'front' | 'back';

export interface Region {
  key: string;
  label: string;
  side: Side;
  /** Rounded rect in a 100x220 viewBox. */
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}

/**
 * Every target muscle and coarse group the catalogue uses, mapped onto a
 * region. Several muscles share a region on purpose — the map answers "have I
 * trained my back this week", not "which head of the deltoid".
 */
export const MUSCLE_REGION: Record<string, string> = {
  // Chest
  chest: 'chest', upper_chest: 'chest', mid_chest: 'chest', lower_chest: 'chest',
  // Shoulders
  shoulders: 'shoulders', front_delts: 'shoulders', side_delts: 'shoulders',
  rear_delts: 'upper_back', traps: 'upper_back',
  // Arms
  arms: 'arms', biceps: 'arms', triceps: 'arms_back', forearms: 'arms',
  // Back
  back: 'upper_back', lats: 'lats', mid_back: 'upper_back', lower_back: 'lower_back',
  // Core
  core: 'core', abs: 'core', obliques: 'core',
  // Legs
  legs: 'quads', quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes',
  calves: 'calves', adductors: 'quads', abductors: 'glutes',
  // Whole body
  full_body: 'core', cardio: 'core',
};

export const REGIONS: Region[] = [
  // ── Front ──
  { key: 'shoulders', label: 'Shoulders', side: 'front', x: 20, y: 42, w: 60, h: 14, rx: 7 },
  { key: 'chest', label: 'Chest', side: 'front', x: 30, y: 58, w: 40, h: 22, rx: 8 },
  { key: 'arms', label: 'Arms', side: 'front', x: 8, y: 60, w: 14, h: 46, rx: 7 },
  { key: 'core', label: 'Core', side: 'front', x: 34, y: 82, w: 32, h: 30, rx: 8 },
  { key: 'quads', label: 'Quads', side: 'front', x: 28, y: 122, w: 44, h: 48, rx: 12 },
  // ── Back ──
  { key: 'upper_back', label: 'Upper back', side: 'back', x: 28, y: 46, w: 44, h: 24, rx: 8 },
  { key: 'lats', label: 'Lats', side: 'back', x: 24, y: 70, w: 52, h: 22, rx: 9 },
  { key: 'arms_back', label: 'Triceps', side: 'back', x: 8, y: 60, w: 14, h: 46, rx: 7 },
  { key: 'lower_back', label: 'Lower back', side: 'back', x: 34, y: 94, w: 32, h: 18, rx: 7 },
  { key: 'glutes', label: 'Glutes', side: 'back', x: 30, y: 114, w: 40, h: 20, rx: 9 },
  { key: 'hamstrings', label: 'Hamstrings', side: 'back', x: 28, y: 136, w: 44, h: 36, rx: 11 },
  { key: 'calves', label: 'Calves', side: 'back', x: 30, y: 174, w: 40, h: 30, rx: 11 },
];

/** The right-hand arm is a mirror of the left; stored once, drawn twice. */
export const MIRROR_X = 100;

/**
 * Fold per-muscle set counts onto regions.
 *
 * Anything the catalogue reports that is not in MUSCLE_REGION is dropped
 * rather than guessed at — a wrongly-lit region is worse than a dark one,
 * because it tells someone they trained something they did not.
 */
export function regionTotals(byMuscle: { muscle: string; sets: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const { muscle, sets } of byMuscle ?? []) {
    const region = MUSCLE_REGION[muscle];
    if (!region) continue;
    out.set(region, (out.get(region) ?? 0) + sets);
  }
  return out;
}

/**
 * Intensity 0–4 for a region, RELATIVE to the member's own hardest-worked
 * muscle.
 *
 * Relative on purpose, unlike the training calendar: the useful question here
 * is "what am I neglecting compared with everything else", and a fixed scale
 * would light a beginner's whole body dimly and tell them nothing.
 */
export function shade(sets: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (sets <= 0 || max <= 0) return 0;
  const ratio = sets / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

/** Regions with no work at all, in drawing order — the honest headline. */
export function neglected(totals: Map<string, number>): Region[] {
  return REGIONS.filter((r) => !totals.get(r.key));
}
