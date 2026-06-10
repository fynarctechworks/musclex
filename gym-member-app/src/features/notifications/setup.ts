import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { api } from '../../api/endpoints';

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
  // Campaign/automation pushes carry a `deepLink` like musclex://home → /home.
  const deepLink = data?.deepLink as string | undefined;
  if (deepLink) {
    const path = deepLink.replace(/^musclex:\/\//, '/');
    return path.startsWith('/') ? path : `/${path}`;
  }
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

/** Best-effort campaign delivery ack (Phase 7.6) — never throws / blocks UI. */
function ackDelivery(data: Record<string, unknown> | undefined, action: 'opened' | 'clicked') {
  const deliveryId = data?.deliveryId as string | undefined;
  if (deliveryId) api.ackNotification(deliveryId, action).catch(() => {});
}

/** Wire tap-to-route + badge clear. Call once from the root layout. */
export function useNotificationObservers(): void {
  useEffect(() => {
    Notifications.setBadgeCountAsync(0).catch(() => {});

    // Foreground receipt → counts as an "open" for campaign analytics.
    const recv = Notifications.addNotificationReceivedListener((notif) => {
      ackDelivery(
        notif.request.content.data as Record<string, unknown> | undefined,
        'opened',
      );
    });

    // Tap → route (deep link) + counts as a "click".
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      ackDelivery(data, 'clicked');
      const path = routeForData(data);
      try {
        router.push(path as never);
      } catch {
        /* router not ready — ignore */
      }
    });

    return () => {
      recv.remove();
      sub.remove();
    };
  }, []);
}
