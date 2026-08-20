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

/* ── Activities ───────────────────────────────────────────────── */

export interface SportType {
  key: string;
  label: string;
  group: string;
  /** Distance and pace lead; otherwise duration does. */
  distanceBased: boolean;
  gps: boolean;
}

export interface ActivitySummary {
  id: string;
  sportType: string;
  title: string | null;
  source: string;
  startedAt: string;
  endedAt: string | null;
  elapsedSeconds: number;
  movingSeconds: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  avgSpeedMps: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  polyline: string | null;
  visibility: string;
  kudosCount: number;
  commentCount: number;
}

export interface ActivityDetail extends ActivitySummary {
  description: string | null;
  elevationLossM: number | null;
  maxSpeedMps: number | null;
  startLatitude: number | null;
  startLongitude: number | null;
  privacyZoneM: number | null;
  streams: Record<string, unknown[]>;
  laps: {
    lapIndex: number;
    elapsedSeconds: number;
    movingSeconds: number | null;
    distanceM: number | null;
    avgHeartRate: number | null;
    maxHeartRate: number | null;
  }[];
  photos: { id: string; path: string; primary: boolean }[];
}

export interface ActivityInput {
  sportType: string;
  startedAt: string;
  endedAt?: string;
  title?: string;
  description?: string;
  source?: string;
  elapsedSeconds?: number;
  movingSeconds?: number;
  distanceM?: number;
  elevationGainM?: number;
  avgSpeedMps?: number;
  maxSpeedMps?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  polyline?: string;
  startLatitude?: number;
  startLongitude?: number;
  visibility?: string;
}

/* ── Feed ─────────────────────────────────────────────────────── */

export interface FeedActivity {
  id: string;
  appUserId: string;
  athlete: { id: string; name: string | null } | null;
  sportType: string;
  title: string | null;
  startedAt: string;
  elapsedSeconds: number;
  movingSeconds: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  avgHeartRate: number | null;
  /** Already trimmed by the owner's privacy zone when it isn't yours. */
  polyline: string | null;
  startLatitude: number | null;
  startLongitude: number | null;
  visibility: string;
  kudosCount: number;
  commentCount: number;
  mine: boolean;
  kudosedByMe: boolean;
}

/** Text and mentions, already resolved by the server for THIS reader. */
export type CommentSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; id: string; name: string };

export interface ActivityComment {
  id: string;
  /** Flattened to plain @names — for anywhere that cannot render segments. */
  body: string;
  segments: CommentSegment[];
  createdAt: string;
  author: { id: string; name: string | null };
  mine: boolean;
}

export interface Person {
  id: string;
  name: string | null;
}

/* ── Clubs ────────────────────────────────────────────────────── */

export interface Club {
  id: string;
  name: string;
  description: string | null;
  sportType: string | null;
  city: string | null;
  visibility: string;
  memberCount: number;
  myRole: string | null;
  joined: boolean;
}

export interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  locationName: string | null;
  attendeeCount: number;
  myStatus: 'going' | 'interested' | null;
}

export interface ClubFeedItem {
  id: string;
  athlete: { id: string; name: string | null };
  sportType: string;
  title: string | null;
  startedAt: string;
  elapsedSeconds: number;
  distanceM: number | null;
  kudosCount: number;
  mine: boolean;
}

/* ── Direct messages ──────────────────────────────────────────── */

export interface Conversation {
  id: string;
  with: { id: string; name: string | null };
  lastMessage: { body: string; at: string; mine: boolean } | null;
  unread: number;
}

export interface DirectMessage {
  id: string;
  body: string;
  at: string;
  mine: boolean;
}

/* ── Progress photos ──────────────────────────────────────────── */

export interface ProgressPhoto {
  id: string;
  /** A signed URL that expires, or null if signing failed. Never a raw path. */
  url: string | null;
  takenAt: string;
}

/* ── Finding people ───────────────────────────────────────────── */

export interface SuggestedPerson {
  id: string;
  name: string | null;
  /** Why we are suggesting them. A suggestion with no reason is unsettling. */
  reason: string;
}

export interface MatchedPerson {
  id: string;
  name: string | null;
  following: boolean;
}

export interface PersonProfile {
  id: string;
  name: string | null;
  followerCount: number;
  followingCount: number;
  youFollow: boolean;
  isYou: boolean;
}

/* ── Group challenges ─────────────────────────────────────────── */

export interface GroupChallenge {
  id: string;
  title: string;
  metric: 'distance_m' | 'elapsed_seconds' | 'activity_count' | 'elevation_m';
  sportType: string | null;
  /** Null means "most wins" rather than "first to reach". */
  target: number | null;
  startsOn: string;
  endsOn: string;
  ownerId: string;
  joined: boolean;
  participantCount: number;
}

export interface GroupChallengeDetail extends GroupChallenge {
  leaderboard: { id: string; name: string | null; value: number; rank: number; mine: boolean }[];
}

/* ── On-device health (steps) ─────────────────────────────────── */
/** One day's rollup from the phone or watch. Public/app_user scoped. */
export interface HealthDay {
  /** Local calendar day, "YYYY-MM-DD". */
  date: string;
  steps: number;
  activeCalories: number | null;
  distanceM: number | null;
  restingHeartRate: number | null;
  /** 'pedometer' when the phone counted it, 'manual' when the member typed it. */
  source: string | null;
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
  /** Sets per muscle over the window — what the body map is drawn from. */
  byMuscle: { muscle: string; sets: number }[];
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
  /** Absent (not []) when the prescription is uniform. */
  targetRepsPerSet?: number[];
  targetSecondsPerSet?: number[];
  targetWeightPerSet?: number[];
}

/** What the client sends when creating or replacing a routine's exercises. */
export interface RoutineExerciseInput {
  exerciseId: string;
  targetSets?: number;
  targetReps?: number;
  targetDurationSeconds?: number;
  /**
   * Per-set plan, e.g. [12, 10, 8] for a pyramid. When present the array is
   * authoritative and its LENGTH is the set count — the server derives
   * targetSets from it rather than trusting both and letting them disagree.
   */
  targetRepsPerSet?: number[];
  targetSecondsPerSet?: number[];
  /** Canonical kg, converted at the edge like every other weight. */
  targetWeightPerSet?: number[];
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

/* ── Friends ─────────────────────────────────────────────────────────────── */

export interface FriendSummary {
  appUserId: string;
  name: string;
}

export interface IncomingRequest extends FriendSummary {
  requestId: string;
}

export interface FriendSearchResult extends FriendSummary {
  /** Existing relationship, so the UI offers Pending rather than a doomed Add. */
  status: 'pending' | 'accepted' | 'blocked' | null;
}

export interface FriendSession {
  id: string;
  appUserId: string;
  name: string;
  performedAt: string;
  title?: string | null;
  exerciseCount: number;
  setCount: number;
  /** Canonical kg; convert at the edge for display. */
  totalVolumeKg: number | null;
  durationSeconds: number | null;
  exerciseNames: string[];
  kudosCount: number;
  kudosedByMe: boolean;
}

export interface PrComparison {
  /** False when the friend has not turned PR sharing on — distinct from "no lifts in common". */
  sharing: boolean;
  name: string;
  lifts: {
    exercise: string;
    mine: { weightKg: number; reps: number; achievedAt: string };
    theirs: { weightKg: number; reps: number; achievedAt: string };
  }[];
}

export interface SharePrefs {
  shareSessions: boolean;
  sharePrs: boolean;
  shareStreak: boolean;
}

export interface RoutineShare {
  id: string;
  token: string;
  name: string;
  from: string;
  sentAt: string;
  importedAt: string | null;
}
