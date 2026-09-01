import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException } from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { SubscriptionPolicyService } from '../common/services/subscription-policy.service';
import { SubscriptionGateway } from './subscription.gateway';
import { RazorpayService } from '../payments/razorpay.service';
import { SubscriptionCouponService } from './subscription-coupon.service';
import { PLAN_CONFIGS } from '../common/plan-configs';
import {
  classifyPlanChange,
  computeProration,
  cycleDays,
  PlanChangeMode,
} from './proration.util';
import { QueueService } from '../queue/queue.service';
import {
  REFERRAL_EVENTS,
  SubscriptionRefundedPayload,
} from '../referrals/events/domain-events';

/**
 * Orchestrates user-facing subscription operations.
 *
 * - getStatus()       : returns current SubscriptionContext + plan + amount due
 * - getEvents()       : paginated ledger view (audit + UX)
 * - renew()           : records a renewal (continuity-strict) and pushes WS event
 * - simulateRenewal() : computes the next period without persisting (preview)
 *
 * Razorpay gateway integration is live via createRenewalOrder()/verifyAndRenew();
 * this layer is also the integration point a webhook handler would call.
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly policy: SubscriptionPolicyService,
    private readonly gateway: SubscriptionGateway,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly razorpay: RazorpayService,
    private readonly coupons: SubscriptionCouponService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Razorpay gateway (subscription renewal / plan switch)
  // ────────────────────────────────────────────────────────────

  /**
   * Create a Razorpay order for a subscription renewal / plan switch. The
   * amount is computed server-side from the (target) plan + cycle; the plan,
   * cycle and studio_id are stored in the order `notes` so verify can trust
   * them instead of the client.
   */
  async createRenewalOrder(
    studioId: string,
    opts: { plan?: string; billing_cycle?: 'monthly' | 'annual'; coupon_code?: string },
  ) {
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: { subscription_plan: true, billing_cycle: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    // A scheduled downgrade / cycle switch is consumed at renewal: when the
    // caller doesn't name a plan or cycle explicitly, the pending scheduled
    // change is the default. An explicit choice supersedes it.
    const pending =
      opts.plan || opts.billing_cycle
        ? null
        : await this.getRenewalDefaultChange(studioId);

    const targetPlan = opts.plan ?? pending?.target_plan ?? studio.subscription_plan;
    const targetCycle = (opts.billing_cycle ??
      pending?.target_cycle ??
      studio.billing_cycle) as 'monthly' | 'annual';
    if (targetCycle !== 'monthly' && targetCycle !== 'annual') {
      throw new BadRequestException(`Invalid billing_cycle "${targetCycle}".`);
    }

    const planInfo = await this.resolvePlanPricing(targetPlan);
    if (!planInfo) throw new BadRequestException(`Unknown plan "${targetPlan}".`);

    const listPrice =
      targetCycle === 'annual' ? planInfo.annual_price : planInfo.monthly_price;
    if (listPrice <= 0) {
      throw new BadRequestException(`Plan "${targetPlan}" is free — no payment required.`);
    }

    // Coupon is resolved and applied SERVER-SIDE: the discount comes from
    // scc.discounts, never from the client, so the charged amount cannot be
    // forged by editing the request. Applied to the pre-GST subtotal so tax is
    // computed on what the customer actually pays.
    const coupon = await this.coupons.resolve(opts.coupon_code, targetPlan, listPrice);
    const subtotal = +(listPrice - (coupon?.discount_amount ?? 0)).toFixed(2);
    if (subtotal <= 0) {
      throw new BadRequestException(
        'This coupon covers the full amount — no payment is required. Contact support to apply it.',
      );
    }

    // GST is added on top (exclusive) at the platform rate configured in the SCC.
    // The Razorpay order is created for the GST-inclusive TOTAL — that's the
    // authoritative amount every downstream step (verify, onboarding payment,
    // invoice) reads back, so GST flows through without trusting the client.
    const gst = await this.computeGst(subtotal);
    const total = +(subtotal + gst.amount).toFixed(2);

    const order = await this.razorpay.createOrder({
      amount: total,
      currency: 'INR',
      receipt: `SUB-${studioId.slice(0, 8)}-${Date.now()}`,
      notes: {
        kind: 'subscription',
        studio_id: studioId,
        plan: targetPlan,
        billing_cycle: targetCycle,
        // Carried on the order so verify() can credit usage against the same
        // coupon without trusting anything the client sends back.
        ...(coupon ? { coupon_id: coupon.id, coupon_code: coupon.code } : {}),
      },
    });

    return {
      order_id: order.id,
      key_id: this.razorpay.getKeyId(),
      amount: total,
      currency: 'INR',
      plan: targetPlan,
      billing_cycle: targetCycle,
      plan_display_name: planInfo.display_name,
      // Breakdown so the client can render a GST summary.
      list_price: listPrice,
      coupon_code: coupon?.code ?? null,
      coupon_name: coupon?.name ?? null,
      discount_amount: coupon?.discount_amount ?? 0,
      subtotal,
      gst_percent: gst.percent,
      gst_label: gst.label,
      gst_amount: gst.amount,
      total,
    };
  }

  /**
   * Redeem a coupon that covers the ENTIRE amount — activates the subscription
   * with no gateway involved.
   *
   * Security: the coupon is re-resolved from `scc.discounts` here, and the
   * renewal is granted ONLY if the server's own arithmetic makes the payable
   * total zero. A client cannot reach this path with a partial coupon, and
   * cannot influence the discount — it sends a code, nothing more. Usage is
   * consumed exactly once, before the grant, so a replay cannot mint free
   * periods beyond `max_uses`.
   */
  async redeemFullDiscountCoupon(
    studioId: string,
    actorId: string,
    opts: {
      code: string;
      plan?: string;
      billing_cycle?: 'monthly' | 'annual';
      billing_info?: {
        billing_name?: string;
        billing_email?: string;
        billing_address?: string;
        tax_id?: string;
      };
    },
  ) {
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: { subscription_plan: true, billing_cycle: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    const pending =
      opts.plan || opts.billing_cycle
        ? null
        : await this.getRenewalDefaultChange(studioId);
    const targetPlan = opts.plan ?? pending?.target_plan ?? studio.subscription_plan;
    const targetCycle = (opts.billing_cycle ??
      pending?.target_cycle ??
      studio.billing_cycle) as 'monthly' | 'annual';

    const planInfo = await this.resolvePlanPricing(targetPlan);
    if (!planInfo) throw new BadRequestException(`Unknown plan "${targetPlan}".`);

    const listPrice =
      targetCycle === 'annual' ? planInfo.annual_price : planInfo.monthly_price;
    if (listPrice <= 0) {
      throw new BadRequestException(`Plan "${targetPlan}" is free — no payment required.`);
    }

    // Authoritative re-resolution. Throws if the code is invalid/expired/
    // exhausted or restricted to a different plan.
    const coupon = await this.coupons.resolve(opts.code, targetPlan, listPrice);
    if (!coupon) throw new BadRequestException('A coupon code is required.');

    // The whole point of this path: it exists ONLY for coupons that leave
    // nothing to pay. Anything else must go through Razorpay Checkout.
    if (coupon.discount_amount + 0.005 < listPrice) {
      const remaining = +(listPrice - coupon.discount_amount).toFixed(2);
      throw new BadRequestException(
        `This coupon does not cover the full amount — ₹${remaining} remains payable. Complete the payment through Checkout instead.`,
      );
    }

    // Consume BEFORE granting: the update is guarded by `used_count < max_uses`,
    // so two concurrent redemptions cannot both pass.
    await this.coupons.consume(coupon.id);

    this.logger.log(
      `Full-discount activation: studio=${studioId} plan=${targetPlan}/${targetCycle} coupon=${coupon.code} (₹${coupon.discount_amount} off ₹${listPrice})`,
    );

    return this.renew({
      studio_id: studioId,
      actor_id: actorId,
      actor_type: 'user',
      // Trusted because THIS method proved the coupon covers the total using
      // server-side pricing — no gateway payment is owed.
      gateway_verified: true,
      plan: opts.plan,
      billing_cycle: opts.billing_cycle,
      currency: 'INR',
      payment_method: 'coupon',
      payment_reference: `COUPON-${coupon.code}-${Date.now()}`,
      discount_amount: coupon.discount_amount,
      discount_code: coupon.code,
      billing_info: opts.billing_info,
    });
  }

  /**
   * Validate a platform coupon and return the resulting breakdown. Preview
   * only — no order, no usage consumed. `createRenewalOrder` re-resolves the
   * coupon independently, so this response can never set the charged price.
   */
  async previewCoupon(
    studioId: string,
    opts: { code: string; plan?: string; billing_cycle?: 'monthly' | 'annual' },
  ) {
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: { subscription_plan: true, billing_cycle: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    const targetPlan = opts.plan ?? studio.subscription_plan;
    const targetCycle = (opts.billing_cycle ?? studio.billing_cycle) as
      | 'monthly'
      | 'annual';

    const planInfo = await this.resolvePlanPricing(targetPlan);
    if (!planInfo) throw new BadRequestException(`Unknown plan "${targetPlan}".`);

    const listPrice =
      targetCycle === 'annual' ? planInfo.annual_price : planInfo.monthly_price;

    const coupon = await this.coupons.resolve(opts.code, targetPlan, listPrice);
    const subtotal = +(listPrice - (coupon?.discount_amount ?? 0)).toFixed(2);
    const gst = await this.computeGst(subtotal);

    return {
      valid: true,
      coupon_code: coupon?.code ?? null,
      coupon_name: coupon?.name ?? null,
      discount_amount: coupon?.discount_amount ?? 0,
      // True when nothing is left to pay — the client then activates via
      // POST /subscription/redeem-coupon instead of opening Razorpay.
      covers_full_amount: subtotal <= 0,
      list_price: listPrice,
      subtotal,
      gst_percent: gst.percent,
      gst_label: gst.label,
      gst_amount: gst.amount,
      total: +(subtotal + gst.amount).toFixed(2),
    };
  }

  /**
   * Read-only GST/total preview for the studio's currently-selected plan. The
   * onboarding payment page calls this to render the subtotal + GST + total
   * summary BEFORE creating an order. Amounts are computed server-side from the
   * plan; no order is created.
   */
  async getOrderPreview(studioId: string) {
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: { subscription_plan: true, billing_cycle: true, currency: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    const cycle = (studio.billing_cycle as 'monthly' | 'annual') ?? 'monthly';
    const planInfo = await this.resolvePlanPricing(studio.subscription_plan);
    if (!planInfo) {
      throw new BadRequestException(`Unknown plan "${studio.subscription_plan}".`);
    }

    const subtotal = cycle === 'annual' ? planInfo.annual_price : planInfo.monthly_price;
    const gst = await this.computeGst(subtotal);
    const total = +(subtotal + gst.amount).toFixed(2);

    return {
      plan: studio.subscription_plan,
      plan_display_name: planInfo.display_name,
      billing_cycle: cycle,
      currency: studio.currency || 'INR',
      subtotal,
      gst_percent: gst.percent,
      gst_label: gst.label,
      gst_amount: gst.amount,
      total,
    };
  }

  /**
   * Read the platform-wide subscription GST setting from scc.platform_settings
   * (configured in the SCC). Fails safe to "disabled / 0%" if the row is
   * missing or unreadable, so payments never break.
   */
  private async readGstSetting(): Promise<{
    percent: number;
    label: string;
    enabled: boolean;
  }> {
    try {
      const rows = await this.pub.$queryRaw<Array<{ value: any }>>`
        SELECT value FROM scc.platform_settings WHERE key = 'subscription_gst' LIMIT 1
      `;
      const v = rows[0]?.value;
      if (v) {
        const percent = Number(v.percent ?? 0);
        return {
          percent: Number.isFinite(percent) && percent >= 0 ? percent : 0,
          label: typeof v.label === 'string' && v.label.trim() ? v.label : 'GST',
          enabled: v.enabled !== false,
        };
      }
    } catch {
      // scc.platform_settings not present yet — treat as no GST.
    }
    return { percent: 0, label: 'GST', enabled: false };
  }

  /** GST added on top of a subtotal (exclusive), rounded to 2 decimals. */
  private async computeGst(
    subtotal: number,
  ): Promise<{ percent: number; label: string; amount: number }> {
    const s = await this.readGstSetting();
    if (!s.enabled || s.percent <= 0) {
      return { percent: 0, label: s.label, amount: 0 };
    }
    const amount = Math.round(subtotal * s.percent) / 100;
    return { percent: s.percent, label: s.label, amount };
  }

  /**
   * Verify a Razorpay Checkout handshake for a subscription order, then record
   * the renewal. The plan/cycle are taken from the (server-set) order notes —
   * NOT the client — so a buyer can't pay for a cheap plan and claim a costly
   * one. The order's studio_id note must match the caller's tenant.
   */
  async verifyAndRenew(params: {
    studio_id: string;
    actor_id: string;
    gateway_order_id: string;
    gateway_payment_id: string;
    signature: string;
    billing_info?: {
      billing_name?: string;
      billing_email?: string;
      billing_address?: string;
      tax_id?: string;
    };
  }) {
    const ok = this.razorpay.verifyCheckoutSignature(
      params.gateway_order_id,
      params.gateway_payment_id,
      params.signature,
    );
    if (!ok) throw new ForbiddenException('Invalid payment signature');

    // Read the authoritative order back from Razorpay.
    const order = await this.razorpay.getOrder(params.gateway_order_id);
    const notes = order.notes ?? {};
    if (notes.studio_id !== params.studio_id) {
      throw new ForbiddenException('Order does not belong to this tenant');
    }
    if (order.status !== 'paid') {
      throw new BadRequestException(`Order not paid (status: ${order.status})`);
    }

    // Prorated mid-cycle upgrade orders carry kind='plan_change' — they apply
    // the plan immediately WITHOUT moving the billing date, so they must not
    // flow through renew() (which would grant a whole new period).
    if (notes.kind === 'plan_change') {
      return this.applyVerifiedPlanChange(params, notes, order);
    }

    // Credit the coupon only once the payment is confirmed paid. Best-effort —
    // never fails an already-captured payment.
    if (notes.coupon_id) {
      await this.coupons.consume(notes.coupon_id);
    }

    return this.renew({
      studio_id: params.studio_id,
      actor_id: params.actor_id,
      actor_type: 'user',
      gateway_verified: true,
      plan: notes.plan,
      billing_cycle: notes.billing_cycle as 'monthly' | 'annual' | undefined,
      currency: order.currency || 'INR',
      payment_reference: params.gateway_payment_id,
      payment_method: 'razorpay',
      billing_info: params.billing_info,
    });
  }

  // ────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────

  async getStatus(studioId: string) {
    const [studio, context, plan, pendingChange] = await Promise.all([
      this.pub.studio.findUnique({
        where: { id: studioId },
        select: {
          subscription_plan: true,
          subscription_status: true,
          billing_cycle: true,
          subscription_start: true,
          next_billing_date: true,
          trial_ends_at: true,
          lifecycle_status: true,
          grace_until: true,
          locked_at: true,
          suspended_at: true,
        },
      }),
      this.policy.getContext(studioId),
      this.resolvePlanInfo(studioId),
      this.policy.getScheduledPlanChange(studioId),
    ]);

    if (!studio) throw new NotFoundException('Studio not found');

    // Amount due is the GST-inclusive total — the figure the customer will
    // actually be charged (matches renew/create-order).
    const dueSubtotal =
      studio.billing_cycle === 'annual'
        ? plan.annual_price
        : plan.monthly_price;
    const dueGst = await this.computeGst(dueSubtotal);
    const amountDue = +(dueSubtotal + dueGst.amount).toFixed(2);

    return {
      subscription: context,
      plan: {
        name: studio.subscription_plan,
        display_name: plan.display_name,
        monthly_price: plan.monthly_price,
        annual_price: plan.annual_price,
        billing_cycle: studio.billing_cycle,
        grace_days: plan.grace_days,
      },
      timeline: {
        subscription_start: studio.subscription_start,
        next_billing_date: studio.next_billing_date,
        trial_ends_at: studio.trial_ends_at,
        grace_until: studio.grace_until,
        locked_at: studio.locked_at,
        suspended_at: studio.suspended_at,
      },
      amount_due: amountDue,
      amount_due_subtotal: dueSubtotal,
      gst_percent: dueGst.percent,
      gst_label: dueGst.label,
      gst_amount: dueGst.amount,
      currency: 'INR',
      // Scheduled downgrade / cycle switch, if any — applies at effective_at.
      pending_change: pendingChange
        ? {
            target_plan: pendingChange.target_plan,
            target_cycle: pendingChange.target_cycle,
            effective_at: pendingChange.effective_at.toISOString(),
            scheduled_at: pendingChange.scheduled_at.toISOString(),
          }
        : null,
    };
  }

  async getEvents(studioId: string, limit = 50) {
    return this.pub.subscriptionEvent.findMany({
      where: { studio_id: studioId },
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        event_type: true,
        from_status: true,
        to_status: true,
        plan_name: true,
        billing_cycle: true,
        amount: true,
        currency: true,
        period_start: true,
        period_end: true,
        actor_type: true,
        metadata: true,
        created_at: true,
      },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Writes
  // ────────────────────────────────────────────────────────────

  /**
   * Record a renewal payment. Strict continuity: next period starts from prior
   * expiry, NOT from now. After persist, push a WS event so connected clients
   * unlock immediately.
   *
   * NB: the Razorpay gateway path (verifyAndRenew) calls this after verifying
   * the payment server-side. The userId passed in is the actor (owner who
   * initiated checkout).
   */
  // Whitelist of accepted payment methods. `razorpay` is the live gateway
  // (create-order/verify); the rest are recorded manually with a reference.
  private static readonly ALLOWED_PAYMENT_METHODS = [
    'upi',
    'card',
    'netbanking',
    'bank_transfer',
    'cash',
    'razorpay',
    // 100%-off platform coupon — no gateway involved. Only ever set by
    // redeemFullDiscountCoupon(), which proves the discount covers the whole
    // total server-side before calling renew().
    'coupon',
  ] as const;

  async renew(params: {
    studio_id: string;
    actor_id: string;
    actor_type?: 'user' | 'webhook' | 'admin';
    /**
     * Set ONLY by server-side gateway paths (verifyAndRenew) after the
     * Razorpay signature + order status have been checked. Never derived
     * from client input — self-service callers cannot record a renewal
     * without a verified online payment.
     */
    gateway_verified?: boolean;
    /**
     * Optional plan switch. If omitted, the current plan is renewed as-is.
     * If provided + different, switches plan AND renews in one atomic tx.
     */
    plan?: string;
    billing_cycle?: 'monthly' | 'annual';
    currency?: string;
    payment_reference?: string; // razorpay_payment_id / manual UTR
    payment_method?: string;
    /**
     * Rupees off the pre-GST subtotal, from a verified platform coupon. Set
     * ONLY by server-side paths that resolved the coupon themselves
     * (redeemFullDiscountCoupon). Never accepted from client input — it
     * directly reduces the recorded amount.
     */
    discount_amount?: number;
    discount_code?: string;
    /**
     * Optional billing info update applied BEFORE the invoice is created so the
     * invoice + receipt email use the freshest values the user just typed in.
     * Any omitted/empty field leaves the existing value alone.
     */
    billing_info?: {
      billing_name?: string;
      billing_email?: string;
      billing_address?: string;
      tax_id?: string;
    };
  }) {
    // Self-service renewals MUST come through the gateway (create-order +
    // verify). Honor-system manual references let the paying customer renew
    // themselves for free — only server-verified gateway calls, platform
    // admins, or verified webhooks may record a renewal.
    const trusted =
      params.gateway_verified === true ||
      params.actor_type === 'admin' ||
      params.actor_type === 'webhook';
    if (!trusted) {
      throw new BadRequestException(
        'Online payment required — start with POST /subscription/create-order and complete Razorpay Checkout; the renewal is recorded after verification.',
      );
    }

    const method = params.payment_method?.toLowerCase();
    if (!method || !SubscriptionService.ALLOWED_PAYMENT_METHODS.includes(method as any)) {
      throw new BadRequestException(
        `Invalid payment_method "${params.payment_method}". Allowed: ${SubscriptionService.ALLOWED_PAYMENT_METHODS.join(', ')}`,
      );
    }
    if (!params.payment_reference || params.payment_reference.trim().length < 3) {
      throw new BadRequestException(
        'payment_reference is required (UTR / transaction ID / receipt number).',
      );
    }

    // ── Resolve target plan + amount server-side (never trust client). ──
    const studio = await this.pub.studio.findUnique({
      where: { id: params.studio_id },
      select: { subscription_plan: true, billing_cycle: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    // Consume a pending scheduled change (downgrade / cycle switch) when the
    // caller doesn't pick a plan explicitly — the schedule IS the default at
    // renewal time. An explicit choice supersedes it.
    const pending =
      params.plan || params.billing_cycle
        ? null
        : await this.getRenewalDefaultChange(params.studio_id);

    const targetPlan =
      params.plan ?? pending?.target_plan ?? studio.subscription_plan;
    const targetCycle = (params.billing_cycle ??
      pending?.target_cycle ??
      studio.billing_cycle) as 'monthly' | 'annual';
    if (targetCycle !== 'monthly' && targetCycle !== 'annual') {
      throw new BadRequestException(
        `Invalid billing_cycle "${params.billing_cycle}". Allowed: monthly, annual`,
      );
    }

    const planInfo = await this.resolvePlanPricing(targetPlan);
    if (!planInfo) {
      throw new BadRequestException(`Unknown plan "${targetPlan}".`);
    }

    const listPrice =
      targetCycle === 'annual'
        ? planInfo.annual_price
        : planInfo.monthly_price;
    if (listPrice <= 0) {
      throw new BadRequestException(
        `Plan "${targetPlan}" is free — no payment required.`,
      );
    }

    // A verified platform coupon reduces the taxable subtotal. Clamped to the
    // list price so a discount can never produce a negative charge.
    const discount = Math.min(Math.max(params.discount_amount ?? 0, 0), listPrice);
    const subtotal = +(listPrice - discount).toFixed(2);

    // The recorded amount is the GST-inclusive TOTAL — the same figure the
    // Razorpay order charges and the invoice PDF splits back into
    // subtotal + tax. Manual payments owe the same total.
    const gst = await this.computeGst(subtotal);
    const amount = +(subtotal + gst.amount).toFixed(2);

    // ── Persist billing info from the checkout form FIRST ──
    // The invoice (and renewal email) read from studio.billing_*. Updating
    // before recordRenewal means the captured snapshot is fresh.
    await this.applyBillingInfo(params.studio_id, params.billing_info);

    try {
      const result = await this.policy.recordRenewal({
        studio_id: params.studio_id,
        actor_id: params.actor_id,
        actor_type: params.actor_type ?? 'user',
        amount,
        currency: params.currency ?? 'INR',
        new_plan: params.plan || pending ? targetPlan : undefined,
        new_billing_cycle: params.billing_cycle || pending ? targetCycle : undefined,
        // Dedup key — makes recordRenewal idempotent against a replayed payment
        // (double-click / gateway retry) so it can't double-bill the gym.
        payment_reference: params.payment_reference,
        metadata: {
          payment_reference: params.payment_reference,
          payment_method: method,
          // GST audit trail — the invoice PDF splits the total at the
          // CURRENT platform rate; this records the rate actually applied.
          subtotal,
          gst_percent: gst.percent,
          gst_amount: gst.amount,
          // Coupon audit trail — what the list price was and what came off it.
          ...(discount > 0
            ? {
                list_price: listPrice,
                discount_amount: discount,
                discount_code: params.discount_code ?? null,
              }
            : {}),
        },
      });

      // Fresh context post-renewal — push to every connected admin so the UI
      // unlocks before the user even reloads.
      const subscription = await this.policy.getContext(params.studio_id);
      this.gateway.pushStatusChange(params.studio_id, {
        previous_status: result.previous_status,
        subscription,
        reason: 'renewal',
      });

      // Fire-and-forget invoice email. Don't let email failure roll back the
      // renewal — billing already succeeded, the email is a notification.
      this.sendRenewalSuccessEmail({
        studio_id: params.studio_id,
        amount,
        currency: params.currency ?? 'INR',
        payment_method: method,
        payment_reference: params.payment_reference!,
        invoice_id: result.invoice_id,
        invoice_number: result.invoice_number,
        period_start: result.period_start,
        period_end: result.period_end,
        plan_display_name: planInfo.display_name,
        plan_changed: result.plan_changed,
      }).catch((err) =>
        this.logger.warn(`Invoice email queue failed: ${(err as Error).message}`),
      );

      this.logger.log(
        `Renewal recorded: studio=${params.studio_id} plan=${result.plan} ` +
          `cycle=${result.billing_cycle} amount=${amount} ` +
          `period=${result.period_start.toISOString()}..${result.period_end.toISOString()} ` +
          `invoice=${result.invoice_number} method=${method} actor=${params.actor_id}`,
      );

      return {
        success: true,
        period_start: result.period_start,
        period_end: result.period_end,
        invoice_number: result.invoice_number,
        invoice_id: result.invoice_id,
        payment_method: method,
        payment_reference: params.payment_reference,
        plan: result.plan,
        billing_cycle: result.billing_cycle,
        plan_changed: result.plan_changed,
        amount,
        subtotal,
        gst_percent: gst.percent,
        gst_label: gst.label,
        gst_amount: gst.amount,
        subscription,
      };
    } catch (err) {
      // Renewal failed AFTER validation — DB transaction error, unique constraint,
      // gateway webhook race, etc. Notify the customer so they know NOT to retry
      // blindly and can contact support.
      const reason = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Renewal FAILED: studio=${params.studio_id} method=${method} reason=${reason}`,
      );
      this.sendRenewalFailureEmail({
        studio_id: params.studio_id,
        amount,
        currency: params.currency ?? 'INR',
        payment_method: method!,
        payment_reference: params.payment_reference!,
        reason,
      }).catch((e) =>
        this.logger.warn(`Failure email queue failed: ${(e as Error).message}`),
      );
      throw err;
    }
  }

  /**
   * Server-side authoritative pricing for a plan. DB row wins; in-memory
   * PLAN_CONFIGS is the fallback. Returns null for unknown plans so callers
   * can 400 cleanly.
   */
  private async resolvePlanPricing(planName: string): Promise<{
    display_name: string;
    monthly_price: number;
    annual_price: number;
  } | null> {
    const dbPlan = await this.pub.subscriptionPlan
      .findUnique({
        where: { name: planName },
        select: {
          is_active: true,
          display_name: true,
          monthly_price: true,
          annual_price: true,
        },
      })
      .catch(() => null);
    if (dbPlan?.is_active) {
      return {
        display_name: dbPlan.display_name,
        monthly_price: Number(dbPlan.monthly_price),
        annual_price: Number(dbPlan.annual_price),
      };
    }
    const fallback = PLAN_CONFIGS[planName];
    if (!fallback) return null;
    return {
      display_name: fallback.display_name,
      monthly_price: fallback.monthly_price,
      annual_price: fallback.annual_price,
    };
  }

  /**
   * Cancellation flow. The customer keeps full service through the end of the
   * paid period (standard SaaS behavior — no mid-cycle refunds), then lands on
   * the FREE tier instead of drifting into grace → locked.
   *
   * Behavior:
   *   - Logs a `cancel_requested` SubscriptionEvent
   *   - Schedules a downgrade to `free` at next_billing_date (the same
   *     scheduled-change machinery as downgrades; the daily cron applies it)
   *   - Does NOT change lifecycle_status now — access continues until expiry
   *   - Sends an acknowledgement email
   *   - Reactivation = cancelling the scheduled change (DELETE
   *     change-plan/scheduled, surfaced as "Keep current plan" in the UI),
   *     or simply renewing/upgrading — either supersedes the schedule.
   */
  async cancelPlan(params: {
    studio_id: string;
    actor_id: string;
    reason?: string;
  }) {
    const studio = await this.pub.studio.findUnique({
      where: { id: params.studio_id },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        billing_email: true,
        subscription_plan: true,
        billing_cycle: true,
        next_billing_date: true,
        lifecycle_status: true,
      },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    await this.pub.subscriptionEvent.create({
      data: {
        studio_id: studio.id,
        event_type: 'cancel_requested',
        from_status: studio.lifecycle_status,
        to_status: studio.lifecycle_status,
        plan_name: studio.subscription_plan,
        billing_cycle: studio.billing_cycle,
        period_end: studio.next_billing_date,
        actor_id: params.actor_id,
        actor_type: 'user',
        metadata: { reason: params.reason ?? null },
      },
    });

    // Schedule the end-of-period landing on the free tier. Only meaningful
    // when there's a paid period still running and they aren't free already —
    // an expired/locked studio just lapses naturally.
    const downgradeScheduled =
      studio.subscription_plan !== 'free' &&
      !!studio.next_billing_date &&
      studio.next_billing_date.getTime() > Date.now();
    if (downgradeScheduled) {
      await this.policy.schedulePlanChange({
        studio_id: studio.id,
        actor_id: params.actor_id,
        target_plan: 'free',
        target_cycle: 'monthly',
        effective_at: studio.next_billing_date!,
        previous_plan: studio.subscription_plan,
        previous_cycle: studio.billing_cycle,
        metadata: { change_type: 'cancellation', reason: params.reason ?? null },
      });
    }

    this.sendCancellationAckEmail({
      studio_id: studio.id,
      end_of_service: studio.next_billing_date,
      reason: params.reason,
    }).catch((err) =>
      this.logger.warn(`Cancellation email queue failed: ${(err as Error).message}`),
    );

    // ── Referral clawback trigger ────────────────────────────────────
    // If THIS studio was referred by another gym, its cancellation reverses
    // any reward the referrer earned for bringing it in. The referral listener
    // is a no-op if there's no referral or it was never rewarded. We emit at
    // cancel-REQUEST time (not period-end) so a "refer + immediately cancel"
    // fraud loop can't bank the reward in the gap.
    const refundPayload: SubscriptionRefundedPayload = {
      studioId:               studio.id,
      originalIdempotencyKey: '',
      refundReason:           params.reason ?? 'subscription_cancelled',
      refundedAt:             new Date(),
    };
    this.eventEmitter.emit(REFERRAL_EVENTS.SUBSCRIPTION_REFUNDED, refundPayload);

    this.logger.log(
      `Cancel requested: studio=${studio.id} reason="${params.reason ?? ''}"`,
    );

    return {
      success: true,
      message: downgradeScheduled
        ? 'Cancellation recorded. You keep full access until your billing period ends, then your account moves to the Free plan.'
        : 'Cancellation request recorded. Your account remains active until your current billing period ends.',
      access_until: studio.next_billing_date,
      downgrade_to_free_scheduled: downgradeScheduled,
      reactivation_available: true,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Mid-cycle plan changes (proration engine)
  // ────────────────────────────────────────────────────────────

  /**
   * Shared server-side computation behind preview / change / create-order.
   * Decides the execution mode and the money math — never trusts the client:
   *
   *  - immediate_prorated : upgrade mid-period → pay (new − old) × remaining/total
   *                         now (+GST); plan flips immediately; billing date stays.
   *  - scheduled          : downgrade or cycle switch → recorded in the ledger,
   *                         applies at the period boundary. No mid-cycle refunds.
   *  - renewal_due        : no active paid period → change happens via the normal
   *                         renew flow at full price.
   */
  private async computePlanChange(
    studioId: string,
    opts: { plan?: string; billing_cycle?: 'monthly' | 'annual' },
  ) {
    if (!opts.plan) {
      throw new BadRequestException('plan is required.');
    }
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: {
        subscription_plan: true,
        billing_cycle: true,
        next_billing_date: true,
        lifecycle_status: true,
      },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    const currentCycle = (studio.billing_cycle as 'monthly' | 'annual') ?? 'monthly';
    const targetPlan = opts.plan;
    const targetCycle = (opts.billing_cycle ?? currentCycle) as 'monthly' | 'annual';
    if (targetCycle !== 'monthly' && targetCycle !== 'annual') {
      throw new BadRequestException(`Invalid billing_cycle "${opts.billing_cycle}".`);
    }
    if (targetPlan === studio.subscription_plan && targetCycle === currentCycle) {
      throw new BadRequestException('You are already on this plan and billing cycle.');
    }

    const targetInfo = await this.resolvePlanPricing(targetPlan);
    if (!targetInfo) throw new BadRequestException(`Unknown plan "${targetPlan}".`);
    // Unknown/legacy current plan → zero credit rather than blocking the change.
    const currentInfo = (await this.resolvePlanPricing(studio.subscription_plan)) ?? {
      display_name: studio.subscription_plan,
      monthly_price: 0,
      annual_price: 0,
    };

    const currentPrice =
      currentCycle === 'annual' ? currentInfo.annual_price : currentInfo.monthly_price;
    // Same-cycle comparison decides upgrade vs downgrade; the target's own
    // cycle price is what a scheduled change will bill at renewal.
    const targetPriceCurrentCycle =
      currentCycle === 'annual' ? targetInfo.annual_price : targetInfo.monthly_price;
    const targetPriceTargetCycle =
      targetCycle === 'annual' ? targetInfo.annual_price : targetInfo.monthly_price;

    const now = new Date();
    const inActivePaidPeriod =
      studio.lifecycle_status === 'active' &&
      !!studio.next_billing_date &&
      studio.next_billing_date.getTime() > now.getTime();

    const proration = studio.next_billing_date
      ? computeProration({
          current_price: currentPrice,
          target_price: targetPriceCurrentCycle,
          billing_cycle: currentCycle,
          period_end: studio.next_billing_date,
          now,
        })
      : {
          total_days: cycleDays(currentCycle),
          remaining_days: 0,
          unused_credit: 0,
          remaining_cost: 0,
          subtotal: 0,
        };

    const cycleChanged = targetCycle !== currentCycle;
    const mode: PlanChangeMode = classifyPlanChange({
      current_price: currentPrice,
      target_price: targetPriceCurrentCycle,
      cycle_changed: cycleChanged,
      in_active_paid_period: inActivePaidPeriod,
      remaining_days: proration.remaining_days,
    });

    const change_type = cycleChanged
      ? 'cycle_change'
      : targetPriceCurrentCycle > currentPrice
        ? 'upgrade'
        : targetPriceCurrentCycle < currentPrice
          ? 'downgrade'
          : 'lateral';

    const gst =
      mode === 'immediate_prorated'
        ? await this.computeGst(proration.subtotal)
        : { percent: 0, label: 'GST', amount: 0 };
    const total =
      mode === 'immediate_prorated' ? +(proration.subtotal + gst.amount).toFixed(2) : 0;

    return {
      studio,
      now,
      currentCycle,
      targetPlan,
      targetCycle,
      cycleChanged,
      currentInfo,
      targetInfo,
      currentPrice,
      targetPriceCurrentCycle,
      targetPriceTargetCycle,
      inActivePaidPeriod,
      proration,
      mode,
      change_type,
      gst,
      total,
    };
  }

  /**
   * Pending scheduled change usable as the RENEWAL default. Free-tier targets
   * (cancellations) are excluded — a renewal payment implies a paid plan, and
   * paying to renew supersedes the cancellation (that IS reactivation).
   */
  private async getRenewalDefaultChange(studioId: string) {
    const pending = await this.policy.getScheduledPlanChange(studioId);
    if (!pending) return null;
    const p = await this.resolvePlanPricing(pending.target_plan);
    if (!p) return null;
    const price =
      pending.target_cycle === 'annual' ? p.annual_price : p.monthly_price;
    return price > 0 ? pending : null;
  }

  /**
   * Read-only plan-change preview: mode + full proration/GST breakdown so the
   * UI can show "pay ₹X now" or "applies on <date>" before the user commits.
   */
  async getPlanChangePreview(
    studioId: string,
    opts: { plan?: string; billing_cycle?: 'monthly' | 'annual' },
  ) {
    const c = await this.computePlanChange(studioId, opts);
    const pending = await this.policy.getScheduledPlanChange(studioId);

    return {
      mode: c.mode,
      change_type: c.change_type,
      current: {
        plan: c.studio.subscription_plan,
        display_name: c.currentInfo.display_name,
        billing_cycle: c.currentCycle,
        price: c.currentPrice,
        period_end: c.studio.next_billing_date?.toISOString() ?? null,
      },
      target: {
        plan: c.targetPlan,
        display_name: c.targetInfo.display_name,
        billing_cycle: c.targetCycle,
        price: c.targetPriceTargetCycle,
      },
      proration:
        c.mode === 'immediate_prorated'
          ? {
              total_days: c.proration.total_days,
              remaining_days: c.proration.remaining_days,
              unused_credit: c.proration.unused_credit,
              remaining_cost: c.proration.remaining_cost,
            }
          : null,
      subtotal: c.mode === 'immediate_prorated' ? c.proration.subtotal : 0,
      gst_percent: c.gst.percent,
      gst_label: c.gst.label,
      gst_amount: c.gst.amount,
      total: c.total,
      effective_at:
        c.mode === 'immediate_prorated'
          ? c.now.toISOString()
          : c.mode === 'scheduled'
            ? c.studio.next_billing_date!.toISOString()
            : null,
      currency: 'INR',
      pending_change: pending
        ? {
            target_plan: pending.target_plan,
            target_cycle: pending.target_cycle,
            effective_at: pending.effective_at.toISOString(),
          }
        : null,
    };
  }

  /**
   * Execute a plan change. The server (not the client) decides how:
   *  - scheduled changes need no payment — recorded and applied at period end;
   *  - immediate prorated upgrades need a MANUAL payment reference here
   *    (Razorpay goes through createPlanChangeOrder + verify instead);
   *  - a zero prorated difference applies immediately without payment.
   */
  async changePlan(params: {
    studio_id: string;
    actor_id: string;
    plan?: string;
    billing_cycle?: 'monthly' | 'annual';
    payment_method?: string;
    payment_reference?: string;
    billing_info?: {
      billing_name?: string;
      billing_email?: string;
      billing_address?: string;
      tax_id?: string;
    };
  }) {
    const c = await this.computePlanChange(params.studio_id, {
      plan: params.plan,
      billing_cycle: params.billing_cycle,
    });

    if (c.mode === 'renewal_due') {
      throw new BadRequestException(
        'No active paid period — renew and pick the new plan at checkout instead. Proration only applies mid-period.',
      );
    }

    // ── Scheduled downgrade / cycle switch — no payment, applies at boundary ──
    if (c.mode === 'scheduled') {
      await this.policy.schedulePlanChange({
        studio_id: params.studio_id,
        actor_id: params.actor_id,
        target_plan: c.targetPlan,
        target_cycle: c.targetCycle,
        effective_at: c.studio.next_billing_date!,
        previous_plan: c.studio.subscription_plan,
        previous_cycle: c.currentCycle,
        metadata: { change_type: c.change_type },
      });

      this.logger.log(
        `Plan change scheduled: studio=${params.studio_id} ` +
          `${c.studio.subscription_plan}/${c.currentCycle} → ${c.targetPlan}/${c.targetCycle} ` +
          `effective=${c.studio.next_billing_date!.toISOString()}`,
      );

      // Confirmation email — non-blocking, the schedule is already recorded.
      this.sendScheduledChangeEmail({
        studio_id: params.studio_id,
        current_plan_display: c.currentInfo.display_name,
        target_plan_display: c.targetInfo.display_name,
        target_cycle: c.targetCycle,
        effective_at: c.studio.next_billing_date!,
      }).catch((err) =>
        this.logger.warn(
          `Scheduled-change email queue failed: ${(err as Error).message}`,
        ),
      );

      return {
        success: true,
        mode: 'scheduled' as const,
        change_type: c.change_type,
        target_plan: c.targetPlan,
        target_plan_display_name: c.targetInfo.display_name,
        target_cycle: c.targetCycle,
        effective_at: c.studio.next_billing_date!.toISOString(),
        message: `Your ${c.currentInfo.display_name} plan stays active until ${c.studio.next_billing_date!.toDateString()}. The change applies at your next renewal.`,
      };
    }

    // ── Immediate prorated upgrade ──
    if (c.total <= 0) {
      // Prorated difference rounds to zero — apply without payment.
      const result = await this.policy.recordPlanChange({
        studio_id: params.studio_id,
        actor_id: params.actor_id,
        actor_type: 'user',
        new_plan: c.targetPlan,
        amount: 0,
        expected_from_plan: c.studio.subscription_plan,
        metadata: {
          unused_credit: c.proration.unused_credit,
          remaining_cost: c.proration.remaining_cost,
          subtotal: c.proration.subtotal,
        },
      });
      return this.finishPlanChange(params.studio_id, result, 0, 'INR');
    }

    // Paid prorated upgrades are gateway-only: honor-system manual references
    // would let the customer upgrade themselves for free. The verified path is
    // change-plan/create-order → Razorpay Checkout → POST /verify
    // (kind='plan_change' notes → applyVerifiedPlanChange).
    throw new BadRequestException(
      'This upgrade requires online payment — call change-plan/create-order and complete Razorpay Checkout; the upgrade applies after verification.',
    );
  }

  /**
   * Create a Razorpay order for an immediate prorated upgrade. The proration
   * inputs are frozen into the (server-set) order notes; verify re-checks them
   * against the studio before applying so a stale order can't misprice.
   */
  async createPlanChangeOrder(
    studioId: string,
    opts: { plan?: string; billing_cycle?: 'monthly' | 'annual' },
  ) {
    const c = await this.computePlanChange(studioId, opts);

    if (c.mode !== 'immediate_prorated') {
      throw new BadRequestException(
        c.mode === 'scheduled'
          ? 'This change applies at the end of your current period — no payment is needed now. Use change-plan to schedule it.'
          : 'No active paid period — renew and pick the new plan at checkout instead.',
      );
    }
    if (c.total <= 0) {
      throw new BadRequestException(
        'Nothing to pay — the prorated difference is zero. Use change-plan to apply it directly.',
      );
    }

    const order = await this.razorpay.createOrder({
      amount: c.total,
      currency: 'INR',
      receipt: `CHG-${studioId.slice(0, 8)}-${Date.now()}`,
      notes: {
        kind: 'plan_change',
        studio_id: studioId,
        plan: c.targetPlan,
        from_plan: c.studio.subscription_plan,
        billing_cycle: c.currentCycle,
        period_end: c.studio.next_billing_date!.toISOString(),
        subtotal: String(c.proration.subtotal),
        unused_credit: String(c.proration.unused_credit),
        remaining_cost: String(c.proration.remaining_cost),
        gst_amount: String(c.gst.amount),
        gst_percent: String(c.gst.percent),
        total: String(c.total),
      },
    });

    return {
      order_id: order.id,
      key_id: this.razorpay.getKeyId(),
      amount: c.total,
      currency: 'INR',
      plan: c.targetPlan,
      plan_display_name: c.targetInfo.display_name,
      billing_cycle: c.currentCycle,
      remaining_days: c.proration.remaining_days,
      unused_credit: c.proration.unused_credit,
      remaining_cost: c.proration.remaining_cost,
      subtotal: c.proration.subtotal,
      gst_percent: c.gst.percent,
      gst_label: c.gst.label,
      gst_amount: c.gst.amount,
      total: c.total,
    };
  }

  /**
   * Apply a gateway-verified prorated upgrade. Called from verifyAndRenew when
   * the order notes carry kind='plan_change'. Amounts/plan come from the
   * server-set notes; recordPlanChange re-guards against stale orders.
   */
  private async applyVerifiedPlanChange(
    params: {
      studio_id: string;
      actor_id: string;
      gateway_payment_id: string;
      billing_info?: {
        billing_name?: string;
        billing_email?: string;
        billing_address?: string;
        tax_id?: string;
      };
    },
    notes: Record<string, unknown>,
    order: { currency: string },
  ) {
    const targetPlan = String(notes.plan ?? '');
    const total = Number(notes.total);
    if (!targetPlan || !Number.isFinite(total) || total <= 0) {
      throw new BadRequestException('Malformed plan-change order notes.');
    }
    const expectedEnd = notes.period_end ? new Date(String(notes.period_end)) : undefined;

    await this.applyBillingInfo(params.studio_id, params.billing_info);

    const result = await this.policy.recordPlanChange({
      studio_id: params.studio_id,
      actor_id: params.actor_id,
      actor_type: 'user',
      new_plan: targetPlan,
      amount: total,
      currency: order.currency || 'INR',
      payment_reference: params.gateway_payment_id,
      expected_period_end: expectedEnd,
      expected_from_plan: notes.from_plan ? String(notes.from_plan) : undefined,
      metadata: {
        payment_method: 'razorpay',
        payment_reference: params.gateway_payment_id,
        unused_credit: Number(notes.unused_credit ?? 0),
        remaining_cost: Number(notes.remaining_cost ?? 0),
        subtotal: Number(notes.subtotal ?? 0),
        gst_amount: Number(notes.gst_amount ?? 0),
        gst_percent: Number(notes.gst_percent ?? 0),
      },
    });

    const planInfo = await this.resolvePlanPricing(targetPlan);
    return this.finishPlanChange(
      params.studio_id,
      result,
      total,
      order.currency || 'INR',
      'razorpay',
      params.gateway_payment_id,
      planInfo?.display_name ?? targetPlan,
    );
  }

  /** Shared tail of every applied plan change: WS push, email, response. */
  private async finishPlanChange(
    studioId: string,
    result: Awaited<ReturnType<SubscriptionPolicyService['recordPlanChange']>>,
    amount: number,
    currency: string,
    paymentMethod?: string,
    paymentReference?: string,
    planDisplayName?: string,
  ) {
    const subscription = await this.policy.getContext(studioId);
    this.gateway.pushStatusChange(studioId, {
      previous_status: result.previous_status,
      subscription,
      reason: 'plan_change',
    });

    if (!result.replayed && amount > 0 && paymentMethod && paymentReference) {
      this.sendRenewalSuccessEmail({
        studio_id: studioId,
        amount,
        currency,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        invoice_id: result.invoice_id,
        invoice_number: result.invoice_number,
        period_start: result.period_start,
        period_end: result.period_end,
        plan_display_name: planDisplayName,
        plan_changed: true,
      }).catch((err) =>
        this.logger.warn(`Plan-change email queue failed: ${(err as Error).message}`),
      );
    }

    this.logger.log(
      `Prorated upgrade applied: studio=${studioId} ` +
        `${result.previous_plan} → ${result.plan} amount=${amount} ` +
        `invoice=${result.invoice_number || '(none)'} replay=${result.replayed}`,
    );

    return {
      success: true,
      mode: 'immediate_prorated' as const,
      plan: result.plan,
      previous_plan: result.previous_plan,
      billing_cycle: result.billing_cycle,
      period_start: result.period_start,
      period_end: result.period_end,
      invoice_number: result.invoice_number,
      invoice_id: result.invoice_id,
      amount,
      plan_changed: true,
      subscription,
    };
  }

  /** Cancel the pending scheduled plan change. 404 when nothing is pending. */
  async cancelScheduledChange(studioId: string, actorId: string) {
    const cancelled = await this.policy.cancelScheduledPlanChange(studioId, actorId);
    if (!cancelled) {
      throw new NotFoundException('No scheduled plan change to cancel.');
    }
    this.logger.log(
      `Scheduled plan change cancelled: studio=${studioId} target=${cancelled.target_plan}`,
    );
    return {
      success: true,
      cancelled: {
        target_plan: cancelled.target_plan,
        target_cycle: cancelled.target_cycle,
        effective_at: cancelled.effective_at.toISOString(),
      },
    };
  }

  /**
   * Persist billing info from a checkout form. Omitted/empty fields leave the
   * existing values alone. Shared by renew, changePlan and the verify paths so
   * invoices/receipts always read the freshest values.
   */
  private async applyBillingInfo(
    studioId: string,
    bi?: {
      billing_name?: string;
      billing_email?: string;
      billing_address?: string;
      tax_id?: string;
    },
  ): Promise<void> {
    if (!bi) return;
    const data: Record<string, string> = {};
    if (bi.billing_name && bi.billing_name.trim()) data.billing_name = bi.billing_name.trim();
    if (bi.billing_email && bi.billing_email.trim()) data.billing_email = bi.billing_email.trim();
    if (bi.billing_address && bi.billing_address.trim()) data.billing_address = bi.billing_address.trim();
    if (bi.tax_id && bi.tax_id.trim()) data.tax_id = bi.tax_id.trim();
    if (Object.keys(data).length > 0) {
      await this.pub.studio.update({ where: { id: studioId }, data });
    }
  }

  // ────────────────────────────────────────────────────────────
  // Email senders (queue-backed, non-blocking)
  // ────────────────────────────────────────────────────────────

  private async resolveBillingRecipient(studioId: string): Promise<{
    to: string | null;
    studio_name: string;
    studio_slug: string;
    billing_name: string | null;
  }> {
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: {
        name: true,
        slug: true,
        email: true,
        billing_email: true,
        billing_name: true,
        owner_user_id: true,
      },
    });
    if (!studio) return { to: null, studio_name: '', studio_slug: '', billing_name: null };

    // Priority: billing_email (explicit) → studio.email → owner.email
    let to = studio.billing_email || studio.email || null;
    if (!to && studio.owner_user_id) {
      const owner = await this.pub.userIdentity.findUnique({
        where: { id: studio.owner_user_id },
        select: { email: true },
      });
      to = owner?.email ?? null;
    }
    return {
      to,
      studio_name: studio.name,
      studio_slug: studio.slug,
      billing_name: studio.billing_name,
    };
  }

  private frontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('CORS_ORIGINS')?.split(',')[0]?.trim() ||
      'http://localhost:3000'
    );
  }

  private formatMoney(amount: number, currency: string): string {
    const symbol = currency === 'INR' ? '₹' : currency + ' ';
    return `${symbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  private prettyMethod(method: string): string {
    const map: Record<string, string> = {
      upi: 'UPI',
      card: 'Card',
      netbanking: 'Net Banking',
      bank_transfer: 'Bank Transfer',
      cash: 'Cash / Cheque',
      razorpay: 'Razorpay',
    };
    return map[method] || method;
  }

  private async sendRenewalSuccessEmail(p: {
    studio_id: string;
    amount: number;
    currency: string;
    payment_method: string;
    payment_reference: string;
    invoice_id: string;
    invoice_number: string;
    period_start: Date;
    period_end: Date;
    plan_display_name?: string;
    plan_changed?: boolean;
  }): Promise<void> {
    const { to, studio_name, studio_slug, billing_name } =
      await this.resolveBillingRecipient(p.studio_id);
    if (!to) {
      this.logger.warn(
        `No billing email for studio ${p.studio_id}; skipping invoice email`,
      );
      return;
    }

    const fmtDate = (d: Date) =>
      d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    const invoiceUrl = `${this.frontendUrl()}/${studio_slug}/settings/invoices`;
    const subscriptionUrl = `${this.frontendUrl()}/${studio_slug}/settings/subscription`;

    await this.queue.enqueueEmail({
      to,
      subject: `Invoice {{ invoice_number }} — payment received for {{ studio_name }}`,
      template: this.invoiceEmailTemplate(),
      variables: {
        studio_name,
        billed_to: billing_name || studio_name,
        invoice_number: p.invoice_number,
        plan_name: p.plan_display_name || 'Subscription',
        plan_change_note: p.plan_changed
          ? `Your plan changed to ${p.plan_display_name}.`
          : '',
        amount: this.formatMoney(p.amount, p.currency),
        currency: p.currency,
        payment_method: this.prettyMethod(p.payment_method),
        payment_reference: p.payment_reference,
        period_start: fmtDate(p.period_start),
        period_end: fmtDate(p.period_end),
        paid_on: fmtDate(new Date()),
        invoice_url: invoiceUrl,
        subscription_url: subscriptionUrl,
        support_email:
          this.config.get<string>('SUPPORT_EMAIL') || 'support@musclex.app',
        company_name: 'MuscleX',
        year: new Date().getFullYear(),
      },
    });
  }

  private async sendRenewalFailureEmail(p: {
    studio_id: string;
    amount?: number;
    currency: string;
    payment_method: string;
    payment_reference: string;
    reason: string;
  }): Promise<void> {
    const { to, studio_name, studio_slug } = await this.resolveBillingRecipient(
      p.studio_id,
    );
    if (!to) return;

    await this.queue.enqueueEmail({
      to,
      subject: `Payment couldn't be recorded — {{ studio_name }}`,
      template: this.failureEmailTemplate(),
      variables: {
        studio_name,
        amount: p.amount ? this.formatMoney(p.amount, p.currency) : '—',
        payment_method: this.prettyMethod(p.payment_method),
        payment_reference: p.payment_reference,
        reason: p.reason,
        retry_url: `${this.frontendUrl()}/${studio_slug}/settings/subscription`,
        support_email:
          this.config.get<string>('SUPPORT_EMAIL') || 'support@musclex.app',
        company_name: 'MuscleX',
        year: new Date().getFullYear(),
      },
    });
  }

  private async sendCancellationAckEmail(p: {
    studio_id: string;
    end_of_service: Date | null;
    reason?: string;
  }): Promise<void> {
    const { to, studio_name, studio_slug } = await this.resolveBillingRecipient(
      p.studio_id,
    );
    if (!to) return;

    const endDate = p.end_of_service
      ? p.end_of_service.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'the end of your current period';

    await this.queue.enqueueEmail({
      to,
      subject: `Cancellation request received — {{ studio_name }}`,
      template: this.cancellationEmailTemplate(),
      variables: {
        studio_name,
        end_date: endDate,
        reason: p.reason || '—',
        reactivate_url: `${this.frontendUrl()}/${studio_slug}/settings/subscription`,
        support_email:
          this.config.get<string>('SUPPORT_EMAIL') || 'support@musclex.app',
        company_name: 'MuscleX',
        year: new Date().getFullYear(),
      },
    });
  }

  private async sendScheduledChangeEmail(p: {
    studio_id: string;
    current_plan_display: string;
    target_plan_display: string;
    target_cycle: string;
    effective_at: Date;
  }): Promise<void> {
    const { to, studio_name, studio_slug } = await this.resolveBillingRecipient(
      p.studio_id,
    );
    if (!to) return;

    await this.queue.enqueueEmail({
      to,
      subject: `Plan change scheduled — {{ studio_name }}`,
      template: this.scheduledChangeEmailTemplate(),
      variables: {
        studio_name,
        current_plan: p.current_plan_display,
        target_plan: p.target_plan_display,
        target_cycle: p.target_cycle === 'annual' ? 'Annual' : 'Monthly',
        effective_date: p.effective_at.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        manage_url: `${this.frontendUrl()}/${studio_slug}/settings/subscription`,
        support_email:
          this.config.get<string>('SUPPORT_EMAIL') || 'support@musclex.app',
        company_name: 'MuscleX',
        year: new Date().getFullYear(),
      },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Email templates (Mustache-style {{ var }} rendered by EmailProcessor)
  // ────────────────────────────────────────────────────────────

  private invoiceEmailTemplate(): string {
    // Inline-styled HTML — email clients are notoriously strict about CSS.
    return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f8;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
      <tr><td style="padding:32px 36px 16px;background:linear-gradient(135deg,#0ea5e9 0%,#22c55e 100%);color:#fff;">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">Payment confirmed</div>
        <div style="font-size:26px;font-weight:700;margin-top:8px;">{{ amount }} <span style="font-size:14px;font-weight:400;opacity:.8;">received</span></div>
        <div style="font-size:13px;opacity:.85;margin-top:6px;">{{ studio_name }} · Invoice {{ invoice_number }}</div>
      </td></tr>
      <tr><td style="padding:28px 36px;">
        <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#374151;">
          Hi {{ billed_to }} — we've recorded your subscription payment. Below are the details for your records.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;font-size:13.5px;background:#f8fafc;border-radius:10px;padding:18px;margin-bottom:18px;">
          <tr><td style="padding:7px 0;color:#6b7280;">Invoice number</td><td style="padding:7px 0;text-align:right;font-weight:600;font-family:'Menlo','Consolas',monospace;">{{ invoice_number }}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Billed to</td><td style="padding:7px 0;text-align:right;">{{ billed_to }}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Amount paid</td><td style="padding:7px 0;text-align:right;font-weight:700;color:#0f172a;">{{ amount }}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Payment method</td><td style="padding:7px 0;text-align:right;">{{ payment_method }}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Reference</td><td style="padding:7px 0;text-align:right;font-family:'Menlo','Consolas',monospace;font-size:12.5px;">{{ payment_reference }}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;">Paid on</td><td style="padding:7px 0;text-align:right;">{{ paid_on }}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;border-top:1px solid #e5e7eb;">Service period</td><td style="padding:7px 0;text-align:right;border-top:1px solid #e5e7eb;font-weight:600;">{{ period_start }} — {{ period_end }}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><a href="{{ invoice_url }}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:11px 18px;border-radius:9px;">View invoice</a></td>
          <td><a href="{{ subscription_url }}" style="display:inline-block;color:#0f172a;text-decoration:none;font-weight:500;font-size:13px;padding:11px 12px;">Manage subscription →</a></td>
        </tr></table>
        <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;">
          This payment was recorded by an administrator of {{ studio_name }}. If you didn't authorize this charge,
          reply to this email or contact <a href="mailto:{{ support_email }}" style="color:#0ea5e9;">{{ support_email }}</a> within 48 hours.
        </p>
      </td></tr>
      <tr><td style="padding:18px 36px 28px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:11.5px;color:#9ca3af;text-align:center;line-height:1.6;">
        © {{ year }} {{ company_name }} · This is an automated billing notification.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  }

  private failureEmailTemplate(): string {
    return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f8;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
      <tr><td style="padding:28px 32px 8px;background:#fef2f2;border-bottom:1px solid #fecaca;">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#b91c1c;font-weight:600;">Payment could not be recorded</div>
        <div style="font-size:20px;font-weight:700;margin-top:6px;color:#7f1d1d;">{{ studio_name }}</div>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#374151;">
          We tried to record your renewal payment, but something went wrong on our side. <strong>No money has been deducted by us</strong> — but if your payment gateway already charged you, the funds will auto-reverse within 5–7 business days.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13.5px;background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:18px;">
          <tr><td style="padding:6px 0;color:#6b7280;">Amount attempted</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{ amount }}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Method</td><td style="padding:6px 0;text-align:right;">{{ payment_method }}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Reference</td><td style="padding:6px 0;text-align:right;font-family:'Menlo','Consolas',monospace;font-size:12.5px;">{{ payment_reference }}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">Reason</td><td style="padding:6px 0;text-align:right;color:#b91c1c;">{{ reason }}</td></tr>
        </table>
        <a href="{{ retry_url }}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:11px 18px;border-radius:9px;">Try again</a>
        <p style="margin:20px 0 0;font-size:12.5px;line-height:1.6;color:#6b7280;">
          If this keeps happening, reply to this email or write to <a href="mailto:{{ support_email }}" style="color:#0ea5e9;">{{ support_email }}</a> with the reference above — we'll resolve it quickly.
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:11.5px;color:#9ca3af;text-align:center;">
        © {{ year }} {{ company_name }}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  }

  private cancellationEmailTemplate(): string {
    return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f8;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
      <tr><td style="padding:26px 32px;background:#fffbeb;border-bottom:1px solid #fde68a;">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#92400e;font-weight:600;">Cancellation requested</div>
        <div style="font-size:20px;font-weight:700;margin-top:6px;color:#7c2d12;">{{ studio_name }}</div>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#374151;">
          We've received your request to cancel. You'll continue to have full access until <strong>{{ end_date }}</strong>, after which your account will become read-only.
        </p>
        <p style="margin:0 0 14px;font-size:13.5px;line-height:1.55;color:#6b7280;">
          Reason on file: <em>{{ reason }}</em>
        </p>
        <a href="{{ reactivate_url }}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:11px 18px;border-radius:9px;">Reactivate plan</a>
        <p style="margin:20px 0 0;font-size:12.5px;line-height:1.6;color:#9ca3af;">
          Changed your mind? You can reactivate any time before {{ end_date }} — your data, members, and history stay intact.
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:11.5px;color:#9ca3af;text-align:center;">
        © {{ year }} {{ company_name }} · Need help? <a href="mailto:{{ support_email }}" style="color:#0ea5e9;">{{ support_email }}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  }

  private scheduledChangeEmailTemplate(): string {
    return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f8;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
      <tr><td style="padding:26px 32px;background:#eff6ff;border-bottom:1px solid #bfdbfe;">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#1d4ed8;font-weight:600;">Plan change scheduled</div>
        <div style="font-size:20px;font-weight:700;margin-top:6px;color:#1e3a8a;">{{ studio_name }}</div>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#374151;">
          Your subscription will switch from <strong>{{ current_plan }}</strong> to
          <strong>{{ target_plan }} ({{ target_cycle }})</strong> on <strong>{{ effective_date }}</strong>.
          Until then, nothing changes — you keep your current plan and all its features.
        </p>
        <p style="margin:0 0 18px;font-size:13.5px;line-height:1.55;color:#6b7280;">
          Nothing was charged today. Your next renewal bills the new plan's price.
          Changed your mind? You can cancel this scheduled change any time before it takes effect.
        </p>
        <a href="{{ manage_url }}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:11px 18px;border-radius:9px;">Manage subscription</a>
      </td></tr>
      <tr><td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:11.5px;color:#9ca3af;text-align:center;">
        © {{ year }} {{ company_name }} · Need help? <a href="mailto:{{ support_email }}" style="color:#0ea5e9;">{{ support_email }}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  }

  /**
   * Compute the next period without persisting. Useful for the renewal modal
   * to show the customer exactly what dates they'll get and how many days
   * they'll lose (continuity-strict).
   */
  async simulateRenewal(
    studioId: string,
    opts: { plan?: string; billing_cycle?: 'monthly' | 'annual' } = {},
  ) {
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: {
        next_billing_date: true,
        billing_cycle: true,
        subscription_plan: true,
      },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    const pending =
      opts.plan || opts.billing_cycle
        ? null
        : await this.getRenewalDefaultChange(studioId);

    const targetPlan = opts.plan ?? pending?.target_plan ?? studio.subscription_plan;
    const targetCycle = (opts.billing_cycle ??
      pending?.target_cycle ??
      studio.billing_cycle) as 'monthly' | 'annual';
    if (targetCycle !== 'monthly' && targetCycle !== 'annual') {
      throw new BadRequestException(
        `Invalid billing_cycle "${opts.billing_cycle}". Allowed: monthly, annual`,
      );
    }

    const planInfo = await this.resolvePlanPricing(targetPlan);
    if (!planInfo) {
      throw new BadRequestException(`Unknown plan "${targetPlan}".`);
    }

    const period = this.policy.computeNextPeriod(
      studio.next_billing_date,
      targetCycle,
    );

    const lostDays =
      studio.next_billing_date && studio.next_billing_date < new Date()
        ? Math.ceil(
            (Date.now() - studio.next_billing_date.getTime()) /
              (24 * 60 * 60 * 1000),
          )
        : 0;

    // Preview the same GST-inclusive total renew() will record, so the
    // checkout summary matches the charge to the paisa.
    const subtotal =
      targetCycle === 'annual'
        ? planInfo.annual_price
        : planInfo.monthly_price;
    const gst = await this.computeGst(subtotal);
    const amount = +(subtotal + gst.amount).toFixed(2);

    return {
      ...period,
      plan: targetPlan,
      plan_display_name: planInfo.display_name,
      billing_cycle: targetCycle,
      amount,
      subtotal,
      gst_percent: gst.percent,
      gst_label: gst.label,
      gst_amount: gst.amount,
      currency: 'INR',
      plan_changed: targetPlan !== studio.subscription_plan,
      cycle_changed: targetCycle !== studio.billing_cycle,
      // True when the previewed plan/cycle comes from a scheduled change that
      // this renewal would consume (customer scheduled a downgrade earlier).
      applies_scheduled_change: !!pending,
      continuity_mode: 'strict' as const,
      days_lost_to_continuity: lostDays,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Admin
  // ────────────────────────────────────────────────────────────

  /**
   * Manual lifecycle override for SaaS admins. Logged in the ledger.
   */
  async setLifecycleStatus(
    studioId: string,
    targetStatus: 'active' | 'suspended',
    adminId: string,
    reason: string,
  ) {
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: { lifecycle_status: true, subscription_plan: true, billing_cycle: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    const previous = studio.lifecycle_status;

    if (targetStatus === 'suspended') {
      await this.pub.$transaction([
        this.pub.studio.update({
          where: { id: studioId },
          data: {
            lifecycle_status: 'suspended',
            suspended_at: new Date(),
          },
        }),
        this.pub.subscriptionEvent.create({
          data: {
            studio_id: studioId,
            event_type: 'suspended',
            from_status: previous,
            to_status: 'suspended',
            plan_name: studio.subscription_plan,
            billing_cycle: studio.billing_cycle,
            actor_id: adminId,
            actor_type: 'admin',
            metadata: { reason },
          },
        }),
      ]);
    } else {
      // Reactivate — re-run policy compute to determine if active/grace/locked.
      await this.pub.studio.update({
        where: { id: studioId },
        data: { suspended_at: null },
      });
      await this.policy.recomputeForStudio(studioId);
      await this.pub.subscriptionEvent.create({
        data: {
          studio_id: studioId,
          event_type: 'reactivated',
          from_status: previous,
          to_status: 'active',
          plan_name: studio.subscription_plan,
          billing_cycle: studio.billing_cycle,
          actor_id: adminId,
          actor_type: 'admin',
          metadata: { reason },
        },
      });
    }

    this.policy.invalidateCache(studioId);

    const subscription = await this.policy.getContext(studioId);
    this.gateway.pushStatusChange(studioId, {
      previous_status: previous as any,
      subscription,
      reason: 'admin_action',
    });

    return subscription;
  }

  // ────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────

  private async resolvePlanInfo(studioId: string) {
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: { subscription_plan: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    const dbPlan = await this.pub.subscriptionPlan
      .findUnique({ where: { name: studio.subscription_plan } })
      .catch(() => null);

    if (dbPlan) {
      return {
        display_name: dbPlan.display_name,
        monthly_price: Number(dbPlan.monthly_price),
        annual_price: Number(dbPlan.annual_price),
        grace_days: dbPlan.grace_days,
      };
    }

    const fallback = PLAN_CONFIGS[studio.subscription_plan] ?? PLAN_CONFIGS.free;
    return {
      display_name: fallback.display_name,
      monthly_price: fallback.monthly_price,
      annual_price: fallback.annual_price,
      grace_days: 3,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Invoices (subscription billing)
  // ────────────────────────────────────────────────────────────

  /**
   * Paginated list of subscription invoices for a tenant. Lightweight
   * cursor pagination keyed on created_at — the index already covers it.
   */
  async listInvoices(
    studioId: string,
    opts: { limit?: number; cursor?: string } = {},
  ) {
    const take = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const rows = await this.pub.invoice.findMany({
      where: { studio_id: studioId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(opts.cursor
        ? { skip: 1, cursor: { id: opts.cursor } }
        : {}),
      select: {
        id: true,
        invoice_number: true,
        amount: true,
        currency: true,
        status: true,
        billing_period_start: true,
        billing_period_end: true,
        paid_at: true,
        created_at: true,
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items: items.map((r) => ({
        id: r.id,
        invoice_number: r.invoice_number,
        amount: Number(r.amount),
        currency: r.currency,
        status: r.status,
        billing_period_start: r.billing_period_start.toISOString(),
        billing_period_end: r.billing_period_end.toISOString(),
        paid_at: r.paid_at?.toISOString() ?? null,
        created_at: r.created_at.toISOString(),
      })),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getInvoice(studioId: string, invoiceId: string) {
    const invoice = await this.pub.invoice.findFirst({
      where: { id: invoiceId, studio_id: studioId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
      select: {
        name: true,
        billing_name: true,
        billing_email: true,
        billing_address: true,
        tax_id: true,
      },
    });

    // Best-effort: find the renewal / plan-change event linked to this invoice
    // for plan/cycle (prorated upgrades write 'plan_changed', not 'renewed').
    const event = await this.pub.subscriptionEvent.findFirst({
      where: {
        studio_id: studioId,
        event_type: { in: ['renewed', 'plan_changed'] },
        metadata: { path: ['invoice_id'], equals: invoiceId },
      },
      orderBy: { created_at: 'desc' },
    });

    const paymentEvent = await this.pub.subscriptionEvent.findFirst({
      where: {
        studio_id: studioId,
        event_type: 'payment_recorded',
        metadata: { path: ['invoice_id'], equals: invoiceId },
      },
      orderBy: { created_at: 'desc' },
    });

    const meta = (paymentEvent?.metadata ?? event?.metadata ?? {}) as Record<
      string,
      unknown
    >;
    const num = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) ? v : null;

    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: Number(invoice.amount),
      currency: invoice.currency,
      status: invoice.status,
      billing_period_start: invoice.billing_period_start.toISOString(),
      billing_period_end: invoice.billing_period_end.toISOString(),
      paid_at: invoice.paid_at?.toISOString() ?? null,
      created_at: invoice.created_at.toISOString(),
      plan_name: event?.plan_name ?? null,
      billing_cycle: event?.billing_cycle ?? null,
      payment_method: typeof meta.payment_method === 'string' ? meta.payment_method : null,
      payment_reference:
        typeof meta.payment_reference === 'string' ? meta.payment_reference : null,
      // Tax + proration breakdown RECORDED at payment time (audit-accurate even
      // if the platform GST rate changes later). Null on legacy invoices that
      // predate metadata capture — consumers fall back to a current-rate split.
      subtotal: num(meta.subtotal),
      gst_percent: num(meta.gst_percent),
      gst_amount: num(meta.gst_amount),
      // Present only on prorated plan-change invoices.
      unused_credit: num(meta.unused_credit),
      remaining_cost: num(meta.remaining_cost),
      billed_to: {
        name: studio?.billing_name || studio?.name || '',
        email: studio?.billing_email ?? null,
        address: studio?.billing_address ?? null,
        tax_id: studio?.tax_id ?? null,
      },
    };
  }

  /**
   * Server-side PDF rendering. Returns the binary + suggested filename.
   * Uses @react-pdf/renderer; template id is read from studio settings or
   * defaults to 'classic'.
   */
  async renderInvoicePdf(
    studioId: string,
    invoiceId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const detail = await this.getInvoice(studioId, invoiceId);

    // Invoice template choice is currently stored client-side (localStorage)
    // on /settings/invoices. Defaulting to 'classic' server-side keeps PDFs
    // consistent for everyone until that pref is persisted to studio settings.
    const template = 'classic' as
      | 'classic'
      | 'modern'
      | 'minimal'
      | 'detailed'
      | 'branded';

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

    const planLabel = detail.plan_name
      ? `${detail.plan_name.charAt(0).toUpperCase()}${detail.plan_name.slice(1)} plan${
          detail.billing_cycle
            ? ` (${detail.billing_cycle === 'annual' ? 'Annual' : 'Monthly'})`
            : ''
        }`
      : 'Subscription';

    const money = (n: number) =>
      `${detail.currency === 'INR' ? '₹' : detail.currency + ' '}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    const prettyMethod = (m: string | null) => (m ? this.prettyMethod(m) : '—');

    // The recorded amount is GST-inclusive (the total charged). Prefer the tax
    // split RECORDED at payment time (event metadata) so a later platform-rate
    // change never rewrites a historical invoice. Legacy invoices without
    // metadata fall back to backing GST out at the current platform rate.
    const gstSetting = await this.readGstSetting();
    let invSubtotal: number;
    let invTax: number;
    let gstPercent: number;
    if (detail.gst_percent !== null && detail.subtotal !== null) {
      invSubtotal = detail.subtotal;
      invTax = detail.gst_amount ?? +(detail.amount - invSubtotal).toFixed(2);
      gstPercent = detail.gst_percent;
    } else {
      const hasGst = gstSetting.enabled && gstSetting.percent > 0;
      invSubtotal = hasGst
        ? +(detail.amount / (1 + gstSetting.percent / 100)).toFixed(2)
        : detail.amount;
      invTax = hasGst ? +(detail.amount - invSubtotal).toFixed(2) : 0;
      gstPercent = gstSetting.percent;
    }
    const hasTax = invTax > 0;
    const pctLabel = Number(gstPercent.toFixed(2)).toString();

    const { renderInvoicePdfBuffer } = await import('./invoice-pdf.renderer');

    const buffer = await renderInvoicePdfBuffer({
      template,
      invoice_number: detail.invoice_number,
      invoice_date: fmtDate(detail.created_at),
      status_label: detail.status.toUpperCase(),
      status_paid: detail.status === 'paid',
      issuer_name: 'MuscleX',
      issuer_address: undefined,
      issuer_email:
        this.config.get<string>('SUPPORT_EMAIL') || 'support@musclex.app',
      billed_to_name: detail.billed_to.name,
      billed_to_email: detail.billed_to.email ?? undefined,
      billed_to_address: detail.billed_to.address ?? undefined,
      billed_to_tax_id: detail.billed_to.tax_id ?? undefined,
      items:
        // Prorated upgrade: show the spec-standard breakdown — new-plan charge
        // for the remaining days minus the unused credit of the old plan.
        detail.unused_credit !== null &&
        detail.unused_credit > 0 &&
        detail.remaining_cost !== null
          ? [
              {
                description: `${planLabel} — prorated upgrade (remaining period)`,
                period_start: fmtDate(detail.billing_period_start),
                period_end: fmtDate(detail.billing_period_end),
                amount: money(detail.remaining_cost),
              },
              {
                description: 'Credit — unused portion of previous plan',
                period_start: fmtDate(detail.billing_period_start),
                period_end: fmtDate(detail.billing_period_end),
                // ASCII hyphen — the PDF font drops U+2212, silently losing the sign.
                amount: `-${money(detail.unused_credit)}`,
              },
            ]
          : [
              {
                description: planLabel,
                period_start: fmtDate(detail.billing_period_start),
                period_end: fmtDate(detail.billing_period_end),
                amount: money(invSubtotal),
              },
            ],
      subtotal: money(invSubtotal),
      tax_label: hasTax ? `${gstSetting.label} (${pctLabel}%)` : 'Tax (0%)',
      tax_amount: money(invTax),
      total: money(detail.amount),
      payment_method: detail.payment_method
        ? prettyMethod(detail.payment_method)
        : undefined,
      payment_reference: detail.payment_reference ?? undefined,
      footer_note: `Thank you for choosing MuscleX. For billing questions, contact ${
        this.config.get<string>('SUPPORT_EMAIL') || 'support@musclex.app'
      }.`,
    });

    return {
      buffer,
      filename: `${detail.invoice_number}.pdf`,
    };
  }

}
