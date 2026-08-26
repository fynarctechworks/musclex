import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@/api/client';
import { getNotifications } from '@/push/notifications-module';
import { reportHandled } from '@/observability/sentry';

/**
 * ────────────────────────────────────────────────────────────────
 * STAFF PUSH REGISTRATION
 * ────────────────────────────────────────────────────────────────
 *
 * Two rules shape everything here:
 *
 *  1. Registration NEVER blocks or breaks the app. A denied permission, a
 *     simulator with no push support, a missing EAS project id and an offline
 *     network all resolve to "no token" — not to an error the user sees. Push
 *     is an enhancement; sign-in is the product.
 *
 *  2. Sign-out MUST clear the token. A front-desk phone is shared and
 *     frequently handed over; a token left registered keeps delivering one
 *     gym's operational alerts to whoever is holding the handset next.
 */

/** The token this device is currently registered with, if any. */
let currentToken: string | null = null;

/** Only ask the OS once per app launch — repeated prompts read as spam. */
let inFlight: Promise<string | null> | null = null;

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

/**
 * Ask the OS for a push token.
 *
 * Returns null — never throws — when push is unavailable for any reason.
 */
async function acquireToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;

    // Missing on any build made before expo-notifications was added.
    const Notifications = getNotifications();
    if (!Notifications) return null;

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    if (Platform.OS === 'android') {
      // Android 8+ drops notifications posted to a channel that does not
      // exist. Without this the token is valid and nothing ever appears.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'MuscleX',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const id = projectId();
    if (!id) {
      // Expo cannot mint a token without knowing which project it belongs to.
      // Surfaced as a log rather than an error: the app is fully usable, and
      // this is a build-config gap, not a runtime fault.
      console.warn('[push] No EAS projectId — skipping push registration.');
      return null;
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return data ?? null;
  } catch (err) {
    // Physical-device-only APIs throw on simulators. That is expected, not a
    // fault worth reporting.
    console.warn('[push] Could not obtain a push token:', err);
    return null;
  }
}

/**
 * Register this device for the signed-in user's current gym.
 *
 * Safe to call on every sign-in and every workspace switch: the server upserts
 * on (token, gym) so a repeat call updates rather than duplicating, and a
 * switch adds the new gym instead of moving the device.
 */
export async function registerForPush(deviceName?: string): Promise<string | null> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const token = currentToken ?? (await acquireToken());
    if (!token) return null;
    currentToken = token;

    try {
      await api.post('/staff-push/register', {
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        device_name: deviceName ?? Constants.deviceName ?? undefined,
      });
    } catch (err) {
      // Keep the OS token cached so sign-out can still clear it, and so the
      // next attempt does not re-prompt.
      reportHandled(err, 'push.register');
      return null;
    }
    return token;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Clear this device's registration — across EVERY gym the user belongs to.
 *
 * MUST be awaited before the session is cleared: the endpoint is authenticated,
 * and without a token the request is a 401 that silently leaves the device
 * registered. Failure never blocks sign-out; the server re-points a handset to
 * whoever signs in next, which repairs an unregister lost to a dead network.
 */
export async function unregisterForPush(): Promise<void> {
  const token = currentToken;
  currentToken = null;
  if (!token) return;

  try {
    await api.post('/staff-push/unregister', { token }, { timeoutMs: 5_000 });
  } catch (err) {
    console.warn('[push] Unregister failed; the device will be re-pointed on next sign-in.', err);
  }
}

/** Test seam: reset module state between cases. */
export function __resetPushRegistration(): void {
  currentToken = null;
  inFlight = null;
}

/** Test seam / diagnostics: the token this device is registered with. */
export function currentPushToken(): string | null {
  return currentToken;
}
