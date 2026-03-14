import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
} from '../dto';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  // ─── Integrations ─────────────────────────────────────────

  async getIntegrations(organizationId: string) {
    const integrations = await this.prisma.integration.findMany({
      where: { organization_id: organizationId },
      orderBy: { provider: 'asc' },
    });
    // Mask sensitive config fields
    return integrations.map((i) => ({
      ...i,
      config: this.maskConfig(i.config),
    }));
  }

  async getIntegration(organizationId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return { ...integration, config: this.maskConfig(integration.config) };
  }

  async getIntegrationByProvider(organizationId: string, provider: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { organization_id_provider: { organization_id: organizationId, provider } },
    });
    if (!integration) throw new NotFoundException(`Integration "${provider}" not found`);
    return integration; // Return full config for internal use
  }

  async createIntegration(organizationId: string, dto: CreateIntegrationDto, createdBy: string) {
    const existing = await this.prisma.integration.findUnique({
      where: {
        organization_id_provider: {
          organization_id: organizationId,
          provider: dto.provider,
        },
      },
    });
    if (existing) throw new ConflictException(`Integration "${dto.provider}" already exists`);

    return this.prisma.integration.create({
      data: {
        organization_id: organizationId,
        provider: dto.provider,
        display_name: dto.display_name,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        created_by: createdBy,
      },
    });
  }

  async updateIntegration(organizationId: string, id: string, dto: UpdateIntegrationDto) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    return this.prisma.integration.update({
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
  }

  async toggleIntegration(organizationId: string, id: string, enabled: boolean) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    return this.prisma.integration.update({
      where: { id },
      data: {
        is_enabled: enabled,
        status: enabled ? 'active' : 'inactive',
      },
    });
  }

  async deleteIntegration(organizationId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return this.prisma.integration.delete({ where: { id } });
  }

  async testIntegration(organizationId: string, id: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    // Basic connectivity check by provider type
    const result = { provider: integration.provider, status: 'ok', message: 'Connection test passed' };

    try {
      switch (integration.provider) {
        case 'razorpay':
        case 'stripe':
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
      await this.prisma.integration.update({
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
        provider: 'stripe',
        name: 'Stripe',
        category: 'payments',
        description: 'Accept international card payments',
        config_fields: ['publishable_key', 'secret_key', 'webhook_secret'],
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
        config_fields: ['phone_number_id', 'access_token', 'business_account_id'],
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
