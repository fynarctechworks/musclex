import Constants from 'expo-constants';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER BFF CLIENT
 * ────────────────────────────────────────────────────────────────
 *
 * Every response is the BFF envelope `{ data, meta }` or `{ error }`, so
 * unwrapping happens in exactly one place. Writes carry an Idempotency-Key —
 * the server requires one and dedupes on it, which is what makes a retry over
 * flaky gym wifi safe.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? 'http://localhost:4002/member/v1';

/** Long enough for a slow gym connection, short enough that nothing hangs. */
const REQUEST_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when the request never reached the server — the queueable case. */
export class OfflineError extends Error {
  constructor() {
    super('No connection');
    this.name = 'OfflineError';
  }
}

let token: string | null = null;
export function setToken(next: string | null) {
  token = next;
}
export function getToken() {
  return token;
}

export function uuid(): string {
  // crypto.randomUUID exists on Hermes (RN 0.74+) and every browser we target.
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
}

/**
 * Set by the auth module to avoid a circular import. Called once on a 401 so a
 * member is not bounced to sign-in because a short-lived token aged out.
 */
let onUnauthorized: (() => Promise<boolean>) | null = null;
export function setRefreshHandler(fn: (() => Promise<boolean>) | null) {
  onUnauthorized = fn;
}

export async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string } = {},
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;

  // A request that never settles is worse than one that fails: captive portals,
  // half-open connections and a dropped mobile signal can all leave fetch
  // hanging indefinitely, which would pin the UI on a spinner. Time out and
  // treat it as offline, which is the queueable case.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: abort.signal,
    });
  } catch {
    throw new OfflineError();
  } finally {
    clearTimeout(timer);
  }

  // A handler returning null makes Nest send 200 with an EMPTY body, so there
  // is nothing to parse. That is a normal answer ("no workout assigned today"),
  // not a failure.
  const text = await res.text();
  const payload = (text ? JSON.parse(text) : {}) as {
    data?: T;
    error?: { code?: string; message?: string };
  };

  if (res.status === 401 && !retried && onUnauthorized) {
    const ok = await onUnauthorized();
    if (ok) return request<T>(path, opts, true);
  }

  if (!res.ok) {
    throw new ApiError(
      payload.error?.code ?? 'UNKNOWN',
      payload.error?.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  // Never return undefined: React Query treats it as a broken query function
  // and throws "Query data cannot be undefined". `null` is the honest value for
  // an endpoint that legitimately has nothing to return.
  return (payload.data ?? null) as T;
}
