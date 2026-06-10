import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  BodyMetricInput,
  CheckInRequestBody,
  SetLogData,
  WorkoutLogRequestBody,
  MealLogInput,
  MealLogItemInput,
  WaterLogInput,
  NutritionGoalInput,
  SendMessageInput,
  DeviceTokenRequestBody,
  DeviceTokenDeleteBody,
  HealthSampleInputData,
  HealthSampleBatchInput,
  WearableConnectInput,
  UpdateProfileBody,
  WeightInputBody,
  WaterInputBody,
  GoalInputBody,
  GoalUpdateBody,
  HealthDailyInputBody,
  EventInputData,
  EventBatchInputBody,
  AppEventTypeValue,
  AppDeviceTokenBody,
  AppDeviceTokenDeleteBody,
  ReferralApplyBody,
  ToolsComputeBody,
  NotificationAckBody,
  RenewRequestBody,
  PhotoUploadUrlRequestBody,
  PhotoConfirmRequestBody,
} from '../contract';

// ── Profile / onboarding enums (single source for DTO validation) ──
export const FITNESS_GOALS = [
  'lose_weight', 'gain_muscle', 'build_strength', 'improve_fitness',
  'improve_endurance', 'athletic_performance', 'body_recomposition', 'stay_healthy',
] as const;

export const WORKOUT_PREFERENCES = [
  'gym', 'home', 'strength', 'cardio', 'hiit', 'yoga', 'crossfit',
  'powerlifting', 'bodybuilding',
] as const;

export const ACTIVITY_LEVELS = [
  'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete',
] as const;

export const TRAINING_EXPERIENCE = ['beginner', 'intermediate', 'advanced'] as const;

export const GENDERS = ['male', 'female', 'prefer_not_to_say'] as const;

/** POST /progress/metrics body. */
export class BodyMetricDto implements BodyMetricInput {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(700)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  waistCm?: number;

  @IsOptional()
  @IsISO8601()
  recordedAt?: string;
}

/** POST /checkins body. */
export class CheckInDto implements CheckInRequestBody {
  @IsIn(['qr', 'manual'])
  method!: 'qr' | 'manual';

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

/** One logged set within POST /workouts/{workoutId}/logs. */
export class SetLogDto implements SetLogData {
  @IsString()
  exerciseId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  setNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  reps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  weight?: number;

  @IsOptional()
  @IsIn(['kg', 'lb'])
  unit!: 'kg' | 'lb';
}

/** POST /workouts/{workoutId}/logs body. */
export class WorkoutLogDto implements WorkoutLogRequestBody {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SetLogDto)
  sets!: SetLogDto[];
}

// ── Nutrition (V2.1) ──────────────────────────────────────────────

/** One item within POST /nutrition/meals. Macros are optional — when a
 * foodItemId is given the server fills them from the catalog snapshot. */
export class MealLogItemDto implements MealLogItemInput {
  @IsOptional()
  @IsString()
  foodItemId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  kcal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  proteinG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  carbsG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  fatG?: number;
}

/** POST /nutrition/meals body. */
export class MealLogDto implements MealLogInput {
  @IsIn(['breakfast', 'lunch', 'dinner', 'snack'])
  mealType!: 'breakfast' | 'lunch' | 'dinner' | 'snack';

  @IsOptional()
  @IsISO8601()
  loggedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MealLogItemDto)
  items!: MealLogItemDto[];
}

/** POST /nutrition/water body. */
export class WaterLogDto implements WaterLogInput {
  @IsInt()
  @Min(1)
  @Max(10000)
  amountMl!: number;

  @IsOptional()
  @IsISO8601()
  loggedAt?: string;
}

/** POST /notifications/device-tokens body. */
export class DeviceTokenDto implements DeviceTokenRequestBody {
  @IsString()
  token!: string;

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  @IsOptional()
  @IsObject()
  prefs?: { [key: string]: boolean };
}

/** DELETE /notifications/device-tokens body. */
export class DeviceTokenDeleteDto implements DeviceTokenDeleteBody {
  @IsString()
  token!: string;
}

