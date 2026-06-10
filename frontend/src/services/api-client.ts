/**
 * Centralized API client for MuscleX.
 * Wraps fetch with JWT auth, token refresh, and tenant headers.
 * All feature modules import from here — never call fetch() directly.
 */

import { captureApiFailure } from '@/lib/observability/capture';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestConfig {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  signal?: AbortSignal;
}

interface ApiError extends Error {
  status: number;
  data?: unknown;
}

// ─── Subscription Write Gate ─────────────────────────────────
// SubscriptionProvider keeps this in sync via setMutationAllowed().
// When false (status != active), any POST/PUT/PATCH/DELETE is short-circuited
// with a synthetic 403 SUBSCRIPTION_LOCKED — the modal opens and no network
// request is sent. Backend stays authoritative; this just prevents wasted
// round-trips and keeps the UX consistent across every page.
let mutationAllowed = true;
let lockedSubscription: Record<string, unknown> | null = null;

export function setMutationAllowed(
  allowed: boolean,
  subscriptionPayload?: Record<string, unknown> | null,
): void {
  mutationAllowed = allowed;
  lockedSubscription = subscriptionPayload ?? null;
}

// Endpoints that must work even when the tenant is locked/in-grace. Mirrors
// the backend's ALWAYS_ALLOWED_PREFIXES in SubscriptionLockGuard.
const ALWAYS_ALLOWED_PREFIXES = [
  '/auth/',
  '/subscription/',
  '/settings/subscription',
  '/settings/account',
  '/settings/invoices',
  '/settings/plans',
];

function isExemptEndpoint(endpoint: string): boolean {
  return ALWAYS_ALLOWED_PREFIXES.some((p) => endpoint.startsWith(p));
}

const MUTATING_METHODS = new Set<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

// ─── Auth State Helpers ──────────────────────────────────────

function getAuthState(): { accessToken: string | null; refreshToken: string | null } {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
  const stored = localStorage.getItem('auth-storage');
  if (!stored) return { accessToken: null, refreshToken: null };
  try {
    const parsed = JSON.parse(stored);
    return {
      accessToken: parsed?.state?.accessToken || null,
      refreshToken: parsed?.state?.refreshToken || null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function updateTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem('auth-storage');
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    parsed.state.accessToken = accessToken;
    if (refreshToken) parsed.state.refreshToken = refreshToken;
    localStorage.setItem('auth-storage', JSON.stringify(parsed));
  } catch { /* ignore */ }
}

function getActiveBranchId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    return JSON.parse(stored)?.state?.activeBranchId || null;
  } catch { return null; }
}

function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth-storage');
  document.cookie = 'auth-token=; path=/; max-age=0';
  window.location.href = '/login?expired=true';
}

// ─── Correlation ID ──────────────────────────────────────────
// One ID per request, echoed back from the backend in the response
// X-Correlation-Id header. `lastCorrelationId` is intentionally a
// module-global — callers (e.g. check-in mutations) can read it
// immediately after an awaited request to attach to a Sentry breadcrumb.
// This works because JavaScript is single-threaded; we never end up
// with two awaits resolving between the assignment and the read.

let lastCorrelationId: string | null = null;

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older Safari).
  return 'cid-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
}

export function getLastCorrelationId(): string | null {
  return lastCorrelationId;
}

