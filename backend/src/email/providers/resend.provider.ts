import { Logger } from '@nestjs/common';
import {
  EmailProvider,
  ProviderEmailMessage,
  ProviderSendResult,
} from './email-provider.interface';

/**
 * Resend-backed provider. This is the ONLY place in the codebase that talks to
 * the Resend SDK — everything else goes through `EmailService`.
 *
 * The SDK is imported dynamically so the module loads even if `resend` is not
 * installed in some environment; the factory in `email.module.ts` only ever
 * constructs this when `RESEND_API_KEY` is present.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailProvider.name);
  private client: any;

  constructor(private readonly apiKey: string) {}

  private async getClient(): Promise<any> {
    if (!this.client) {
      const { Resend } = await import('resend');
      this.client = new Resend(this.apiKey);
    }
    return this.client;
  }

  async send(message: ProviderEmailMessage): Promise<ProviderSendResult> {
    const client = await this.getClient();
    const { data, error } = await client.emails.send({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      ...(message.cc ? { cc: message.cc } : {}),
      ...(message.attachments ? { attachments: message.attachments } : {}),
    });

    if (error) {
      // Surface as a throw so inline-retry / BullMQ can react.
      throw new Error(`Resend rejected message: ${error.message ?? JSON.stringify(error)}`);
    }

    return { id: data?.id, delivered: true };
  }
}
