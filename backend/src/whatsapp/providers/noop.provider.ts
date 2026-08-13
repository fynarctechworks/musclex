import { Logger } from '@nestjs/common';
import {
  WabaCredentials,
  WhatsAppDocumentMessage,
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppTemplateMessage,
  WhatsAppTextMessage,
} from '../whatsapp-provider.interface';

/**
 * Log-only provider, bound when WHATSAPP_SANDBOX=true (dev/CI). Never sends,
 * never throws — mirrors NoopEmailProvider.
 */
export class NoopWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'noop';
  private readonly logger = new Logger(NoopWhatsAppProvider.name);

  async sendText(_creds: WabaCredentials, msg: WhatsAppTextMessage): Promise<WhatsAppSendResult> {
    this.logger.log(`[NOOP] WhatsApp text → ${msg.to}: ${msg.text.slice(0, 120)}`);
    return { delivered: false };
  }

  async sendTemplate(_creds: WabaCredentials, msg: WhatsAppTemplateMessage): Promise<WhatsAppSendResult> {
    this.logger.log(`[NOOP] WhatsApp template "${msg.templateName}" → ${msg.to}`);
    return { delivered: false };
  }

  async sendDocument(_creds: WabaCredentials, msg: WhatsAppDocumentMessage): Promise<WhatsAppSendResult> {
    this.logger.log(`[NOOP] WhatsApp document → ${msg.to}: ${msg.documentUrl}`);
    return { delivered: false };
  }
}
