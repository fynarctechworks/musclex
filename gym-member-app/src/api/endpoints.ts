import { request } from './client';
import type {
  BodyMetric,
  BodyMetricInput,
  CheckInRequest,
  CheckInResult,
  HomeDashboard,
  Membership,
  MemberProfile,
  Occupancy,
  GymLocations,
  Progress,
  RazorpayOrder,
  SessionResult,
  TokenPair,
  Workout,
  WorkoutLogResult,
  SetLog,
  UploadTarget,
  OtpRequestResult,
  ClassList,
  ClassBookingResult,
  ClassCancelResult,
  NutritionDay,
  FoodSearch,
  MealLogInput,
  MealLogResult,
  WaterLogInput,
  WaterLogResult,
  NutritionGoal,
  NutritionGoalInput,
  ExerciseList,
  ExerciseDetail,
  FavoriteResult,
  ChatThreadList,
  ChatMessageList,
  ChatMessage,
  Leaderboard,
  ChallengeList,
  ChallengeJoinResult,
  BadgeList,
  HealthSampleInput,
  HealthIngestResult,
  HealthSummary,
  WearableConnection,
  WearableConnectionList,
  WearableConnectInput,
} from './types';

/** Typed wrappers for every Phase-1 BFF endpoint. */
export const api = {
  // ── Auth (unauthenticated) ──
  requestOtp: (phone: string) =>
    request<OtpRequestResult>('/auth/otp/request', {
      method: 'POST',
      body: { phone },
      auth: false,
    }),

  createSession: (supabaseToken: string, tenantId?: string) =>
    request<SessionResult>('/auth/session', {
      method: 'POST',
      body: { supabaseToken, tenantId },
      auth: false,
    }),

  refresh: (refreshToken: string) =>
    request<TokenPair>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),

  // ── Profile / home ──
  me: () => request<MemberProfile>('/me'),
  home: () => request<HomeDashboard>('/home'),
  occupancy: () => request<Occupancy>('/gym/occupancy'),
  locations: () => request<GymLocations>('/gym/locations'),

  // ── Check-in (idempotent) ──
  checkIn: (body: CheckInRequest, idempotencyKey: string) =>
    request<CheckInResult>('/checkins', {
      method: 'POST',
      body,
      idempotencyKey,
    }),

  // ── Membership ──
  membership: () => request<Membership>('/membership'),
  renew: (planId: string, idempotencyKey: string) =>
    request<RazorpayOrder>('/membership/renew', {
      method: 'POST',
      body: { planId },
      idempotencyKey,
    }),

  // ── Workouts ──
  todayWorkout: () => request<Workout | null>('/workouts/today'),
  logWorkout: (workoutId: string, sets: SetLog[], idempotencyKey: string) =>
    request<WorkoutLogResult>(`/workouts/${workoutId}/logs`, {
      method: 'POST',
      body: { sets },
      idempotencyKey,
    }),

  // ── Classes (browse / book / cancel) ──
  classes: () => request<ClassList>('/classes'),
  bookClass: (classId: string, idempotencyKey: string) =>
    request<ClassBookingResult>(`/classes/${classId}/book`, {
      method: 'POST',
      idempotencyKey,
    }),
  cancelClassBooking: (classId: string) =>
    request<ClassCancelResult>(`/classes/${classId}/booking`, {
      method: 'DELETE',
    }),

  // ── Progress ──
  progress: () => request<Progress>('/progress'),
  addMetric: (body: BodyMetricInput, idempotencyKey: string) =>
    request<BodyMetric>('/progress/metrics', {
      method: 'POST',
      body,
      idempotencyKey,
    }),
  photoUploadUrl: (contentType: string) =>
    request<UploadTarget>('/progress/photos/upload-url', {
      method: 'POST',
      body: { contentType },
    }),
  confirmPhoto: (photoId: string, takenAt: string) =>
    request<unknown>('/progress/photos', {
      method: 'POST',
      body: { photoId, takenAt },
    }),

  // ── Notifications ──
  registerDeviceToken: (
    token: string,
    platform: 'ios' | 'android',
    prefs?: Record<string, boolean>,
  ) =>
    request<void>('/notifications/device-tokens', {
      method: 'POST',
      body: { token, platform, prefs },
    }),
  deleteDeviceToken: (token: string) =>
    request<void>('/notifications/device-tokens', {
      method: 'DELETE',
      body: { token },
    }),

  // ── Nutrition (idempotent writes) ──
  nutritionToday: () => request<NutritionDay>('/nutrition/today'),
  searchFoods: (q: string) =>
    request<FoodSearch>(
      `/nutrition/foods${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    ),
  logMeal: (body: MealLogInput, idempotencyKey: string) =>
    request<MealLogResult>('/nutrition/meals', {
      method: 'POST',
      body,
      idempotencyKey,
    }),
  logWater: (body: WaterLogInput, idempotencyKey: string) =>
    request<WaterLogResult>('/nutrition/water', {
      method: 'POST',
      body,
      idempotencyKey,
    }),
  setNutritionGoal: (body: NutritionGoalInput) =>
    request<NutritionGoal>('/nutrition/goal', { method: 'PUT', body }),

  // ── Exercise library (read-only) ──
  exercises: (q?: string, muscle?: string, favorites?: boolean) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (muscle) params.set('muscle', muscle);
    if (favorites) params.set('favorites', 'true');
    const qs = params.toString();
    return request<ExerciseList>(`/exercises${qs ? `?${qs}` : ''}`);
  },
  exercise: (id: string) => request<ExerciseDetail>(`/exercises/${id}`),
  setFavorite: (id: string) =>
    request<FavoriteResult>(`/exercises/${id}/favorite`, { method: 'PUT' }),
  removeFavorite: (id: string) =>
    request<FavoriteResult>(`/exercises/${id}/favorite`, { method: 'DELETE' }),

  // ── Trainer chat ──
  chatThreads: () => request<ChatThreadList>('/trainer-chat/threads'),
  chatMessages: (trainerId: string) =>
    request<ChatMessageList>(`/trainer-chat/threads/${trainerId}/messages`),
  sendChatMessage: (trainerId: string, body: string, idempotencyKey: string) =>
    request<ChatMessage>(`/trainer-chat/threads/${trainerId}/messages`, {
      method: 'POST',
      body: { body },
      idempotencyKey,
    }),

  // ── Community (V2.5) ──
  leaderboard: (period?: number) =>
    request<Leaderboard>(`/community/leaderboard${period ? `?period=${period}` : ''}`),
  communityChallenges: () => request<ChallengeList>('/community/challenges'),
  joinChallenge: (challengeId: string) =>
    request<ChallengeJoinResult>(`/community/challenges/${challengeId}/join`, {
      method: 'POST',
    }),
  badges: () => request<BadgeList>('/community/badges'),

  // ── Health Data Platform (wearable telemetry) ──
  ingestHealth: (samples: HealthSampleInput[], idempotencyKey: string) =>
    request<HealthIngestResult>('/health/samples', {
      method: 'POST',
      body: { samples },
      idempotencyKey,
    }),
  healthSummary: (from?: string, to?: string, types?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (types) params.set('types', types);
    const qs = params.toString();
    return request<HealthSummary>(`/health/summary${qs ? `?${qs}` : ''}`);
  },
  wearableConnections: () =>
    request<WearableConnectionList>('/health/connections'),
  connectWearable: (body: WearableConnectInput) =>
    request<WearableConnection>('/health/connections', {
      method: 'POST',
      body,
    }),
  revokeWearable: (provider: string) =>
    request<WearableConnection>(`/health/connections/${provider}`, {
      method: 'DELETE',
    }),
};
