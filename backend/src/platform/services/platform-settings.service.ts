import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../../common/tenant-context';
import { Prisma } from '../../../node_modules/.prisma/client-tenant';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  UpdateWhiteLabelDto,
  CreateSsoProviderDto,
  UpdateSsoProviderDto,
  CreateSystemNotificationDto,
} from '../dto';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly tenant: TenantPrisma) {}

  // ─── Feature Flags ────────────────────────────────────────

  async getFeatureFlags(organizationId: string) {
    return this.tenant.client.featureFlag.findMany({
      where: { organization_id: organizationId },
      orderBy: { key: 'asc' },
    });
  }

  async getFeatureFlag(organizationId: string, key: string) {
    const flag = await this.tenant.client.featureFlag.findUnique({
      where: { organization_id_key: { organization_id: organizationId, key } },
    });
    if (!flag) throw new NotFoundException(`Feature flag "${key}" not found`);
    return flag;
  }

  async isFeatureEnabled(organizationId: string, key: string): Promise<boolean> {
    const flag = await this.tenant.client.featureFlag.findUnique({
      where: { organization_id_key: { organization_id: organizationId, key } },
    });
    return flag?.is_enabled ?? false;
  }

  async createFeatureFlag(organizationId: string, dto: CreateFeatureFlagDto) {
    const existing = await this.tenant.client.featureFlag.findUnique({
      where: { organization_id_key: { organization_id: organizationId, key: dto.key } },
    });
    if (existing) throw new ConflictException(`Feature flag "${dto.key}" already exists`);

    return this.tenant.client.featureFlag.create({
      data: {
        gym_id: getTenantGymId()!,
        organization_id: organizationId,
        key: dto.key,
        is_enabled: dto.is_enabled ?? false,
        description: dto.description,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async updateFeatureFlag(organizationId: string, key: string, dto: UpdateFeatureFlagDto) {
    await this.getFeatureFlag(organizationId, key);
    return this.tenant.client.featureFlag.update({
      where: { organization_id_key: { organization_id: organizationId, key } },
      data: {
        is_enabled: dto.is_enabled,
        description: dto.description,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async bulkToggleFlags(organizationId: string, flags: Record<string, boolean>) {
    const operations = Object.entries(flags).map(([key, is_enabled]) =>
      this.tenant.client.featureFlag.upsert({
        where: { organization_id_key: { organization_id: organizationId, key } },
        update: { is_enabled },
        create: { gym_id: getTenantGymId()!, organization_id: organizationId, key, is_enabled },
      }),
    );
    return this.tenant.client.$transaction(operations);
  }

  async deleteFeatureFlag(organizationId: string, key: string) {
    await this.getFeatureFlag(organizationId, key);
    return this.tenant.client.featureFlag.delete({
      where: { organization_id_key: { organization_id: organizationId, key } },
    });
  }

  // ─── White Label ──────────────────────────────────────────

  async getWhiteLabelConfig(organizationId: string) {
    let config = await this.tenant.client.whiteLabelConfig.findUnique({
      where: { organization_id: organizationId },
    });
    if (!config) {
      config = await this.tenant.client.whiteLabelConfig.create({
        data: { gym_id: getTenantGymId()!, organization_id: organizationId },
      });
    }
    return config;
  }

  async updateWhiteLabelConfig(organizationId: string, dto: UpdateWhiteLabelDto) {
    return this.tenant.client.whiteLabelConfig.upsert({
      where: { organization_id: organizationId },
      update: {
        custom_domain: dto.custom_domain,
        logo_url: dto.logo_url,
        favicon_url: dto.favicon_url,
        primary_color: dto.primary_color,
        secondary_color: dto.secondary_color,
        accent_color: dto.accent_color,
        font_family: dto.font_family,
        email_from_name: dto.email_from_name,
        email_from_address: dto.email_from_address,
        support_email: dto.support_email,
        support_url: dto.support_url,
        terms_url: dto.terms_url,
        privacy_url: dto.privacy_url,
        is_active: dto.is_active,
      },
      create: {
        gym_id: getTenantGymId()!,
        organization_id: organizationId,
        custom_domain: dto.custom_domain,
        logo_url: dto.logo_url,
        favicon_url: dto.favicon_url,
        primary_color: dto.primary_color ?? '#4A9FD4',
        secondary_color: dto.secondary_color ?? '#1A2F45',
        accent_color: dto.accent_color ?? '#6BBFE8',
        font_family: dto.font_family ?? 'Inter',
        email_from_name: dto.email_from_name,
        email_from_address: dto.email_from_address,
        support_email: dto.support_email,
        support_url: dto.support_url,
        terms_url: dto.terms_url,
        privacy_url: dto.privacy_url,
        is_active: dto.is_active ?? false,
      },
    });
  }

  // ─── SSO Providers ────────────────────────────────────────

  async getSsoProviders() {
    return this.tenant.client.ssoProvider.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        provider_type: true,
        display_name: true,
        issuer_url: true,
        scopes: true,
        is_active: true,
        auto_provision_users: true,
        allowed_domains: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async getSsoProvider(id: string) {
    const provider = await this.tenant.client.ssoProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('SSO provider not found');
    // Mask secret
    return { ...provider, encrypted_client_secret: provider.encrypted_client_secret ? '••••••••' : null };
  }

  async createSsoProvider(dto: CreateSsoProviderDto, createdBy: string) {
    return this.tenant.client.ssoProvider.create({
      data: {
        gym_id: getTenantGymId()!,
        provider_type: dto.provider_type,
        display_name: dto.display_name,
        client_id: dto.client_id,
        encrypted_client_secret: dto.encrypted_client_secret,
        issuer_url: dto.issuer_url,
        authorization_url: dto.authorization_url,
        token_url: dto.token_url,
        userinfo_url: dto.userinfo_url,
        scopes: dto.scopes ?? [],
        attribute_mapping: (dto.attribute_mapping ?? {}) as Prisma.InputJsonValue,
        is_active: dto.is_active ?? false,
        auto_provision_users: dto.auto_provision_users ?? false,
        allowed_domains: dto.allowed_domains ?? [],
        created_by: createdBy,
      },
    });
  }

  async updateSsoProvider(id: string, dto: UpdateSsoProviderDto) {
    await this.getSsoProvider(id);
    return this.tenant.client.ssoProvider.update({
      where: { id },
      data: {
        display_name: dto.display_name,
        client_id: dto.client_id,
        encrypted_client_secret: dto.encrypted_client_secret,
        issuer_url: dto.issuer_url,
        authorization_url: dto.authorization_url,
        token_url: dto.token_url,
        userinfo_url: dto.userinfo_url,
        scopes: dto.scopes,
        attribute_mapping: dto.attribute_mapping as Prisma.InputJsonValue | undefined,
        is_active: dto.is_active,
        auto_provision_users: dto.auto_provision_users,
        allowed_domains: dto.allowed_domains,
      },
    });
  }

  async deleteSsoProvider(id: string) {
    await this.getSsoProvider(id);
    return this.tenant.client.ssoProvider.delete({ where: { id } });
  }

  // ─── System Notifications ─────────────────────────────────

  async getNotifications(organizationId: string, unreadOnly?: boolean) {
    const where: Prisma.SystemNotificationWhereInput = {
      organization_id: organizationId,
    };
    if (unreadOnly) {
      where.is_read = false;
    }
    return this.tenant.client.systemNotification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(organizationId: string): Promise<number> {
    return this.tenant.client.systemNotification.count({
      where: { organization_id: organizationId, is_read: false },
    });
  }

  async createNotification(organizationId: string, dto: CreateSystemNotificationDto) {
    return this.tenant.client.systemNotification.create({
      data: {
        gym_id: getTenantGymId()!,
        organization_id: organizationId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        action_url: dto.action_url,
        expires_at: dto.expires_at ? new Date(dto.expires_at) : undefined,
      },
    });
  }

  async markAsRead(organizationId: string, notificationId: string) {
    const notification = await this.tenant.client.systemNotification.findFirst({
      where: { id: notificationId, organization_id: organizationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.tenant.client.systemNotification.update({
      where: { id: notificationId },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async markAllAsRead(organizationId: string) {
    return this.tenant.client.systemNotification.updateMany({
      where: { organization_id: organizationId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
  }

  // ─── Platform Overview ────────────────────────────────────

  async getPlatformOverview(organizationId: string) {
    const [
      org,
      settings,
      featureFlags,
      whiteLabelConfig,
      integrations,
      webhooks,
      ssoProviders,
      unreadNotifications,
    ] = await Promise.all([
      this.tenant.client.organization.findUnique({ where: { id: organizationId } }),
      this.tenant.client.organizationSettings.findUnique({
        where: { organization_id: organizationId },
      }),
      this.tenant.client.featureFlag.count({ where: { organization_id: organizationId } }),
      this.tenant.client.whiteLabelConfig.findUnique({
        where: { organization_id: organizationId },
      }),
      this.tenant.client.integration.count({
        where: { organization_id: organizationId, is_enabled: true },
      }),
      this.tenant.client.webhook.count({
        where: { organization_id: organizationId, is_active: true },
      }),
      this.tenant.client.ssoProvider.count({ where: { is_active: true } }),
      this.tenant.client.systemNotification.count({
        where: { organization_id: organizationId, is_read: false },
      }),
    ]);

    return {
      organization: {
        id: org?.id,
        name: org?.name,
        timezone: org?.timezone,
        currency: org?.currency,
        status: org?.status,
      },
      settings: {
        default_timezone: settings?.default_timezone,
        default_currency: settings?.default_currency,
        billing_plan: settings?.billing_plan,
      },
      counts: {
        feature_flags: featureFlags,
        active_integrations: integrations,
        active_webhooks: webhooks,
        sso_providers: ssoProviders,
        unread_notifications: unreadNotifications,
      },
      white_label: {
        is_active: whiteLabelConfig?.is_active ?? false,
        custom_domain: whiteLabelConfig?.custom_domain,
      },
    };
  }
}
