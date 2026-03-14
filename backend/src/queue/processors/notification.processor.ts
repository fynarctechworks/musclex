import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { NotificationJobData } from '../queue.service';

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

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
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      this.logger.warn('WhatsApp not configured — message skipped');
      return;
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: data.to,
          type: 'text',
          text: { body: data.message },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`WhatsApp API error: ${response.status} ${error}`);
    }

    this.logger.log(`WhatsApp message sent to ${data.to}`);
  }

  private async sendPush(data: NotificationJobData): Promise<void> {
    // Push notification via web push or FCM — stub for Phase 2
    this.logger.log(`Push notification queued for ${data.to} (delivery TBD)`);
  }
}
