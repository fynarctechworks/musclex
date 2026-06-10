import { createHash } from 'crypto';
import * as Sentry from '@sentry/nestjs';
import type { Request } from 'express';

/**
 * Attaches tenant/route context to the current Sentry scope so that any
 * error captured during the request is tagged with the right gym/user/role
 * — without sending raw user IDs or emails.
 */

function hashId(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function attachSentryRequestScope(req: Request, gymId?: string): void {
  if (!process.env.SENTRY_DSN) return;
  const scope = Sentry.getCurrentScope();
  if (!scope) return;

  const user = (req as any).user as
    | { id?: string; role?: string; email?: string; studio_id?: string }
    | undefined;

  const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
  const activeBranchId = (req.headers['x-active-branch-id'] as string) || undefined;

  scope.setTags({
    route: `${req.method} ${req.baseUrl || ''}${req.path || ''}`.trim(),
    gym_id: gymId || user?.studio_id || 'unknown',
    branch_id: activeBranchId || 'none',
    role: user?.role || 'anonymous',
    correlation_id: correlationId || 'none',
  });

  if (user?.id) {
    // Only the hashed id — no email, no name, no IP.
    scope.setUser({ id: hashId(user.id)! });
  }
}

export function captureWithTenantTags(
  err: unknown,
  tags: Record<string, string | undefined>,
): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(tags)) {
      if (v) scope.setTag(k, v);
    }
    Sentry.captureException(err);
  });
}
