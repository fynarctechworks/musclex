import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
  ) {}

  private generateReceiptNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomBytes(4).toString('hex').toUpperCase();
    return `RCP-${date}-${rand}`;
  }

  async recordCash(studioId: string, data: {
    member_id: string;
    membership_id?: string;
    branch_id: string;
    invoice_id?: string;
    amount: number;
    payment_method?: string;
    billing_cycle?: 'monthly' | 'yearly';
    notes?: string;
  }) {
    const member = await this.prisma.member.findFirst({
      where: { id: data.member_id } // tenant isolation via search_path,
    });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          gym_id: getTenantGymId()!,
          member_id: data.member_id,
          membership_id: data.membership_id,
          branch_id: data.branch_id,
          invoice_id: data.invoice_id,
          amount: data.amount,
          payment_method: data.payment_method || 'cash',
          status: 'paid',
          receipt_number: this.generateReceiptNumber(),
          notes: data.notes,
          paid_at: new Date(),
        },
        include: {
          member: { select: { id: true, full_name: true, member_code: true } },
        },
      });

      // Record financial transaction
      await tx.financialTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          branch_id: data.branch_id,
          reference_type: 'payment',
          reference_id: payment.id,
          transaction_type: 'credit',
          amount: data.amount,
          description: `Cash payment ${payment.receipt_number}`,
        },
      });

      // Extend membership based on plan duration (not hardcoded 1 year)
      if (data.billing_cycle === 'yearly' && data.membership_id) {
        const membership = await tx.memberMembership.findUnique({
          where: { id: data.membership_id },
          include: { plan: true },
        });
        if (membership) {
          const extensionDays = membership.plan?.duration_days || 365;
          const baseDate = membership.end_date ? new Date(membership.end_date) : new Date();
          const newEnd = new Date(baseDate.getTime() + extensionDays * 86400000);
          await tx.memberMembership.update({
            where: { id: data.membership_id },
            data: { end_date: newEnd },
          });
        }
      }

      // Update invoice status if linked
      if (data.invoice_id) {
        await this.billingService.recalculateInvoiceStatus(data.invoice_id);
      }

      return payment;
    });
  }

  async createOrder(studioId: string, data: {
    member_id: string;
    plan_id: string;
    branch_id: string;
    invoice_id?: string;
    gateway: 'razorpay' | 'stripe';
  }) {
    const member = await this.prisma.member.findFirst({
      where: { id: data.member_id } // tenant isolation via search_path,
    });
    if (!member) throw new NotFoundException('Member not found');

    const plan = await this.prisma.membershipPlan.findUnique({
      where: { id: data.plan_id },
    });
    if (!plan) throw new BadRequestException('Invalid plan');

    const receiptNumber = this.generateReceiptNumber();

    // Create pending payment record
    const payment = await this.prisma.payment.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: data.member_id,
        branch_id: data.branch_id,
        invoice_id: data.invoice_id,
        amount: plan.price,
        payment_method: data.gateway,
        status: 'pending',
        receipt_number: receiptNumber,
      },
    });

    // In production, call Razorpay/Stripe SDK to create an order.
    // For now, return the payment record as the order reference.
    return {
      order_id: payment.id,
      receipt_number: receiptNumber,
      amount: Number(plan.price),
      currency: payment.currency,
      gateway: data.gateway,
      plan_name: plan.name,
    };
  }

  async verifyPayment(data: {
    gateway_payment_id: string;
    gateway_order_id: string;
    signature: string;
    member_id: string;
    plan_id: string;
    branch_id: string;
  }) {
    // Verify HMAC signature based on payment gateway
    const payment = await this.prisma.payment.findFirst({
      where: { id: data.gateway_order_id, status: 'pending' },
    });
    if (!payment) throw new NotFoundException('Pending payment not found');

    // Verify gateway signature
    const gatewayConfig = await this.prisma.paymentGatewayConfig.findFirst({
      where: { gateway_name: payment.payment_method, is_active: true },
    });

    if (!gatewayConfig?.webhook_secret) {
      throw new BadRequestException(
        `Payment gateway configuration not found or missing webhook secret for ${payment.payment_method}`,
      );
    }

    const isValid = this.verifyGatewaySignature(
      payment.payment_method,
      data,
      gatewayConfig.webhook_secret,
    );
    if (!isValid) {
      throw new ForbiddenException('Invalid payment signature');
    }

    const plan = await this.prisma.membershipPlan.findUnique({
      where: { id: data.plan_id },
    });
    if (!plan) throw new BadRequestException('Invalid plan');

    // Wrap entire operation in a transaction to prevent race conditions
    return this.prisma.$transaction(async (tx) => {
      // Re-fetch payment inside transaction to prevent double-processing
      const lockedPayment = await tx.payment.findFirst({
        where: { id: data.gateway_order_id, status: 'pending' },
      });
      if (!lockedPayment) {
        throw new BadRequestException('Payment already processed or not found');
      }

      // Create membership
      const startDate = new Date();
      const endDate = plan.duration_days
        ? new Date(startDate.getTime() + plan.duration_days * 86400000)
        : null;

      const membership = await tx.memberMembership.create({
        data: {
          gym_id: getTenantGymId()!,
          member_id: data.member_id,
          plan_id: data.plan_id,
          branch_id: data.branch_id,
          start_date: startDate,
          end_date: endDate,
          classes_remaining: plan.total_classes,
          status: 'active',
        },
        include: { plan: true },
      });

      // Update payment to paid
      const updatedPayment = await tx.payment.update({
        where: { id: lockedPayment.id },
        data: {
          membership_id: membership.id,
          gateway_payment_id: data.gateway_payment_id,
          gateway_order_id: data.gateway_order_id,
          status: 'paid',
          paid_at: new Date(),
        },
      });

      // Record financial transaction
      await tx.financialTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          branch_id: data.branch_id,
          reference_type: 'payment',
          reference_id: updatedPayment.id,
          transaction_type: 'credit',
          amount: updatedPayment.amount,
          description: `Gateway payment ${updatedPayment.receipt_number} via ${lockedPayment.payment_method}`,
        },
      });

      // Activate member
      await tx.member.update({
        where: { id: data.member_id },
        data: { status: 'active' },
      });

      // Update invoice if linked
      if (lockedPayment.invoice_id) {
        await this.billingService.recalculateInvoiceStatus(lockedPayment.invoice_id);
      }

      return { payment: updatedPayment, membership };
    });
  }

  private verifyGatewaySignature(
    gateway: string,
    data: { gateway_payment_id: string; gateway_order_id: string; signature: string },
    secret: string,
  ): boolean {
    if (gateway === 'razorpay') {
      const body = `${data.gateway_order_id}|${data.gateway_payment_id}`;
      const expected = createHmac('sha256', secret).update(body).digest('hex');
      // Use timing-safe comparison to prevent timing attacks
      try {
        return timingSafeEqual(Buffer.from(expected), Buffer.from(data.signature));
      } catch {
        return false;
      }
    }
    if (gateway === 'stripe') {
      // Stripe signature format: "t=timestamp,v1=signature1,v1=signature2"
      // Verification: HMAC-SHA256(secret, "${timestamp}.${rawPayload}")
      try {
        const parts = data.signature.split(',').reduce<Record<string, string>>((acc, part) => {
          const [k, v] = part.split('=');
          acc[k] = v;
          return acc;
        }, {});
        const timestamp = parts['t'];
        const receivedSig = parts['v1'];
        if (!timestamp || !receivedSig) return false;

        const signedPayload = `${timestamp}.${data.gateway_payment_id}`;
        const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
        return timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSig));
      } catch {
        return false;
      }
    }
    return false;
  }

  async findAll(studioId: string, query: {
    branch_id?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    page?: number;
    limit?: number;
    user_branch_ids?: string[];
  }) {
    const { branch_id, date_from, date_to, status, page = 1, limit = 50, user_branch_ids } = query;
    const safeLimit = Math.min(limit, 500);
    const skip = (page - 1) * safeLimit;

    // Tenant isolation via search_path in TenantMiddleware
    const where: any = {};
    if (branch_id) {
      if (user_branch_ids && !user_branch_ids.includes(branch_id)) {
        return { data: [], total: 0, page, limit };
      }
      where.branch_id = branch_id;
    } else if (Array.isArray(user_branch_ids)) {
      if (user_branch_ids.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      where.branch_id = { in: user_branch_ids };
    }
    if (status) where.status = status;
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at.gte = new Date(date_from);
      if (date_to) where.created_at.lte = new Date(date_to);
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          member: {
            select: { id: true, full_name: true, member_code: true, phone: true },
          },
          membership: {
            include: { plan: { select: { id: true, name: true } } },
          },
          invoice: { select: { id: true, invoice_number: true, status: true } },
        },
        skip,
        take: safeLimit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    // Prisma Decimal serializes as an object over JSON; coerce to plain
    // numbers so the frontend reads `.amount` as a Number, not NaN.
    const serialized = data.map((p: any) => ({
      ...p,
      amount: p.amount === null || p.amount === undefined ? p.amount : Number(p.amount.toString()),
    }));

    return { data: serialized, total, page, limit };
  }

  async getInvoice(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        member: {
          select: {
            id: true,
            full_name: true,
            member_code: true,
            phone: true,
            email: true,
          },
        },
        membership: {
          include: { plan: true },
        },
        branch: true,
      },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    return payment;
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        member: {
          select: { id: true, full_name: true, member_code: true, phone: true, email: true },
        },
        membership: { include: { plan: true } },
        branch: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoice_number: true, status: true, total_amount: true } },
        refunds: { orderBy: { created_at: 'desc' } },
      },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  /**
   * Called by Razorpay webhook when payment.captured event fires.
   * Marks the pending payment as paid without needing frontend verification.
   */
  async handleRazorpayWebhook(orderId: string, gatewayPaymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: orderId, status: 'pending' },
    });
    if (!payment) return; // Already processed or not found — idempotent

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: orderId },
        data: {
          gateway_payment_id: gatewayPaymentId,
          status: 'paid',
          paid_at: new Date(),
        },
      });

      await tx.financialTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          branch_id: payment.branch_id,
          reference_type: 'payment',
          reference_id: payment.id,
          transaction_type: 'credit',
          amount: payment.amount,
          description: `Razorpay payment ${payment.receipt_number} (webhook)`,
        },
      });

      if (payment.invoice_id) {
        await this.billingService.recalculateInvoiceStatus(payment.invoice_id);
      }
    });
  }

  /**
   * Called by Stripe webhook when payment_intent.succeeded event fires.
   * Marks the pending payment as paid without needing frontend verification.
   */
  async handleStripeWebhook(orderId: string, gatewayPaymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: orderId, status: 'pending' },
    });
    if (!payment) return; // Already processed or not found — idempotent

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: orderId },
        data: {
          gateway_payment_id: gatewayPaymentId,
          status: 'paid',
          paid_at: new Date(),
        },
      });

      await tx.financialTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          branch_id: payment.branch_id,
          reference_type: 'payment',
          reference_id: payment.id,
          transaction_type: 'credit',
          amount: payment.amount,
          description: `Stripe payment ${payment.receipt_number} (webhook)`,
        },
      });

      if (payment.invoice_id) {
        await this.billingService.recalculateInvoiceStatus(payment.invoice_id);
      }
    });
  }

  // ────────────────────────────────────────────────────────────
  // PDF receipt rendering (member payments)
  // ────────────────────────────────────────────────────────────

  /**
   * Render a payment receipt as a PDF. Uses the same renderer the
   * subscription invoices use so receipts look identical across the
   * product (gym sub + member payment).
   *
   * The "issuer" of a member-payment receipt is the gym (Studio + Branch),
   * and the "billed-to" is the member.
   */
  async renderReceiptPdf(
    studioId: string,
    paymentId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        member: {
          select: {
            id: true,
            full_name: true,
            member_code: true,
            phone: true,
            email: true,
          },
        },
        membership: { include: { plan: true } },
        branch: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        state: true,
        postal_code: true,
        tax_id: true,
      },
    });

    const branch = payment.branch;
    // Issuer address: prefer branch (the location actually serving the
    // member), fall back to studio HQ.
    const issuerAddress = [
      branch?.address ?? studio?.address,
      branch?.city ?? studio?.city,
      branch?.state ?? studio?.state,
      branch?.postal_code ?? studio?.postal_code,
    ]
      .filter(Boolean)
      .join(', ');

    const fmtDate = (d: Date) =>
      d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

    const currency = payment.currency;
    const money = (n: number) =>
      `${currency === 'INR' ? '₹' : currency + ' '}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    const prettyMethod = (m: string) => {
      const map: Record<string, string> = {
        upi: 'UPI',
        card: 'Card',
        cash: 'Cash',
        netbanking: 'Net Banking',
        bank_transfer: 'Bank Transfer',
        razorpay: 'Razorpay',
        stripe: 'Stripe',
        cheque: 'Cheque',
      };
      return map[m] || m.replace(/_/g, ' ');
    };

    const plan = payment.membership?.plan;
    const lineDesc = plan
      ? `${plan.name}${plan.plan_type ? ` (${plan.plan_type.replace(/_/g, ' ')})` : ''}`
      : 'Membership payment';

    const periodStart = payment.membership?.start_date ?? payment.created_at;
    const periodEnd =
      payment.membership?.end_date ??
      payment.membership?.start_date ??
      payment.created_at;

    const amount = Number(payment.amount);
    const paid = payment.status === 'paid';

    const { renderInvoicePdfBuffer } = await import(
      '../subscription/invoice-pdf.renderer'
    );

    const buffer = await renderInvoicePdfBuffer({
      template: 'classic',
      invoice_number: payment.receipt_number,
      invoice_date: fmtDate(payment.paid_at ?? payment.created_at),
      status_label: payment.status.toUpperCase(),
      status_paid: paid,
      issuer_name: studio?.name || 'Gym',
      issuer_address: issuerAddress || undefined,
      issuer_email: studio?.email || branch?.email || undefined,
      billed_to_name: payment.member.full_name,
      billed_to_email: payment.member.email ?? undefined,
      billed_to_address: undefined,
      billed_to_tax_id: payment.member.member_code,
      items: [
        {
          description: lineDesc,
          period_start: fmtDate(new Date(periodStart)),
          period_end: fmtDate(new Date(periodEnd)),
          amount: money(amount),
        },
      ],
      subtotal: money(amount),
      tax_label: 'Tax (0%)',
      tax_amount: money(0),
      total: money(amount),
      payment_method: prettyMethod(payment.payment_method),
      payment_reference:
        payment.gateway_payment_id ??
        payment.gateway_order_id ??
        payment.receipt_number,
      footer_note: studio?.name
        ? `Thank you for being a member of ${studio.name}.`
        : 'Thank you for your payment.',
    });

    return { buffer, filename: `${payment.receipt_number}.pdf` };
  }
}
