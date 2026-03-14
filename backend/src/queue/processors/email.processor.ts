import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { EmailJobData } from '../queue.service';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, template, variables } = job.data;
    this.logger.log(`Processing email job ${job.id}: to=${to}, subject=${subject}`);

    try {
      // Resend integration — import dynamically to avoid hard dependency
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      if (!process.env.RESEND_API_KEY) {
        this.logger.warn(`Email job ${job.id} skipped — RESEND_API_KEY not configured`);
        return;
      }

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'FitSync Pro <noreply@fitsyncpro.com>',
        to,
        subject,
        html: this.renderTemplate(template, variables),
      });

      this.logger.log(`Email job ${job.id} delivered to ${to}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Email job ${job.id} failed: ${message}`);
      throw error; // Let BullMQ handle retries
    }
  }

  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    let html = template;
    for (const [key, value] of Object.entries(variables)) {
      html = html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value ?? ''));
    }
    return html;
  }
}
