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
