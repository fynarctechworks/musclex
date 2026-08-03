import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../prisma/tenant-task-runner';
import { DocumentDeliveryService } from '../documents/document-delivery.service';
import { PAYMENT_PAID, type PaymentPaidPayload } from './payment.events';

/**
 * Automatic payment receipts.
 *
 * Until now a receipt only went out if a staff member opened the invoice list
 * and clicked Email/WhatsApp — competitors send one on every payment. This
 * service is called (fire-and-forget) from each path that marks a payment
 * `paid`, and delivers the invoice/tax-invoice PDF over whichever channels the
 * member has contact details for.
 *
 * Design notes:
 *  - Only fires when the payment is linked to an invoice. A payment with no
 *    invoice has no tax document to send; those flows create the invoice first.
 *  - Never throws into the payment path: a receipt failure must not roll back
 *    or fail a captured payment.
 *  - Gateway/webhook callers have no tenant context, so `gymId` may be passed
 *    explicitly and the work runs inside `runForGym`.
 */
@Injectable()
export class PaymentReceiptService {
  private readonly logger = new Logger(PaymentReceiptService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly tasks: TenantTaskRunner,
    private readonly delivery: DocumentDeliveryService,
  ) {}

  @OnEvent(PAYMENT_PAID, { async: true })
  async onPaymentPaid(payload: PaymentPaidPayload): Promise<void> {
    await this.sendForPayment(payload.payment_id, payload.gym_id);
  }

  /**
   * Send the receipt for a paid payment. Safe to call from inside or outside
   * tenant context; always resolves without throwing.
   */
  async sendForPayment(paymentId: string, gymId?: string): Promise<void> {
    const run = () => this.dispatch(paymentId);
    try {
      if (gymId) {
        await this.tasks.runForGym(gymId, run);
      } else {
        await run();
      }
    } catch (err) {
      this.logger.warn(
        `Auto-receipt failed for payment ${paymentId}: ${(err as Error).message}`,
      );
    }
  }

  private async dispatch(paymentId: string): Promise<void> {
    const payment = await this.tenant.client.payment.findFirst({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        invoice_id: true,
        member: { select: { email: true, phone: true } },
      },
    });

    if (!payment || payment.status !== 'paid') return;
    if (!payment.invoice_id) {
      this.logger.debug(`Payment ${paymentId} has no invoice — no receipt to send`);
      return;
    }

    const channels: Array<'email' | 'whatsapp'> = [];
    if (payment.member?.email) channels.push('email');
    if (payment.member?.phone) channels.push('whatsapp');
    if (channels.length === 0) {
      this.logger.debug(`Payment ${paymentId}: member has no email or phone`);
      return;
    }

    const result = await this.delivery.sendInvoice(payment.invoice_id, { channels });
    const sent = result.deliveries.filter((d) => d.status === 'sent').map((d) => d.channel);
    this.logger.log(
      `Auto-receipt for payment ${paymentId}: ${sent.length ? sent.join(', ') : 'no channel succeeded'}`,
    );
  }
}
