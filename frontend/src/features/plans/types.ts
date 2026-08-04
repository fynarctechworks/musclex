// ── Training Plans (workout + diet) — shared types ─────────────

export type WorkoutGoal =
  | 'weight_loss'
  | 'muscle_gain'
  | 'endurance'
  | 'general_fitness';

export type DietGoal =
  | 'weight_loss'
  | 'muscle_gain'
  | 'maintenance'
  | 'general_fitness';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type WorkoutAssignmentStatus = 'assigned' | 'completed' | 'skipped';

export interface PlanCreatedBy {
  id: string;
  full_name: string;
}

export interface PaginatedList<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Exercises (picker) ──────────────────────────────────────────

export interface ExerciseRef {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
}

export interface ExerciseFilters {
  search?: string;
  muscle_group?: string;
  page?: number;
  limit?: number;
}

// ── Workout plans ───────────────────────────────────────────────

export interface WorkoutPlan {
  id: string;
  title: string;
  description: string | null;
  goal: WorkoutGoal | null;
  difficulty: Difficulty | null;
  is_template: boolean;
  is_active: boolean;
  created_at: string;
  created_by: PlanCreatedBy | null;
  _count: {
    exercises: number;
    assigned_workouts: number;
  };
}

export interface WorkoutPlanExercise {
  id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercise: ExerciseRef;
}

export interface WorkoutPlanDetail extends WorkoutPlan {
  exercises: WorkoutPlanExercise[];
}

export interface WorkoutPlanExerciseInput {
  exercise_id: string;
  position?: number;
  target_sets?: number;
  target_reps?: number;
  target_weight?: number;
  rest_seconds?: number;
  notes?: string;
}

export interface CreateWorkoutPlanInput {
  title: string;
  description?: string;
  goal?: WorkoutGoal;
  difficulty?: Difficulty;
  is_template?: boolean;
  /** On PATCH the exercises array REPLACES the plan's list. */
  exercises?: WorkoutPlanExerciseInput[];
}

export type UpdateWorkoutPlanInput = Partial<CreateWorkoutPlanInput>;

export interface WorkoutPlanFilters {
  search?: string;
  is_template?: boolean;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface AssignWorkoutPlanInput {
  member_id: string;
  /** YYYY-MM-DD dates */
  dates: string[];
}

export interface AssignWorkoutPlanResult {
  assigned: number;
  skipped_existing: number;
}

export interface WorkoutAssignment {
  id: string;
  scheduled_date: string;
  status: WorkoutAssignmentStatus;
  workout_plan: {
    id: string;
    title: string;
    goal: WorkoutGoal | null;
    difficulty: Difficulty | null;
  };
  member: {
    id: string;
    full_name: string;
    member_code: string;
  };
}

export interface AssignmentFilters {
  member_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// ── Diet plans ──────────────────────────────────────────────────

export interface DietMealItem {
  food: string;
  quantity: string;
}

export interface DietPlanMeal {
  id: string;
  meal_type: MealType;
  position: number;
  title: string;
  items: DietMealItem[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
}

export interface DietPlan {
  id: string;
  title: string;
  description: string | null;
  goal: DietGoal | null;
  daily_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_template: boolean;
  is_active: boolean;
  created_at: string;
  created_by: PlanCreatedBy | null;
  _count: {
    meals: number;
    assignments: number;
  };
}

export interface DietPlanDetail extends DietPlan {
  meals: DietPlanMeal[];
}

export interface DietPlanMealInput {
  meal_type: MealType;
  position?: number;
  title: string;
  items?: DietMealItem[];
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  notes?: string;
}

export interface CreateDietPlanInput {
  title: string;
  description?: string;
  goal?: DietGoal;
  daily_calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  is_template?: boolean;
  /** On PATCH the meals array REPLACES the plan's list. */
  meals?: DietPlanMealInput[];
}

export type UpdateDietPlanInput = Partial<CreateDietPlanInput>;

export type DietPlanFilters = WorkoutPlanFilters;

export interface AssignDietPlanInput {
  member_id: string;
  /** YYYY-MM-DD */
  starts_on: string;
  ends_on?: string;
  notes?: string;
}

export interface DietAssignment {
  id: string;
  starts_on: string;
  ends_on: string | null;
  status: string;
  notes: string | null;
  diet_plan: {
    id: string;
    title: string;
    goal: DietGoal | null;
  };
  member: {
    id: string;
    full_name: string;
    member_code: string;
  };
}

// ── Display label maps ──────────────────────────────────────────

export const workoutGoalLabels: Record<WorkoutGoal, string> = {
  weight_loss: 'Weight Loss',
  muscle_gain: 'Muscle Gain',
  endurance: 'Endurance',
  general_fitness: 'General Fitness',
};

export const dietGoalLabels: Record<DietGoal, string> = {
  weight_loss: 'Weight Loss',
  muscle_gain: 'Muscle Gain',
  maintenance: 'Maintenance',
  general_fitness: 'General Fitness',
};

export const difficultyLabels: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// ── Exercise catalog management (admin) ─────────────────────────

export interface ExerciseInput {
  name: string;
  muscle_group?: string | null;
  equipment?: string | null;
  media_url?: string | null;
  instructions?: string | null;
  is_active?: boolean;
}

/** Full row (list endpoint returns these when managing the catalog). */
export interface ExerciseDetail extends ExerciseRef {
  media_url?: string | null;
  instructions?: string | null;
  is_active?: boolean;
}

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
  'cardio',
] as const;
