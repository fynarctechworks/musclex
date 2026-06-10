'use client';

import * as Sentry from '@sentry/nextjs';

/**
 * Browser-side helper for attaching tenant context to the active Sentry scope.
 * Called by auth-store on login / logout. No-op when DSN is unset.
 *
 * We send a hashed user id (sha-256, first 16 hex chars) — never email/name.
 */

async function hashId(value: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    // SSR / unsupported — just truncate so we never accidentally send raw id.
    return value.slice(0, 16);
  }
  const buf = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 16);
}

export async function attachSentryUserContext(params: {
  userId: string;
  gymId?: string;
  role?: string;
}): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const id = await hashId(params.userId);
    Sentry.setUser({ id });
    Sentry.setTags({
      gym_id: params.gymId || 'unknown',
      role: params.role || 'anonymous',
    });
  } catch {
    // Never let monitoring instrumentation break the app.
  }
}

export function clearSentryUserContext(): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    Sentry.setUser(null);
  } catch {
    /* no-op */
  }
}
