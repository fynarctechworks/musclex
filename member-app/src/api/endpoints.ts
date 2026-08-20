import { request, uuid } from './client';
import type {
  AssignedWorkout,
  BodyMetricInput,
  Badge,
  Branch,
  ChatMessage,
  ChatThread,
  ExerciseDetail,
  Food,
  Goal,
  MembershipDetail,
  MembershipPlan,
  MyPlan,
  RenewalOrder,
  NearbyGym,
  Profile,
  ReferralResult,
  ExploreCategory,
  ExploreDetail,
  FriendSearchResult,
  FriendSession,
  FriendSummary,
  IncomingRequest,
  PrComparison,
  Routine,
  RoutineExerciseInput,
  RoutineShare,
  SharePrefs,
  RoutineImportResult,
  SharedRoutinePreview,
  ToolsResult,
  TrainingStats,
  Visit,
  WaterToday,
  WeightLog,
  Challenge,
  ClassItem,
  CoachConversation,
  DigitalId,
  ExerciseHistory,
  ExerciseListItem,
  Home,
  Leaderboard,
  Me,
  NutritionToday,
  Occupancy,
  ProgressData,
  SetLog,
  VisitSummary,
  Weekly,
  WorkoutLogResult,
} from './types';

export const api = {
  /** One call drives the whole Today screen. */
  home: () => request<Home>('/home'),
  occupancy: () => request<Occupancy>('/gym/occupancy'),
  me: () => request<Me>('/me'),
  digitalId: () => request<DigitalId>('/id'),
  visitSummary: () => request<VisitSummary>('/visits/summary'),
  leaderboard: () => request<Leaderboard>('/community/leaderboard'),

  exercises: (
    opts: {
      q?: string;
      muscle?: string;
      favorites?: boolean;
      equipment?: string;
      target?: string;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    if (opts.q) qs.set('q', opts.q);
    if (opts.muscle) qs.set('muscle', opts.muscle);
    if (opts.equipment) qs.set('equipment', opts.equipment);
    if (opts.target) qs.set('target', opts.target);
    if (opts.favorites) qs.set('favorites', 'true');
    const s = qs.toString();
    return request<{ exercises: ExerciseListItem[] }>(`/exercises${s ? `?${s}` : ''}`);
  },

  exerciseDetail: (id: string) => request<ExerciseDetail>(`/exercises/${id}`),
  /** Create a PERSONAL exercise. Never enters the gym's shared catalogue. */
  createCustomExercise: (body: {
    name: string;
    muscleGroup?: string;
    equipment?: string;
    trackingType?: 'reps' | 'duration';
    instructions?: string;
  }) => request<{ id: string; name: string; isCustom: boolean }>('/exercises', {
    method: 'POST',
    body,
  }),
  deleteCustomExercise: (id: string) =>
    request<unknown>(`/exercises/${id}/custom`, { method: 'DELETE' }),
  favorite: (id: string) => request<unknown>(`/exercises/${id}/favorite`, { method: 'PUT' }),
  unfavorite: (id: string) => request<unknown>(`/exercises/${id}/favorite`, { method: 'DELETE' }),

  /** Drives the "last time" column and the prefilled set rows. */
  exerciseHistory: (id: string, limit = 5) =>
    request<ExerciseHistory>(`/exercises/${id}/history?limit=${limit}`),

  /** Today's trainer-assigned workout, or null when nothing is set. */
  todayWorkout: () => request<AssignedWorkout | null>('/workouts/today'),

  /**
   * Log against a trainer assignment. Server-side this also flips the
   * assignment to completed, so the trainer's dashboard reflects the session.
   */
  logAssignedWorkout: (
    workoutId: string,
    sets: SetLog[],
    key = uuid(),
    span?: { startedAt?: string; endedAt?: string },
  ) =>
    request<WorkoutLogResult>(`/workouts/${workoutId}/logs`, {
      method: 'POST',
      body: { sets, ...span },
      idempotencyKey: key,
    }),

  /** Training statistics over a window. */
  stats: (days = 30) => request<TrainingStats>(`/workouts/stats?days=${days}`),

  /** Freestyle session: no trainer assignment behind it. `span` records when
   *  the session actually happened, which is what makes retro-logging work. */
  logFreestyle: (
    sets: SetLog[],
    key = uuid(),
    span?: { startedAt?: string; endedAt?: string },
  ) =>
    request<WorkoutLogResult>('/workouts/logs', {
      method: 'POST',
      body: { sets, ...span },
      idempotencyKey: key,
    }),

  checkIn: (key = uuid()) =>
    request<unknown>('/checkins', {
      method: 'POST',
      body: { method: 'qr' },
      idempotencyKey: key,
    }),

  /* ── Classes ─────────────────────────────────────────────── */
  classes: () => request<{ classes: ClassItem[] }>('/classes'),
  bookClass: (id: string, key = uuid()) =>
    request<unknown>(`/classes/${id}/book`, { method: 'POST', idempotencyKey: key }),
  cancelBooking: (id: string) =>
    request<unknown>(`/classes/${id}/booking`, { method: 'DELETE' }),

  /* ── Nutrition ───────────────────────────────────────────── */
  nutritionToday: () => request<NutritionToday>('/nutrition/today'),
  logMeal: (body: { items: unknown[]; mealType: string }, key = uuid()) =>
    request<unknown>('/nutrition/meals', { method: 'POST', body, idempotencyKey: key }),

  /* ── Community (the Strava layer) ────────────────────────── */
  challenges: () => request<{ challenges: Challenge[] }>('/community/challenges'),
  joinChallenge: (id: string, key = uuid()) =>
    request<unknown>(`/community/challenges/${id}/join`, {
      method: 'POST',
      idempotencyKey: key,
    }),
  badges: () => request<{ badges: Badge[] }>('/community/badges'),

  /* ── Coach ───────────────────────────────────────────────── */
  coach: () => request<CoachConversation>('/coach'),
  askCoach: (message: string, key = uuid()) =>
    request<CoachConversation>('/coach/chat', {
      method: 'POST',
      body: { message },
      idempotencyKey: key,
    }),

  /* ── Membership ──────────────────────────────────────────── */
  membership: () => request<MembershipDetail>('/membership'),
  renew: (planId: string, key = uuid()) =>
    request<RenewalOrder>('/membership/renew', {
      method: 'POST',
      body: { planId },
      idempotencyKey: key,
    }),
  /**
   * Public profile of one gym. NOT a session switch — there is no switch-gym
   * route; a member changes gyms by signing in again and picking from the
   * choices their phone number maps to.
   */
  gymProfile: (tenantId: string) => request<NearbyGym>(`/me/gyms/${tenantId}`),
  membershipPlans: () =>
    request<{ currentPlanId: string | null; plans: MembershipPlan[] }>('/membership/plans'),

  /* ── Trainer chat (a real human, not the AI coach) ───────── */
  chatThreads: () => request<{ threads: ChatThread[] }>('/trainer-chat/threads'),
  chatMessages: (trainerId: string) =>
    request<{ messages: ChatMessage[] }>(`/trainer-chat/threads/${trainerId}/messages`),
  sendChat: (trainerId: string, body: string, key = uuid()) =>
    request<ChatMessage>(`/trainer-chat/threads/${trainerId}/messages`, {
      method: 'POST',
      body: { body },
      idempotencyKey: key,
    }),

  /* ── Goals + profile ─────────────────────────────────────── */
  goals: () => request<{ goals: Goal[] }>('/me/goals'),
  addGoal: (body: Record<string, unknown>) =>
    request<Goal>('/me/goals', { method: 'POST', body }),
  updateGoal: (goalId: string, body: Record<string, unknown>) =>
    request<Goal>(`/me/goals/${goalId}`, { method: 'PATCH', body }),
  profile: () => request<Profile>('/me/profile'),
  /**
   * PATCH /me is the ONBOARDING surface and the only route that stamps
   * completion. /me/profile accepts `onboardingComplete` in its DTO but never
   * acts on it, so writing onboarding there looks like it worked and leaves the
   * member stuck in the flow forever.
   */
  updateMe: (body: Record<string, unknown>) =>
    request<unknown>('/me', { method: 'PATCH', body }),
  updateProfile: (body: Record<string, unknown>) =>
    request<Profile>('/me/profile', { method: 'PATCH', body }),

  /* ── Body weight ─────────────────────────────────────────── */
  weight: () => request<WeightLog>('/me/weight'),
  logWeight: (weightKg: number, key = uuid()) =>
    request<unknown>('/me/weight', { method: 'POST', body: { weightKg }, idempotencyKey: key }),
  /** Gym-scoped body measurements, distinct from the public weight log. */
  addMetric: (body: BodyMetricInput, key = uuid()) =>
    request<unknown>('/progress/metrics', { method: 'POST', body, idempotencyKey: key }),

  /* ── Food + locations ────────────────────────────────────── */
  foods: (q: string) => request<{ foods: Food[] }>(`/nutrition/foods?q=${encodeURIComponent(q)}`),
  locations: () => request<{ branches: Branch[] }>('/gym/locations'),

  /* ── My Plan (trainer's diet plan + upcoming assignments) ── */
  myPlan: () => request<MyPlan>('/plans'),

  /* ── Visits ──────────────────────────────────────────────── */
  visits: () => request<{ visits: Visit[]; nextCursor: string | null }>('/visits'),

  /* ── Water + nutrition goal ──────────────────────────────── */
  waterToday: () => request<WaterToday>('/me/water'),
  setNutritionGoal: (body: Record<string, number>) =>
    request<unknown>('/nutrition/goal', { method: 'PUT', body }),

  /* ── Explore (central curated library) ───────────────────── */
  explore: () => request<{ categories: ExploreCategory[] }>('/explore'),
  exploreWorkout: (slug: string) => request<ExploreDetail>(`/explore/${slug}`),
  addExploreWorkout: (slug: string) =>
    request<RoutineImportResult>(`/explore/${slug}/add`, { method: 'POST' }),

  /* ── Friends ─────────────────────────────────────────────── */
  friends: () => request<{ friends: FriendSummary[]; incoming: IncomingRequest[] }>('/friends'),
  friendSearch: (phone: string) =>
    request<{ results: FriendSearchResult[] }>(`/friends/search?phone=${encodeURIComponent(phone)}`),
  friendRequest: (appUserId: string) =>
    request<{ status: string }>('/friends/request', { method: 'POST', body: { appUserId } }),
  friendRespond: (requestId: string, accept: boolean) =>
    request<{ status: string }>(`/friends/requests/${requestId}/respond`, {
      method: 'POST',
      body: { accept },
    }),
  friendRemove: (appUserId: string) =>
    request<{ removed: boolean }>(`/friends/${appUserId}`, { method: 'DELETE' }),
  friendFeed: () => request<{ sessions: FriendSession[] }>('/friends/feed'),
  friendKudos: (sessionId: string) =>
    request<{ kudosed: boolean; kudosCount: number }>(`/friends/sessions/${sessionId}/kudos`, {
      method: 'POST',
    }),
  friendPrs: (appUserId: string) => request<PrComparison>(`/friends/${appUserId}/prs`),
  sharePrefs: () => request<SharePrefs>('/friends/me/sharing'),
  setSharePrefs: (body: Partial<SharePrefs>) =>
    request<SharePrefs>('/friends/me/sharing', { method: 'PATCH', body }),
  sendRoutineToFriend: (appUserId: string, routineId: string) =>
    request<{ sent: boolean; name: string; exerciseCount: number }>(
      `/friends/${appUserId}/routines/${routineId}`,
      { method: 'POST' },
    ),
  routineInbox: () => request<{ shares: RoutineShare[] }>('/friends/routines/inbox'),
  acceptSentRoutine: (id: string) =>
    request<RoutineImportResult>(`/friends/routines/inbox/${id}/accept`, { method: 'POST' }),

  /* ── Routines (personal, shareable by link) ──────────────── */
  routines: () => request<{ routines: Routine[] }>('/routines'),
  routine: (id: string) => request<Routine>(`/routines/${id}`),
  createRoutine: (body: {
    name: string;
    notes?: string;
    exercises: RoutineExerciseInput[];
  }) => request<Routine>('/routines', { method: 'POST', body }),
  updateRoutine: (
    id: string,
    body: { name?: string; notes?: string; exercises?: RoutineExerciseInput[] },
  ) => request<Routine>(`/routines/${id}`, { method: 'PATCH', body }),
  deleteRoutine: (id: string) => request<unknown>(`/routines/${id}`, { method: 'DELETE' }),
  shareRoutine: (id: string) =>
    request<{ token: string; name: string; exerciseCount: number }>(`/routines/${id}/share`, {
      method: 'POST',
    }),
  previewSharedRoutine: (token: string) =>
    request<SharedRoutinePreview>(`/routines/shared/${token}`),
  importRoutine: (token: string) =>
    request<RoutineImportResult>('/routines/import', { method: 'POST', body: { token } }),

  /* ── Tools, referral, discovery ──────────────────────────── */
  computeTools: (body: Record<string, unknown>) =>
    request<ToolsResult>('/me/tools/compute', { method: 'POST', body }),
  applyReferral: (code: string) =>
    request<ReferralResult>('/me/referral', { method: 'POST', body: { code } }),
  nearbyGyms: (q?: string) =>
    request<{ gyms: NearbyGym[] }>(`/me/nearby-gyms${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  /* ── Progress ────────────────────────────────────────────── */
  progress: () => request<ProgressData>('/progress'),
  weekly: () => request<Weekly>('/me/weekly'),

  logWater: (amountMl: number, key = uuid()) =>
    request<unknown>('/nutrition/water', {
      method: 'POST',
      body: { amountMl },
      idempotencyKey: key,
    }),
};
