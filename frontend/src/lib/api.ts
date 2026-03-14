const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

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

function updateAccessToken(newToken: string, newRefreshToken?: string) {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem('auth-storage');
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    parsed.state.accessToken = newToken;
    if (newRefreshToken) parsed.state.refreshToken = newRefreshToken;
    localStorage.setItem('auth-storage', JSON.stringify(parsed));
  } catch { /* ignore */ }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getAuthState();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token) {
      updateAccessToken(data.access_token, data.refresh_token);
      // Update auth cookie for middleware
      document.cookie = `auth-token=${data.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const { accessToken: token } = getAuthState();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // On 401, attempt token refresh once
  if (res.status === 401 && typeof window !== 'undefined') {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    if (res.status === 401) {
      localStorage.removeItem('auth-storage');
      document.cookie = 'auth-token=; path=/; max-age=0';
      window.location.href = '/login?expired=true';
      throw new Error('Session expired. Redirecting to login...');
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'API request failed');
  }

  return res.json();
}

export const apiClient = {
  get: <T = unknown>(endpoint: string) => api<T>(endpoint),
  post: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: 'POST', body }),
  patch: <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: 'PATCH', body }),
  delete: <T = unknown>(endpoint: string) =>
    api<T>(endpoint, { method: 'DELETE' }),
};
