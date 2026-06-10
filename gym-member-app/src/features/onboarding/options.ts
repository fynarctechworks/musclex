import type {
  ActivityLevel,
  ExperienceLevel,
  FitnessGoal,
  Gender,
  WorkoutPreference,
} from '../../api/types';
import type { IconName } from '../../design-system';

export const GENDER_OPTIONS: { value: Gender; label: string; icon?: IconName }[] = [
  { value: 'male', label: 'Male', icon: 'user' },
  { value: 'female', label: 'Female', icon: 'user' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const GOAL_OPTIONS: { value: FitnessGoal; label: string }[] = [
  { value: 'lose_weight', label: 'Lose weight' },
  { value: 'gain_muscle', label: 'Gain muscle' },
  { value: 'build_strength', label: 'Build strength' },
  { value: 'improve_fitness', label: 'Improve fitness' },
  { value: 'improve_endurance', label: 'Improve endurance' },
  { value: 'athletic_performance', label: 'Athletic performance' },
  { value: 'body_recomposition', label: 'Body recomposition' },
  { value: 'stay_healthy', label: 'Stay healthy' },
];

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string; icon?: IconName }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little or no exercise', icon: 'user' },
  { value: 'lightly_active', label: 'Lightly active', description: 'Light exercise 1–3 days/week', icon: 'flash' },
  { value: 'moderately_active', label: 'Moderately active', description: 'Exercise 3–5 days/week', icon: 'flash' },
  { value: 'very_active', label: 'Very active', description: 'Hard exercise 6–7 days/week', icon: 'flame' },
  { value: 'athlete', label: 'Athlete', description: 'Training twice a day / physical job', icon: 'dumbbell' },
];

export const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; description: string; icon?: IconName }[] = [
  { value: 'beginner', label: 'Beginner', description: 'New to training', icon: 'flash' },
  { value: 'intermediate', label: 'Intermediate', description: 'Train regularly', icon: 'dumbbell' },
  { value: 'advanced', label: 'Advanced', description: 'Years under the bar', icon: 'chart' },
];

export const WORKOUT_OPTIONS: { value: WorkoutPreference; label: string }[] = [
  { value: 'gym', label: 'Gym workouts' },
  { value: 'home', label: 'Home workouts' },
  { value: 'strength', label: 'Strength training' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'powerlifting', label: 'Powerlifting' },
  { value: 'bodybuilding', label: 'Bodybuilding' },
];

/** Common limitations offered as quick-picks (free of medical claims). */
export const LIMITATION_OPTIONS = [
  'Knee issues',
  'Back pain',
  'Shoulder issues',
  'Previous injury',
  'Medical restrictions',
];

// ── Unit conversion (values stay canonical cm / kg; these are display only) ──
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalInches = Math.round(cm / 2.54);
  return { ft: Math.floor(totalInches / 12), inch: totalInches % 12 };
}

export function ftInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * 2.54);
}

export function kgToLb(kg: number): number {
  return Math.round(kg * 2.2046226218);
}

export function lbToKg(lb: number): number {
  return Math.round(lb / 2.2046226218);
}

/** Human label for a fitness goal (used on Home / summary / profile). */
export function goalLabel(goal?: string | null): string {
  return GOAL_OPTIONS.find((g) => g.value === goal)?.label ?? 'Your goal';
}
