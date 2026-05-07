/* FitSync Pro — minimal service worker for Web Push notifications.
 *
 * Why this exists:
 *   The dashboard's Action Queue can escalate high-severity items to a
 *   user's mobile device. The browser only delivers Web Push to a page
 *   if a service worker is installed and active. This SW handles the
 *   `push` event and shows a notification; clicking the notification
 *   opens the dashboard at the right deep-link.
 *
 * Scope:
 *   This file is intentionally minimal — no caching strategy, no
 *   pre-cache. The dashboard's offline mirror is IndexedDB-driven from
 *   the application thread (lib/offline-cache.ts), not the SW.
 */

self.addEventListener("install", (event) => {
  // Activate immediately so users get notifications without a refresh.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "FitSync Pro",
    body: "You have a new action.",
    url: "/",
    tag: "fitsync-action",
  };
  try {
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data };
    }
  } catch {
    // payload is whatever the default was
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url },
      icon: "/icon-192.png",
      badge: "/icon-72.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const url = event.notification?.data?.url || "/";
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
