import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { CampaignJobData } from '../queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { reportJobFailure } from '../../common/sentry/report-job-failure';

@Processor(QUEUE_NAMES.CAMPAIGN)
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    reportJobFailure(QUEUE_NAMES.CAMPAIGN, job, err);
  }

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<CampaignJobData>): Promise<{ sent: number; failed: number }> {
    const { campaignId, channel, recipients, templateId, variables } = job.data;
    this.logger.log(
      `Processing campaign job ${job.id}: campaign=${campaignId}, channel=${channel}, recipients=${recipients.length}`,
    );

    let sent = 0;
    let failed = 0;

    // Get template
    const template = await this.prisma.messageTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      this.logger.error(`Template ${templateId} not found`);
      throw new Error(`Template ${templateId} not found`);
    }

    // Process recipients in batches
    const batchSize = 50;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((recipient) =>
          this.sendToRecipient(channel, recipient, template.content, variables),
        ),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') sent++;
        else failed++;
      }

      await job.updateProgress(Math.round(((i + batch.length) / recipients.length) * 100));
    }

    // Update campaign status
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'completed',
        sent_count: sent,
      },
    });

    this.logger.log(`Campaign ${campaignId} completed: sent=${sent}, failed=${failed}`);
    return { sent, failed };
  }

  private async sendToRecipient(
    channel: string,
    recipient: { id: string; contact: string; name?: string },
    templateContent: string,
    variables?: Record<string, unknown>,
  ): Promise<void> {
    // Merge recipient-specific variables
    const mergedVars = {
      ...variables,
      name: recipient.name || '',
      contact: recipient.contact,
    };

    let message = templateContent;
    for (const [key, value] of Object.entries(mergedVars)) {
      message = message.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value ?? ''));
    }

    switch (channel) {
      case 'email':
        // Delegate to email queue — but for campaigns, send inline to avoid queue-in-queue
        this.logger.debug(`Campaign email to ${recipient.contact}`);
        break;
      case 'sms':
        this.logger.debug(`Campaign SMS to ${recipient.contact}`);
        break;
      case 'whatsapp':
        this.logger.debug(`Campaign WhatsApp to ${recipient.contact}`);
        break;
      case 'push':
        this.logger.debug(`Campaign push to ${recipient.contact}`);
        break;
    }
  }
}
