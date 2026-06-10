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
/** Legacy compact goal (kept for back-compat with Home / older screens). */
export type Goal = 'lose_fat' | 'build_muscle' | 'general_fitness';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

// ── Onboarding / fitness profile vocab (mirrors the BFF contract enums) ──
export type Gender = 'male' | 'female' | 'prefer_not_to_say';

/** Rich onboarding goals (multi-select; one is the primary). */
export type FitnessGoal =
  | 'lose_weight'
  | 'gain_muscle'
  | 'build_strength'
  | 'improve_fitness'
  | 'improve_endurance'
  | 'athletic_performance'
  | 'body_recomposition'
  | 'stay_healthy';

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'athlete';

export type WorkoutPreference =
  | 'gym'
  | 'home'
  | 'strength'
  | 'cardio'
  | 'hiit'
  | 'yoga'
  | 'crossfit'
  | 'powerlifting'
  | 'bodybuilding';

export type HeightUnit = 'cm' | 'ft';
export type WeightUnit = 'kg' | 'lb';

/** Personalization targets computed server-side from the profile. */
export interface Recommendation {
  dailyCalories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
  weeklyWorkouts?: number;
  splitKey?: 'full_body' | 'push_pull_legs' | 'advanced_split';
  split?: string;
  bmi?: number | null;
  bmr?: number | null;
}

// ── Phase 7: weekly progress, tools, gym profile ──────────────────
export interface WeeklyProgress {
  daysActive: number;
  weightChangeKg?: number | null;
  consistencyScore: number;
  points: { day: string; active: boolean }[];
}
export interface ToolsComputeInput {
  gender?: 'male' | 'female' | 'prefer_not_to_say';
  age?: number;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'athlete';
  primaryGoal?: string;
  trainingExperience?: 'beginner' | 'intermediate' | 'advanced';
}
export interface GymPlan {
  id: string;
  name: string;
  price?: number | null;
  durationDays?: number | null;
  description?: string | null;
}
export interface GymProfile {
  tenantId: string;
  gymName: string;
  tagline?: string | null;
  logoUrl?: string | null;
  city?: string | null;
  branches: NearbyGym[];
  plans: GymPlan[];
}

export interface MemberProfile {
  id?: string;
  name?: string;
  phone?: string;
  gymName?: string;
  goal?: Goal;
  experienceLevel?: ExperienceLevel;
  avatarUrl?: string | null;
  // fitness profile (onboarding)
  gender?: Gender | null;
  dateOfBirth?: string | null; // YYYY-MM-DD
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  heightUnit?: HeightUnit;
  weightUnit?: WeightUnit;
  primaryGoal?: FitnessGoal | null;
  goals?: FitnessGoal[];
  activityLevel?: ActivityLevel | null;
  trainingExperience?: ExperienceLevel | null;
  workoutPreferences?: WorkoutPreference[];
  limitations?: string[];
  onboardingCompleted?: boolean;
  onboardingStep?: string | null;
  recommendation?: Recommendation | null;
}

