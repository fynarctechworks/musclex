/** Shapes returned by the Member BFF. Only the fields this app renders. */

export interface Occupancy {
  current: number;
  capacity: number;
  level: 'low' | 'moderate' | 'high';
  updatedAt: string;
}

export interface Home {
  greeting: string;
  membership: { planName?: string; status?: string; expiresAt?: string } | null;
  streak: { days: number };
  today: {
    checkedIn: boolean;
    workoutLogged: boolean;
    mealLogged: boolean;
    streakAtRisk: boolean;
  };
  todayWorkout: { id?: string; title?: string; exerciseCount?: number } | null;
  nextClass: { id: string; title: string; startsAt: string; seatsLeft: number } | null;
  occupancy: Occupancy;
  nutrition: { kcal: number; kcalGoal: number; waterMl: number; waterGoal: number };
}

export interface ExerciseListItem {
  id: string;
  name: string;
  muscleGroup?: string | null;
  /** Primary mover at head level, e.g. side_delt. Groups the picker. */
  targetMuscle?: string | null;
  /** Everything else the movement loads. */
  secondaryMuscles?: string[];
  /** 'reps' (weight x reps) or 'duration' (planks, carries, cardio). */
  trackingType?: 'reps' | 'duration';
  equipment?: string | null;
  /** Animated GIF — the animation is the form cue. Detail views use this. */
  mediaUrl?: string | null;
  /** Lightweight still for list rows. */
  thumbUrl?: string | null;
  /** True for the member's OWN exercise — never in the gym's shared catalogue. */
  isCustom?: boolean;
  hasInstructions?: boolean;
  favorited?: boolean;
}

export interface HistorySet {
  setNumber: number;
  reps: number;
  weight: number;
  /** Seconds, for interval exercises. Null for rep-based sets. */
  durationSeconds?: number | null;
  unit: string;
}

export interface ExerciseHistory {
  exercise: { id: string; name: string; trackingType?: 'reps' | 'duration' };
  personalRecord: { weight: number; reps: number; unit: string; achievedAt: string } | null;
  sessions: { loggedAt: string; sets: HistorySet[] }[];
}

export interface SetLog {
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
  /** Seconds, for interval exercises. */
  durationSeconds?: number;
  unit: 'kg' | 'lb';
}

export interface WorkoutLogResult {
  logId: string;
  newPersonalRecords: { exerciseId: string; weight: number }[];
}

export interface DigitalId {
  memberCode: string;
  fullName: string;
  status: string;
  dynamicQr?: string;
  dynamicExpiresAt?: string;
}

export interface VisitSummary {
  totalVisits: number;
  thisMonthVisits: number;
}

export interface Leaderboard {
  metric: string;
  periodDays: number;
  entries: { rank: number; name: string; value: number; isMe: boolean }[];
  myRank: number | null;
  myValue: number;
}

export interface Me {
  id: string;
  name: string;
  phone: string;
  gymName: string;
  weightKg?: number | null;
  heightCm?: number | null;
  goal?: string | null;
  onboardingCompleted?: boolean;
  onboardingStep?: string | null;
}

/* ── Classes ─────────────────────────────────────────────────── */
export interface ClassItem {
  id: string;
  title: string;
  category?: string | null;
  startsAt: string;
  durationMinutes?: number;
  room?: string | null;
  trainerName?: string | null;
  capacity?: number;
  seatsLeft: number;
  booked?: boolean;
  bookingStatus?: string | null;
  waitlistPosition?: number | null;
}

/* ── Nutrition ───────────────────────────────────────────────── */
export interface NutritionToday {
  date: string;
  goal: { kcal: number; proteinG: number; carbsG: number; fatG: number; waterMl: number };
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  waterMl: number;
  meals: {
    id: string;
    mealType: string;
    loggedAt: string;
    items: { name: string; kcal?: number }[];
  }[];
}

export interface FoodItem {
  id: string;
  name: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  servingLabel?: string;
}

/* ── Community ───────────────────────────────────────────────── */
export interface Challenge {
  id: string;
  title: string;
  description?: string;
  metric?: string;
  target?: number;
  progress?: number;
  joined?: boolean;
  endsAt?: string;
}

