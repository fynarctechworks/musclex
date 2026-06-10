import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { QUEUE_NAMES } from '../queue.module';
import { WebhookJobData } from '../queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantGymId } from '../../common/tenant-context';
import { Prisma } from '@prisma/client';
import { reportJobFailure } from '../../common/sentry/report-job-failure';

@Processor(QUEUE_NAMES.WEBHOOK)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    reportJobFailure(QUEUE_NAMES.WEBHOOK, job, err);
  }

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { webhookId, event, payload } = job.data;
    this.logger.log(`Processing webhook job ${job.id}: event=${event}, webhookId=${webhookId}`);

    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook || !webhook.is_active) {
      this.logger.warn(`Webhook ${webhookId} not found or inactive — skipping`);
      return;
    }

    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    });
    const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

    // Create delivery record
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        gym_id: getTenantGymId()!,
        webhook_id: webhookId,
        event,
        payload: payload as Prisma.InputJsonValue,
        status: 'pending',
        attempt: job.attemptsMade + 1,
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
          'X-Webhook-Attempt': String(job.attemptsMade + 1),
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseBody = await response.text().catch(() => '');

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: response.ok ? 'delivered' : 'failed',
          response_status: response.status,
          response_body: responseBody.substring(0, 1000),
          delivered_at: response.ok ? new Date() : undefined,
        },
      });

      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: {
          last_triggered_at: new Date(),
          failure_count: response.ok ? 0 : { increment: 1 },
        },
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${responseBody.substring(0, 200)}`);
      }

      this.logger.log(`Webhook delivery ${delivery.id} succeeded`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'failed', response_body: message },
      });
      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: { failure_count: { increment: 1 }, last_triggered_at: new Date() },
      });
      this.logger.error(`Webhook delivery ${delivery.id} failed: ${message}`);
      throw error; // Let BullMQ handle retries
    }
  }
}
