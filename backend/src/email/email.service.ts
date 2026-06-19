import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService } from '../queue/queue.service';
import {
  EMAIL_PROVIDER,
  EmailAttachment,
  EmailProvider,
  ProviderEmailMessage,
} from './providers/email-provider.interface';
import {
  EmailTemplateId,
  RenderedEmail,
  SendEmailParams,
  SendEmailResult,
} from './email.types';
import { renderTemplate } from './templates';

const DEFAULT_FROM = 'MuscleX <noreply@musclex.app>';
const MAX_INLINE_ATTEMPTS = 3;

/** Cheap plain-text fallback from HTML for the `sendRaw` path. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The single entry point for all transactional email in MuscleX.
 *
 * Callers never touch a provider or write HTML — they call a typed helper (or
 * `send`) with a template id + data. The service:
 *   1. renders the branded template (subject + html + text),
 *   2. routes delivery: through BullMQ when Redis is enabled (retry/backoff +
 *      dedupe via jobId), otherwise inline with a bounded retry,
 *   3. never throws back to the request for fire-and-forget mail, and never
 *      returns the message body or any token to the caller.
 *
 * Adding a provider (SES/Postmark) or a per-tenant `from` is a config/DI change,
 * not a caller change — see providers/email-provider.interface.ts.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly defaultFrom: string;
  private readonly defaultReplyTo?: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    @Optional() private readonly queue?: QueueService,
  ) {
    this.defaultFrom = this.config.get<string>('RESEND_FROM_EMAIL', DEFAULT_FROM);
    this.defaultReplyTo = this.config.get<string>('EMAIL_REPLY_TO') || undefined;
  }

  /** Render a template without sending — used by tests and previews. */
  render<T extends EmailTemplateId>(templateId: T, data: SendEmailParams<T>['data']): RenderedEmail {
    return renderTemplate(templateId, data);
  }

  /**
   * Render + deliver. Failures are logged (and, for the queued path, retried by
   * BullMQ) but never bubble up as an exception — a failed notification must not
   * 500 the user's request.
   */
  async send<T extends EmailTemplateId>(params: SendEmailParams<T>): Promise<SendEmailResult> {
    const rendered = renderTemplate(params.templateId, params.data);
    const message: ProviderEmailMessage = {
      from: params.from ?? this.defaultFrom,
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: params.replyTo ?? this.defaultReplyTo,
    };

    // Queued path — let BullMQ own retry/backoff. dedupeKey → jobId so a
    // double-submit enqueues once. (The existing email processor renders a
    // pass-through template; we hand it the already-rendered HTML.)
    if (this.queue?.isRedisEnabled) {
      try {
        const job = await this.queue.enqueueEmail(
          {
            to: Array.isArray(params.to) ? params.to.join(',') : params.to,
            subject: rendered.subject,
            template: rendered.html,
            variables: {},
          },
          params.dedupeKey ? { jobId: `email:${params.dedupeKey}` } : undefined,
        );
        return { delivered: false, queued: job.queued, id: job.id };
      } catch (err) {
        this.logger.error(
          `Failed to enqueue ${params.templateId} email: ${(err as Error).message}`,
        );
        return { delivered: false, queued: false };
      }
    }

    // Inline path — bounded retry. Noop provider returns delivered:false (no throw).
    return this.deliverInline(message, params.templateId);
  }

  /**
   * Bespoke email that doesn't fit the template registry — invoice delivery
   * (with PDF attachment), staff leave notifications (with cc), 2FA recovery, etc.
   *
   * Still goes through the single provider seam + bounded retry (so there is no
   * second Resend client anywhere), but skips the queue because the queue job
   * shape can't carry attachments/cc. Returns the provider message id on success.
   */
  async sendRaw(params: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
    replyTo?: string;
    cc?: string | string[];
    attachments?: EmailAttachment[];
  }): Promise<SendEmailResult> {
    const message: ProviderEmailMessage = {
      from: params.from ?? this.defaultFrom,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text ?? htmlToText(params.html),
      replyTo: params.replyTo ?? this.defaultReplyTo,
      cc: params.cc,
      attachments: params.attachments,
    };
    return this.deliverInline(message, 'raw' as EmailTemplateId);
  }

  private async deliverInline(
    message: ProviderEmailMessage,
    templateId: EmailTemplateId,
  ): Promise<SendEmailResult> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_INLINE_ATTEMPTS; attempt++) {
      try {
        const result = await this.provider.send(message);
        if (result.delivered) {
          this.logger.log(`Sent ${templateId} email via ${this.provider.name} (id=${result.id ?? 'n/a'})`);
        }
        return { delivered: result.delivered, queued: false, id: result.id };
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_INLINE_ATTEMPTS) {
          const delay = 400 * Math.pow(3, attempt - 1); // 400ms, 1200ms
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    this.logger.error(
      `Failed to send ${templateId} email after ${MAX_INLINE_ATTEMPTS} attempts: ${(lastErr as Error)?.message}`,
    );
    return { delivered: false, queued: false };
  }
}