export interface Badge {
  key: string;
  label: string;
  description: string;
  earned: boolean;
  earnedAt?: string | null;
}

/* ── Coach ───────────────────────────────────────────────────── */
export interface CoachMessage {
  id?: string;
  role: 'member' | 'coach' | 'assistant' | string;
  content: string;
  createdAt?: string;
}

export interface CoachConversation {
  conversation_id: string | null;
  messages: CoachMessage[];
}

/* ── Progress ────────────────────────────────────────────────── */
export interface ProgressData {
  latest: { weightKg: number | null; bmi: number | null; bodyFatPct: number | null };
  series: {
    date?: string;
    recordedAt?: string;
    weightKg?: number | null;
    waistCm?: number | null;
    chestCm?: number | null;
    armsCm?: number | null;
    thighsCm?: number | null;
    hipsCm?: number | null;
    calvesCm?: number | null;
    bodyFatPct?: number | null;
  }[];
  photos: { id: string; url?: string; takenAt?: string }[];
}

export interface Weekly {
  daysActive: number;
  weightChangeKg: number | null;
  consistencyScore: number;
  points: { day: string; active: boolean }[];
}

/* ── Assigned workouts ───────────────────────────────────────── */

export interface AssignedExercise {
  /** This is the EXERCISE id, not a plan-row id — logs reference it directly. */
  id: string;
  name: string;
  targetSets?: number;
  targetReps?: number;
  mediaUrl?: string | null;
  lastLog?: { reps?: number; weight?: number; unit?: string };
}

export interface AssignedWorkout {
  id: string;
  title: string;
  assignedBy?: string | null;
  exercises: AssignedExercise[];
}

/* ── Exercise library ────────────────────────────────────────── */
export interface ExerciseDetail {
  id: string;
  name: string;
  trackingType?: 'reps' | 'duration';
  muscleGroup?: string | null;
  equipment?: string | null;
  mediaUrl?: string | null;
  instructions?: string | null;
  favorited?: boolean;
}

/* ── Membership ──────────────────────────────────────────────── */
export interface MembershipPlan {
  id: string;
  name: string;
  description?: string | null;
  planType?: string;
  price: number;
  yearlyPrice?: number | null;
  durationDays?: number | null;
  totalClasses?: number | null;
  accessType?: string;
  isCurrent?: boolean;
}

/* ── Trainer chat ────────────────────────────────────────────── */
export interface ChatThread {
  trainerId: string;
  trainerName: string;
  trainerAvatarUrl?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  body: string;
  /** 'member' when the member sent it. */
  sender: string;
  createdAt: string;
  readAt?: string | null;
}

/* ── Goals ───────────────────────────────────────────────────── */
export interface Goal {
  id: string;
  type: string;
  title: string;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  targetDate?: string | null;
  status: string;
}

/* ── Profile ─────────────────────────────────────────────────── */
export interface Profile {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: string | null;
  trainingExperience?: string | null;
  goals?: string[];
  /** Display preference only — storage stays metric. */
  weightUnit?: 'kg' | 'lb';
  heightUnit?: 'cm' | 'ft';
}

/* ── Weight ──────────────────────────────────────────────────── */
export interface WeightLog {
  latest: { date: string; weightKg: number; bodyFatPct?: number | null } | null;
  entries: { date: string; weightKg: number; bodyFatPct?: number | null }[];
}

/* ── Locations ───────────────────────────────────────────────── */
export interface Branch {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  status?: string;
}

/* ── Food ────────────────────────────────────────────────────── */
export interface Food {
  id: string;
  name: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  servingLabel?: string;
}

/* ── My Plan ─────────────────────────────────────────────────── */
export interface MyPlan {
  diet_plan: {
    id?: string;
    title?: string;
    notes?: string | null;
    meals?: { name?: string; items?: string[]; kcal?: number }[];
  } | null;
  upcoming_workouts: {
    assignment_id: string;
    scheduled_date: string;
    status: string;
    plan: { id: string; title: string; goal?: string | null; difficulty?: string | null; exercise_count?: number };
  }[];
}

