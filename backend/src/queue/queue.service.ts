import { Injectable, Logger, Optional } from '@nestjs/common';
import { QUEUE_NAMES } from './queue.module';

// Re-export interfaces for consumers
export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  variables: Record<string, unknown>;
  organizationId?: string;
}

export interface WebhookJobData {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  organizationId: string;
}

export interface NotificationJobData {
  type: 'sms' | 'whatsapp' | 'push';
  to: string;
  message: string;
  templateId?: string;
  variables?: Record<string, unknown>;
  organizationId?: string;
}

export interface ReportJobData {
  type: 'revenue' | 'members' | 'attendance' | 'classes' | 'staff' | 'custom';
  organizationId: string;
  branchId?: string;
  dateFrom: string;
  dateTo: string;
  format: 'pdf' | 'csv' | 'xlsx';
  requestedBy: string;
}

export interface CampaignJobData {
  campaignId: string;
  organizationId: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  recipients: Array<{ id: string; contact: string; name?: string }>;
  templateId: string;
  variables?: Record<string, unknown>;
}

interface JobResult {
  id: string;
  queued: boolean;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly redisEnabled: boolean;
  private emailQueue: any;
  private webhookQueue: any;
  private notificationQueue: any;
  private reportQueue: any;
  private campaignQueue: any;

  constructor() {
    this.redisEnabled = process.env.ENABLE_REDIS === 'true';
    if (!this.redisEnabled) {
      this.logger.warn('QueueService running in log-only mode (no Redis). Jobs will not be processed.');
    }
  }

  /** Called by QueueModule when Redis is enabled to inject real queues */
  setQueues(queues: Record<string, any>) {
    this.emailQueue = queues[QUEUE_NAMES.EMAIL];
    this.webhookQueue = queues[QUEUE_NAMES.WEBHOOK];
    this.notificationQueue = queues[QUEUE_NAMES.NOTIFICATION];
    this.reportQueue = queues[QUEUE_NAMES.REPORT];
    this.campaignQueue = queues[QUEUE_NAMES.CAMPAIGN];
  }

  get isRedisEnabled(): boolean {
    return this.redisEnabled;
  }

  async enqueueEmail(data: EmailJobData, opts?: any): Promise<JobResult> {
    if (!this.redisEnabled || !this.emailQueue) {
      this.logger.log(`[DRY-RUN] Email job: to=${data.to}, subject=${data.subject}`);
      return { id: `dry-${Date.now()}`, queued: false };
    }
    const job = await this.emailQueue.add('send', data, { priority: 2, ...opts });
    this.logger.debug(`Enqueued email job ${job.id} to ${data.to}`);
    return { id: job.id, queued: true };
  }

  async enqueueWebhook(data: WebhookJobData, opts?: any): Promise<JobResult> {
    if (!this.redisEnabled || !this.webhookQueue) {
      this.logger.log(`[DRY-RUN] Webhook job: event=${data.event}, webhookId=${data.webhookId}`);
      return { id: `dry-${Date.now()}`, queued: false };
    }
    const job = await this.webhookQueue.add('deliver', data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      ...opts,
    });
    this.logger.debug(`Enqueued webhook job ${job.id} for event ${data.event}`);
    return { id: job.id, queued: true };
  }

  async enqueueNotification(data: NotificationJobData, opts?: any): Promise<JobResult> {
    if (!this.redisEnabled || !this.notificationQueue) {
      this.logger.log(`[DRY-RUN] ${data.type} notification: to=${data.to}`);
      return { id: `dry-${Date.now()}`, queued: false };
    }
    const job = await this.notificationQueue.add(data.type, data, { priority: 1, ...opts });
    this.logger.debug(`Enqueued ${data.type} notification job ${job.id}`);
    return { id: job.id, queued: true };
  }

  async enqueueReport(data: ReportJobData, opts?: any): Promise<JobResult> {
    if (!this.redisEnabled || !this.reportQueue) {
      this.logger.log(`[DRY-RUN] Report job: type=${data.type}, format=${data.format}`);
      return { id: `dry-${Date.now()}`, queued: false };
    }
    const job = await this.reportQueue.add('generate', data, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 10000 },
      ...opts,
    });
    this.logger.debug(`Enqueued report job ${job.id} type=${data.type}`);
    return { id: job.id, queued: true };
  }

  async enqueueCampaign(data: CampaignJobData, opts?: any): Promise<JobResult> {
    if (!this.redisEnabled || !this.campaignQueue) {
      this.logger.log(`[DRY-RUN] Campaign job: id=${data.campaignId}, channel=${data.channel}`);
      return { id: `dry-${Date.now()}`, queued: false };
    }
    const job = await this.campaignQueue.add('execute', data, { attempts: 3, ...opts });
    this.logger.debug(`Enqueued campaign job ${job.id} id=${data.campaignId}`);
    return { id: job.id, queued: true };
  }

  async getAllQueueStats(): Promise<any[]> {
    if (!this.redisEnabled) {
      return Object.values(QUEUE_NAMES).map((name) => ({
        queue: name,
        status: 'disabled',
        reason: 'Redis not enabled',
      }));
    }

    const queues = {
      [QUEUE_NAMES.EMAIL]: this.emailQueue,
      [QUEUE_NAMES.WEBHOOK]: this.webhookQueue,
      [QUEUE_NAMES.NOTIFICATION]: this.notificationQueue,
      [QUEUE_NAMES.REPORT]: this.reportQueue,
      [QUEUE_NAMES.CAMPAIGN]: this.campaignQueue,
    };

    const stats = await Promise.all(
      Object.entries(queues).map(async ([name, queue]) => {
        if (!queue) return { queue: name, status: 'unavailable' };
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);
        return { queue: name, waiting, active, completed, failed, delayed };
      }),
    );
    return stats;
  }
}
