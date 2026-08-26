import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../prisma/tenant-task-runner';
import { BillingService } from './billing.service';
import { RazorpayService } from './razorpay.service';
import { StripeService } from './stripe.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PAYMENT_PAID, type PaymentPaidPayload } from './payment.events';
import { randomBytes } from 'crypto';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class PaymentsService {
  constructor(
    private pub: PublicPrismaService, // registry: studio (GST state)
    private tenant: TenantPrisma, // tenant: payments/invoices/etc.
    private tasks: TenantTaskRunner, // webhook has no req context
    private billingService: BillingService,
    private razorpay: RazorpayService,
    private stripe: StripeService,
    private events: EventEmitter2,
  ) {}

  /**
   * Announce a captured payment so the receipt listener can deliver the
   * invoice PDF. Emitted (not awaited) — a slow or failing WhatsApp/email
   * send must never delay or roll back a payment that already succeeded.
   * Going through the bus also keeps the PDF/document stack out of this
   * module's import graph.
   */
  private queueReceipt(paymentId: string, gymId?: string): void {
    const payload: PaymentPaidPayload = { payment_id: paymentId, gym_id: gymId };
    this.events.emit(PAYMENT_PAID, payload);
  }

  private generateReceiptNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomBytes(4).toString('hex').toUpperCase();
    return `RCP-${date}-${rand}`;
  }

  /**
   * Per-gym gateway keys from payment_gateway_configs (owner-configured under
   * /payment-gateways). Returns null when the gym has no active config — the
   * gateway services then fall back to platform env keys. Requires tenant ctx.
   */
  private async gatewayCreds(gatewayName: 'razorpay' | 'stripe'): Promise<{ keyId: string; keySecret: string } | null> {
    try {
      const cfg = await this.tenant.client.paymentGatewayConfig.findFirst({
        where: { gateway_name: gatewayName, is_active: true },
      });
      if (!cfg?.api_key || !cfg?.secret_key) return null;
      return { keyId: cfg.api_key, keySecret: cfg.secret_key };
    } catch {
      return null;
    }
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
    const member = await this.tenant.client.member.findFirst({
      where: { id: data.member_id } // gym-scoped: findFirst on a tenant model gets gym_id injected,
    });
    if (!member) throw new NotFoundException('Member not found');

    return this.tenant.client.$transaction(async (tx) => {
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

      // Auto-receipt (only sends when the payment is invoice-linked).
      this.queueReceipt(payment.id);

      return payment;
    });
  }

  /**
   * Price a gateway order from one of two sources:
   *   plan_id    → a membership purchase, priced from the plan.
   *   invoice_id → collecting an existing bill, priced from what is still
   *                OWED, not the invoice total — a partial cash payment may
   *                already have landed against it.
   *
   * Collecting an invoice by card previously wasn't possible at all: both
   * gateway paths demanded a plan and the live CreateOrderDto had no
   * invoice_id, so `forbidNonWhitelisted` rejected any attempt to send one.
   */
  private async resolveOrderPricing(data: {
    plan_id?: string;
    invoice_id?: string;
  }): Promise<{
    plan: { id: string; name: string; price: unknown; currency: string | null; duration_days: number | null; total_classes: number | null } | null;
    amount: number;
    currency: string;
    description: string;
  }> {
    if (data.plan_id) {
      const plan = await this.tenant.client.membershipPlan.findUnique({
        where: { id: data.plan_id },
      });
      if (!plan) throw new BadRequestException('Invalid plan');
      return {
        plan: plan as never,
        amount: Number(plan.price),
        currency: plan.currency ?? 'INR',
        description: plan.name,
      };
    }

    if (data.invoice_id) {
      const { invoice, balance } = await this.billingService.getInvoiceBalance(
        data.invoice_id,
      );
      if (invoice.status === 'cancelled') {
        throw new BadRequestException('Invoice is cancelled');
      }
      if (balance <= 0) {
        throw new BadRequestException('Invoice is already paid in full');
      }
      return {
        plan: null,
        amount: balance,
        currency: invoice.currency ?? 'INR',
        description: `Invoice ${invoice.invoice_number}`,
      };
    }

    throw new BadRequestException(
      'Either plan_id or invoice_id is required to create an order',
    );
  }

  async createOrder(studioId: string, data: {
    member_id: string;
    plan_id?: string;
    branch_id: string;
    invoice_id?: string;
    gateway?: 'razorpay';
  }) {
    const member = await this.tenant.client.member.findFirst({
      where: { id: data.member_id } // gym-scoped: findFirst on a tenant model gets gym_id injected,
    });
    if (!member) throw new NotFoundException('Member not found');

    const { amount, description } = await this.resolveOrderPricing(data);

    const receiptNumber = this.generateReceiptNumber();

    // Create pending payment record
    const payment = await this.tenant.client.payment.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: data.member_id,
        branch_id: data.branch_id,
        invoice_id: data.invoice_id,
        amount,
        payment_method: 'razorpay',
        status: 'pending',
        receipt_number: receiptNumber,
      },
    });

    // Create a real Razorpay order and bind it to our pending payment. The
    // Razorpay order id (order_xxx) is what Checkout needs and what the
    // signature is computed over, so we persist it as gateway_order_id and
    // return it as order_id. Per-gym keys win over platform env keys.
    const creds = (await this.gatewayCreds('razorpay')) ?? undefined;
    const order = await this.razorpay.createOrder(
      {
        amount,
        currency: payment.currency,
        receipt: receiptNumber,
        notes: {
          gym_id: studioId,
          payment_id: payment.id,
          member_id: data.member_id,
          ...(data.plan_id ? { plan_id: data.plan_id } : {}),
          ...(data.invoice_id ? { invoice_id: data.invoice_id } : {}),
        },
      },
      creds,
    );
    await this.tenant.client.payment.update({
      where: { id: payment.id },
      data: { gateway_order_id: order.id },
    });
    return {
      order_id: order.id,
      payment_id: payment.id,
      key_id: this.razorpay.getKeyId(creds),
      receipt_number: receiptNumber,
      amount,
      currency: payment.currency,
      gateway: 'razorpay',
      // Checkout description — the plan name, or the invoice being settled.
      plan_name: description,
    };
  }

  async verifyPayment(data: {
    gateway_payment_id: string;
    gateway_order_id: string;
    signature: string;
    // NOTE: member_id / plan_id / branch_id are accepted for backward-compat
    // but DELIBERATELY IGNORED. The Razorpay checkout signature only proves
    // `order_id|payment_id` are authentic — it does NOT bind which plan/member
    // the grant is for. Trusting client-supplied values here let a caller pay
    // for a cheap plan then claim an expensive one (or activate a different
    // member). We derive all three server-side instead: member/branch from the
    // pending Payment row (set at createOrder), plan from the gateway order's
    // server-set notes. This binds "what was paid" to "what is granted".
    member_id?: string;
    plan_id?: string;
    branch_id?: string;
  }) {
    // Look up the pending payment by the gateway order id (order_xxx for
    // Razorpay) — NOT our local payment id.
    const payment = await this.tenant.client.payment.findFirst({
      where: { gateway_order_id: data.gateway_order_id, status: 'pending' },
    });
    if (!payment) throw new NotFoundException('Pending payment not found');

    const creds = (await this.gatewayCreds('razorpay')) ?? undefined;

    // Verify the Razorpay Checkout handshake — signed `order_id|payment_id`
    // with the KEY SECRET (timing-safe). Per-gym keys win over env.
    const isValid = this.razorpay.verifyCheckoutSignature(
      data.gateway_order_id,
      data.gateway_payment_id,
      data.signature,
      creds,
    );
    if (!isValid) {
      throw new ForbiddenException('Invalid payment signature');
    }

    // Server-derived plan/member/branch — never the client's word.
    const order = await this.razorpay.getOrder(data.gateway_order_id, creds);
    const notes = (order.notes ?? {}) as Record<string, string>;
    const planId = notes.plan_id;
    const memberId = payment.member_id;
    const branchId = payment.branch_id;
    if (!memberId || !branchId) {
      throw new BadRequestException('Order is missing required metadata');
    }

    // An invoice collection grants no membership — it just settles an existing
    // bill. Falling through to the plan path here would throw AFTER the
    // customer's card was already charged, taking the money and recording
    // nothing.
    if (!planId) {
      if (!payment.invoice_id) {
        throw new BadRequestException('Order is missing required metadata');
      }
      return this.settleInvoiceOrder(payment, data);
    }

    // Plan must belong to THIS gym (findFirst is gym-scoped; guards against a
    // notes-injected cross-gym plan id).
    const plan = await this.tenant.client.membershipPlan.findFirst({
      where: { id: planId, gym_id: getTenantGymId()! },
    });
    if (!plan) throw new BadRequestException('Invalid plan');

    // Amount-integrity: the amount we recorded as pending (and that Razorpay
    // enforced on capture) MUST equal the price of the plan we are about to
    // grant. Compare in integer minor units to avoid float drift.
    const paidMinor = Math.round(Number(payment.amount) * 100);
    const planMinor = Math.round(Number(plan.price) * 100);
    if (paidMinor !== planMinor) {
      throw new BadRequestException('Payment amount does not match plan price');
    }

    // Wrap entire operation in a transaction to prevent race conditions
    return this.tenant.client.$transaction(async (tx) => {
      // Atomically CLAIM the pending→paid transition. A plain `findFirst pending`
      // does not serialize concurrent transactions under read-committed, so
      // overlapping confirmations (double-click verify×verify, or verify×webhook)
      // would each create a membership + ledger credit. The guarded updateMany
      // row-locks and re-checks status, so exactly one writer wins; the loser
      // matches 0 rows and bails — no duplicate membership / double credit.
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: {
          gateway_payment_id: data.gateway_payment_id,
          gateway_order_id: data.gateway_order_id,
          status: 'paid',
          paid_at: new Date(),
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('Payment already processed or not found');
      }

      // We now exclusively own the transition. `payment` holds the stable
      // read-only fields (amount, receipt_number, payment_method, invoice_id)
      // captured before the transaction.
      const startDate = new Date();
      const endDate = plan.duration_days
        ? new Date(startDate.getTime() + plan.duration_days * 86400000)
        : null;

      const membership = await tx.memberMembership.create({
        data: {
          gym_id: getTenantGymId()!,
          member_id: memberId,
          plan_id: planId,
          branch_id: branchId,
          start_date: startDate,
          end_date: endDate,
          classes_remaining: plan.total_classes,
          status: 'active',
        },
        include: { plan: true },
      });

      // Link the membership onto the now-paid payment.
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { membership_id: membership.id },
      });

      // Record financial transaction
      await tx.financialTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          branch_id: branchId,
          reference_type: 'payment',
          reference_id: updatedPayment.id,
          transaction_type: 'credit',
          amount: updatedPayment.amount,
          description: `Gateway payment ${updatedPayment.receipt_number} via ${payment.payment_method}`,
        },
      });

      // Activate member
      await tx.member.update({
        where: { id: memberId },
        data: { status: 'active' },
      });

      // Update invoice if linked
      if (payment.invoice_id) {
        await this.billingService.recalculateInvoiceStatus(payment.invoice_id);
      }

      this.queueReceipt(updatedPayment.id);

      return { payment: updatedPayment, membership };
    });
  }

  /**
   * Settle a gateway order that was raised against an INVOICE rather than a
   * plan: mark the pending payment paid, post the ledger credit, and let the
   * invoice recalculate to partial/paid. No membership is granted.
   *
   * Uses the same guarded updateMany claim as the plan path so a double
   * verify (or verify racing the webhook) cannot double-credit the ledger.
   */
  private async settleInvoiceOrder(
    payment: { id: string; branch_id: string | null; invoice_id: string | null; payment_method: string; receipt_number: string | null },
    data: { gateway_payment_id: string; gateway_order_id: string },
  ) {
    const settled = await this.tenant.client.$transaction(async (tx) => {
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: {
          gateway_payment_id: data.gateway_payment_id,
          gateway_order_id: data.gateway_order_id,
          status: 'paid',
          paid_at: new Date(),
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('Payment already processed or not found');
      }

      const updatedPayment = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });

      await tx.financialTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          branch_id: updatedPayment.branch_id,
          reference_type: 'payment',
          reference_id: updatedPayment.id,
          transaction_type: 'credit',
          amount: updatedPayment.amount,
          description: `Invoice payment ${updatedPayment.receipt_number} via ${updatedPayment.payment_method}`,
        },
      });

      return updatedPayment;
    });

    // Outside the transaction: recalculation reads the payments it just wrote.
    if (settled.invoice_id) {
      await this.billingService.recalculateInvoiceStatus(settled.invoice_id);
    }
    this.queueReceipt(settled.id);

    return { payment: settled, membership: null };
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

    // Gym-scoped by the Prisma extension's gym_id injection (see
    // prisma/tenant-models.ts) — NOT by search_path, which is inert under multiSchema.
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
      this.tenant.client.payment.findMany({
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
      this.tenant.client.payment.count({ where }),
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
    const payment = await this.tenant.client.payment.findUnique({
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
    const payment = await this.tenant.client.payment.findUnique({
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
    // Webhook = no tenant context. Resolve the gym from the order's server-set
    // notes (set in createOrder), then run all work in that gym's schema.
    const order = await this.razorpay.getOrder(orderId).catch(() => null);
    const gymId = (order?.notes as Record<string, string> | undefined)?.gym_id;
    if (!gymId) return; // can't resolve tenant — skip (idempotent)

    await this.tasks.runForGym(gymId, async () => {
    const payment = await this.tenant.client.payment.findFirst({
      where: { gateway_order_id: orderId, status: 'pending' },
    });
    if (!payment) return; // Already processed or not found — idempotent

    await this.tenant.client.$transaction(async (tx) => {
      // Atomically CLAIM pending→paid. Razorpay delivers at-least-once, and this
      // can race the frontend verify path; the guarded updateMany ensures only
      // one writer transitions the payment and creates the ledger credit (the
      // loser matches 0 rows and returns without double-crediting).
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: {
          gateway_payment_id: gatewayPaymentId,
          status: 'paid',
          paid_at: new Date(),
        },
      });
      if (claim.count !== 1) return; // lost the race — another writer already credited

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

      // Webhook has no request tenant context — pass the resolved gym so the
      // receipt dispatch re-enters the right schema.
      this.queueReceipt(payment.id, payment.gym_id);
    });
    });
  }

  // ────────────────────────────────────────────────────────────
  // Stripe (international cards/wallets) — mirrors the Razorpay flow:
  // pending Payment + gateway object carrying server-set metadata, then a
  // guarded pending→paid claim on verify/webhook.
  // ────────────────────────────────────────────────────────────

  get stripeConfigured(): boolean {
    return this.stripe.configured;
  }

  async createStripeIntent(studioId: string, data: {
    member_id: string;
    plan_id?: string;
    branch_id: string;
    invoice_id?: string;
  }) {
    // For Stripe configs: api_key = publishable key, secret_key = secret key.
    const gymStripeCreds = await this.gatewayCreds('stripe');
    if (!this.stripe.configured && !gymStripeCreds) {
      throw new BadRequestException('Stripe is not configured for this gym');
    }
    const member = await this.tenant.client.member.findFirst({
      where: { id: data.member_id },
    });
    if (!member) throw new NotFoundException('Member not found');

    const { amount, currency, description } = await this.resolveOrderPricing(data);

    const receiptNumber = this.generateReceiptNumber();
    const payment = await this.tenant.client.payment.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: data.member_id,
        branch_id: data.branch_id,
        invoice_id: data.invoice_id,
        amount,
        payment_method: 'stripe',
        status: 'pending',
        receipt_number: receiptNumber,
      },
    });

    const intent = await this.stripe.createPaymentIntent(
      {
        amount,
        currency,
        metadata: {
          gym_id: studioId,
          payment_id: payment.id,
          member_id: data.member_id,
          ...(data.plan_id ? { plan_id: data.plan_id } : {}),
          ...(data.invoice_id ? { invoice_id: data.invoice_id } : {}),
          branch_id: data.branch_id,
        },
      },
      gymStripeCreds?.keySecret,
    );
    await this.tenant.client.payment.update({
      where: { id: payment.id },
      data: { gateway_order_id: intent.id },
    });

    return {
      payment_intent_id: intent.id,
      client_secret: intent.client_secret,
      publishable_key: gymStripeCreds?.keyId || this.stripe.getPublishableKey(),
      payment_id: payment.id,
      receipt_number: receiptNumber,
      amount,
      currency,
      gateway: 'stripe',
      plan_name: description,
    };
  }

  /**
   * Server-side confirmation: retrieve the PaymentIntent from Stripe (the
   * client can't forge this) and, when succeeded, claim pending→paid and
   * create the membership. Member/plan/branch come from the intent's
   * server-set metadata — never from the client.
   */
  async verifyStripePayment(data: { payment_intent_id: string }) {
    const stripeCreds = await this.gatewayCreds('stripe');
    const intent = await this.stripe.getPaymentIntent(data.payment_intent_id, stripeCreds?.keySecret);
    if (intent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not completed (status: ${intent.status})`);
    }
    const meta = intent.metadata ?? {};
    const { member_id, plan_id, branch_id } = meta;
    if (!member_id || !branch_id) {
      throw new BadRequestException('Payment intent is missing metadata');
    }

    const payment = await this.tenant.client.payment.findFirst({
      where: { gateway_order_id: intent.id, status: 'pending' },
    });
    if (!payment) throw new NotFoundException('Pending payment not found');

    // Invoice collection grants no membership. Must be handled before the plan
    // lookup below, which would otherwise throw AFTER Stripe already captured.
    if (!plan_id) {
      if (!payment.invoice_id) {
        throw new BadRequestException('Payment intent is missing metadata');
      }
      return this.settleInvoiceOrder(payment, {
        gateway_payment_id: intent.id,
        gateway_order_id: intent.id,
      });
    }

    // Plan gym-scoped (guards a metadata-injected cross-gym plan id).
    const plan = await this.tenant.client.membershipPlan.findFirst({
      where: { id: plan_id, gym_id: getTenantGymId()! },
    });
    if (!plan) throw new BadRequestException('Invalid plan');

    // Amount-integrity: pending amount (== the intent amount Stripe captured)
    // must equal the granted plan's price. Minor units, no float drift.
    if (Math.round(Number(payment.amount) * 100) !== Math.round(Number(plan.price) * 100)) {
      throw new BadRequestException('Payment amount does not match plan price');
    }
    // member_id must match the member the pending payment was created for.
    if (payment.member_id && payment.member_id !== member_id) {
      throw new BadRequestException('Payment/member mismatch');
    }

    return this.tenant.client.$transaction(async (tx) => {
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: {
          gateway_payment_id: intent.id,
          status: 'paid',
          paid_at: new Date(),
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('Payment already processed or not found');
      }

      const startDate = new Date();
      const endDate = plan.duration_days
        ? new Date(startDate.getTime() + plan.duration_days * 86400000)
        : null;

      const membership = await tx.memberMembership.create({
        data: {
          gym_id: getTenantGymId()!,
          member_id,
          plan_id,
          branch_id,
          start_date: startDate,
          end_date: endDate,
          classes_remaining: plan.total_classes,
          status: 'active',
        },
        include: { plan: true },
      });

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { membership_id: membership.id },
      });

      await tx.financialTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          branch_id,
          reference_type: 'payment',
          reference_id: updatedPayment.id,
          transaction_type: 'credit',
          amount: updatedPayment.amount,
          description: `Gateway payment ${updatedPayment.receipt_number} via stripe`,
        },
      });

      await tx.member.update({ where: { id: member_id }, data: { status: 'active' } });

      if (payment.invoice_id) {
        await this.billingService.recalculateInvoiceStatus(payment.invoice_id);
      }

      this.queueReceipt(updatedPayment.id);

      return { payment: updatedPayment, membership };
    });
  }

  /**
   * Stripe webhook (payment_intent.succeeded): marks the pending payment paid
   * + ledger credit, same scope as the Razorpay webhook (membership creation
   * stays on the verify path). Tenant resolved from server-set metadata.
   */
  async handleStripeWebhook(intent: { id: string; metadata?: Record<string, string> }) {
    const gymId = intent.metadata?.gym_id;
    if (!gymId) return; // can't resolve tenant — skip (idempotent)

    await this.tasks.runForGym(gymId, async () => {
      const payment = await this.tenant.client.payment.findFirst({
        where: { gateway_order_id: intent.id, status: 'pending' },
      });
      if (!payment) return; // already processed — idempotent

      await this.tenant.client.$transaction(async (tx) => {
        const claim = await tx.payment.updateMany({
          where: { id: payment.id, status: 'pending' },
          data: { gateway_payment_id: intent.id, status: 'paid', paid_at: new Date() },
        });
        if (claim.count !== 1) return;

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

        // Webhook has no request tenant context — see the Razorpay path.
        this.queueReceipt(payment.id, payment.gym_id);
      });
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
    const payment = await this.tenant.client.payment.findUnique({
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

    const studio = await this.pub.studio.findUnique({
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
