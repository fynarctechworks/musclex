import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { RazorpayService } from './razorpay.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { getTenantGymId } from '../common/tenant-context';
import { randomBytes } from 'crypto';

export interface CreatePaymentLinkInput {
  member_id: string;
  branch_id?: string;
  /** Charge a plan's price. Mutually exclusive with `amount`. */
  plan_id?: string;
  /** Charge an explicit amount (e.g. an invoice balance). */
  amount?: number;
  /** Reconcile the payment against this invoice when it completes. */
  invoice_id?: string;
  /** Deliver the link immediately over these channels. */
  send_via?: Array<'whatsapp' | 'email'>;
  note?: string;
}

/**
 * Shareable payment links.
 *
 * The hosted checkout page (`/pay/[orderId]`) and the public order-context
 * endpoint already existed — but a link was only ever minted implicitly by the
 * member app's renewal flow and the /join portal. Staff had no way to say
 * "send this member a link to pay", which is a headline feature for competitors
 * in this market (WhatsApp-first collections).
 *
 * This mints the same kind of Razorpay order the member-app path uses, so the
 * existing pay page, webhook, and reconciliation all work unchanged.
 */
@Injectable()
export class PaymentLinksService {
  private readonly logger = new Logger(PaymentLinksService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly razorpay: RazorpayService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /** Base URL of the gym web app, which hosts /pay/[orderId]. */
  private payBaseUrl(): string {
    const explicit = this.config.get<string>('FRONTEND_URL');
    const base =
      explicit?.trim() ||
      this.config.get('CORS_ORIGINS', 'http://localhost:3000').split(',')[0].trim();
    return base.replace(/\/+$/, '');
  }

  private receiptNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LNK-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private async gatewayCreds() {
    const cfg = await this.tenant.client.paymentGatewayConfig.findFirst({
      where: { gateway_name: 'razorpay', is_active: true },
      select: { api_key: true, secret_key: true },
    });
    if (!cfg?.api_key || !cfg?.secret_key) return undefined;
    return { keyId: cfg.api_key, keySecret: cfg.secret_key };
  }

  async create(input: CreatePaymentLinkInput) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context missing');

    const member = await this.tenant.client.member.findFirst({
      where: { id: input.member_id },
      select: {
        id: true,
        full_name: true,
        phone: true,
        email: true,
        branch_id: true,
      },
    });
    if (!member) throw new NotFoundException('Member not found');

    // Resolve the amount: explicit wins, else the plan's price.
    let amount = input.amount;
    let planName: string | null = null;
    let planId = input.plan_id;

    if (planId) {
      const plan = await this.tenant.client.membershipPlan.findFirst({
        where: { id: planId },
        select: { id: true, name: true, price: true },
      });
      if (!plan) throw new BadRequestException('Invalid plan');
      planName = plan.name;
      amount = amount ?? Number(plan.price);
    }

    if (input.invoice_id) {
      const invoice = await this.tenant.client.memberInvoice.findFirst({
        where: { id: input.invoice_id },
        select: { id: true, total_amount: true, status: true, member_id: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.member_id !== member.id) {
        throw new BadRequestException('Invoice belongs to a different member');
      }
      if (invoice.status === 'paid' || invoice.status === 'cancelled') {
        throw new BadRequestException(`Invoice is already ${invoice.status}`);
      }
      amount = amount ?? Number(invoice.total_amount);
    }

    if (!amount || amount <= 0) {
      throw new BadRequestException('A plan, invoice, or positive amount is required');
    }

    const branchId = input.branch_id ?? member.branch_id;
    if (!branchId) throw new BadRequestException('Branch could not be resolved for this member');

    const receipt = this.receiptNumber();
    const payment = await this.tenant.client.payment.create({
      data: {
        gym_id: gymId,
        member_id: member.id,
        branch_id: branchId,
        invoice_id: input.invoice_id,
        amount,
        payment_method: 'razorpay',
        status: 'pending',
        receipt_number: receipt,
        notes: input.note,
      },
    });

    const creds = await this.gatewayCreds();
    // The pending Payment row must exist first because the gateway `notes`
    // carry its id (that is what the hosted page and webhook resolve against).
    // But if the gateway then rejects us, that row can never be paid and would
    // sit forever in "pending payments" and outstanding-dues totals — so a
    // failure here removes it before rethrowing.
    let order: { id: string };
    try {
      order = await this.razorpay.createOrder(
        {
          amount,
          currency: payment.currency,
          receipt,
          // notes are SERVER-set and are what the hosted page + webhook trust
          // to resolve the gym/payment — never accept these from the client.
          notes: {
            gym_id: gymId,
            payment_id: payment.id,
            member_id: member.id,
            ...(planId ? { plan_id: planId } : {}),
          },
        },
        creds,
      );
    } catch (err) {
      await this.tenant.client.payment
        .delete({ where: { id: payment.id } })
        .catch((cleanupErr) =>
          this.logger.error(
            `Orphaned pending payment ${payment.id} after gateway failure — ` +
              `cleanup also failed: ${(cleanupErr as Error).message}`,
          ),
        );
      throw err;
    }

    await this.tenant.client.payment.update({
      where: { id: payment.id },
      data: { gateway_order_id: order.id },
    });

    const url = `${this.payBaseUrl()}/pay/${order.id}`;

    const delivery = input.send_via?.length
      ? await this.deliver(input.send_via, {
          url,
          amount,
          memberName: member.full_name,
          phone: member.phone,
          email: member.email,
          planName,
        })
      : [];

    return {
      url,
      order_id: order.id,
      payment_id: payment.id,
      receipt_number: receipt,
      amount,
      currency: payment.currency,
      member: { id: member.id, full_name: member.full_name },
      plan_name: planName,
      invoice_id: input.invoice_id ?? null,
      delivery,
    };
  }

  private async deliver(
    channels: Array<'whatsapp' | 'email'>,
    ctx: {
      url: string;
      amount: number;
      memberName: string;
      phone: string | null;
      email: string | null;
      planName: string | null;
    },
  ) {
    const gymName = await this.gymName();
    const what = ctx.planName ? `your ${ctx.planName} membership` : 'your outstanding balance';
    const body =
      `Hi ${ctx.memberName}, here's your secure payment link for ${what} at ${gymName}: ` +
      `${ctx.url} — amount ₹${ctx.amount.toLocaleString('en-IN')}.`;

    const results: Array<{ channel: string; status: string; error?: string }> = [];

    for (const channel of channels) {
      try {
        if (channel === 'whatsapp') {
          if (!ctx.phone) {
            results.push({ channel, status: 'skipped', error: 'no phone on file' });
            continue;
          }
          const res = await this.whatsapp.sendText({ to: ctx.phone, text: body });
          results.push({ channel, status: res?.delivered ? 'sent' : 'failed' });
        } else {
          if (!ctx.email) {
            results.push({ channel, status: 'skipped', error: 'no email on file' });
            continue;
          }
          await this.email.sendRaw({
            to: ctx.email,
            subject: `Payment link — ${gymName}`,
            html: `<p>Hi ${ctx.memberName},</p><p>Here's your secure payment link for ${what}:</p>
                   <p><a href="${ctx.url}">${ctx.url}</a></p>
                   <p>Amount: ₹${ctx.amount.toLocaleString('en-IN')}</p>`,
          });
          results.push({ channel, status: 'sent' });
        }
      } catch (err) {
        results.push({ channel, status: 'failed', error: (err as Error).message });
        this.logger.warn(`Payment link ${channel} delivery failed: ${(err as Error).message}`);
      }
    }
    return results;
  }

  private async gymName(): Promise<string> {
    try {
      const branch = await this.tenant.client.branch.findFirst({ select: { name: true } });
      return branch?.name ?? 'your gym';
    } catch {
      return 'your gym';
    }
  }
}
