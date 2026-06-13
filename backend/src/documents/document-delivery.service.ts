import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { DocumentsService } from './documents.service';
import { getTenantGymId } from '../common/tenant-context';

export type DeliveryChannel = 'email' | 'whatsapp';

interface SendOptions {
  channels: DeliveryChannel[];
  email_override?: string;
  phone_override?: string;
}

@Injectable()
export class DocumentDeliveryService {
  private readonly logger = new Logger(DocumentDeliveryService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private documents: DocumentsService,
  ) {}

  async sendPosReceipt(saleId: string, opts: SendOptions & { format?: 'a4' | 'thermal_80mm' }): Promise<{
    document_id: string;
    deliveries: Array<{ id: string; channel: DeliveryChannel; status: string; error?: string }>;
  }> {
    if (!opts.channels?.length) {
      throw new BadRequestException('At least one delivery channel is required');
    }
    const sale = await this.tenant.client.posSale.findUnique({
      where: { id: saleId },
      include: { member: { select: { email: true, phone: true } } },
    });
    if (!sale) throw new BadRequestException('Sale not found');

    const doc = await this.documents.ensurePosReceiptDocument(saleId, { format: opts.format ?? 'a4' });
    const results: Array<{ id: string; channel: DeliveryChannel; status: string; error?: string }> = [];

    for (const channel of opts.channels) {
      const recipient = channel === 'email'
        ? opts.email_override || sale.member?.email
        : opts.phone_override || sale.member?.phone;
      if (!recipient) {
        const row = await this.logDelivery(doc.id, channel, '', 'failed', undefined, `No ${channel} contact on file`);
        results.push({ id: row.id, channel, status: 'failed', error: `No ${channel} contact on file` });
        continue;
      }
      try {
        const docMeta = { invoice_number: sale.invoice_number, total_amount: sale.total_amount, currency: 'INR' };
        if (channel === 'email') {
          const id = await this.sendEmail(recipient, docMeta, doc);
          const row = await this.logDelivery(doc.id, channel, recipient, 'sent', id);
          results.push({ id: row.id, channel, status: 'sent' });
        } else {
          const id = await this.sendWhatsApp(recipient, docMeta, doc);
          const row = await this.logDelivery(doc.id, channel, recipient, 'sent', id);
          results.push({ id: row.id, channel, status: 'sent' });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`${channel} send failed for sale ${saleId}: ${message}`);
        const row = await this.logDelivery(doc.id, channel, recipient, 'failed', undefined, message);
        results.push({ id: row.id, channel, status: 'failed', error: message });
      }
    }

    return { document_id: doc.id, deliveries: results };
  }

  async sendInvoice(invoiceId: string, opts: SendOptions): Promise<{
    document_id: string;
    deliveries: Array<{ id: string; channel: DeliveryChannel; status: string; error?: string }>;
  }> {
    if (!opts.channels?.length) {
      throw new BadRequestException('At least one delivery channel is required');
    }

    const invoice = await this.tenant.client.memberInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        member: { select: { full_name: true, email: true, phone: true } },
      },
    });
    if (!invoice) throw new BadRequestException('Invoice not found');

    const doc = await this.documents.ensureInvoiceDocument(invoiceId);
    const results: Array<{ id: string; channel: DeliveryChannel; status: string; error?: string }> = [];

    for (const channel of opts.channels) {
      const recipient = channel === 'email'
        ? opts.email_override || invoice.member.email
        : opts.phone_override || invoice.member.phone;

      if (!recipient) {
        const row = await this.logDelivery(doc.id, channel, '', 'failed', undefined, `No ${channel} contact on file`);
        results.push({ id: row.id, channel, status: 'failed', error: `No ${channel} contact on file` });
        continue;
      }

      try {
        if (channel === 'email') {
          const providerMsgId = await this.sendEmail(recipient, invoice, doc);
          const row = await this.logDelivery(doc.id, channel, recipient, 'sent', providerMsgId);
          results.push({ id: row.id, channel, status: 'sent' });
        } else {
          const providerMsgId = await this.sendWhatsApp(recipient, invoice, doc);
          const row = await this.logDelivery(doc.id, channel, recipient, 'sent', providerMsgId);
          results.push({ id: row.id, channel, status: 'sent' });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`${channel} send failed for invoice ${invoiceId}: ${message}`);
        const row = await this.logDelivery(doc.id, channel, recipient, 'failed', undefined, message);
        results.push({ id: row.id, channel, status: 'failed', error: message });
      }
    }

    return { document_id: doc.id, deliveries: results };
  }

  private async sendEmail(
    to: string,
    invoice: { invoice_number: string; total_amount: any; currency: string },
    doc: { signed_url: string },
  ): Promise<string | undefined> {
    if (!process.env.RESEND_API_KEY) {
      this.logger.warn('RESEND_API_KEY not configured — email skipped (logged only)');
      return undefined;
    }
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#1A2F45;margin:0 0 12px;">Your invoice ${invoice.invoice_number}</h2>
        <p style="color:#444;font-size:14px;line-height:1.5;">
          A new invoice for <strong>${invoice.currency} ${Number(invoice.total_amount).toFixed(2)}</strong>
          is attached and available at the secure link below (valid for 1 hour).
        </p>
        <p style="margin:20px 0;">
          <a href="${doc.signed_url}"
             style="display:inline-block;padding:10px 18px;background:#1A2F45;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
            View invoice (PDF)
          </a>
        </p>
        <p style="color:#888;font-size:12px;">If the button doesn't work, copy this link into your browser:<br/>${doc.signed_url}</p>
      </div>
    `;

    // Fetch the PDF bytes once so we attach instead of relying on the signed URL alone.
    const pdfResponse = await fetch(doc.signed_url);
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'MuscleX <noreply@musclex.com>',
      to,
      subject: `Invoice ${invoice.invoice_number}`,
      html,
      attachments: [
        {
          filename: `${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    } as any);
    return (result as any)?.data?.id;
  }

  private async sendWhatsApp(
    to: string,
    invoice: { invoice_number: string; total_amount: any; currency: string },
    doc: { signed_url: string },
  ): Promise<string | undefined> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      this.logger.warn('WhatsApp not configured — message skipped (logged only)');
      return undefined;
    }
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'document',
        document: {
          link: doc.signed_url,
          filename: `${invoice.invoice_number}.pdf`,
          caption: `Invoice ${invoice.invoice_number} — ${invoice.currency} ${Number(invoice.total_amount).toFixed(2)}`,
        },
      }),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => 'unknown');
      throw new Error(`WhatsApp API ${response.status}: ${error}`);
    }
    const json = (await response.json().catch(() => ({}))) as { messages?: Array<{ id?: string }> };
    return json.messages?.[0]?.id;
  }

  private async logDelivery(
    documentId: string,
    channel: DeliveryChannel,
    recipient: string,
    status: 'sent' | 'failed',
    providerMsgId?: string,
    error?: string,
  ) {
    return this.tenant.client.documentDelivery.create({
      data: {
        gym_id: getTenantGymId()!,
        document_id: documentId,
        channel,
        recipient,
        status,
        provider: channel === 'email' ? 'resend' : 'meta_whatsapp',
        provider_msg_id: providerMsgId ?? null,
        error: error ?? null,
        attempts: 1,
        sent_at: status === 'sent' ? new Date() : null,
      },
    });
  }
}