// ─── Token Refresh (singleton promise to prevent races) ──────

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getAuthState();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token) {
      updateTokens(data.access_token, data.refresh_token);
      const isSecure = window.location.protocol === 'https:';
      document.cookie = `auth-token=${data.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Self-heal a stale onboarding token.
 *
 * A token minted during onboarding (at email-verification / first sign-in)
 * predates studio creation, so it carries no `user_metadata.studio_id`. The
 * backend's TenantMiddleware reads studio_id from the JWT to resolve gym_id;
 * without it, tenant-scoped writes (member creation, photo upload) fail with a
 * 400 — and because the token is *valid* (not expired), the normal 401 refresh
 * path never fires, so it never self-heals.
 *
 * This decodes the current access token and, if studio_id is absent, forces a
 * single refresh. The refresh re-mints from the user's *current* metadata
 * (studio_id now present). Returns true if a refresh was performed.
 */
export async function ensureStudioScopedToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const { accessToken, refreshToken } = getAuthState();
  if (!accessToken || !refreshToken) return false;

  let hasStudioId = false;
  try {
    const part = accessToken.split('.')[1];
    if (!part) return false;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(
      decodeURIComponent(
        json
          .split('')
          .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(''),
      ),
    );
    hasStudioId = !!payload?.user_metadata?.studio_id;
  } catch {
    // Unparseable token — leave it; the 401 path handles genuine expiry.
    return false;
  }
  if (hasStudioId) return false;

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return !!(await refreshPromise);
}

// ─── URL Builder ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUrl(endpoint: string, params?: Record<string, any>): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

// ─── Core Request Function ───────────────────────────────────

async function request<T = unknown>(
  endpoint: string,
  config: RequestConfig = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, params, signal } = config;

  // Short-circuit writes when the subscription doesn't allow mutations.
  // Skip the network entirely and dispatch the same event the 403 handler
  // would — SubscriptionProvider opens the renewal modal.
  if (
    !mutationAllowed &&
    MUTATING_METHODS.has(method) &&
    !isExemptEndpoint(endpoint) &&
    typeof window !== 'undefined'
  ) {
    const payload = {
      statusCode: 403,
      error_code: 'SUBSCRIPTION_LOCKED',
      message:
        'Your subscription is not active. Renew to make changes — your data is safe and unchanged.',
      subscription: lockedSubscription,
    };
    window.dispatchEvent(
      new CustomEvent('subscription-locked', { detail: payload }),
    );
    throw createApiError(payload.message, 403, payload);
  }

  const { accessToken } = getAuthState();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  // Attach active branch context so the backend can scope queries
  const activeBranchId = getActiveBranchId();
  if (activeBranchId) {
    requestHeaders['X-Active-Branch-Id'] = activeBranchId;
  }

  // Per-request correlation id. We generate one on the client, the
  // backend stamps it on logs + events + WS payloads, and we echo it
  // back as a Sentry breadcrumb so an error report carries the same
  // key as the backend log line.
  const correlationId = headers?.['X-Correlation-Id'] ?? generateCorrelationId();
  requestHeaders['X-Correlation-Id'] = correlationId;

  const url = buildUrl(endpoint, params);

  let res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  // The backend may regenerate the id if it didn't trust ours (length
  // bound / character whitelist). Trust the echo as authoritative.
  const echoedCorrelationId = res.headers.get('X-Correlation-Id') ?? correlationId;
  lastCorrelationId = echoedCorrelationId;

  // Token refresh on 401 — skip only for endpoints that don't require a valid session
  const skipRefresh = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/verify-email', '/auth/resend-verification', '/auth/forgot-password', '/auth/reset-password'].includes(endpoint);
  if (res.status === 401 && typeof window !== 'undefined' && !skipRefresh) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    }
    if (res.status === 401) {
      clearSession();
      throw createApiError('Session expired', 401);
    }
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: res.statusText }));
    const msg = errorData.message || 'API request failed';

    // Sentry breadcrumb on failure — carries the same correlation id as
    // the backend log line, so a support agent can paste it into Loki/
    // CloudWatch and land on the exact request. Fire-and-forget; Sentry
    // SDK is loaded lazily so we don't pull it into common bundles.
    void emitSentryBreadcrumb({
      level: res.status >= 500 ? 'error' : 'warning',
      category: 'api',
      message: `${method} ${endpoint} → ${res.status}`,
      data: {
        status: res.status,
        endpoint,
        method,
        correlation_id: echoedCorrelationId,
        error_code: (errorData as { error_code?: string })?.error_code,
      },
    });

    // Mirror true server faults (5xx) to the SCC Error Center. The reporter is
    // statically imported (it's tiny + dependency-free) so there's no async
    // loader to go stale under HMR; captureApiFailure never throws.
    if (res.status >= 500) {
      captureApiFailure({
        endpoint,
        method,
        status: res.status,
        message: msg,
        correlationId: echoedCorrelationId,
      });
    }

    // Dispatch global event for plan limit errors → redirect to subscription page
    if (res.status === 403 && typeof window !== 'undefined' && (msg.includes('limit reached') || msg.includes('Upgrade'))) {
      window.dispatchEvent(new CustomEvent('plan-limit-reached', { detail: { message: msg } }));
    }

    // Subscription lock — let SubscriptionProvider show the modal. We still
    // throw the error so the caller's mutation reports failure.
    if (
      res.status === 403 &&
      typeof window !== 'undefined' &&
      errorData?.error_code === 'SUBSCRIPTION_LOCKED'
    ) {
      window.dispatchEvent(
        new CustomEvent('subscription-locked', {
          detail: errorData,
        }),
      );
    }

    throw createApiError(msg, res.status, errorData);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

function createApiError(message: string, status: number, data?: unknown): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.data = data;
  return error;
}

// ─── Public API ──────────────────────────────────────────────

export const apiClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: <T = unknown>(endpoint: string, options?: { params?: Record<string, any>; signal?: AbortSignal }) =>
    request<T>(endpoint, { params: options?.params, signal: options?.signal }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: <T = unknown>(endpoint: string, body?: unknown, options?: { params?: Record<string, any>; headers?: Record<string, string> }) =>
    request<T>(endpoint, { method: 'POST', body, params: options?.params, headers: options?.headers }),

  put: <T = unknown>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: <T = unknown>(endpoint: string, body?: unknown, options?: { params?: Record<string, any> }) =>
    request<T>(endpoint, { method: 'PATCH', body, params: options?.params }),

  delete: <T = unknown>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};

/**
 * Fetch an authenticated binary resource (PDF, image, etc) and return a Blob.
 * Used for in-app PDF previews where we need to feed an <iframe> src — the
 * iframe can't send Authorization headers itself, so we fetch the blob and
 * hand it a `URL.createObjectURL(blob)`.
 */
export async function fetchBlob(endpoint: string): Promise<Blob> {
  const { accessToken } = getAuthState();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL.replace(/\/api\/v1$/, '')}${endpoint}`;
  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`) as ApiError;
    err.status = res.status;
    throw err;
  }
  return await res.blob();
}

// Re-export for backward compatibility with existing pages
export { request as api };
export type { ApiError, RequestConfig };

// ─── Sentry Breadcrumb (lazy) ────────────────────────────────
// Lazy-imported so the bundler can tree-shake Sentry out of pages that
// don't need it. We swallow every error here — a missing breadcrumb is
// never worth crashing the user's request.

interface BreadcrumbPayload {
  level: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  data: Record<string, unknown>;
}

async function emitSentryBreadcrumb(crumb: BreadcrumbPayload): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const Sentry = await import('@sentry/nextjs').catch(() => null);
    if (!Sentry) return;
    Sentry.addBreadcrumb({
      level: crumb.level,
      category: crumb.category,
      message: crumb.message,
      data: crumb.data,
      timestamp: Date.now() / 1000,
    });
  } catch {
    // Swallow — breadcrumb emission must never throw.
  }
}
