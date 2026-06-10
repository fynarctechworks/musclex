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
export type MeContextData = Schemas['MeContext'];
export type MeCapabilitiesData = Schemas['MeCapabilities'];
export type MeMembershipData = Schemas['MeMembership'];

// ── Public (gym-less) personal tracking ───────────────────────────
export type WeightEntryData = Schemas['WeightEntry'];
export type WeightSeriesData = Schemas['WeightSeries'];
export type WaterDayData = Schemas['WaterDay'];
export type GoalData = Schemas['Goal'];
export type GoalListData = Schemas['GoalList'];
export type HealthDayData = Schemas['HealthDay'];
export type HealthSeriesData = Schemas['HealthSeries'];
export type WeightInputBody = JsonBody<paths['/me/weight']['post']>;
export type WaterInputBody = JsonBody<paths['/me/water']['post']>;
export type GoalInputBody = JsonBody<paths['/me/goals']['post']>;
export type GoalUpdateBody = JsonBody<paths['/me/goals/{goalId}']['patch']>;
export type HealthDailyInputBody = JsonBody<paths['/me/health/daily']['post']>;
export type NearbyGymsData = Schemas['NearbyGyms'];
export type NearbyGymData = Schemas['NearbyGym'];
export type SimpleOkData = Schemas['SimpleOk'];
export type WeeklyProgressData = Schemas['WeeklyProgress'];
export type GymProfileData = Schemas['GymProfile'];
export type ToolsComputeBody = JsonBody<paths['/me/tools/compute']['post']>;
export type ReferralApplyResultData = Schemas['ReferralApplyResult'];
export type AppDeviceTokenBody = JsonBody<paths['/me/device-tokens']['post']>;
export type AppDeviceTokenDeleteBody = JsonBody<paths['/me/device-tokens']['delete']>;
export type ReferralApplyBody = JsonBody<paths['/me/referral']['post']>;
export type NotificationAckBody = JsonBody<paths['/me/notifications/ack']['post']>;
export type AppEventTypeValue = Schemas['AppEventType'];
export type EventInputData = Schemas['EventInput'];
export type EventIngestResultData = Schemas['EventIngestResult'];
export type EventBatchInputBody = JsonBody<paths['/me/events']['post']>;
export type RecommendationData = Schemas['Recommendation'];
export type FitnessGoalValue = Schemas['FitnessGoal'];
export type WorkoutPreferenceValue = Schemas['WorkoutPreference'];
export type HomeDashboardData = Schemas['HomeDashboard'];
export type OccupancyData = Schemas['Occupancy'];
export type GymLocationsData = Schemas['GymLocations'];
export type GymLocationData = Schemas['GymLocation'];
export type CheckInResultData = Schemas['CheckInResult'];
export type MembershipData = Schemas['Membership'];
export type RazorpayOrderData = Schemas['RazorpayOrder'];
export type WorkoutData = Schemas['Workout'];
export type WorkoutSummaryData = Schemas['WorkoutSummary'];
export type WorkoutLogResultData = Schemas['WorkoutLogResult'];
export type ClassSummaryData = Schemas['ClassSummary'];
export type ClassListData = Schemas['ClassList'];
export type ClassListItemData = Schemas['ClassListItem'];
export type ClassBookingResultData = Schemas['ClassBookingResult'];
export type ClassCancelResultData = Schemas['ClassCancelResult'];
export type ProgressData = Schemas['Progress'];
export type BodyMetricData = Schemas['BodyMetric'];
export type UploadTargetData = Schemas['UploadTarget'];
export type SetLogData = Schemas['SetLog'];
export type BodyMetricInput = Schemas['BodyMetricInput'];

// ── Nutrition (V2.1) ──────────────────────────────────────────────
export type NutritionDayData = Schemas['NutritionDay'];
export type NutritionGoalData = Schemas['NutritionGoal'];
export type NutritionTotalsData = Schemas['NutritionTotals'];
export type NutritionMealData = Schemas['NutritionMeal'];
export type NutritionMealItemData = Schemas['NutritionMealItem'];
export type FoodItemData = Schemas['FoodItem'];
export type FoodSearchData = Schemas['FoodSearch'];
export type MealLogResultData = Schemas['MealLogResult'];
export type WaterLogResultData = Schemas['WaterLogResult'];
export type MealLogInput = Schemas['MealLogInput'];
export type MealLogItemInput = Schemas['MealLogItemInput'];
export type WaterLogInput = Schemas['WaterLogInput'];
export type NutritionGoalInput = Schemas['NutritionGoalInput'];

// ── Exercise library (V2.2) ───────────────────────────────────────
export type ExerciseListData = Schemas['ExerciseList'];
export type ExerciseListItemData = Schemas['ExerciseListItem'];
export type ExerciseDetailData = Schemas['ExerciseDetail'];
export type FavoriteResultData = Schemas['FavoriteResult'];

// ── Community (V2.5) ──────────────────────────────────────────────
export type LeaderboardData = Schemas['Leaderboard'];
export type ChallengeListData = Schemas['ChallengeList'];
export type ChallengeItemData = Schemas['ChallengeItem'];
export type ChallengeJoinResultData = Schemas['ChallengeJoinResult'];
export type BadgeListData = Schemas['BadgeList'];

// ── Health Data Platform (wearable telemetry) ─────────────────────
export type HealthSampleInputData = Schemas['HealthSampleInput'];
export type HealthSampleBatchInput = Schemas['HealthSampleBatchInput'];
export type HealthIngestResultData = Schemas['HealthIngestResult'];
export type HealthSummaryData = Schemas['HealthSummary'];
export type HealthMetricSeriesData = Schemas['HealthMetricSeries'];
export type HealthDailyPointData = Schemas['HealthDailyPoint'];
export type WearableConnectionData = Schemas['WearableConnection'];
export type WearableConnectionListData = Schemas['WearableConnectionList'];
export type WearableConnectInput = Schemas['WearableConnectInput'];

// ── Trainer chat (V2.3) ───────────────────────────────────────────
export type ChatThreadListData = Schemas['ChatThreadList'];
export type ChatThreadData = Schemas['ChatThread'];
export type ChatMessageListData = Schemas['ChatMessageList'];
export type ChatMessageData = Schemas['ChatMessage'];
export type SendMessageInput = Schemas['SendMessageInput'];
export type SessionResultData = Schemas['SessionResult'];
export type TokenPairData = Schemas['TokenPair'];
export type OtpRequestResultData = Schemas['OtpRequestResult'];
export type MetaShape = Schemas['Meta'];
export type ErrorEnvelopeShape = Schemas['ErrorEnvelope'];

// ── Request body shapes (source of truth for the hand-written,
//    class-validator request DTOs added with the controllers) ───────
type JsonBody<T> = T extends { requestBody: { content: { 'application/json': infer B } } } ? B : never;

export type UpdateProfileBody = JsonBody<paths['/me']['patch']>;
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
export type DeviceTokenDeleteBody = JsonBody<paths['/notifications/device-tokens']['delete']>;
export type MealLogRequestBody = JsonBody<paths['/nutrition/meals']['post']>; // === MealLogInput
export type WaterLogRequestBody = JsonBody<paths['/nutrition/water']['post']>; // === WaterLogInput
export type NutritionGoalRequestBody = JsonBody<paths['/nutrition/goal']['put']>; // === NutritionGoalInput
export type HealthSampleBatchRequestBody = JsonBody<paths['/health/samples']['post']>; // === HealthSampleBatchInput
export type WearableConnectRequestBody = JsonBody<paths['/health/connections']['post']>; // === WearableConnectInput
