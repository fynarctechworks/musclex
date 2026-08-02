import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../../common/tenant-context';
import { Prisma } from '../../../node_modules/.prisma/client-tenant';
import { createHmac, randomBytes } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
} from '../dto';

@Injectable()
export class WebhooksService {
  constructor(private readonly tenant: TenantPrisma) {}

  // ─── SSRF guard ───────────────────────────────────────────
  // Tenant-supplied webhook URLs are fetched server-side and their response body
  // is stored and readable, so an unguarded fetch is a classic SSRF: a tenant
  // could point a webhook at 127.0.0.1, 169.254.169.254 (cloud metadata), or an
  // internal service and read the reply. We require http(s) and reject any URL
  // whose host resolves to a private / loopback / link-local / reserved address.

  private isPrivateIp(ip: string): boolean {
    const low = ip.toLowerCase();
    if (low.includes(':')) {
      // IPv6
      if (low === '::1' || low === '::') return true;
      if (low.startsWith('fc') || low.startsWith('fd')) return true; // unique-local
      if (low.startsWith('fe80')) return true; // link-local
      const mapped = low.startsWith('::ffff:') ? low.slice(7) : null;
      return mapped && isIP(mapped) === 4 ? this.isPrivateIp(mapped) : false;
    }
    const p = low.split('.').map((n) => Number(n));
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // unparseable → treat as unsafe
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  /** Reject non-http(s) schemes and any host that resolves to a non-public address. */
  private async assertPublicWebhookUrl(rawUrl: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new BadRequestException('Webhook URL must use http or https');
    }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
      throw new ForbiddenException('Webhook URL host is not permitted');
    }
    const addresses = isIP(host)
      ? [host]
      : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
    if (addresses.length === 0) {
      throw new BadRequestException('Webhook host could not be resolved');
    }
    if (addresses.some((ip) => this.isPrivateIp(ip))) {
      throw new ForbiddenException('Webhook URL resolves to a private or reserved address');
    }
  }

  // ─── Supported Events ─────────────────────────────────────

  getSupportedEvents(): string[] {
    return [
      'member.created',
      'member.updated',
      'member.deleted',
      'member.plan_assigned',
      'member.plan_expired',
      'checkin.completed',
      'checkin.failed',
      'payment.received',
      'payment.failed',
      'payment.refunded',
      'class.booked',
      'class.cancelled',
      'class.completed',
      'invoice.created',
      'invoice.paid',
      'staff.created',
      'staff.updated',
      'lead.created',
      'lead.converted',
      'campaign.sent',
      'campaign.completed',
    ];
  }

  // ─── Webhook CRUD ─────────────────────────────────────────

  async getWebhooks(organizationId: string) {
    return this.tenant.client.webhook.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        is_active: true,
        retry_count: true,
        timeout_ms: true,
        failure_count: true,
        last_triggered_at: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async getWebhook(organizationId: string, id: string) {
    const webhook = await this.tenant.client.webhook.findFirst({
      where: { id, organization_id: organizationId },
      include: {
        deliveries: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    // Mask secret
    return { ...webhook, secret: '••••••••' };
  }

  async createWebhook(organizationId: string, dto: CreateWebhookDto, createdBy: string) {
    const secret = randomBytes(32).toString('hex');

    const webhook = await this.tenant.client.webhook.create({
      data: {
        gym_id: getTenantGymId()!,
        organization_id: organizationId,
        name: dto.name,
        url: dto.url,
        secret,
        events: dto.events,
        retry_count: dto.retry_count ?? 3,
        timeout_ms: dto.timeout_ms ?? 5000,
        created_by: createdBy,
      },
    });

    // Return secret only on creation (like API keys)
    return { ...webhook, secret };
  }

  async updateWebhook(organizationId: string, id: string, dto: UpdateWebhookDto) {
    const webhook = await this.tenant.client.webhook.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');

    return this.tenant.client.webhook.update({
      where: { id },
      data: {
        name: dto.name,
        url: dto.url,
        events: dto.events,
        is_active: dto.is_active,
        retry_count: dto.retry_count,
        timeout_ms: dto.timeout_ms,
      },
    });
  }

  async deleteWebhook(organizationId: string, id: string) {
    const webhook = await this.tenant.client.webhook.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return this.tenant.client.webhook.delete({ where: { id } });
  }

  async rotateSecret(organizationId: string, id: string) {
    const webhook = await this.tenant.client.webhook.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');

    const newSecret = randomBytes(32).toString('hex');
    await this.tenant.client.webhook.update({
      where: { id },
      data: { secret: newSecret },
    });

    return { id, secret: newSecret };
  }

  // ─── Webhook Delivery ─────────────────────────────────────

  async getDeliveries(organizationId: string, webhookId: string, limit = 50) {
    const webhook = await this.tenant.client.webhook.findFirst({
      where: { id: webhookId, organization_id: organizationId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');

    return this.tenant.client.webhookDelivery.findMany({
      where: { webhook_id: webhookId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async retryDelivery(organizationId: string, deliveryId: string) {
    const delivery = await this.tenant.client.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });
    if (!delivery || delivery.webhook.organization_id !== organizationId) {
      throw new NotFoundException('Delivery not found');
    }

    // Reset delivery for retry
    await this.tenant.client.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'pending',
        attempt: delivery.attempt + 1,
        response_status: null,
        response_body: null,
      },
    });

    // Trigger delivery (in production, this would use a job queue)
    await this.dispatchDelivery(delivery.webhook_id, delivery.event, delivery.payload);

    return { message: 'Retry queued' };
  }

  // ─── Webhook Dispatch (called by other modules) ───────────

  async dispatch(organizationId: string, event: string, payload: Record<string, unknown>) {
    const webhooks = await this.tenant.client.webhook.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
        events: { has: event },
      },
    });

    const results = await Promise.allSettled(
      webhooks.map((webhook) => this.dispatchDelivery(webhook.id, event, payload)),
    );

    return {
      event,
      dispatched: webhooks.length,
      succeeded: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }

  /**
   * Dispatch an event to every active subscribed webhook in the current gym,
   * resolving the owning organization from the branch when one is known.
   * Branch-less events (gym-wide) go to all of the gym's webhooks — the
   * tenant client already scopes the query to this gym.
   */
  async dispatchEvent(event: string, payload: Record<string, unknown>, branchId?: string | null) {
    let organizationId: string | undefined;
    if (branchId) {
      const branch = await this.tenant.client.branch.findUnique({
        where: { id: branchId },
        select: { organization_id: true },
      });
      organizationId = branch?.organization_id ?? undefined;
    }

    const webhooks = await this.tenant.client.webhook.findMany({
      where: {
        is_active: true,
        events: { has: event },
        ...(organizationId ? { organization_id: organizationId } : {}),
      },
      select: { id: true },
    });
    if (webhooks.length === 0) return { event, dispatched: 0, succeeded: 0, failed: 0 };

    const results = await Promise.allSettled(
      webhooks.map((webhook) => this.dispatchDelivery(webhook.id, event, payload)),
    );

    return {
      event,
      dispatched: webhooks.length,
      succeeded: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }

  private async dispatchDelivery(webhookId: string, event: string, payload: unknown) {
    const webhook = await this.tenant.client.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) return;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

    const delivery = await this.tenant.client.webhookDelivery.create({
      data: {
        gym_id: getTenantGymId()!,
        webhook_id: webhookId,
        event,
        payload: payload as Prisma.InputJsonValue,
        status: 'pending',
      },
    });

    try {
      // SSRF guard: never fetch a URL that resolves to an internal address.
      await this.assertPublicWebhookUrl(webhook.url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeout_ms);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-Id': delivery.id,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text().catch(() => '');

      await this.tenant.client.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: response.ok ? 'delivered' : 'failed',
          response_status: response.status,
          response_body: responseBody.substring(0, 1000), // Cap response storage
          delivered_at: response.ok ? new Date() : undefined,
        },
      });

      await this.tenant.client.webhook.update({
        where: { id: webhookId },
        data: {
          last_triggered_at: new Date(),
          failure_count: response.ok ? 0 : { increment: 1 },
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.tenant.client.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          response_body: errorMessage,
        },
      });

      await this.tenant.client.webhook.update({
        where: { id: webhookId },
        data: {
          failure_count: { increment: 1 },
          last_triggered_at: new Date(),
        },
      });
    }
  }
}
