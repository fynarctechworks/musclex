import React from 'react';
import { router } from 'expo-router';

import { getNotifications } from '@/push/notifications-module';

/**
 * Foreground presentation + tap routing for staff notifications.
 *
 * Staff alerts are operational — an overdue payment, a class about to start
 * short-staffed — so they are shown even while the app is open. Silently
 * swallowing them in the foreground (Expo's default) would mean a person
 * looking at the app is the LEAST likely to hear about the thing that needs
 * them.
 */
let handlerInstalled = false;

function installForegroundHandler(): void {
  if (handlerInstalled) return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Server-supplied deep links are treated as UNTRUSTED input: only in-app paths
 * are followed. Without this check a payload could push an external URL into
 * the router.
 */
function safeRoute(data: unknown): string | null {
  const route = (data as { route?: unknown } | null)?.route;
  if (typeof route !== 'string') return null;
  if (!route.startsWith('/') || route.startsWith('//')) return null;
  return route;
}

/** Route on notification tap, including the tap that cold-started the app. */
export function usePushRouter(enabled: boolean): void {
  React.useEffect(() => {
    if (!enabled) return;

    const Notifications = getNotifications();
    if (!Notifications) return;
    installForegroundHandler();

    let cancelled = false;

    // A cold start from a notification tap has no live listener to fire, so
    // the launch response has to be read explicitly.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      const route = safeRoute(response.notification.request.content.data);
      if (route) router.push(route as never);
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = safeRoute(response.notification.request.content.data);
      if (route) router.push(route as never);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [enabled]);
}

export { safeRoute as __safeRoute };
