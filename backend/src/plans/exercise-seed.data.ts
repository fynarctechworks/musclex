/**
 * Starter exercise catalog.
 *
 * A fresh tenant previously had ZERO exercises — no seed existed anywhere in
 * the repo (no INSERT, no createMany, nothing in prisma/seed.ts), so the
 * workout-plan builder opened with an empty picker and was effectively
 * unusable until rows were inserted out of band.
 *
 * This is DATA only: it inserts `Exercise` rows into an existing table and
 * requires no migration. Seeding is idempotent (skips names already present
 * for the gym), so a gym that has curated its own catalog is never disturbed.
 */
export interface ExerciseSeed {
  name: string;
  muscle_group: string;
  equipment: string;
}

export const EXERCISE_SEED: ExerciseSeed[] = [
  // ── Chest ──
  { name: 'Barbell Bench Press', muscle_group: 'chest', equipment: 'barbell' },
  { name: 'Incline Dumbbell Press', muscle_group: 'chest', equipment: 'dumbbell' },
  { name: 'Chest Fly (Machine)', muscle_group: 'chest', equipment: 'machine' },
  { name: 'Push-up', muscle_group: 'chest', equipment: 'bodyweight' },
  { name: 'Cable Crossover', muscle_group: 'chest', equipment: 'cable' },

  // ── Back ──
  { name: 'Deadlift', muscle_group: 'back', equipment: 'barbell' },
  { name: 'Pull-up', muscle_group: 'back', equipment: 'bodyweight' },
  { name: 'Lat Pulldown', muscle_group: 'back', equipment: 'cable' },
  { name: 'Seated Cable Row', muscle_group: 'back', equipment: 'cable' },
  { name: 'Bent-over Barbell Row', muscle_group: 'back', equipment: 'barbell' },
  { name: 'Single-arm Dumbbell Row', muscle_group: 'back', equipment: 'dumbbell' },

  // ── Legs ──
  { name: 'Back Squat', muscle_group: 'legs', equipment: 'barbell' },
  { name: 'Front Squat', muscle_group: 'legs', equipment: 'barbell' },
  { name: 'Leg Press', muscle_group: 'legs', equipment: 'machine' },
  { name: 'Romanian Deadlift', muscle_group: 'legs', equipment: 'barbell' },
  { name: 'Walking Lunge', muscle_group: 'legs', equipment: 'dumbbell' },
  { name: 'Leg Extension', muscle_group: 'legs', equipment: 'machine' },
  { name: 'Lying Leg Curl', muscle_group: 'legs', equipment: 'machine' },
  { name: 'Standing Calf Raise', muscle_group: 'legs', equipment: 'machine' },
  { name: 'Bulgarian Split Squat', muscle_group: 'legs', equipment: 'dumbbell' },

  // ── Shoulders ──
  { name: 'Overhead Barbell Press', muscle_group: 'shoulders', equipment: 'barbell' },
  { name: 'Seated Dumbbell Shoulder Press', muscle_group: 'shoulders', equipment: 'dumbbell' },
  { name: 'Lateral Raise', muscle_group: 'shoulders', equipment: 'dumbbell' },
  { name: 'Face Pull', muscle_group: 'shoulders', equipment: 'cable' },
  { name: 'Rear Delt Fly', muscle_group: 'shoulders', equipment: 'dumbbell' },
  { name: 'Upright Row', muscle_group: 'shoulders', equipment: 'barbell' },

  // ── Arms ──
  { name: 'Barbell Bicep Curl', muscle_group: 'arms', equipment: 'barbell' },
  { name: 'Dumbbell Hammer Curl', muscle_group: 'arms', equipment: 'dumbbell' },
  { name: 'Preacher Curl', muscle_group: 'arms', equipment: 'machine' },
  { name: 'Tricep Rope Pushdown', muscle_group: 'arms', equipment: 'cable' },
  { name: 'Skull Crusher', muscle_group: 'arms', equipment: 'barbell' },
  { name: 'Dips', muscle_group: 'arms', equipment: 'bodyweight' },
  { name: 'Cable Bicep Curl', muscle_group: 'arms', equipment: 'cable' },

  // ── Core ──
  { name: 'Plank', muscle_group: 'core', equipment: 'bodyweight' },
  { name: 'Hanging Leg Raise', muscle_group: 'core', equipment: 'bodyweight' },
  { name: 'Cable Crunch', muscle_group: 'core', equipment: 'cable' },
  { name: 'Russian Twist', muscle_group: 'core', equipment: 'bodyweight' },
  { name: 'Ab Wheel Rollout', muscle_group: 'core', equipment: 'other' },
  { name: 'Mountain Climber', muscle_group: 'core', equipment: 'bodyweight' },

  // ── Full body ──
  { name: 'Barbell Clean', muscle_group: 'full_body', equipment: 'barbell' },
  { name: 'Kettlebell Swing', muscle_group: 'full_body', equipment: 'kettlebell' },
  { name: 'Burpee', muscle_group: 'full_body', equipment: 'bodyweight' },
  { name: 'Farmer’s Carry', muscle_group: 'full_body', equipment: 'dumbbell' },
  { name: 'Battle Ropes', muscle_group: 'full_body', equipment: 'other' },

  // ── Cardio ──
  { name: 'Treadmill Run', muscle_group: 'cardio', equipment: 'machine' },
  { name: 'Stationary Bike', muscle_group: 'cardio', equipment: 'machine' },
  { name: 'Rowing Machine', muscle_group: 'cardio', equipment: 'machine' },
  { name: 'Elliptical', muscle_group: 'cardio', equipment: 'machine' },
  { name: 'Stair Climber', muscle_group: 'cardio', equipment: 'machine' },
  { name: 'Jump Rope', muscle_group: 'cardio', equipment: 'other' },
];
