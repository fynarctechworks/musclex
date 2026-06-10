import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { config, isSccErrorReportingConfigured } from '../config';

/**
 * SCC Error Center reporter — ships caught JS errors to the SaaS Control Center's
 * public ingest endpoint (`POST /system-errors`, `x-ingest-key` auth), so member-
 * app issues surface in the same place the operator triages backend/admin errors.
 *
 * Fire-and-forget over `fetch` (zero native deps). Payload mirrors SCC's
 * IngestErrorBatchDto. The server re-scrubs PII regardless of what we send, and
 * the endpoint is throttled per-IP — the ingest key is a client-side shared
 * secret (like a Sentry DSN), acceptable for telemetry but NOT a real credential.
 */

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

const appVersion =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? 'unknown';

// PRODUCTION unless this is a dev build. SCC's AppEnvironment enum is upper-case.
const environment =
  typeof __DEV__ !== 'undefined' && __DEV__ ? 'DEVELOPMENT' : 'PRODUCTION';

function toEvent(error: unknown, context?: Record<string, unknown>) {
  const e = error instanceof Error ? error : new Error(String(error));
  const fatal = context?.fatal === true;
  const severity: Severity = fatal ? 'CRITICAL' : 'MEDIUM';

  return {
    message: e.message?.slice(0, 2000) || 'Unknown member-app error',
    source: 'FRONTEND' as const, // no MOBILE source in SCC; distinguish via module/device_info
    module: 'member-app',
    severity,
    environment,
    stack_trace: e.stack?.slice(0, 20000),
    page: typeof context?.screen === 'string' ? context.screen : undefined,
    app_version: String(appVersion).slice(0, 64),
    device_info: {
      platform: Platform.OS,
      osVersion: Platform.Version,
      app: 'gym-member-app',
      ...context,
    },
  };
}

/** Report one caught error to the SCC Error Center. No-op when unconfigured. */
export function reportErrorToScc(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!isSccErrorReportingConfigured()) return;
  const url = `${config.sccIngestUrl.replace(/\/+$/, '')}/system-errors`;
  try {
    void fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ingest-key': config.sccIngestKey,
      },
      body: JSON.stringify({ events: [toEvent(error, context)] }),
    }).catch(() => {});
  } catch {
    /* monitoring must never throw into a user flow */
  }
}
