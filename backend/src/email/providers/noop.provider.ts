import { Logger } from '@nestjs/common';
import {
  EmailProvider,
  ProviderEmailMessage,
  ProviderSendResult,
} from './email-provider.interface';

/**
 * Fallback provider used when no `RESEND_API_KEY` is configured (local dev, CI).
 *
 * It logs the message metadata and returns `delivered: false` WITHOUT throwing,
 * so dev flows don't crash — but, crucially, it never returns the message body
 * or any token to the caller. (The old code leaked verification links to the
 * client when delivery failed; this provider does not.)
 */
export class NoopEmailProvider implements EmailProvider {
  readonly name = 'noop';
  private readonly logger = new Logger('EmailProvider:noop');

  async send(message: ProviderEmailMessage): Promise<ProviderSendResult> {
    const to = Array.isArray(message.to) ? message.to.join(',') : message.to;
    this.logger.warn(
      `[no provider configured] would send to=${to} subject="${message.subject}" — set RESEND_API_KEY to deliver`,
    );
    return { delivered: false };
  }
}
