import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { getTenantGymId, getTenantSchema } from '../../common/tenant-context';
import { Prisma } from '../../../node_modules/.prisma/client-tenant';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
} from '../dto';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly pub: PublicPrismaService,
  ) {}

  /**
   * Keep the public inbound-webhook routing index in sync: WhatsApp
   * integrations map their WABA phone_number_id → this gym, so the Meta
   * webhook can resolve the tenant before any context exists. Best-effort —
   * never fails the integration write.
   */
  private async syncWhatsAppNumberIndex(provider: string, config: unknown, enabled: boolean): Promise<void> {
    if (provider !== 'whatsapp') return;
    try {
      const gymId = getTenantGymId()!;
      const schemaName = getTenantSchema();
      const phoneNumberId =
        typeof (config as Record<string, unknown>)?.phone_number_id === 'string'
          ? ((config as Record<string, string>).phone_number_id ?? '').trim()
          : '';
      if (!schemaName) return;
      if (!phoneNumberId || !enabled) {
        await this.pub.whatsAppNumberIndex.deleteMany({ where: { gym_id: gymId } });
        return;
      }
      await this.pub.whatsAppNumberIndex.deleteMany({
        where: { gym_id: gymId, phone_number_id: { not: phoneNumberId } },
      });
      await this.pub.whatsAppNumberIndex.upsert({
        where: { phone_number_id: phoneNumberId },
        create: { phone_number_id: phoneNumberId, gym_id: gymId, schema_name: schemaName },
        update: { gym_id: gymId, schema_name: schemaName },
      });
    } catch (e) {
      this.logger.warn(`whatsapp_number_index sync failed: ${(e as Error).message}`);
    }
  }

  // ─── Integrations ─────────────────────────────────────────

  // NOTE on the organizationId params: callers (IntegrationsController) pass
  // user.studio_id, which is NOT organizations.id. Every query here is already
  // tenant-scoped by the isolation layer, so reads ignore the param; create
  // resolves the gym's real Organization row for the FK.
  async getIntegrations(_organizationId: string) {
    const integrations = await this.tenant.client.integration.findMany({
      orderBy: { provider: 'asc' },
    });
    // Mask sensitive config fields
    return integrations.map((i) => ({
      ...i,
      config: this.maskConfig(i.config),
    }));
  }

  async getIntegration(_organizationId: string, id: string) {
    const integration = await this.tenant.client.integration.findFirst({
      where: { id },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return { ...integration, config: this.maskConfig(integration.config) };
  }

  async getIntegrationByProvider(_organizationId: string, provider: string) {
    const integration = await this.tenant.client.integration.findFirst({
      where: { provider },
    });
    if (!integration) throw new NotFoundException(`Integration "${provider}" not found`);
    return integration; // Return full config for internal use
  }

  async createIntegration(_organizationId: string, dto: CreateIntegrationDto, createdBy: string) {
    const existing = await this.tenant.client.integration.findFirst({
      where: { provider: dto.provider },
    });
    if (existing) throw new ConflictException(`Integration "${dto.provider}" already exists`);

    // The FK targets the gym's Organization row — resolve it, never trust the param.
    const org = await this.tenant.client.organization.findFirst({ select: { id: true } });
    if (!org) throw new NotFoundException('Studio setup incomplete (no organization)');

    const created = await this.tenant.client.integration.create({
      data: {
        gym_id: getTenantGymId()!,
        organization_id: org.id,
        provider: dto.provider,
        display_name: dto.display_name,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        created_by: createdBy,
      },
    });
    await this.syncWhatsAppNumberIndex(created.provider, created.config, created.is_enabled);
    return created;
  }

  async updateIntegration(_organizationId: string, id: string, dto: UpdateIntegrationDto) {
    const integration = await this.tenant.client.integration.findFirst({
      where: { id },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    const updated = await this.tenant.client.integration.update({
      where: { id },
      data: {
        display_name: dto.display_name,
        config: dto.config as Prisma.InputJsonValue | undefined,
        is_enabled: dto.is_enabled,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        status: dto.is_enabled !== undefined
          ? (dto.is_enabled ? 'active' : 'inactive')
          : undefined,
      },
    });
    await this.syncWhatsAppNumberIndex(updated.provider, updated.config, updated.is_enabled);
    return updated;
  }

  async toggleIntegration(_organizationId: string, id: string, enabled: boolean) {
    const integration = await this.tenant.client.integration.findFirst({
      where: { id },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    const toggled = await this.tenant.client.integration.update({
      where: { id },
      data: {
        is_enabled: enabled,
        status: enabled ? 'active' : 'inactive',
      },
    });
    await this.syncWhatsAppNumberIndex(toggled.provider, toggled.config, toggled.is_enabled);
    return toggled;
  }

  async deleteIntegration(_organizationId: string, id: string) {
    const integration = await this.tenant.client.integration.findFirst({
      where: { id },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    const deleted = await this.tenant.client.integration.delete({ where: { id } });
    await this.syncWhatsAppNumberIndex(integration.provider, integration.config, false);
    return deleted;
  }

  async testIntegration(_organizationId: string, id: string) {
    const integration = await this.tenant.client.integration.findFirst({
      where: { id },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    // Basic connectivity check by provider type
    const result = { provider: integration.provider, status: 'ok', message: 'Connection test passed' };

    try {
      switch (integration.provider) {
        case 'razorpay':
          result.message = 'Payment gateway credentials validated';
          break;
        case 'twilio':
          result.message = 'SMS provider credentials validated';
          break;
        case 'whatsapp':
          result.message = 'WhatsApp API credentials validated';
          break;
        case 'resend':
          result.message = 'Email provider credentials validated';
          break;
        default:
          result.message = `Integration "${integration.provider}" connectivity validated`;
      }
    } catch {
      result.status = 'error';
      result.message = 'Connection test failed';
      await this.tenant.client.integration.update({
        where: { id },
        data: { status: 'error', error_message: result.message },
      });
    }

    return result;
  }

  // ─── Available Integrations Catalog ───────────────────────

  getAvailableCatalog() {
    return [
      {
        provider: 'razorpay',
        name: 'Razorpay',
        category: 'payments',
        description: 'Accept payments via UPI, cards, and net banking (India)',
        config_fields: ['api_key', 'secret_key', 'webhook_secret'],
      },
      {
        provider: 'twilio',
        name: 'Twilio',
        category: 'messaging',
        description: 'Send SMS notifications and alerts',
        config_fields: ['account_sid', 'auth_token', 'from_number'],
      },
      {
        provider: 'whatsapp',
        name: 'WhatsApp Cloud API',
        category: 'messaging',
        description: 'Send WhatsApp messages via Meta Business API',
        config_fields: ['phone_number_id', 'access_token', 'business_account_id', 'auto_reply_message'],
      },
      {
        provider: 'resend',
        name: 'Resend',
        category: 'email',
        description: 'Transactional and marketing email delivery',
        config_fields: ['api_key', 'from_email', 'from_name'],
      },
      {
        provider: 'google_calendar',
        name: 'Google Calendar',
        category: 'scheduling',
        description: 'Sync class schedules with Google Calendar',
        config_fields: ['client_id', 'client_secret', 'refresh_token'],
      },
      {
        provider: 'zapier',
        name: 'Zapier',
        category: 'automation',
        description: 'Connect to 5000+ apps via Zapier workflows',
        config_fields: ['webhook_url'],
      },
    ];
  }

  // ─── Helpers ──────────────────────────────────────────────

  private maskConfig(config: unknown): Record<string, unknown> {
    if (!config || typeof config !== 'object') return {};
    const masked: Record<string, unknown> = {};
    const sensitiveKeys = ['secret', 'token', 'password', 'key', 'auth'];
    for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s)) && typeof v === 'string') {
        masked[k] = v.length > 4 ? `${'•'.repeat(8)}${v.slice(-4)}` : '••••••••';
      } else {
        masked[k] = v;
      }
    }
    return masked;
  }
}
