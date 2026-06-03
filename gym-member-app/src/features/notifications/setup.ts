import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

/**
 * Push presentation + interaction wiring (Phase 3). The handler decides how a
 * notification shows while the app is foregrounded; the observer routes a tap to
 * the right screen (deep link) and clears the badge on open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Map a notification's `data.type` to an in-app route. */
function routeForData(data: Record<string, unknown> | undefined) {
  const type = (data?.type as string) ?? '';
  switch (type) {
    case 'chat':
      return data?.trainerId ? `/chat/${data.trainerId}` : '/messages';
    case 'class':
      return '/classes';
    case 'meal':
    case 'nutrition':
      return '/nutrition';
    case 'workout':
      return '/workout';
    case 'membership':
      return '/membership';
    default:
      return '/notifications';
  }
}

/** Wire tap-to-route + badge clear. Call once from the root layout. */
export function useNotificationObservers(): void {
  useEffect(() => {
    Notifications.setBadgeCountAsync(0).catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const path = routeForData(data);
      try {
        router.push(path as never);
      } catch {
        /* router not ready — ignore */
      }
    });

    return () => sub.remove();
  }, []);
}
