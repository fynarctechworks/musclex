/**
 * Centralized API client for FitSync Pro.
 * Wraps fetch with JWT auth, token refresh, and tenant headers.
 * All feature modules import from here — never call fetch() directly.
 */

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

function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth-storage');
  document.cookie = 'auth-token=; path=/; max-age=0';
  window.location.href = '/login?expired=true';
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
      document.cookie = `auth-token=${data.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
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
  const { accessToken } = getAuthState();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = buildUrl(endpoint, params);

  let res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  // Token refresh on 401
  if (res.status === 401 && typeof window !== 'undefined') {
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
    throw createApiError(errorData.message || 'API request failed', res.status, errorData);
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
  post: <T = unknown>(endpoint: string, body?: unknown, options?: { params?: Record<string, any> }) =>
    request<T>(endpoint, { method: 'POST', body, params: options?.params }),

  put: <T = unknown>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: <T = unknown>(endpoint: string, body?: unknown, options?: { params?: Record<string, any> }) =>
    request<T>(endpoint, { method: 'PATCH', body, params: options?.params }),

  delete: <T = unknown>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};

// Re-export for backward compatibility with existing pages
export { request as api };
export type { ApiError, RequestConfig };
