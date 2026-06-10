"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Lightweight telemetry hook (Wave 7).
 *
 * The dashboard fires structured events on key interactions so we can later
 * answer "did the Action Stack drive a real lift in renewal recovery?" with
 * data, not vibes.
 *
 * Today this is a no-op + console-shaped wrapper. When `posthog-js` is
 * installed and `NEXT_PUBLIC_POSTHOG_KEY` is set, swap the body of `track`
 * to call `posthog.capture(...)`. Until then, events are forwarded to a
 * window-level queue (`window.__musclex_telemetry`) so they can be
 * inspected during dev — and so a future provider can drain the queue.
 *
 * The `pageview` helper is debounced per-pathname so React's render churn
 * doesn't generate duplicate events.
 */
export interface TelemetryEvent {
  name: string;
  props?: Record<string, unknown>;
  ts: number;
}

declare global {
  interface Window {
    __musclex_telemetry?: TelemetryEvent[];
  }
}

export function track(name: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const evt: TelemetryEvent = {
    name,
    props,
    ts: Date.now(),
  };
  window.__musclex_telemetry = window.__musclex_telemetry ?? [];
  window.__musclex_telemetry.push(evt);
  // Keep the in-memory ring small — last 200 events is plenty for debug.
  if (window.__musclex_telemetry.length > 200) {
    window.__musclex_telemetry.shift();
  }
  // If a real posthog client is loaded, forward.
  const posthog = (window as any).posthog;
  if (posthog?.capture) {
    try {
      posthog.capture(name, props ?? {});
    } catch {
      // never let telemetry break the app
    }
  }
}

export function useTelemetry() {
  const lastPath = useRef<string | null>(null);

  const pageview = useCallback(
    (path: string, props?: Record<string, unknown>) => {
      if (lastPath.current === path) return;
      lastPath.current = path;
      track("dashboard.pageview", { path, ...props });
    },
    [],
  );

  return { track, pageview };
}

/**
 * Fire a single mount-time event. Useful for the dashboard's "I rendered"
 * heartbeat that powers the 2-second-test gate.
 */
export function useMountEvent(name: string, props?: Record<string, unknown>) {
  useEffect(() => {
    track(name, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
