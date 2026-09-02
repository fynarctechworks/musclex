import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { NotificationJobData } from '../queue.service';
import { reportJobFailure } from '../../common/sentry/report-job-failure';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { PushService } from '../../push/push.service';

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly push: PushService,
  ) {
    super();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    // ALWAYS log: reportJobFailure() is a no-op without SENTRY_DSN, so a
    // failing job would otherwise leave no trace anywhere.
    this.logger.error(
      `Job ${job?.id ?? '?'} FAILED (attempt ${job?.attemptsMade ?? 0}/${job?.opts?.attempts ?? 1}): ${err?.message}`,
    );
    reportJobFailure(QUEUE_NAMES.NOTIFICATION, job, err);
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { type, to, message } = job.data;
    this.logger.log(`Processing ${type} notification job ${job.id}: to=${to}`);

    switch (type) {
      case 'sms':
        await this.sendSms(job.data);
        break;
      case 'whatsapp':
        await this.sendWhatsApp(job.data);
        break;
      case 'push':
        await this.sendPush(job.data);
        break;
      default:
        this.logger.warn(`Unknown notification type: ${type}`);
    }
  }

  private async sendSms(data: NotificationJobData): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      this.logger.warn('Twilio not configured — SMS skipped');
      return;
    }

    // Dynamic import to avoid hard dependency
    const twilioModule = await import('twilio' as string);
    const createClient = twilioModule.default || twilioModule;
    const client = createClient(accountSid, authToken);
    await client.messages.create({
      body: data.message,
      from: fromNumber,
      to: data.to,
    });
    this.logger.log(`SMS sent to ${data.to}`);
  }

  private async sendWhatsApp(data: NotificationJobData): Promise<void> {
    // Central seam: per-gym Integration credentials (env fallback), audit row,
    // phone normalization. Throws on a configured-but-failed send so BullMQ retries.
    const result = await this.whatsapp.sendText({
      to: data.to,
      text: data.message,
      gymId: data.gymId,
      memberId: data.memberId,
      triggerType: data.triggerType ?? 'notification',
    });
    if (result.delivered) {
      this.logger.log(`WhatsApp message sent to ${data.to}`);
    }
  }

  private async sendPush(data: NotificationJobData): Promise<void> {
    // Member pushes ride the Expo Push API via the member's registered device
    // tokens. `to` is informational here — the member id is the target.
    if (!data.memberId) {
      this.logger.warn(`Push job without memberId (to=${data.to}) — dropped`);
      return;
    }
    const delivered = await this.push.sendToMember(
      data.memberId,
      { title: 'MuscleX', body: data.message, data: { triggerType: data.triggerType ?? 'notification' } },
      { gymId: data.gymId },
    );
    if (delivered > 0) this.logger.log(`Push sent to member ${data.memberId} (${delivered} devices)`);
  }
}
