import { titleiseSlug } from '@/lib/format';

/**
 * Training vocabulary and prescription formatting.
 *
 * Kept out of the screens so the mapping is testable, and so an enum the API
 * adds later degrades to readable text instead of leaking `general_fitness`
 * onto the page.
 */

const GOALS: Record<string, string> = {
  weight_loss: 'Weight loss',
  muscle_gain: 'Muscle gain',
  endurance: 'Endurance',
  general_fitness: 'General fitness',
};

const DIFFICULTY: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function describeGoal(goal?: string | null): string | null {
  if (!goal) return null;
  return GOALS[goal] ?? goal.replace(/_/g, ' ');
}

export function describeDifficulty(d?: string | null): string | null {
  if (!d) return null;
  return DIFFICULTY[d] ?? d.replace(/_/g, ' ');
}

/** Muscle groups the seeded library uses, in the order a plan usually runs. */
export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body',
] as const;

export function describeMuscleGroup(g?: string | null): string {
  return titleiseSlug(g, 'Other');
}

/**
 * The muscle head, spelled the way a trainer says it.
 *
 * titleiseSlug alone gives "Front Delt" and "Lats", which is close, but the
 * anatomical names are what a trainer writing a programme actually uses, and
 * the picker groups by this — so it has to read as the same vocabulary.
 */
const TARGET_MUSCLE_LABELS: Record<string, string> = {
  front_delt: 'Front delts',
  side_delt: 'Side delts',
  rear_delt: 'Rear delts',
  upper_chest: 'Upper chest',
  mid_chest: 'Mid chest',
  lower_chest: 'Lower chest',
  spinal_erectors: 'Spinal erectors',
  lats: 'Lats',
  traps: 'Traps',
  abs: 'Abs',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  adductors: 'Adductors',
  abductors: 'Abductors',
  cardiovascular_system: 'Cardio',
};

export function describeTargetMuscle(m?: string | null): string | null {
  if (!m) return null;
  return TARGET_MUSCLE_LABELS[m] ?? titleiseSlug(m, '');
}

/**
 * "Core · Abs" — the bucket and the head it actually trains.
 *
 * Collapses to just the bucket when the head repeats it, so a cardio movement
 * does not read "Cardio · Cardio".
 */
export function describeMuscle(
  group?: string | null,
  target?: string | null,
): string {
  const g = describeMuscleGroup(group);
  const t = describeTargetMuscle(target);
  if (!t || t.toLowerCase() === g.toLowerCase()) return g;
  return `${g} · ${t}`;
}

/**
 * The prescription line: "3 × 10 @ 40kg · 60s rest".
 *
 * Every part is optional because gyms prescribe differently — some set reps
 * and not weight, some only a time. Missing parts are OMITTED rather than
 * defaulted, because "3 × 0" reads as an instruction and "3 sets" reads as the
 * truth.
 */
export function describePrescription(input: {
  target_sets?: number | null;
  target_reps?: number | null;
  target_weight?: number | string | null;
  rest_seconds?: number | null;
}): string {
  const parts: string[] = [];

  const sets = input.target_sets ?? null;
  const reps = input.target_reps ?? null;
  if (sets && reps) parts.push(`${sets} × ${reps}`);
  else if (sets) parts.push(`${sets} set${sets === 1 ? '' : 's'}`);
  else if (reps) parts.push(`${reps} rep${reps === 1 ? '' : 's'}`);

  // Weight arrives as a Prisma Decimal string; Number() it before deciding.
  const weight = input.target_weight == null ? null : Number(input.target_weight);
  if (weight !== null && Number.isFinite(weight) && weight > 0) {
    parts.push(`@ ${weight}kg`);
  }

  const rest = input.rest_seconds ?? null;
  if (rest) parts.push(`${rest}s rest`);

  return parts.join(' · ');
}
