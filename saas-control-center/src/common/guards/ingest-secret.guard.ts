import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

export const INGEST_HEADER = 'x-ingest-secret';

/**
 * Protects the server-to-server endpoints the marketing website calls
 * (lead ingest, public plan catalogue).
 *
 * The endpoint is `@Public()` so the admin JWT guard does not run — the
 * marketing app has no admin session. In its place, the caller must present a
 * shared secret. This is a server-to-server call: the marketing site's Next.js
 * route handler holds the secret, never the browser, so the secret is not
 * exposed to the public even though the form is.
 *
 * Fails CLOSED. If MARKETING_INGEST_SECRET is unset, every request is rejected
 * rather than the endpoint silently becoming an open write to the database.
 */
@Injectable()
export class IngestSecretGuard implements CanActivate {
  private readonly logger = new Logger(IngestSecretGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('MARKETING_INGEST_SECRET');

    if (!secret) {
      this.logger.error(
        'MARKETING_INGEST_SECRET is not configured — rejecting lead ingest. ' +
          'Set it on both the SCC API and the marketing app to enable the contact form.',
      );
      throw new UnauthorizedException('Ingest is not configured');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers[INGEST_HEADER];

    if (typeof provided !== 'string' || !this.matches(provided, secret)) {
      throw new UnauthorizedException('Invalid ingest credentials');
    }

    return true;
  }

  /**
   * Constant-time comparison. `timingSafeEqual` throws on length mismatch, so
   * length is checked first — that leaks only the length, not the content.
   */
  private matches(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
