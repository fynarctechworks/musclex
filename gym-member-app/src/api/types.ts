/**
 * Member API contract types — the app-side mirror of the BFF contract
 * (docs/"Member api v1.openapi.yaml"). Hand-curated for the Phase-1 surface so
 * screens code against typed shapes. Run `npm run gen:api` to regenerate the
 * FULL generated contract into src/api/contract.ts; this file stays the curated,
 * ergonomic view the app actually imports.
 *
 * Keep these in lockstep with backend/src/member/contract/member-api.types.ts.
 */

export interface Meta {
  tenantId?: string;
  serverTime?: string;
  /** Seconds the client may cache. */
  cacheTtl?: number;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface ApiError {
  code: string;
  message: string;
  retryable?: boolean;
}

// ── Auth ──────────────────────────────────────────────────────────
export interface OtpRequestResult {
  dispatched?: boolean;
  channel?: 'sms' | 'whatsapp';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TenantChoice {
  tenantId?: string;
  gymName?: string;
}

export interface SessionResult {
  tokens?: TokenPair | null;
  tenantChoices?: TenantChoice[];
}

// ── Profile ───────────────────────────────────────────────────────
export type Goal = 'lose_fat' | 'build_muscle' | 'general_fitness';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface MemberProfile {
  id?: string;
  name?: string;
  phone?: string;
  gymName?: string;
  goal?: Goal;
  experienceLevel?: ExperienceLevel;
  avatarUrl?: string | null;
}

// ── Home / occupancy ──────────────────────────────────────────────
export type MembershipStatus = 'active' | 'expiring' | 'expired' | 'frozen';
export type OccupancyLevel = 'low' | 'moderate' | 'high' | 'full';

export interface Occupancy {
  current?: number;
  capacity?: number;
  level?: OccupancyLevel;
  updatedAt?: string;
}

export interface WorkoutSummary {
  id?: string;
  title?: string;
  assignedBy?: string | null;
  exerciseCount?: number;
}

export interface ClassSummary {
  id?: string;
  title?: string;
  startsAt?: string;
  seatsLeft?: number;
}

// ── Classes (browse / book / cancel) ──────────────────────────────
export type ClassBookingStatus = 'enrolled' | 'waitlisted';

export interface ClassListItem {
  id?: string;
  title?: string;
  category?: string;
  startsAt?: string;
  durationMinutes?: number;
  room?: string | null;
  trainerName?: string | null;
  capacity?: number;
  seatsLeft?: number;
  /** true when THIS member has an active booking on the class. */
  booked?: boolean;
  bookingStatus?: ClassBookingStatus | null;
  waitlistPosition?: number | null;
}

export interface ClassList {
  classes?: ClassListItem[];
}

export interface ClassBookingResult {
  classId?: string;
  status?: ClassBookingStatus;
  waitlistPosition?: number | null;
  seatsLeft?: number;
  message?: string;
}

export interface ClassCancelResult {
  cancelled?: boolean;
  promotedMemberName?: string | null;
}

export interface HomeDashboard {
  greeting?: string;
  membership?: {
    status?: MembershipStatus;
    expiresOn?: string;
    daysLeft?: number;
  };
  streak?: { days?: number };
  /** Today's ritual status — which streak-qualifying actions are already done today. */
  today?: {
    checkedIn?: boolean;
    workoutLogged?: boolean;
    mealLogged?: boolean;
    streakAtRisk?: boolean;
  };
  todayWorkout?: WorkoutSummary | null;
  nextClass?: ClassSummary | null;
  occupancy?: Occupancy;
  nutrition?: {
    kcal?: number;
    kcalGoal?: number;
    waterMl?: number;
    waterGoal?: number;
  };
}

// ── Gym locations (branch finder) ─────────────────────────────────
export type LocationStatus =
  | 'active'
  | 'inactive'
  | 'temporarily_closed'
  | 'coming_soon'
  | 'provisioning';

export interface GymLocation {
  id?: string;
  name?: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  status?: LocationStatus;
}

export interface GymLocations {
  branches?: GymLocation[];
}

// ── Check-in ──────────────────────────────────────────────────────
export interface CheckInRequest {
  method: 'qr' | 'manual';
  token?: string;
  occurredAt?: string;
}

export interface CheckInResult {
  checkInId?: string;
  recordedAt?: string;
  alreadyRecorded?: boolean;
  streakDays?: number;
}

// ── Membership ────────────────────────────────────────────────────
export interface Invoice {
  id?: string;
  amount?: number;
  currency?: string;
  paidOn?: string | null;
  status?: 'paid' | 'pending' | 'failed';
}

export interface Membership {
  status?: MembershipStatus;
  plan?: { id?: string; name?: string; price?: number; currency?: string };
  startedOn?: string;
  expiresOn?: string;
  autoRenew?: boolean;
  invoices?: Invoice[];
}

export interface RazorpayOrder {
  orderId?: string;
  amount?: number;
  currency?: string;
  razorpayKeyId?: string;
  receipt?: string;
}

// ── Workouts ──────────────────────────────────────────────────────
export interface SetLog {
  exerciseId?: string;
  setNumber?: number;
  reps?: number;
  weight?: number;
  unit: 'kg' | 'lb';
}

export interface Exercise {
  id?: string;
  name?: string;
  targetSets?: number;
  targetReps?: number;
  mediaUrl?: string | null;
  lastLog?: SetLog;
}

export interface Workout {
  id?: string;
  title?: string;
  assignedBy?: string | null;
  exercises?: Exercise[];
}

export interface WorkoutLogResult {
  logId?: string;
  newPersonalRecords?: { exerciseId?: string; weight?: number }[];
}

// ── Progress ──────────────────────────────────────────────────────
export interface BodyMetric {
  id?: string;
  weightKg?: number | null;
  bmi?: number | null;
  waistCm?: number | null;
  recordedAt?: string;
}

export interface BodyMetricInput {
  weightKg?: number;
  waistCm?: number;
  recordedAt?: string;
}

export interface ProgressPhoto {
  id?: string;
  url?: string;
  takenAt?: string;
}

export interface Progress {
  latest?: { weightKg?: number | null; bmi?: number | null; bodyFatPct?: number | null };
  series?: BodyMetric[];
  photos?: ProgressPhoto[];
}

export interface UploadTarget {
  photoId?: string;
  uploadUrl?: string;
  expiresIn?: number;
}

// ── Nutrition (V2.1) ──────────────────────────────────────────────
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface NutritionTotals {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

export interface NutritionGoal {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
}

export interface FoodItem {
  id?: string;
  name?: string;
  brand?: string | null;
  barcode?: string | null;
  servingSize?: number;
  servingUnit?: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  source?: 'custom' | 'catalog' | 'barcode';
}

export interface FoodSearch {
  foods?: FoodItem[];
}

export interface NutritionMealItem {
  id?: string;
  foodItemId?: string | null;
  name?: string;
  quantity?: number;
  unit?: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

export interface NutritionMeal {
  id?: string;
  mealType?: MealType;
  loggedAt?: string;
  notes?: string | null;
  totals?: NutritionTotals;
  items?: NutritionMealItem[];
}

export interface NutritionDay {
  date?: string;
  goal?: NutritionGoal;
  totals?: NutritionTotals;
  waterMl?: number;
  meals?: NutritionMeal[];
}

export interface MealLogItemInput {
  foodItemId?: string | null;
  name: string;
  quantity?: number;
  unit?: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

export interface MealLogInput {
  mealType: MealType;
  loggedAt?: string;
  notes?: string;
  items: MealLogItemInput[];
}

export interface MealLogResult {
  mealId?: string;
}

export interface WaterLogInput {
  amountMl: number;
  loggedAt?: string;
}

export interface WaterLogResult {
  waterId?: string;
  totalMl?: number;
}

export interface NutritionGoalInput {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
}

// ── Exercise library (V2.2) ───────────────────────────────────────
export interface ExerciseListItem {
  id?: string;
  name?: string;
  muscleGroup?: string | null;
  equipment?: string | null;
  mediaUrl?: string | null;
  hasInstructions?: boolean;
  favorited?: boolean;
}

export interface ExerciseList {
  exercises?: ExerciseListItem[];
}

export interface ExerciseDetail {
  id?: string;
  name?: string;
  muscleGroup?: string | null;
  equipment?: string | null;
  mediaUrl?: string | null;
  instructions?: string | null;
  favorited?: boolean;
}

export interface FavoriteResult {
  favorited?: boolean;
}

// ── Trainer chat (V2.3) ───────────────────────────────────────────
export interface ChatThread {
  trainerId?: string;
  trainerName?: string;
  trainerAvatarUrl?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
}

export interface ChatThreadList {
  threads?: ChatThread[];
}

export interface ChatMessage {
  id?: string;
  sender?: 'member' | 'trainer';
  body?: string;
  createdAt?: string;
}

export interface ChatMessageList {
  trainerId?: string;
  trainerName?: string;
  messages?: ChatMessage[];
}

export interface SendMessageInput {
  body: string;
}

// ── Health Data Platform (wearable telemetry) ─────────────────────
export type HealthMetricType =
  | 'steps'
  | 'calories_active'
  | 'calories_resting'
  | 'distance_m'
  | 'active_minutes'
  | 'heart_rate'
  | 'hr_resting'
  | 'hrv'
  | 'sleep_duration'
  | 'sleep_deep'
  | 'sleep_rem'
  | 'spo2'
  | 'stress'
  | 'body_weight'
  | 'body_fat'
  | 'vo2max'
  | 'respiratory_rate'
  | 'mood';

export type HealthSource =
  | 'apple_health'
  | 'health_connect'
  | 'fitbit'
  | 'garmin'
  | 'scale'
  | 'manual';

export type WearableProvider = Exclude<HealthSource, 'manual'>;

export interface HealthSampleInput {
  type: HealthMetricType;
  value: number;
  unit: string;
  startAt: string;
  endAt: string;
  source: HealthSource;
  sourceUuid: string;
  metadata?: Record<string, unknown> | null;
}

export interface HealthSampleBatchInput {
  samples: HealthSampleInput[];
}

export interface HealthIngestResult {
  accepted?: number;
  duplicates?: number;
  daysAffected?: number;
}

export interface HealthDailyPoint {
  day?: string;
  total?: number;
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  sampleCount?: number;
}

export interface HealthMetricSeries {
  type?: HealthMetricType;
  unit?: string;
  points?: HealthDailyPoint[];
}

export interface HealthSummary {
  from?: string;
  to?: string;
  metrics?: HealthMetricSeries[];
}

export interface WearableConnection {
  provider?: WearableProvider;
  status?: 'connected' | 'revoked';
  consentedAt?: string;
  lastSyncedAt?: string | null;
}

export interface WearableConnectionList {
  connections?: WearableConnection[];
}

export interface WearableConnectInput {
  provider: WearableProvider;
  externalUserId?: string | null;
  scopes?: string[];
}

// ── Community (V2.5) ──────────────────────────────────────────────
export interface LeaderboardEntry {
  rank?: number;
  name?: string;
  value?: number;
  isMe?: boolean;
}

export interface Leaderboard {
  metric?: string;
  periodDays?: number;
  entries?: LeaderboardEntry[];
  myRank?: number | null;
  myValue?: number;
}

export interface ChallengeItem {
  id?: string;
  title?: string;
  description?: string | null;
  metric?: 'checkins' | 'workouts';
  goal?: number;
  startsAt?: string;
  endsAt?: string;
  joined?: boolean;
  progress?: number;
  completed?: boolean;
  participantCount?: number;
}

export interface ChallengeList {
  challenges?: ChallengeItem[];
}

export interface ChallengeJoinResult {
  joined?: boolean;
  progress?: number;
}

export interface CommunityBadge {
  key?: string;
  label?: string;
  description?: string;
  earned?: boolean;
}

export interface BadgeList {
  badges?: CommunityBadge[];
  earnedCount?: number;
}
