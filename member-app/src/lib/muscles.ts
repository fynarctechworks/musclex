/**
 * Head-level muscle taxonomy.
 *
 * `muscle_group` is the coarse bucket a gym catalogues by (shoulders, back…).
 * `target_muscle` is the head an exercise actually drives. The split matters
 * because "Shoulders" as one list is how people end up doing front delts three
 * times a week and rear delts never — the group is not the muscle.
 *
 * Ordering within a group is anatomical, not alphabetical, so the sections read
 * front-to-back the way people think about the muscle.
 */

export interface TargetGroup {
  key: string;
  label: string;
  /** One-line reason this head deserves its own slot in the session. */
  hint: string;
}

const GROUPS: Record<string, TargetGroup[]> = {
  shoulders: [
    { key: 'front_delt', label: 'Front delt', hint: 'Already worked by pressing' },
    { key: 'side_delt', label: 'Side delt', hint: 'Drives shoulder width' },
    { key: 'rear_delt', label: 'Rear delt', hint: 'Most often skipped' },
  ],
  chest: [
    { key: 'upper_chest', label: 'Upper chest', hint: 'Incline work' },
    { key: 'mid_chest', label: 'Mid chest', hint: 'Flat pressing' },
    { key: 'lower_chest', label: 'Lower chest', hint: 'Decline and dips' },
  ],
  back: [
    { key: 'lats', label: 'Lats', hint: 'Width' },
    { key: 'traps', label: 'Traps', hint: 'Upper back thickness' },
    { key: 'spinal_erectors', label: 'Lower back', hint: 'Hinging and bracing' },
  ],
  legs: [
    { key: 'quads', label: 'Quads', hint: 'Knee-dominant' },
    { key: 'hamstrings', label: 'Hamstrings', hint: 'Hip-dominant' },
    { key: 'glutes', label: 'Glutes', hint: 'Extension and lockout' },
    { key: 'calves', label: 'Calves', hint: 'Easily forgotten' },
  ],
  arms: [
    { key: 'biceps', label: 'Biceps', hint: 'Elbow flexion' },
    { key: 'triceps', label: 'Triceps', hint: 'Two thirds of the arm' },
    { key: 'forearms', label: 'Forearms', hint: 'Grip' },
  ],
  core: [
    { key: 'abs', label: 'Abs', hint: 'Flexion' },
    { key: 'obliques', label: 'Obliques', hint: 'Rotation and side bend' },
  ],
};

/** The heads worth splitting a group into, or null when a split adds nothing. */
export function groupsFor(muscleGroup: string | null): TargetGroup[] | null {
  if (!muscleGroup) return null;
  return GROUPS[muscleGroup] ?? null;
}

/** Human label for a target key, falling back to a readable form of the key. */
export function targetLabel(key: string | null | undefined): string {
  if (!key) return 'Other';
  for (const list of Object.values(GROUPS)) {
    const hit = list.find((g) => g.key === key);
    if (hit) return hit.label;
  }
  return key.replace(/_/g, ' ');
}

/**
 * The coarse groups the library and picker filter by, in the order shown.
 *
 * Lives here rather than beside either screen because both offer the same
 * filter, and two copies would drift the first time a group is renamed.
 */
export const MUSCLES: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Legs', value: 'legs' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Full body', value: 'full_body' },
];

/** One head and the exercises that train it. */
export interface HeadSection<T> {
  head: TargetGroup;
  list: T[];
}

/**
 * Split a muscle group's exercises by head, in anatomical order.
 *
 * Anything whose target does not match a known head is collected under
 * "Other" rather than dropped — a library that silently omits exercises is
 * worse than one that admits some are unclassified, and the dataset does have
 * gaps.
 *
 * Pure and generic so it can be tested without a screen, and so the picker and
 * the library cannot disagree about what belongs where.
 */
export function buildHeadSections<T extends { targetMuscle?: string | null }>(
  items: T[],
  heads: TargetGroup[] | null,
): HeadSection<T>[] | null {
  if (!heads) return null;

  const byTarget = new Map<string, T[]>();
  for (const e of items) {
    const key = e.targetMuscle ?? 'other';
    const list = byTarget.get(key) ?? [];
    list.push(e);
    byTarget.set(key, list);
  }

  const out: HeadSection<T>[] = heads.map((h) => ({ head: h, list: byTarget.get(h.key) ?? [] }));

  const leftovers = items.filter((e) => !heads.some((h) => h.key === e.targetMuscle));
  if (leftovers.length) {
    out.push({
      head: { key: 'other', label: 'Other', hint: 'Not classified yet' },
      list: leftovers,
    });
  }
  return out;
}
