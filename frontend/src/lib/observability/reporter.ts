/**
 * Lightweight client-side error reporter for the SCC Error Center.
 *
 * Posts batched, deduped events to the main backend's `/observability/report`
 * proxy (which forwards to the SCC ingest endpoint with the server-held key —
 * the key is never shipped to the browser). Resilient by design: an offline
 * queue persists across reloads, sends are batched + retried, and every path is
 * guarded so reporting can never throw into product code.
 *
 * This is additive to Sentry, not a replacement.
 */

export interface ReportEvent {
  message: string;
  source: string; // SCC ErrorSource: FRONTEND | QR | CAMERA | BIOMETRIC | POS | PAYMENT | NETWORK | AUTH | API
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  module?: string;
  stack_trace?: string;
  page?: string;
  api_endpoint?: string;
  http_status?: number;
  tenant_id?: string;
  user_id?: string;
  breadcrumbs?: unknown;
  browser_info?: Record<string, unknown>;
  app_version?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const ENDPOINT = `${API_BASE_URL}/observability/report`;
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'frontend@dev';

const QUEUE_KEY = 'mx_obs_queue';
const MAX_QUEUE = 50;
const BATCH_SIZE = 20;
const FLUSH_DEBOUNCE_MS = 2000;
const DEDUPE_WINDOW_MS = 10_000;

let queue: ReportEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
const recentlySeen = new Map<string, number>();

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function loadPersisted(): void {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (raw) queue = JSON.parse(raw).slice(0, MAX_QUEUE);
  } catch {
    /* ignore corrupt queue */
  }
}

function persist(): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE)));
  } catch {
    /* storage full / unavailable — keep in-memory */
  }
}

function browserInfo(): Record<string, unknown> {
  if (!isBrowser()) return {};
  return {
    ua: navigator.userAgent,
    language: navigator.language,
    screen: `${window.screen?.width}x${window.screen?.height}`,
    online: navigator.onLine,
  };
}

function ensureInit(): void {
  if (initialized || !isBrowser()) return;
  initialized = true;
  loadPersisted();
  window.addEventListener('online', () => void flush());
  // Best-effort final flush when the tab goes away.
  window.addEventListener('pagehide', () => void flush());
  if (queue.length) scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  if (!isBrowser() || queue.length === 0) return;
  const batch = queue.slice(0, BATCH_SIZE);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`report failed: ${res.status}`);
    queue = queue.slice(batch.length);
    persist();
    if (queue.length) scheduleFlush(); // drain remainder
  } catch {
    // Leave the batch queued; retry on next enqueue / online / pagehide.
    persist();
  }
}

/** Enqueue an error event for reporting. Never throws. */
export function reportEvent(event: ReportEvent): void {
  try {
    if (!isBrowser()) return;
    ensureInit();

    const key = `${event.source}|${event.message}`.slice(0, 200);
    const now = Date.now();
    const last = recentlySeen.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return; // collapse bursts
    recentlySeen.set(key, now);

    const enriched: ReportEvent = {
      app_version: APP_VERSION,
      page: window.location?.pathname,
      browser_info: browserInfo(),
      ...event,
      message: String(event.message ?? 'Unknown error').slice(0, 2000),
    };

    queue.push(enriched);
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    persist();
    scheduleFlush();
  } catch {
    /* reporting must never break product code */
  }
}
