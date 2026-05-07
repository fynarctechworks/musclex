import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSsoProviderDto, UpdateSsoProviderDto } from './dto';
import { Prisma } from '@prisma/client';
import { getTenantGymId } from '../common/tenant-context';

const VALID_PROVIDER_TYPES = ['google', 'microsoft', 'saml', 'oidc'];

@Injectable()
export class AuthSsoService {
  private readonly logger = new Logger(AuthSsoService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * List all SSO providers for the current tenant.
   */
  async listProviders() {
    const providers = await this.prisma.ssoProvider.findMany({
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        provider_type: true,
        display_name: true,
        client_id: true,
        issuer_url: true,
        is_active: true,
        auto_provision_users: true,
        allowed_domains: true,
        scopes: true,
        created_at: true,
        updated_at: true,
      },
    });

    return providers;
  }

  /**
   * Get a single SSO provider by ID (without exposing secrets).
   */
  async getProvider(id: string) {
    const provider = await this.prisma.ssoProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new NotFoundException('SSO provider not found');
    }

    // Never return encrypted secrets
    const { encrypted_client_secret, ...safe } = provider;
    return {
      ...safe,
      has_client_secret: !!encrypted_client_secret,
    };
  }

  /**
   * Create a new SSO provider configuration.
   */
  async createProvider(dto: CreateSsoProviderDto, createdBy: string) {
    if (!VALID_PROVIDER_TYPES.includes(dto.provider_type)) {
      throw new ConflictException(
        `Invalid provider type. Must be one of: ${VALID_PROVIDER_TYPES.join(', ')}`,
      );
    }

    let encryptedSecret: string | undefined;
    if (dto.client_secret) {
      encryptedSecret = this.encryptSecret(dto.client_secret);
    }

    const provider = await this.prisma.ssoProvider.create({
      data: {
        gym_id: getTenantGymId()!,
        provider_type: dto.provider_type,
        display_name: dto.display_name,
        client_id: dto.client_id,
        encrypted_client_secret: encryptedSecret,
        issuer_url: dto.issuer_url,
        authorization_url: dto.authorization_url,
        token_url: dto.token_url,
        userinfo_url: dto.userinfo_url,
        scopes: dto.scopes || [],
        attribute_mapping: (dto.attribute_mapping || {}) as Prisma.InputJsonValue,
        auto_provision_users: dto.auto_provision_users ?? false,
        allowed_domains: dto.allowed_domains || [],
        is_active: false, // Must be explicitly activated
        created_by: createdBy,
      },
    });

    const { encrypted_client_secret, ...safe } = provider;
    return safe;
  }

  /**
   * Update an SSO provider configuration.
   */
  async updateProvider(id: string, dto: UpdateSsoProviderDto) {
    const existing = await this.prisma.ssoProvider.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('SSO provider not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.display_name !== undefined) data.display_name = dto.display_name;
    if (dto.client_id !== undefined) data.client_id = dto.client_id;
    if (dto.client_secret !== undefined) {
      data.encrypted_client_secret = dto.client_secret
        ? this.encryptSecret(dto.client_secret)
        : null;
    }
    if (dto.issuer_url !== undefined) data.issuer_url = dto.issuer_url;
    if (dto.authorization_url !== undefined) data.authorization_url = dto.authorization_url;
    if (dto.token_url !== undefined) data.token_url = dto.token_url;
    if (dto.userinfo_url !== undefined) data.userinfo_url = dto.userinfo_url;
    if (dto.scopes !== undefined) data.scopes = dto.scopes;
    if (dto.attribute_mapping !== undefined)
      data.attribute_mapping = dto.attribute_mapping as Prisma.InputJsonValue;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;
    if (dto.auto_provision_users !== undefined)
      data.auto_provision_users = dto.auto_provision_users;
    if (dto.allowed_domains !== undefined) data.allowed_domains = dto.allowed_domains;

    const updated = await this.prisma.ssoProvider.update({
      where: { id },
      data,
    });

    const { encrypted_client_secret, ...safe } = updated;
    return safe;
  }

  /**
   * Delete an SSO provider.
   */
  async deleteProvider(id: string) {
    const existing = await this.prisma.ssoProvider.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('SSO provider not found');
    }

    await this.prisma.ssoProvider.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Get active SSO providers (for login page display).
   */
  async getActiveProviders() {
    return this.prisma.ssoProvider.findMany({
      where: { is_active: true },
      select: {
        id: true,
        provider_type: true,
        display_name: true,
        allowed_domains: true,
      },
      orderBy: { display_name: 'asc' },
    });
  }

  // ── Encryption helpers ──

  private getEncryptionKey(): Buffer {
    const secret = (
      this.configService.get<string>('SSO_ENCRYPTION_KEY', '') ||
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', '') + '0'.repeat(32)
    ).substring(0, 32);
    return Buffer.from(secret, 'utf8');
  }

  private encryptSecret(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decryptSecret(encrypted: string): string {
    const key = this.getEncryptionKey();
    const data = Buffer.from(encrypted, 'base64');
    const iv = data.subarray(0, 16);
    const tag = data.subarray(16, 32);
    const ciphertext = data.subarray(32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }
}
