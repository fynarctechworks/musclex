/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER API CONTRACT — ergonomic aliases over the generated types
 * ────────────────────────────────────────────────────────────────
 *
 * `member-api.types.ts` is generated from docs/"Member api v1.openapi.yaml"
 * (run `npm run gen:member-api`). Do NOT edit it by hand. This barrel gives
 * controllers, mappers, and the future RN client friendly names instead of
 * deep `paths[...]['post']['requestBody']...` lookups, so the contract stays
 * the single source of truth for both request and response shapes.
 */
import type { components, paths } from './member-api.types';

export type { components, paths } from './member-api.types';

/** All response/object schemas defined in the contract. */
export type Schemas = components['schemas'];

// ── Response data shapes (the `data` inside the envelope) ──────────
export type MemberProfileData = Schemas['MemberProfile'];
export type HomeDashboardData = Schemas['HomeDashboard'];
export type OccupancyData = Schemas['Occupancy'];
export type CheckInResultData = Schemas['CheckInResult'];
export type MembershipData = Schemas['Membership'];
export type RazorpayOrderData = Schemas['RazorpayOrder'];
export type WorkoutData = Schemas['Workout'];
export type WorkoutSummaryData = Schemas['WorkoutSummary'];
export type WorkoutLogResultData = Schemas['WorkoutLogResult'];
export type ClassSummaryData = Schemas['ClassSummary'];
export type ProgressData = Schemas['Progress'];
export type BodyMetricData = Schemas['BodyMetric'];
export type UploadTargetData = Schemas['UploadTarget'];
export type SetLogData = Schemas['SetLog'];
export type BodyMetricInput = Schemas['BodyMetricInput'];
export type SessionResultData = Schemas['SessionResult'];
export type TokenPairData = Schemas['TokenPair'];
export type OtpRequestResultData = Schemas['OtpRequestResult'];
export type MetaShape = Schemas['Meta'];
export type ErrorEnvelopeShape = Schemas['ErrorEnvelope'];

// ── Request body shapes (source of truth for the hand-written,
//    class-validator request DTOs added with the controllers) ───────
type JsonBody<T> = T extends { requestBody: { content: { 'application/json': infer B } } } ? B : never;

export type OtpRequestBody = JsonBody<paths['/auth/otp/request']['post']>;
export type SessionRequestBody = JsonBody<paths['/auth/session']['post']>;
export type RefreshRequestBody = JsonBody<paths['/auth/refresh']['post']>;
export type CheckInRequestBody = JsonBody<paths['/checkins']['post']>;
export type RenewRequestBody = JsonBody<paths['/membership/renew']['post']>;
export type WorkoutLogRequestBody = JsonBody<paths['/workouts/{workoutId}/logs']['post']>;
export type ProgressMetricRequestBody = JsonBody<paths['/progress/metrics']['post']>; // === BodyMetricInput
export type PhotoUploadUrlRequestBody = JsonBody<paths['/progress/photos/upload-url']['post']>;
export type PhotoConfirmRequestBody = JsonBody<paths['/progress/photos']['post']>;
export type DeviceTokenRequestBody = JsonBody<paths['/notifications/device-tokens']['post']>;