/* ── Visits ──────────────────────────────────────────────────── */
export interface Visit {
  id: string;
  checkedInAt: string;
  checkOutAt?: string | null;
  branchName?: string | null;
  method?: string | null;
}

/* ── Water ───────────────────────────────────────────────────── */
export interface WaterToday {
  date: string;
  amountMl: number;
  goalMl?: number | null;
}

/* ── Tools ───────────────────────────────────────────────────── */
export interface ToolsResult {
  bmi?: number | null;
  bmiCategory?: string | null;
  bmr?: number | null;
  tdee?: number | null;
  targetKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  waterMl?: number | null;
}

/* ── Referral ────────────────────────────────────────────────── */
export interface ReferralResult {
  applied?: boolean;
  message?: string;
  rewardDescription?: string | null;
}

/* ── Nearby gyms ─────────────────────────────────────────────── */
export interface NearbyGym {
  tenantId?: string;
  gymName?: string;
  branchName?: string;
  address?: string | null;
  city?: string | null;
  distanceKm?: number | null;
}

/* ── Membership detail + renewal ─────────────────────────────── */
export interface MembershipDetail {
  planName?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  daysRemaining?: number | null;
  branchName?: string | null;
}

export interface RenewalOrder {
  orderId: string;
  /** Paise. Divide by 100 for rupees. */
  amount: number;
  currency?: string;
  keyId?: string;
}

/* ── Training statistics ─────────────────────────────────────── */
export interface TrainingStats {
  periodDays: number;
  workouts: number;
  totalVolumeKg: number;
  avgVolumeKg: number;
  totalSets: number;
  totalExercises: number;
  totalSeconds: number;
  timedSessions: number;
  avgSessionSeconds: number | null;
  currentStreak: number;
  longestStreak: number;
  activeDays: { date: string; sets: number }[];
  mostPerformed: { exerciseId: string; name: string; sessions: number }[];
  personalRecords: {
    exerciseId: string;
    name: string;
    weight: number;
    reps: number;
    unit: string;
    achievedAt: string;
  }[];
}

/* ── Body measurements ───────────────────────────────────────── */
export interface BodyMetricInput {
  weightKg?: number;
  waistCm?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  chestCm?: number;
  hipsCm?: number;
  armsCm?: number;
  thighsCm?: number;
  calvesCm?: number;
}

/* ── Member routines ─────────────────────────────────────────── */
export interface RoutineExercise {
  exerciseId: string;
  name: string;
  thumbUrl?: string | null;
  trackingType?: 'reps' | 'duration';
  targetSets?: number;
  targetReps?: number;
  targetDurationSeconds?: number;
}

/** What the client sends when creating or replacing a routine's exercises. */
export interface RoutineExerciseInput {
  exerciseId: string;
  targetSets?: number;
  targetReps?: number;
  targetDurationSeconds?: number;
}

export interface Routine {
  id: string;
  name: string;
  notes?: string | null;
  /** True when this arrived from someone else's link — it is a copy, not a feed. */
  importedFromLink: boolean;
  updatedAt: string;
  exercises: RoutineExercise[];
}

export interface SharedRoutinePreview {
  token: string;
  name: string;
  exerciseCount: number;
  exercises: { name: string; targetSets?: number; targetReps?: number }[];
  importCount: number;
}

export interface RoutineImportResult {
  routine: Routine;
  /** Names the recipient's gym does not stock. Reported, never silently dropped. */
  missing: string[];
}

/* ── Explore (curated library) ───────────────────────────────── */
export interface ExploreCard {
  slug: string;
  title: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationMinutes?: number | null;
  exerciseCount: number;
  addCount: number;
}

export interface ExploreCategory {
  category: string;
  label: string;
  workouts: ExploreCard[];
}

export interface ExploreDetail extends ExploreCard {
  description?: string | null;
  exercises: {
    name: string;
    targetSets?: number;
    targetReps?: number;
    targetDurationSeconds?: number;
  }[];
}
