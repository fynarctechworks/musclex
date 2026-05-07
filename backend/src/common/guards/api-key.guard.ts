import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_ROLE_PERMISSIONS } from './default-permissions';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;
    const studioId = request.headers['x-studio-id'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    if (!studioId || !UUID_REGEX.test(studioId)) {
      throw new UnauthorizedException('Missing or invalid x-studio-id header');
    }

    // Set tenant search_path so the API key lookup runs in the correct schema
    const schemaName = `studio_${studioId.replace(/-/g, '_')}`;
    if (!/^studio_[0-9a-f_]+$/i.test(schemaName)) {
      throw new ForbiddenException('Invalid studio identifier');
    }

    try {
      const schemaExists = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) as exists`,
        schemaName,
      );
      if (!schemaExists?.[0]?.exists) {
        throw new ForbiddenException('Studio environment not found');
      }
      await this.prisma.$executeRawUnsafe(
        `SET search_path TO "${schemaName}", public`,
      );
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof UnauthorizedException) throw err;
      this.logger.error(`Failed to set tenant schema for API key: ${err.message}`);
      throw new ForbiddenException('Unable to access studio environment');
    }

    const keyHash = this.hashApiKey(apiKey);

    const key = await this.prisma.apiKey.findUnique({
      where: { key_hash: keyHash },
    });

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!key.is_active) {
      throw new UnauthorizedException('API key is deactivated');
    }

    if (key.expires_at && key.expires_at < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Update last_used tracking (fire-and-forget)
    const clientIp =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      'unknown';

    this.prisma.apiKey
      .update({
        where: { id: key.id },
        data: { last_used_at: new Date(), last_used_ip: clientIp },
      })
      .catch(() => {});

    // Set user context with correct studio_id from the validated header
    const scopes = (key.scopes as Record<string, string[]>) || {};
    request.user = {
      user_id: key.created_by_user_id,
      studio_id: studioId,
      role: 'api_key',
      branch_ids: [],
      email: null,
      permissions: Object.keys(scopes).length > 0
        ? scopes
        : DEFAULT_ROLE_PERMISSIONS['front_desk'] || {},
      api_key_id: key.id,
    };

    return true;
  }

  private hashApiKey(apiKey: string): string {
    const secret = this.configService.get<string>('HASH_SECRET', '');
    if (!secret) {
      this.logger.error('HASH_SECRET not set — API key verification will always fail. Set HASH_SECRET in environment.');
      throw new UnauthorizedException('API key verification is misconfigured');
    }
    return createHmac('sha256', secret).update(apiKey).digest('hex');
  }
}
