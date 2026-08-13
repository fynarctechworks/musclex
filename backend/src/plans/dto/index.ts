import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// ── Workout plans ────────────────────────────────────────────────

export class WorkoutPlanExerciseDto {
  @IsUUID()
  exercise_id: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  target_sets?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  target_reps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  target_weight?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  rest_seconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateWorkoutPlanDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['weight_loss', 'muscle_gain', 'endurance', 'general_fitness'])
  goal?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  difficulty?: string;

  @IsOptional()
  @IsBoolean()
  is_template?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutPlanExerciseDto)
  exercises?: WorkoutPlanExerciseDto[];
}

export class UpdateWorkoutPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['weight_loss', 'muscle_gain', 'endurance', 'general_fitness'])
  goal?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  difficulty?: string;

  @IsOptional()
  @IsBoolean()
  is_template?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  /** When present, REPLACES the plan's exercise list. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutPlanExerciseDto)
  exercises?: WorkoutPlanExerciseDto[];
}

export class AssignWorkoutPlanDto {
  @IsUUID()
  member_id: string;

  /** One AssignedWorkout per date (YYYY-MM-DD). */
  @IsArray()
  @IsDateString({}, { each: true })
  dates: string[];
}

// ── Diet plans ───────────────────────────────────────────────────

export class DietPlanMealDto {
  @IsIn(['breakfast', 'lunch', 'dinner', 'snack'])
  meal_type: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsString()
  @MaxLength(200)
  title: string;

  /** Free-form food items: [{ food, quantity, calories?, protein_g?, ... }] */
  @IsOptional()
  @IsArray()
  items?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsInt()
  @Min(0)
  calories?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  protein_g?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  carbs_g?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fat_g?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateDietPlanDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['weight_loss', 'muscle_gain', 'maintenance', 'general_fitness'])
  goal?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  daily_calories?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  protein_g?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  carbs_g?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fat_g?: number;

  @IsOptional()
  @IsBoolean()
  is_template?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DietPlanMealDto)
  meals?: DietPlanMealDto[];
}

export class UpdateDietPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['weight_loss', 'muscle_gain', 'maintenance', 'general_fitness'])
  goal?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  daily_calories?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  protein_g?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  carbs_g?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fat_g?: number;

  @IsOptional()
  @IsBoolean()
  is_template?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  /** When present, REPLACES the plan's meal list. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DietPlanMealDto)
  meals?: DietPlanMealDto[];
}

export class AssignDietPlanDto {
  @IsUUID()
  member_id: string;

  @IsDateString()
  starts_on: string;

  @IsOptional()
  @IsDateString()
  ends_on?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
