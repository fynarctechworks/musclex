import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Authenticates the public error-ingestion endpoint with a shared secret in the
 * `x-ingest-key` header (NOT the admin JWT — client gym apps have no admin
 * session). Configure one or more keys via INGEST_API_KEYS (comma-separated).
 *
 * If no keys are configured the guard fails closed in production but, for local
 * DX, allows ingestion in non-production environments with a loud warning.
 */
@Injectable()
export class IngestKeyGuard implements CanActivate {
  private readonly logger = new Logger(IngestKeyGuard.name);
  private readonly keys: string[];

  constructor(private readonly config: ConfigService) {
    this.keys = (this.config.get<string>('INGEST_API_KEYS') ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = (req.headers['x-ingest-key'] as string | undefined) ?? '';

    if (this.keys.length === 0) {
      if ((process.env.NODE_ENV ?? 'development') !== 'production') {
        this.logger.warn(
          'INGEST_API_KEYS not set — accepting error ingestion without a key (non-production only).',
        );
        return true;
      }
      throw new UnauthorizedException('Error ingestion is not configured');
    }

    if (provided && this.keys.some((k) => this.safeEqual(provided, k))) {
      return true;
    }
    throw new UnauthorizedException('Invalid or missing ingest key');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
