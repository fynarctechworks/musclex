import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes, createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { Prisma } from '@prisma/client';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class AuthApiKeyService {
  private readonly logger = new Logger(AuthApiKeyService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private hashKey(rawKey: string): string {
    const secret = this.configService.get<string>('HASH_SECRET', '');
    if (!secret) {
      throw new Error('HASH_SECRET environment variable is not set. Cannot hash API keys.');
    }
    return createHmac('sha256', secret).update(rawKey).digest('hex');
  }

  /**
   * Create a new API key. The raw key is returned ONLY at creation time.
   */
  async createApiKey(dto: CreateApiKeyDto, userId: string) {
    const rawKey = `fsp_${randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        gym_id: getTenantGymId()!,
        name: dto.name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: (dto.scopes || {}) as Prisma.InputJsonValue,
        rate_limit_per_minute: dto.rate_limit_per_minute || 60,
        expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
        created_by_user_id: userId,
      },
    });

    // Return raw key ONLY at creation time
    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey, // Only shown once!
      key_prefix: keyPrefix,
      scopes: apiKey.scopes,
      rate_limit_per_minute: apiKey.rate_limit_per_minute,
      expires_at: apiKey.expires_at,
      created_at: apiKey.created_at,
    };
  }

  /**
   * List all API keys (without raw keys or hashes).
   */
  async listApiKeys() {
    return this.prisma.apiKey.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        key_prefix: true,
        scopes: true,
        rate_limit_per_minute: true,
        expires_at: true,
        last_used_at: true,
        last_used_ip: true,
        is_active: true,
        created_at: true,
      },
    });
  }

  /**
   * Get a single API key by ID.
   */
  async getApiKey(id: string) {
    const key = await this.prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        key_prefix: true,
        scopes: true,
        rate_limit_per_minute: true,
        expires_at: true,
        last_used_at: true,
        last_used_ip: true,
        is_active: true,
        created_by_user_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    return key;
  }

  /**
   * Update an API key's metadata.
   */
  async updateApiKey(id: string, dto: UpdateApiKeyDto) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.scopes !== undefined) data.scopes = dto.scopes as Prisma.InputJsonValue;
    if (dto.rate_limit_per_minute !== undefined)
      data.rate_limit_per_minute = dto.rate_limit_per_minute;

    return this.prisma.apiKey.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        key_prefix: true,
        scopes: true,
        rate_limit_per_minute: true,
        expires_at: true,
        is_active: true,
        updated_at: true,
      },
    });
  }

  /**
   * Deactivate an API key.
   */
  async deactivateApiKey(id: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    return this.prisma.apiKey.update({
      where: { id },
      data: { is_active: false },
      select: { id: true, name: true, is_active: true },
    });
  }

  /**
   * Reactivate an API key.
   */
  async reactivateApiKey(id: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    return this.prisma.apiKey.update({
      where: { id },
      data: { is_active: true },
      select: { id: true, name: true, is_active: true },
    });
  }

  /**
   * Delete an API key permanently.
   */
  async deleteApiKey(id: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({ where: { id } });
    return { deleted: true };
  }
}
