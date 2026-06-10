import { Platform } from 'react-native';
import { config, isAnalyticsConfigured, isSccErrorReportingConfigured } from '../config';
import { setAnalyticsSink, type AnalyticsSink, captureError } from '../analytics';
import { reportErrorToScc } from './scc-errors';

/**
 * Monitoring wiring (Phase 5) — analytics + JS error reporting via PostHog's HTTP
 * capture API. Zero native dependencies (just `fetch`), so it works on web and
 * native and can't break the bundle. Activates only when EXPO_PUBLIC_POSTHOG_KEY
 * is set; otherwise the analytics facade stays on its dev-console/no-op sink.
 *
 * Product events flow through the existing `track()` facade; this just attaches a
 * real sink. Retention metrics (DAU, streak retention, chat/nutrition/workout
 * engagement) are PostHog insights computed over these events — no extra code.
 *
 * NOTE: native *crash* reporting (JS-engine crashes) would need a native SDK
 * (@sentry/react-native) + an EAS build — flagged as a follow-up. This captures
 * JS errors + unhandled rejections, which covers the large majority of issues.
 */

let distinctId: string | null = null;
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function post(path: string, payload: Record<string, unknown>): void {
  // Fire-and-forget; analytics must never block or throw into a user flow.
  fetch(`${config.posthogHost}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function capture(event: string, properties: Record<string, unknown>): void {
  post('/capture/', {
    api_key: config.posthogKey,
    event,
    distinct_id: distinctId ?? `anon-${sessionId}`,
    properties: {
      ...properties,
      $session_id: sessionId,
      platform: Platform.OS,
      app: 'gym-member-app',
    },
    timestamp: new Date().toISOString(),
  });
}

const posthogSink: AnalyticsSink = {
  track: (name, props) => capture(name, props),
  identify: (id) => {
    distinctId = id;
    if (id) {
      post('/capture/', {
        api_key: config.posthogKey,
        event: '$identify',
        distinct_id: id,
        properties: { platform: Platform.OS },
      });
    }
  },
  captureError: (error, context) => {
    const e = error instanceof Error ? error : new Error(String(error));
    capture('$exception', {
      $exception_message: e.message,
      $exception_type: e.name,
      $exception_stack: e.stack ?? null,
      ...context,
    });
    // Also surface in the SCC Error Center (no-op if SCC ingest isn't configured).
    reportErrorToScc(error, context);
  },
};

/**
 * Minimal sink used when the SCC Error Center is configured but PostHog is NOT —
 * keeps product-event tracking a no-op while still routing caught errors to SCC.
 */
const sccOnlySink: AnalyticsSink = {
  track: () => {},
  captureError: (error, context) => reportErrorToScc(error, context),
};

let installed = false;

/** Attach the real analytics sink + a global JS-error handler. Call once at start. */
export function initMonitoring(): void {
  // Activate if EITHER PostHog (analytics + errors) or SCC (errors only) is set.
  if (installed || (!isAnalyticsConfigured() && !isSccErrorReportingConfigured()))
    return;
  installed = true;
  // PostHog sink also fans errors to SCC; if only SCC is set, use the errors-only sink.
  setAnalyticsSink(isAnalyticsConfigured() ? posthogSink : sccOnlySink);

  // Global JS error handler (chains the previous one so RN's red box still shows).
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (e: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (h: (e: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const prev = g.ErrorUtils?.getGlobalHandler?.();
  g.ErrorUtils?.setGlobalHandler?.((err, isFatal) => {
    captureError(err, { fatal: !!isFatal });
    prev?.(err, isFatal);
  });
}
