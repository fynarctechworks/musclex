import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../../api/endpoints';
import type { NotificationPrefs } from '../../auth/prefs-store';

/**
 * Push registration (Phase 3). Prefers an Expo push token (sendable via the Expo
 * Push API once the EAS project has FCM/APNs creds); falls back to the native
 * device token so registration still works in any build. Per-category prefs are
 * sent so the server honours opt-outs.
 */

/** The notification categories surfaced in settings + sent as prefs. */
export const NOTIFICATION_CATEGORIES: { key: string; label: string }[] = [
  { key: 'trainer_messages', label: 'Trainer messages' },
  { key: 'class_reminders', label: 'Class reminders' },
  { key: 'workout_reminders', label: 'Workout reminders' },
  { key: 'meal_reminders', label: 'Meal reminders' },
  { key: 'streak_alerts', label: 'Streak alerts' },
  { key: 'progress_milestones', label: 'Progress milestones' },
  { key: 'achievement_unlocks', label: 'Achievement unlocks' },
  { key: 'challenge_invitations', label: 'Challenge invitations' },
  { key: 'community_updates', label: 'Community updates' },
  { key: 'membership_expiry', label: 'Subscription renewal reminders' },
  { key: 'security_alerts', label: 'Security alerts' },
];

/** Default: everything on. */
export function defaultNotificationPrefs(): NotificationPrefs {
  return Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.key, true]));
}

const projectId =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
    ?.projectId;

async function currentToken(): Promise<{ token: string; platform: 'ios' | 'android' } | null> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  // Expo token is preferred (server can send via the Expo Push API).
  if (projectId) {
    try {
      const t = await Notifications.getExpoPushTokenAsync({ projectId });
      return { token: t.data, platform };
    } catch {
      /* fall back to native */
    }
  }
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    return { token: String(t.data), platform };
  } catch {
    return null;
  }
}

/** Request permission, get a token, and register it (with prefs). */
export async function enablePush(
  prefs: NotificationPrefs,
): Promise<'granted' | 'denied' | 'error'> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return 'denied';

    const tok = await currentToken();
    if (!tok) return 'error';
    // App-user token (works for public + gym users — segment campaigns).
    await api.registerAppDeviceToken(tok.token, tok.platform).catch(() => {});
    // Gym-scoped token (no-op / 403 for gym-less public users).
    await api.registerDeviceToken(tok.token, tok.platform, prefs).catch(() => {});
    return 'granted';
  } catch {
    return 'error';
  }
}

/** Re-register with updated prefs (no-op if permission isn't granted). */
export async function syncPushPrefs(prefs: NotificationPrefs): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const tok = await currentToken();
    if (!tok) return;
    await api.registerAppDeviceToken(tok.token, tok.platform).catch(() => {});
    await api.registerDeviceToken(tok.token, tok.platform, prefs).catch(() => {});
  } catch {
    /* best-effort */
  }
}

/** Unregister this device's token (on disable / sign-out). */
export async function disablePush(): Promise<void> {
  try {
    const tok = await currentToken();
    if (tok) {
      await api.deleteAppDeviceToken(tok.token).catch(() => {});
      await api.deleteDeviceToken(tok.token).catch(() => {});
    }
  } catch {
    /* best-effort */
  }
}
