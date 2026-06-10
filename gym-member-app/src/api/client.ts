import { config } from '../config';
import { sessionBridge } from './session-bridge';
import type { ApiError, Envelope, TokenPair } from './types';

/** Thrown for any non-2xx (or network) response, carrying the contract error. */
export class MemberApiError extends Error {
  code: string;
  status: number;
  retryable: boolean;
  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'MemberApiError';
    this.code = error.code;
    this.status = status;
    this.retryable = !!error.retryable;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('No connection');
    this.name = 'NetworkError';
  }
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Adds Authorization. Default true. Auth endpoints pass false. */
  auth?: boolean;
  /** Idempotency-Key header for safe retries. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

let refreshing: Promise<TokenPair | null> | null = null;

async function rawFetch(path: string, opts: RequestOpts, token: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  try {
    return await fetch(`${config.apiBaseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new NetworkError();
  }
}

/** Refresh the access token using the stored refresh token (single-flight). */
async function doRefresh(): Promise<TokenPair | null> {
  if (refreshing) return refreshing;
  const rt = sessionBridge.refreshToken;
  if (!rt) return null;

  refreshing = (async () => {
    try {
      const res = await rawFetch(
        '/auth/refresh',
        { method: 'POST', body: { refreshToken: rt }, auth: false },
        null,
      );
      if (!res.ok) return null;
      const tokens = (await res.json()) as TokenPair;
      sessionBridge.setTokens(tokens);
      return tokens;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function parseError(res: Response): Promise<MemberApiError> {
  let body: { error?: ApiError } | undefined;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  const err: ApiError = body?.error ?? {
    code: `HTTP_${res.status}`,
    message: res.statusText || 'Request failed',
    retryable: res.status >= 500,
  };
  return new MemberApiError(res.status, err);
}

/**
 * Core request. Unwraps the { data, meta } envelope. On 401 (with auth), tries a
 * single token refresh + retry; if that fails the session is expired.
 */
export async function request<T>(
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  let res = await rawFetch(path, opts, sessionBridge.accessToken);

  if (res.status === 401 && opts.auth !== false) {
    const refreshed = await doRefresh();
    if (!refreshed) {
      sessionBridge.notifyExpired();
      throw await parseError(res);
    }
    res = await rawFetch(path, opts, refreshed.accessToken);
  }

  if (!res.ok) throw await parseError(res);

  if (res.status === 204) return undefined as T;

  // A nullable resource (e.g. GET /workouts/today with nothing assigned) comes
  // back as a 200 with an empty body. Treat that as null — calling res.json()
  // on an empty body throws, which React Query would surface as an error state.
  const text = await res.text();
  if (!text) return null as T;

  const json = JSON.parse(text);
  // Auth endpoints return raw bodies; data endpoints are enveloped.
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as Envelope<T>).data;
  }
  return json as T;
}

/** Like request, but also returns meta (used for cacheTtl-driven caching). */
export async function requestWithMeta<T>(
  path: string,
  opts: RequestOpts = {},
): Promise<Envelope<T>> {
  let res = await rawFetch(path, opts, sessionBridge.accessToken);
  if (res.status === 401 && opts.auth !== false) {
    const refreshed = await doRefresh();
    if (!refreshed) {
      sessionBridge.notifyExpired();
      throw await parseError(res);
    }
    res = await rawFetch(path, opts, refreshed.accessToken);
  }
  if (!res.ok) throw await parseError(res);
  const text = await res.text();
  if (!text) return { data: null as T } as Envelope<T>;
  return JSON.parse(text) as Envelope<T>;
}
