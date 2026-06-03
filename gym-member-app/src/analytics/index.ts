/**
 * Analytics facade — a typed event bus, NOT a vendor integration.
 *
 * Screens call `track(event)`; events go to whatever sink is registered. In dev
 * the sink logs to the console so events are observable; in production there is
 * NO sink until a real provider (Mixpanel/PostHog/Segment) is attached via
 * `setAnalyticsSink(...)` at app start. This keeps event *instrumentation* in the
 * codebase now without shipping a fake/unconfigured integration — wire a provider
 * (one dependency + token) when you're ready and every existing call lights up.
 */
export type AnalyticsEvent =
  | { name: 'app_opened' }
  | { name: 'screen_viewed'; screen: string }
  | { name: 'nutrition_meal_logged'; mealType: string; kcal: number; viaSearch: boolean }
  | { name: 'nutrition_water_logged'; amountMl: number }
  | { name: 'nutrition_food_selected'; food: string }
  | { name: 'exercise_library_searched'; query: string; muscle: string | null }
  | { name: 'exercise_viewed'; exerciseId: string; exerciseName: string }
  | { name: 'trainer_chat_opened'; trainerId: string }
  | { name: 'trainer_message_sent'; trainerId: string }
  | { name: 'community_viewed' }
  | { name: 'challenge_joined'; challengeId: string }
  | { name: 'health_viewed' }
  | { name: 'activity_viewed' }
  | { name: 'goals_updated' }
  | { name: 'onboarding_intro_completed' }
  | { name: 'sleep_viewed' }
  | { name: 'heart_viewed' }
  | { name: 'body_viewed' }
  | { name: 'wearable_connected'; provider: string }
  | { name: 'wearable_revoked'; provider: string }
  | { name: 'health_synced'; accepted: number }
  | { name: 'health_manual_logged'; metric: string };

export interface AnalyticsSink {
  track(name: string, props: Record<string, unknown>): void;
  /** Associate subsequent events with a user (member id); null on sign-out. */
  identify?(distinctId: string | null): void;
  /** Report a caught error / unhandled rejection. */
  captureError?(error: unknown, context?: Record<string, unknown>): void;
}

const consoleSink: AnalyticsSink = {
  track: (name, props) => {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${name}`, props);
  },
};

// Dev observes events via the console; production stays silent until a provider
// is attached. `__DEV__` is the React Native global.
let sink: AnalyticsSink | null =
  typeof __DEV__ !== 'undefined' && __DEV__ ? consoleSink : null;

/** Attach (or clear) the real provider sink. Call once at app start. */
export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next;
}

/** Emit a typed product event. No-op when no sink is registered. */
export function track(event: AnalyticsEvent): void {
  if (!sink) return;
  const { name, ...props } = event;
  try {
    sink.track(name, props as Record<string, unknown>);
  } catch {
    /* analytics must never break a user flow */
  }
}

/** Associate events with the signed-in member (or null to reset on sign-out). */
export function identify(distinctId: string | null): void {
  try {
    sink?.identify?.(distinctId);
  } catch {
    /* never break a user flow */
  }
}

/** Report a caught error / crash to the monitoring sink. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  try {
    sink?.captureError?.(error, context);
  } catch {
    /* never break a user flow */
  }
}
