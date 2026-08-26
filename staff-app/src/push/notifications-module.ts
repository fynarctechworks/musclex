import type * as NotificationsModule from 'expo-notifications';

/**
 * expo-notifications, loaded defensively.
 *
 * A plain `import * as Notifications from 'expo-notifications'` throws at
 * MODULE LOAD time when the native module is missing — before any try/catch
 * inside a function can help. Because this module is reached from
 * SessionProvider, which the root layout imports, that throw is not a degraded
 * push feature: it is a full-screen red error instead of an app.
 *
 * Measured, not assumed. On the dev build that predates this dependency a bare
 * import produced 63 "Cannot find native module 'ExpoPushTokenManager'" errors
 * and a full-screen red overlay. This guarded require brings that to 2: the
 * remaining pair are thrown ASYNCHRONOUSLY from inside expo-notifications'
 * own module initialisation, which a synchronous try/catch cannot reach.
 *
 * So be clear about what this does and does not buy:
 *   - it DOES contain the failure to push code paths, so getNotifications()
 *     returns null cleanly and nothing downstream misbehaves;
 *   - it does NOT make a stale dev build usable. That needs the rebuild.
 *
 * Push is an enhancement; the app working is not.
 */
let cached: typeof NotificationsModule | null | undefined;

export function getNotifications(): typeof NotificationsModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('expo-notifications') as typeof NotificationsModule;
  } catch {
    console.warn('[push] expo-notifications is unavailable in this build — push is off.');
    cached = null;
  }
  return cached;
}

/** Test seam: force the next getNotifications() to resolve again. */
export function __resetNotificationsModule(): void {
  cached = undefined;
}
