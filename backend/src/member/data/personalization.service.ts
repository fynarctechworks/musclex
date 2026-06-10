import { Injectable } from '@nestjs/common';
import type { RecommendationData } from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * PERSONALIZATION SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Pure, deterministic personalization from the member's fitness profile — no DB,
 * no side effects, no stored "program" table. Turns the onboarding answers into
 * daily nutrition targets (calories / protein / carbs / fat / water) and a
 * weekly workout recommendation (frequency + split).
 *
 * Formulas (documented so they can be audited / tuned):
 *   • BMR  — Mifflin–St Jeor.
 *   • TDEE — BMR × activity factor.
 *   • Calories — TDEE × goal adjustment.
 *   • Protein — g per kg bodyweight, by goal.
 *   • Fat — ~25% of calories; Carbs — remaining calories.
 *   • Water — 35 ml/kg (×1.15 for very active / athletes).
 *   • Split — by training experience.
 */

export type Gender = 'male' | 'female' | 'prefer_not_to_say';
export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'athlete';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';

export interface PersonalizationInput {
  gender?: Gender | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: ActivityLevel | null;
  primaryGoal?: string | null;
  trainingExperience?: TrainingExperience | null;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  athlete: 1.9,
};

/** Goal → calorie multiplier on TDEE. */
const GOAL_CALORIE_FACTOR: Record<string, number> = {
  lose_weight: 0.8,
  gain_muscle: 1.1,
  build_strength: 1.1,
  athletic_performance: 1.05,
  body_recomposition: 0.95,
  improve_endurance: 1.0,
  improve_fitness: 1.0,
  stay_healthy: 1.0,
};

/** Goal → protein grams per kg bodyweight. */
const GOAL_PROTEIN_PER_KG: Record<string, number> = {
  gain_muscle: 2.0,
  build_strength: 2.0,
  body_recomposition: 2.0,
  lose_weight: 1.8,
  athletic_performance: 1.8,
  improve_endurance: 1.6,
  improve_fitness: 1.6,
  stay_healthy: 1.6,
};

const SPLIT_BY_EXPERIENCE: Record<
  TrainingExperience,
  { weeklyWorkouts: number; splitKey: NonNullable<RecommendationData['splitKey']>; split: string }
> = {
  beginner: { weeklyWorkouts: 3, splitKey: 'full_body', split: 'Full Body · 3×/week' },
  intermediate: { weeklyWorkouts: 4, splitKey: 'push_pull_legs', split: 'Push / Pull / Legs · 4–5×/week' },
  advanced: { weeklyWorkouts: 5, splitKey: 'advanced_split', split: 'Advanced Split · 5–6×/week' },
};

@Injectable()
export class PersonalizationService {
  /**
   * Compute personalization targets. Returns null only when nothing is
   * computable (no nutrition inputs AND no experience). Nutrition targets are
   * computed only when age + height + weight are all known; the workout split is
   * computed from experience independently.
   */
  compute(input: PersonalizationInput): RecommendationData | null {
    const rec: RecommendationData = {};

    // ── Workout split (needs only experience) ──
    const exp = input.trainingExperience ?? undefined;
    if (exp && SPLIT_BY_EXPERIENCE[exp]) {
      const s = SPLIT_BY_EXPERIENCE[exp];
      rec.weeklyWorkouts = s.weeklyWorkouts;
      rec.splitKey = s.splitKey;
      rec.split = s.split;
    }

    const age = num(input.age);
    const heightCm = num(input.heightCm);
    const weightKg = num(input.weightKg);

    // ── BMI (needs only height + weight) ──
    if (heightCm && weightKg && heightCm > 0 && weightKg > 0) {
      const h = heightCm / 100;
      rec.bmi = Math.round((weightKg / (h * h)) * 10) / 10;
    }

    // ── Nutrition + BMR (needs full biometric set) ──
    if (age && heightCm && weightKg && age > 0 && heightCm > 0 && weightKg > 0) {
      const bmr = this.bmr(input.gender ?? undefined, weightKg, heightCm, age);
      rec.bmr = Math.round(bmr);
      const activity = ACTIVITY_FACTORS[input.activityLevel ?? 'moderately_active'] ?? 1.55;
      const tdee = bmr * activity;

      const goal = input.primaryGoal ?? undefined;
      const calories = Math.round((tdee * (goal ? GOAL_CALORIE_FACTOR[goal] ?? 1 : 1)) / 10) * 10;

      const proteinG = Math.round(weightKg * (goal ? GOAL_PROTEIN_PER_KG[goal] ?? 1.6 : 1.6));
      const fatG = Math.round((calories * 0.25) / 9);
      const carbsKcal = Math.max(0, calories - proteinG * 4 - fatG * 9);
      const carbsG = Math.round(carbsKcal / 4);

      const baseWater = Math.round((weightKg * 35) / 50) * 50;
      const waterMl =
        input.activityLevel === 'very_active' || input.activityLevel === 'athlete'
          ? Math.round((baseWater * 1.15) / 50) * 50
          : baseWater;

      rec.dailyCalories = calories;
      rec.proteinG = proteinG;
      rec.carbsG = carbsG;
      rec.fatG = fatG;
      rec.waterMl = waterMl;
    }

    return Object.keys(rec).length ? rec : null;
  }

  /** Mifflin–St Jeor BMR. prefer_not_to_say uses the male/female average constant. */
  private bmr(gender: Gender | undefined, weightKg: number, heightCm: number, age: number): number {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    const sexConstant = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
    return base + sexConstant;
  }
}

/** Age in whole years from a Date / ISO date string (null-safe). */
export function ageFromDob(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
