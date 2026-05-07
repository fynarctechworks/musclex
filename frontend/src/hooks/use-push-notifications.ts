"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

interface PushState {
  supported: boolean;
  /** Browser permission state ("default" | "granted" | "denied"). */
  permission: NotificationPermission | "unsupported";
  /** Whether the current device is currently subscribed. */
  subscribed: boolean;
  /** True after we've checked the server for a public VAPID key. */
  serverConfigured: boolean;
}

/**
 * Wave 6 — Web Push registration helper.
 *
 * Behavior:
 *   1. Verifies the browser supports Push + the server has a public VAPID key.
 *   2. Lazily registers `/sw.js` (the minimal service worker shipped in /public).
 *   3. Exposes `subscribe()` to ask permission + POST the subscription to
 *      `/dashboard/push/subscribe`.
 *   4. Exposes `unsubscribe()` to detach + DELETE on the server.
 *
 * Operators integrate this anywhere in the UI (e.g. a settings toggle).
 * No automatic prompts — the User Experience rules say *the user must opt in*.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: "unsupported",
    subscribed: false,
    serverConfigured: false,
  });
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      setState((s) => ({ ...s, supported: false, permission: "unsupported" }));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{ public_key: string | null; supported: boolean }>(
          "/dashboard/push/public-key",
        );
        if (cancelled) return;
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setPublicKey(res.public_key);
        setState({
          supported: true,
          permission: Notification.permission,
          subscribed: !!sub,
          serverConfigured: !!res.public_key,
        });
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, supported: false }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    if (!state.supported || !publicKey) return;
    const permission = await Notification.requestPermission();
    setState((s) => ({ ...s, permission }));
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    const keyBytes = urlBase64ToUint8Array(publicKey);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Browser expects the raw underlying ArrayBuffer; cast keeps lib.dom
      // typings happy across environments where Uint8Array is generic.
      applicationServerKey: keyBytes.buffer as ArrayBuffer,
    });

    await apiClient.post("/dashboard/push/subscribe", {
      subscription: sub.toJSON(),
      user_agent: navigator.userAgent,
    });
    setState((s) => ({ ...s, subscribed: true }));
  }, [state.supported, publicKey]);

  const unsubscribe = useCallback(async () => {
    if (!state.supported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      try {
        await apiClient.post("/dashboard/push/unsubscribe", {
          endpoint: sub.endpoint,
        });
      } catch {
        // server-side cleanup is best-effort; the local subscription is
        // already gone so the user no longer gets notifications.
      }
    }
    setState((s) => ({ ...s, subscribed: false }));
  }, [state.supported]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

/**
 * VAPID public key transport convention — base64url string → Uint8Array.
 * Browsers' applicationServerKey expects raw bytes, not base64.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
