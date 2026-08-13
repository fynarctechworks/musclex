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
 * Official Meta WhatsApp Cloud API transport (graph.facebook.com). SDK-free —
 * plain fetch, same approach as RazorpayService. Credentials are passed per
 * call so one process can send on behalf of many gyms (per-gym WABA numbers).
 */
export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'meta-cloud';
  private readonly logger = new Logger(MetaCloudWhatsAppProvider.name);

  constructor(private readonly graphVersion: string = 'v18.0') {}

  async sendText(creds: WabaCredentials, msg: WhatsAppTextMessage): Promise<WhatsAppSendResult> {
    return this.post(creds, {
      messaging_product: 'whatsapp',
      to: msg.to,
      type: 'text',
      text: { body: msg.text },
    });
  }

  async sendTemplate(creds: WabaCredentials, msg: WhatsAppTemplateMessage): Promise<WhatsAppSendResult> {
    return this.post(creds, {
      messaging_product: 'whatsapp',
      to: msg.to,
      type: 'template',
      template: {
        name: msg.templateName,
        language: { code: msg.languageCode },
        ...(msg.bodyParams?.length
          ? {
              components: [
                {
                  type: 'body',
                  parameters: msg.bodyParams.map((p) => ({ type: 'text', text: p })),
                },
              ],
            }
          : {}),
      },
    });
  }

  async sendDocument(creds: WabaCredentials, msg: WhatsAppDocumentMessage): Promise<WhatsAppSendResult> {
    return this.post(creds, {
      messaging_product: 'whatsapp',
      to: msg.to,
      type: 'document',
      document: {
        link: msg.documentUrl,
        ...(msg.filename ? { filename: msg.filename } : {}),
        ...(msg.caption ? { caption: msg.caption } : {}),
      },
    });
  }

  private async post(creds: WabaCredentials, body: Record<string, unknown>): Promise<WhatsAppSendResult> {
    const response = await fetch(
      `https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`WhatsApp API error: ${response.status} ${error}`);
    }

    const json = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
    };
    return { id: json.messages?.[0]?.id, delivered: true };
  }
}
