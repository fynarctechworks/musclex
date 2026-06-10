import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { correlationContext } from '../correlation-context';

/**
 * Per-request correlation ID middleware.
 *
 * Behaviour:
 *  - If the incoming request has `X-Correlation-Id`, validate and reuse
 *    (clients that originate the trace own the ID). We bound length to
 *    128 chars and strip non-printable chars to avoid log injection.
 *  - Otherwise generate a UUIDv4.
 *  - Stash in AsyncLocalStorage so anything in the request scope —
 *    services, orchestrators, Prisma logging — can read it via
 *    `getCorrelationId()` without prop-drilling.
 *  - Echo back in the `X-Correlation-Id` response header so the browser
 *    can attach the same ID to a Sentry breadcrumb. This closes the
 *    loop: a frontend error and a backend log line carry the same key.
 *
 * Must run BEFORE TenantMiddleware so failed-tenant-lookup traces are
 * still correlated.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private static readonly MAX_LEN = 128;
  private static readonly SAFE_CHARS = /^[A-Za-z0-9_\-]+$/;

  use(req: Request, res: Response, next: NextFunction) {
    const incoming = (req.headers['x-correlation-id'] ?? req.headers['x-request-id']) as
      | string
      | string[]
      | undefined;

    let correlationId: string | undefined;
    if (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= CorrelationIdMiddleware.MAX_LEN) {
      // Accept only printable ASCII so the header is safe to log verbatim.
      if (CorrelationIdMiddleware.SAFE_CHARS.test(incoming)) {
        correlationId = incoming;
      }
    }

    if (!correlationId) correlationId = randomUUID();

    // Attach to express request for downstream consumers that prefer to
    // read it off the request instead of from ALS.
    (req as unknown as { correlationId: string }).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    correlationContext.run({ correlationId }, () => next());
  }
}
