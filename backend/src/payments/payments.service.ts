import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import { randomInt, createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
    private configService: ConfigService,
  ) {}

  private generateReceiptNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomInt(1000, 9999);
    return `RCP-${date}-${rand}`;
  }

  async recordCash(data: {
    member_id: string;
    membership_id?: string;
    branch_id: string;
    invoice_id?: string;
    amount: number;
    notes?: string;
  }) {
    const member = await this.prisma.member.findUnique({
      where: { id: data.member_id },
    });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          member_id: data.member_id,
          membership_id: data.membership_id,
          branch_id: data.branch_id,
          invoice_id: data.invoice_id,
          amount: data.amount,
          payment_method: 'cash',
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
          branch_id: data.branch_id,
          reference_type: 'payment',
          reference_id: payment.id,
          transaction_type: 'credit',
          amount: data.amount,
          description: `Cash payment ${payment.receipt_number}`,
        },
      });

      // Update invoice status if linked
      if (data.invoice_id) {
        await this.billingService.recalculateInvoiceStatus(data.invoice_id);
      }

      return payment;
    });
  }

  async createOrder(data: {
    member_id: string;
    plan_id: string;
    branch_id: string;
    invoice_id?: string;
    gateway: 'razorpay' | 'stripe';
  }) {
    const member = await this.prisma.member.findUnique({
      where: { id: data.member_id },
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
      return expected === data.signature;
    }
    if (gateway === 'stripe') {
      // Stripe uses webhook signature verification — placeholder for Stripe SDK
      return data.signature.length > 0;
    }
    return false;
  }

  async findAll(query: {
    branch_id?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { branch_id, date_from, date_to, status, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (branch_id) where.branch_id = branch_id;
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
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data, total, page, limit };
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
}