/** POST /trainer-chat/threads/{trainerId}/messages body. */
export class SendMessageDto implements SendMessageInput {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

/** PUT /nutrition/goal body. */
export class NutritionGoalDto implements NutritionGoalInput {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  kcal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  proteinG?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  carbsG?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  fatG?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  waterMl?: number;
}

// ── Health Data Platform ────────────────────────────────────────────

/** Canonical metric types accepted by /health/samples. */
export const HEALTH_SAMPLE_TYPES = [
  'steps', 'calories_active', 'calories_resting', 'distance_m',
  'active_minutes', 'heart_rate', 'hr_resting', 'hrv', 'sleep_duration',
  'sleep_deep', 'sleep_rem', 'spo2', 'stress', 'body_weight', 'body_fat',
  'vo2max', 'respiratory_rate', 'mood',
] as const;

/** Providers a member can link / sync from. */
export const WEARABLE_PROVIDERS = [
  'apple_health', 'health_connect', 'fitbit', 'garmin', 'scale', 'manual',
] as const;

/** One sample within a POST /health/samples batch. */
export class HealthSampleDto implements HealthSampleInputData {
  @IsIn(HEALTH_SAMPLE_TYPES as unknown as string[])
  type!: string;

  @IsNumber()
  @Min(-100000)
  @Max(10000000)
  value!: number;

  @IsString()
  @MaxLength(16)
  unit!: string;

  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;

  @IsIn(WEARABLE_PROVIDERS as unknown as string[])
  source!: HealthSampleInputData['source'];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  sourceUuid!: string;

  @IsOptional()
  @IsObject()
  metadata?: { [key: string]: unknown } | null;
}

/** POST /health/samples body (batched, offline-safe). */
export class HealthSampleBatchDto implements HealthSampleBatchInput {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => HealthSampleDto)
  samples!: HealthSampleDto[];
}

// ── Profile (PATCH /me — onboarding auto-save + later edits) ────────

/**
 * PATCH /me body. Every field optional — drives per-step onboarding auto-save
 * and later profile edits. Heights/weights are canonical (cm / kg); the unit
 * fields are display prefs only. `onboardingComplete: true` stamps completion.
 */
export class UpdateProfileDto implements UpdateProfileBody {
  @IsOptional()
  @IsIn(GENDERS as unknown as string[])
  gender?: 'male' | 'female' | 'prefer_not_to_say';

  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(260)
  heightCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg?: number;

  @IsOptional()
  @IsIn(['cm', 'ft'])
  heightUnit?: 'cm' | 'ft';

  @IsOptional()
  @IsIn(['kg', 'lb'])
  weightUnit?: 'kg' | 'lb';

  @IsOptional()
  @IsIn(FITNESS_GOALS as unknown as string[])
  primaryGoal?: (typeof FITNESS_GOALS)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(FITNESS_GOALS as unknown as string[], { each: true })
  goals?: (typeof FITNESS_GOALS)[number][];

  @IsOptional()
  @IsIn(ACTIVITY_LEVELS as unknown as string[])
  activityLevel?: (typeof ACTIVITY_LEVELS)[number];

  @IsOptional()
  @IsIn(TRAINING_EXPERIENCE as unknown as string[])
  trainingExperience?: 'beginner' | 'intermediate' | 'advanced';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsIn(WORKOUT_PREFERENCES as unknown as string[], { each: true })
  workoutPreferences?: (typeof WORKOUT_PREFERENCES)[number][];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  limitations?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  onboardingStep?: string;

  @IsOptional()
  @IsBoolean()
  onboardingComplete?: boolean;
}

/** POST /health/connections body (records explicit consent). */
export class WearableConnectDto implements WearableConnectInput {
  @IsIn(['apple_health', 'health_connect', 'fitbit', 'garmin', 'scale'])
  provider!: 'apple_health' | 'health_connect' | 'fitbit' | 'garmin' | 'scale';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalUserId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}

// ── Public (gym-less) personal tracking DTOs ──────────────────────
export const GOAL_TYPES = ['weight', 'water', 'steps', 'workout', 'custom'] as const;
export const GOAL_STATUSES = ['active', 'achieved', 'abandoned'] as const;

/** POST /me/weight body. */
export class WeightInputDto implements WeightInputBody {
  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsNumber()
  @Min(0)
  @Max(700)
  weightKg!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bodyFatPct?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string | null;
}

/** POST /me/water body. */
export class WaterInputDto implements WaterInputBody {
  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsInt()
  @Min(0)
  @Max(40000)
  amountMl!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40000)
  goalMl?: number | null;

  @IsOptional()
  @IsIn(['set', 'add'])
  mode?: 'set' | 'add';
}

