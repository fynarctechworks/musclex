import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_ROLE_PERMISSIONS } from './default-permissions';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');

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

    // Set user context from API key scopes
    const scopes = (key.scopes as Record<string, string[]>) || {};
    request.user = {
      user_id: key.created_by_user_id,
      studio_id: null,
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
}
