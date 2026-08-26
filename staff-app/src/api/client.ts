import Constants from 'expo-constants';

import { clearSession, getSession, patchSession } from '@/auth/session-store';
import { uuidv4 } from '@/lib/uuid';

/**
 * API client — ported from frontend/src/services/api-client.ts.
 *
 * Kept deliberately close to the web client so the two behave identically:
 * same headers, same refresh-on-401 semantics, same error shape. Divergence
 * here shows up as "works on web, fails on mobile" bugs that are painful to
 * trace across two codebases.
 *
 * Differences from web, all forced by the platform:
 *  - tokens come from SecureStore, not localStorage
 *  - no document.cookie mirror (there is no browser to share it with)
 *  - sign-out raises a callback instead of window.location
 */

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:4002/api/v1';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestConfig = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  signal?: AbortSignal;
  /** Skip auth + refresh. Used by the login/refresh calls themselves. */
  anonymous?: boolean;
  /** Override the default request timeout, in ms. 0 disables it. */
  timeoutMs?: number;
};

export interface ApiError extends Error {
  status: number;
  data?: unknown;
  correlationId?: string;
}

function createApiError(message: string, status: number, data?: unknown, correlationId?: string): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.data = data;
  err.correlationId = correlationId;
  return err;
}

/**
 * Pull a human-readable message out of a Nest error body.
 *
 * The global ValidationPipe returns `message` as an ARRAY of field errors
 * ({"message":["password must be longer than or equal to 8 characters"]}),
 * while thrown HttpExceptions return a string. Treating it as a string
 * renders "[object Object]" or a comma-run to the user on every bad form.
 */
export function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const msg = (data as { message?: unknown }).message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) {
    const parts = msg.filter((m): m is string => typeof m === 'string');
    // Join with newlines: several field errors read as a list, not a run-on.
    return parts.length > 0 ? parts.join('\n') : null;
  }
  return null;
}

/** Endpoints that must never trigger a refresh — they ARE the auth surface. */
const NO_REFRESH = new Set([
  '/auth/login', '/auth/refresh', '/auth/register', '/auth/verify-email',
  '/auth/resend-verification', '/auth/forgot-password', '/auth/reset-password',
]);

/** Raised when the session is unrecoverable, so the app can route to sign-in. */
type SignOutHandler = () => void;
let onSignOut: SignOutHandler = () => {};
export function setSignOutHandler(fn: SignOutHandler) { onSignOut = fn; }

function buildUrl(endpoint: string, params?: Record<string, unknown>): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      // Empty string is dropped deliberately — matches the web client, so a
      // cleared filter means "no filter" rather than "match empty".
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Correlation id. Uses the shared uuidv4 helper because Hermes has no
 * crypto.randomUUID — the same gap that made check-in send an invalid
 * idempotency key.
 */
function correlationId(): string {
  return uuidv4();
}

// One in-flight refresh shared by all callers: a burst of 401s on app resume
// would otherwise fire N refreshes and race each other into a signed-out state.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const session = getSession();
  if (!session?.refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; refresh_token?: string };
    if (!data.access_token) return null;
    await patchSession({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? session.refreshToken,
    });
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * How long to wait before giving up on a request.
 *
 * A gym's "no signal" is rarely a clean failure. The usual shape is a phone
 * still associated with the wifi while the uplink is dead, where fetch neither
 * resolves nor rejects — it simply hangs. Without a deadline the check-in
 * button spins forever, the staffer taps it again, and the offline queue never
 * gets a chance to do the job it exists for.
 *
 * Twelve seconds is long enough for a slow-but-working connection on a
 * mid-range Android at the counter, and short enough that a member is not left
 * standing there.
 */
export const DEFAULT_TIMEOUT_MS = 12_000;

export async function request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
  const { method = 'GET', body, headers, params, signal, anonymous } = config;
  const session = getSession();
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const send = (token?: string | null) => {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
    if (!anonymous && token) h.Authorization = `Bearer ${token}`;
    // Branch scoping. The backend uses this to narrow queries; the client must
    // never filter by branch itself.
    if (!anonymous && session?.activeBranchId) h['X-Active-Branch-Id'] = session.activeBranchId;
    h['X-Correlation-Id'] = headers?.['X-Correlation-Id'] ?? correlationId();
    return fetchWithTimeout(
      buildUrl(endpoint, params),
      {
        method,
        headers: h,
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      timeoutMs,
      signal,
    );
  };

  let res = await send(session?.accessToken);

  if (res.status === 401 && !anonymous && !NO_REFRESH.has(endpoint)) {
    if (!refreshInFlight) {
      refreshInFlight = refreshAccessToken().finally(() => { refreshInFlight = null; });
    }
    const token = await refreshInFlight;
    if (token) res = await send(token);

    if (res.status === 401) {
      await clearSession();
      onSignOut();
      throw createApiError('Session expired', 401);
    }
  }

  const echoed = res.headers.get('X-Correlation-Id') ?? undefined;

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw createApiError(extractMessage(data) || 'Request failed', res.status, data, echoed);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * fetch with a deadline, preserving any caller-supplied signal.
 *
 * A timeout is surfaced as a status-less ApiError, the same shape a genuine
 * network failure produces — deliberately, because callers that decide whether
 * to queue treat "no response" identically either way, and inventing a
 * distinct class here would mean two code paths for one situation.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  external?: AbortSignal,
): Promise<Response> {
  if (!timeoutMs) return fetch(url, { ...init, signal: external });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // A caller aborting (screen unmounted) must still cancel the request.
  const onExternalAbort = () => controller.abort();
  external?.addEventListener('abort', onExternalAbort);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    // Distinguish OUR deadline from the caller cancelling: only the former is
    // a network condition worth queueing over.
    if (controller.signal.aborted && !external?.aborted) {
      throw createApiError('The network is not responding', 0);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}

export const api = {
  get: <T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    request<T>(endpoint, { ...config, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    request<T>(endpoint, { ...config, method: 'POST', body }),
  put: <T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    request<T>(endpoint, { ...config, method: 'PUT', body }),
  patch: <T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    request<T>(endpoint, { ...config, method: 'PATCH', body }),
  delete: <T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>) =>
    request<T>(endpoint, { ...config, method: 'DELETE' }),
};

export { API_BASE_URL };