/** PATCH /me body — any subset; drives onboarding auto-save + later edits. */
export interface UpdateProfileInput {
  gender?: Gender;
  dateOfBirth?: string; // YYYY-MM-DD
  heightCm?: number;
  weightKg?: number;
  heightUnit?: HeightUnit;
  weightUnit?: WeightUnit;
  primaryGoal?: FitnessGoal;
  goals?: FitnessGoal[];
  activityLevel?: ActivityLevel;
  trainingExperience?: ExperienceLevel;
  workoutPreferences?: WorkoutPreference[];
  limitations?: string[];
  onboardingStep?: string;
  onboardingComplete?: boolean;
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

export interface AvatarUploadTarget {
  avatarId?: string;
  uploadUrl?: string;
}

export interface AvatarConfirmResult {
  avatarUrl?: string;
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

// ── Experience selector: /me/context ──────────────────────────────
export type UserType = 'public' | 'member' | 'expired' | 'suspended';
export type OnboardingState = 'not_started' | 'in_progress' | 'completed';

/** Feature gates the app reads to build navigation + screens. */
export interface MeCapabilities {
  // Gym-only features
  membershipCard: boolean;
  /** True when the member's gym is operator-suspended (show banner, hide gym features). */
  gymSuspended: boolean;
  attendance: boolean;
  classBooking: boolean;
  gymSchedule: boolean;
  gymAnnouncements: boolean;
  trainerChat: boolean;
  subscriptionDetails: boolean;
  memberBenefits: boolean;
  renewMembership: boolean;
  // Public fitness features (always available)
  healthDashboard: boolean;
  weightTracking: boolean;
  waterTracking: boolean;
  goalTracking: boolean;
  bmiCalculator: boolean;
  calorieCalculator: boolean;
  fitnessTips: boolean;
  nearbyGyms: boolean;
  referralProgram: boolean;
}

export interface MeMembership {
  tenantId: string;
  gymName: string;
  memberId: string;
  status: string;
  active: boolean;
  /** True when this gym is operator-suspended (studios.suspended_at). */
  suspended?: boolean;
  planName?: string | null;
  expiresAt?: string | null;
}

export interface MeContext {
  appUserId: string;
  userType: UserType;
  onboardingState: OnboardingState;
  fullName?: string | null;
  phone: string;
  city?: string | null;
  referralCode?: string | null;
  capabilities: MeCapabilities;
  memberships: MeMembership[];
}

// ── Public (gym-less) personal tracking ───────────────────────────
export interface WeightEntry {
  date: string;
  weightKg: number;
  bodyFatPct?: number | null;
  note?: string | null;
}
export interface WeightSeries {
  latest?: WeightEntry | null;
  entries: WeightEntry[];
}
export interface WeightInput {
  date?: string;
  weightKg: number;
  bodyFatPct?: number | null;
  note?: string | null;
}
export interface WaterDay {
  date: string;
  amountMl: number;
  goalMl?: number | null;
}
export interface WaterInput {
  date?: string;
  amountMl: number;
  goalMl?: number | null;
  mode?: 'set' | 'add';
}
export interface PublicGoal {
  id: string;
  type: 'weight' | 'water' | 'steps' | 'workout' | 'custom';
  title?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  targetDate?: string | null;
  status: 'active' | 'achieved' | 'abandoned';
}
export interface PublicGoalList {
  goals: PublicGoal[];
}
export interface PublicGoalInput {
  type: PublicGoal['type'];
  title?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  targetDate?: string | null;
}
export interface PublicGoalUpdate {
  currentValue?: number | null;
  targetValue?: number | null;
  title?: string | null;
  status?: PublicGoal['status'];
}
export interface HealthDay {
  date: string;
  steps: number;
  activeCalories?: number | null;
  distanceM?: number | null;
  restingHeartRate?: number | null;
  source?: string | null;
}
export interface HealthSeries {
  days: HealthDay[];
}
export interface HealthDailyInput {
  date?: string;
  steps: number;
  activeCalories?: number | null;
  distanceM?: number | null;
  restingHeartRate?: number | null;
  source?: string | null;
}

// ── Conversion: public gym directory (Phase 5) ────────────────────
export interface NearbyGym {
  tenantId: string;
  gymName: string;
  logoUrl?: string | null;
  branchId: string;
  branchName: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  distanceKm?: number | null;
}
export interface NearbyGyms {
  gyms: NearbyGym[];
}

// ── Funnel / behaviour events (Phase 3) ───────────────────────────
export type AppEventType =
  | 'first_app_open'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'gym_selected'
  | 'first_dashboard_visit'
  | 'viewed_nearby_gyms'
  | 'viewed_gym_profile'
  | 'inquiry_click'
  | 'referral_share';

export interface EventInput {
  type: AppEventType;
  occurredAt?: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  metadata?: Record<string, unknown>;
}
export interface EventIngestResult {
  accepted: number;
}
