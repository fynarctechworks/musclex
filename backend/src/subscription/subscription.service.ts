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
import { PLAN_CONFIGS } from '../common/plan-configs';
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
    opts: { plan?: string; billing_cycle?: 'monthly' | 'annual' },
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
    if (targetCycle !== 'monthly' && targetCycle !== 'annual') {
      throw new BadRequestException(`Invalid billing_cycle "${targetCycle}".`);
    }

    const planInfo = await this.resolvePlanPricing(targetPlan);
    if (!planInfo) throw new BadRequestException(`Unknown plan "${targetPlan}".`);

    const amount =
      targetCycle === 'annual' ? planInfo.annual_price : planInfo.monthly_price;
    if (amount <= 0) {
      throw new BadRequestException(`Plan "${targetPlan}" is free — no payment required.`);
    }

    const order = await this.razorpay.createOrder({
      amount,
      currency: 'INR',
      receipt: `SUB-${studioId.slice(0, 8)}-${Date.now()}`,
      notes: {
        kind: 'subscription',
        studio_id: studioId,
        plan: targetPlan,
        billing_cycle: targetCycle,
      },
    });

    return {
      order_id: order.id,
      key_id: this.razorpay.getKeyId(),
      amount,
      currency: 'INR',
      plan: targetPlan,
      billing_cycle: targetCycle,
      plan_display_name: planInfo.display_name,
    };
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

    return this.renew({
      studio_id: params.studio_id,
      actor_id: params.actor_id,
      actor_type: 'user',
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
    const [studio, context, plan] = await Promise.all([
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
    ]);

    if (!studio) throw new NotFoundException('Studio not found');

    const amountDue =
      studio.billing_cycle === 'annual'
        ? plan.annual_price
        : plan.monthly_price;

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
      currency: 'INR',
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
  ] as const;

  async renew(params: {
    studio_id: string;
    actor_id: string;
    actor_type?: 'user' | 'webhook' | 'admin';
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

    const targetPlan = params.plan ?? studio.subscription_plan;
    const targetCycle = (params.billing_cycle ?? studio.billing_cycle) as
      | 'monthly'
      | 'annual';
    if (targetCycle !== 'monthly' && targetCycle !== 'annual') {
      throw new BadRequestException(
        `Invalid billing_cycle "${params.billing_cycle}". Allowed: monthly, annual`,
      );
    }

    const planInfo = await this.resolvePlanPricing(targetPlan);
    if (!planInfo) {
      throw new BadRequestException(`Unknown plan "${targetPlan}".`);
    }

    const amount =
      targetCycle === 'annual'
        ? planInfo.annual_price
        : planInfo.monthly_price;
    if (amount <= 0) {
      throw new BadRequestException(
        `Plan "${targetPlan}" is free — no payment required.`,
      );
    }

    // ── Persist billing info from the checkout form FIRST ──
    // The invoice (and renewal email) read from studio.billing_*. Updating
    // before recordRenewal means the captured snapshot is fresh.
    if (params.billing_info) {
      const bi = params.billing_info;
      const data: Record<string, string> = {};
      if (bi.billing_name && bi.billing_name.trim()) data.billing_name = bi.billing_name.trim();
      if (bi.billing_email && bi.billing_email.trim()) data.billing_email = bi.billing_email.trim();
      if (bi.billing_address && bi.billing_address.trim()) data.billing_address = bi.billing_address.trim();
      if (bi.tax_id && bi.tax_id.trim()) data.tax_id = bi.tax_id.trim();
      if (Object.keys(data).length > 0) {
        await this.pub.studio.update({
          where: { id: params.studio_id },
          data,
        });
      }
    }

    try {
      const result = await this.policy.recordRenewal({
        studio_id: params.studio_id,
        actor_id: params.actor_id,
        actor_type: params.actor_type ?? 'user',
        amount,
        currency: params.currency ?? 'INR',
        new_plan: params.plan ? targetPlan : undefined,
        new_billing_cycle: params.billing_cycle ? targetCycle : undefined,
        // Dedup key — makes recordRenewal idempotent against a replayed payment
        // (double-click / gateway retry) so it can't double-bill the gym.
        payment_reference: params.payment_reference,
        metadata: {
          payment_reference: params.payment_reference,
          payment_method: method,
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
   * Placeholder cancellation flow. Records the cancel REQUEST in the ledger
   * but does NOT immediately downgrade the plan or revoke access — the
   * customer keeps service through the end of the paid period (standard SaaS
   * behavior). Full cancellation logic (final-bill, data retention timer,
   * reactivation window) will land when you give the call. For now, the API
   * is wired so the UI button has somewhere real to land.
   *
   * Behavior today:
   *   - Logs a `cancel_requested` SubscriptionEvent
   *   - Does NOT change lifecycle_status (the cron will lock them naturally
   *     at next_billing_date + grace)
   *   - Sends an acknowledgement email
   *   - Returns the next_billing_date so the UI can say "you'll have access
   *     until DD MMM YYYY"
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
      message:
        'Cancellation request recorded. Your account remains active until your current billing period ends.',
      access_until: studio.next_billing_date,
      reactivation_available: true,
    };
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

    const targetPlan = opts.plan ?? studio.subscription_plan;
    const targetCycle = (opts.billing_cycle ?? studio.billing_cycle) as
      | 'monthly'
      | 'annual';
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

    const amount =
      targetCycle === 'annual'
        ? planInfo.annual_price
        : planInfo.monthly_price;

    return {
      ...period,
      plan: targetPlan,
      plan_display_name: planInfo.display_name,
      billing_cycle: targetCycle,
      amount,
      currency: 'INR',
      plan_changed: targetPlan !== studio.subscription_plan,
      cycle_changed: targetCycle !== studio.billing_cycle,
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

    // Best-effort: find the renewal event linked to this invoice for plan/cycle.
    const event = await this.pub.subscriptionEvent.findFirst({
      where: {
        studio_id: studioId,
        event_type: 'renewed',
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
      items: [
        {
          description: planLabel,
          period_start: fmtDate(detail.billing_period_start),
          period_end: fmtDate(detail.billing_period_end),
          amount: money(detail.amount),
        },
      ],
      subtotal: money(detail.amount),
      tax_label: 'Tax (0%)',
      tax_amount: money(0),
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
