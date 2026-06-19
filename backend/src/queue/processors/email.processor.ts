import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { EmailJobData } from '../queue.service';
import { reportJobFailure } from '../../common/sentry/report-job-failure';
import {
  EMAIL_PROVIDER,
  EmailProvider,
} from '../../email/providers/email-provider.interface';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  // The single provider seam (EmailModule is @Global). No second Resend client.
  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {
    super();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    reportJobFailure(QUEUE_NAMES.EMAIL, job, err);
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, template, variables } = job.data;
    this.logger.log(`Processing email job ${job.id}: to=${to}, subject=${subject}`);

    const html = this.renderTemplate(template, variables);
    const from =
      process.env.RESEND_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      'MuscleX <noreply@musclex.app>';

    // Throw on failure so BullMQ applies its retry/backoff policy.
    await this.provider.send({
      from,
      to,
      subject,
      html,
      text: this.htmlToText(html),
      ...(process.env.EMAIL_REPLY_TO ? { replyTo: process.env.EMAIL_REPLY_TO } : {}),
    });

    this.logger.log(`Email job ${job.id} delivered to ${to} via ${this.provider.name}`);
  }

  /** Legacy `{{var}}` interpolation for enqueueEmail callers that pass raw data. */
  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    let html = template;
    for (const [key, value] of Object.entries(variables ?? {})) {
      html = html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value ?? ''));
    }
    return html;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