/** POST /me/goals body. */
export class GoalInputDto implements GoalInputBody {
  @IsIn(GOAL_TYPES)
  type!: (typeof GOAL_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsOptional()
  @IsNumber()
  targetValue?: number | null;

  @IsOptional()
  @IsNumber()
  currentValue?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string | null;

  @IsOptional()
  @IsISO8601()
  targetDate?: string | null;
}

/** PATCH /me/goals/:id body. */
export class GoalUpdateDto implements GoalUpdateBody {
  @IsOptional()
  @IsNumber()
  currentValue?: number | null;

  @IsOptional()
  @IsNumber()
  targetValue?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsOptional()
  @IsIn(GOAL_STATUSES)
  status?: (typeof GOAL_STATUSES)[number];
}

/** POST /me/health/daily body. */
export class HealthDailyInputDto implements HealthDailyInputBody {
  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsInt()
  @Min(0)
  @Max(200000)
  steps!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  activeCalories?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceM?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  restingHeartRate?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string | null;
}

// ── Funnel / behaviour events (Phase 3) ───────────────────────────
export const APP_EVENT_TYPES = [
  'first_app_open',
  'onboarding_started',
  'onboarding_completed',
  'gym_selected',
  'first_dashboard_visit',
  'viewed_nearby_gyms',
  'viewed_gym_profile',
  'inquiry_click',
  'referral_share',
] as const;

export class EventDto implements EventInputData {
  @IsIn(APP_EVENT_TYPES)
  type!: AppEventTypeValue;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/** POST /me/events body — a batch of funnel events. */
export class EventBatchDto implements EventBatchInputBody {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EventDto)
  events!: EventDto[];
}

/** POST /me/device-tokens body (Phase 5b). */
export class AppDeviceTokenDto implements AppDeviceTokenBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;

  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';
}

/** DELETE /me/device-tokens body. */
export class AppDeviceTokenDeleteDto implements AppDeviceTokenDeleteBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;
}

/** POST /me/referral body (Phase 5c). */
export class ReferralApplyDto implements ReferralApplyBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}

/** POST /me/notifications/ack body (Phase 7.6). */
export class NotificationAckDto implements NotificationAckBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  deliveryId!: string;

  @IsIn(['opened', 'clicked'])
  action!: 'opened' | 'clicked';
}

/** POST /me/tools/compute body (Phase 7.4) — all optional calculator inputs. */
export class ToolsComputeDto implements ToolsComputeBody {
  @IsOptional()
  @IsIn(GENDERS)
  gender?: (typeof GENDERS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  heightCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(700)
  weightKg?: number;

  @IsOptional()
  @IsIn(ACTIVITY_LEVELS)
  activityLevel?: (typeof ACTIVITY_LEVELS)[number];

  @IsOptional()
  @IsIn(FITNESS_GOALS)
  primaryGoal?: (typeof FITNESS_GOALS)[number];

  @IsOptional()
  @IsIn(TRAINING_EXPERIENCE)
  trainingExperience?: (typeof TRAINING_EXPERIENCE)[number];
}

// ── Membership renewal + progress photos (gap remediation 2026-06-07) ──

/** POST /membership/renew body. Identity comes from the token, never the body. */
export class RenewMembershipDto implements RenewRequestBody {
  @IsUUID()
  planId!: string;
}

/** Allowed progress-photo content types (mirrors the private bucket's allowlist). */
export const PROGRESS_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** POST /progress/photos/upload-url body. */
export class ProgressPhotoUploadUrlDto implements PhotoUploadUrlRequestBody {
  @IsIn(PROGRESS_PHOTO_TYPES as unknown as string[])
  contentType!: (typeof PROGRESS_PHOTO_TYPES)[number];
}

/** POST /progress/photos body — confirms a previously-signed upload. */
export class ProgressPhotoConfirmDto implements PhotoConfirmRequestBody {
  @IsUUID()
  photoId!: string;

  @IsISO8601()
  takenAt!: string;
}

// ── Profile avatar (member-uploaded photo → members.profile_photo_url) ──

/** Allowed avatar content types (mirrors the private bucket's allowlist). */
export const AVATAR_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** POST /me/avatar/upload-url body. */
export class AvatarUploadUrlDto {
  @IsIn(AVATAR_PHOTO_TYPES as unknown as string[])
  contentType!: (typeof AVATAR_PHOTO_TYPES)[number];
}

/** POST /me/avatar body — confirms a previously-signed avatar upload. */
export class AvatarConfirmDto {
  @IsUUID()
  avatarId!: string;
}
