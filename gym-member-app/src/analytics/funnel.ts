import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from '../api/endpoints';
import type { AppEventType } from '../api/types';

/**
 * Funnel emitter (Phase 3). Sends app-user funnel / behaviour events to the
 * server store (public.app_user_events) so the SCC can build onboarding +
 * conversion funnels. Fire-and-forget: a failed emit never blocks UI and never
 * throws. Distinct from the analytics facade (PostHog) — this is the first-party
 * store the control center reads; call both where you want both.
 *
 * Requires an authenticated session (the endpoint is app_user-scoped); calling it
 * pre-auth simply no-ops on the 401.
 */
const ONCE_PREFIX = 'funnel.once.';

export function emitFunnel(
  type: AppEventType,
  metadata?: Record<string, unknown>,
): void {
  void (async () => {
    try {
      await api.logEvents([
        { type, platform: Platform.OS as 'ios' | 'android' | 'web', metadata },
      ]);
    } catch {
      /* fire-and-forget */
    }
  })();
}

/**
 * Emit an event at most once per install (for first_app_open / first_dashboard_visit).
 * The server also de-dupes by DISTINCT user, so this is just to avoid noise.
 */
export function emitFunnelOnce(
  type: AppEventType,
  metadata?: Record<string, unknown>,
): void {
  void (async () => {
    try {
      const key = ONCE_PREFIX + type;
      if (await AsyncStorage.getItem(key)) return;
      await AsyncStorage.setItem(key, new Date().toISOString());
      emitFunnel(type, metadata);
    } catch {
      /* fire-and-forget */
    }
  })();
}
