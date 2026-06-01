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
  Progress,
  RazorpayOrder,
  SessionResult,
  TokenPair,
  Workout,
  WorkoutLogResult,
  SetLog,
  UploadTarget,
  OtpRequestResult,
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
  registerDeviceToken: (token: string, platform: 'ios' | 'android') =>
    request<void>('/notifications/device-tokens', {
      method: 'POST',
      body: { token, platform },
    }),
};
