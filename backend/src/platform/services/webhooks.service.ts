import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../../common/tenant-context';
import { Prisma } from '../../../node_modules/.prisma/client-tenant';
import { createHmac, randomBytes } from 'crypto';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
} from '../dto';

@Injectable()
export class WebhooksService {
  constructor(private readonly tenant: TenantPrisma) {}

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
