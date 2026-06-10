import { request } from './client';
import type {
  BodyMetric,
  BodyMetricInput,
  CheckInRequest,
  CheckInResult,
  HomeDashboard,
  Membership,
  MemberProfile,
  UpdateProfileInput,
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
  AvatarUploadTarget,
  AvatarConfirmResult,
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
  MeContext,
  WeightSeries,
  WeightEntry,
  WeightInput,
  WaterDay,
  WaterInput,
  PublicGoalList,
  PublicGoal,
  PublicGoalInput,
  PublicGoalUpdate,
  HealthSeries,
  HealthDay,
  HealthDailyInput,
  EventInput,
  EventIngestResult,
  NearbyGyms,
  Recommendation,
  WeeklyProgress,
  ToolsComputeInput,
  GymProfile,
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

  /** ⚠️ DEV-ONLY OTP bypass — 404s unless the BFF has its dev bypass enabled. */
  devSession: (phone: string, code: string, tenantId?: string) =>
    request<SessionResult>('/auth/dev/session', {
      method: 'POST',
      body: { phone, code, tenantId },
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
  /** Partial profile update (onboarding auto-save + later edits). */
  updateMe: (patch: UpdateProfileInput) =>
    request<MemberProfile>('/me', { method: 'PATCH', body: patch }),
  // Public (gym-less) fitness profile — same shapes, app_user-scoped (Phase 7.1).
  appProfile: () => request<MemberProfile>('/me/profile'),
  updateAppProfile: (patch: UpdateProfileInput) =>
    request<MemberProfile>('/me/profile', { method: 'PATCH', body: patch }),
  weekly: () => request<WeeklyProgress>('/me/weekly'),
  computeTools: (input: ToolsComputeInput) =>
    request<Recommendation>('/me/tools/compute', { method: 'POST', body: input }),
  gymProfile: (tenantId: string) => request<GymProfile>(`/me/gyms/${tenantId}`),
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

  // ── Profile avatar (writes members.profile_photo_url → shows in admin too) ──
  avatarUploadUrl: (contentType: string) =>
    request<AvatarUploadTarget>('/me/avatar/upload-url', {
      method: 'POST',
      body: { contentType },
    }),
  confirmAvatar: (avatarId: string) =>
    request<AvatarConfirmResult>('/me/avatar', {
      method: 'POST',
      body: { avatarId },
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

  // ── Experience selector (public users allowed) ──
  meContext: () => request<MeContext>('/me/context'),

  // ── Public (gym-less) personal tracking ──
  weightSeries: (days?: number) =>
    request<WeightSeries>(`/me/weight${days ? `?days=${days}` : ''}`),
  logWeight: (body: WeightInput) =>
    request<WeightEntry>('/me/weight', { method: 'POST', body }),
  waterDay: (date?: string) =>
    request<WaterDay>(`/me/water${date ? `?date=${date}` : ''}`),
  meLogWater: (body: WaterInput) =>
    request<WaterDay>('/me/water', { method: 'POST', body }),
  goals: () => request<PublicGoalList>('/me/goals'),
  createGoal: (body: PublicGoalInput) =>
    request<PublicGoal>('/me/goals', { method: 'POST', body }),
  updateGoal: (goalId: string, body: PublicGoalUpdate) =>
    request<PublicGoal>(`/me/goals/${goalId}`, { method: 'PATCH', body }),
  healthDaily: (days?: number) =>
    request<HealthSeries>(`/me/health/daily${days ? `?days=${days}` : ''}`),
  upsertHealthDaily: (body: HealthDailyInput) =>
    request<HealthDay>('/me/health/daily', { method: 'POST', body }),

  // ── Funnel / behaviour events ──
  logEvents: (events: EventInput[]) =>
    request<EventIngestResult>('/me/events', { method: 'POST', body: { events } }),

  // ── App-user push tokens + referral (Phase 5b/5c) ──
  registerAppDeviceToken: (token: string, platform?: 'ios' | 'android' | 'web') =>
    request<{ ok: boolean }>('/me/device-tokens', {
      method: 'POST',
      body: { token, platform },
    }),
  deleteAppDeviceToken: (token: string) =>
    request<{ ok: boolean }>('/me/device-tokens', { method: 'DELETE', body: { token } }),
  applyReferral: (code: string) =>
    request<{ applied: boolean; reason?: string | null }>('/me/referral', {
      method: 'POST',
      body: { code },
    }),
  ackNotification: (deliveryId: string, action: 'opened' | 'clicked') =>
    request<{ ok: boolean }>('/me/notifications/ack', {
      method: 'POST',
      body: { deliveryId, action },
    }),

  // ── Conversion: public gym directory ──
  nearbyGyms: (lat?: number, lng?: number, q?: string) => {
    const p = new URLSearchParams();
    if (lat != null) p.set('lat', String(lat));
    if (lng != null) p.set('lng', String(lng));
    if (q) p.set('q', q);
    const qs = p.toString();
    return request<NearbyGyms>(`/me/nearby-gyms${qs ? `?${qs}` : ''}`);
  },
};
