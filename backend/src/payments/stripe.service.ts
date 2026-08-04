import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * SDK-free Stripe REST client — same approach as RazorpayService (fetch +
 * crypto, no `stripe` npm dependency). Global env keys for now
 * (STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET); the
 * per-gym PaymentGatewayConfig override can be layered on later, same as
 * Razorpay.
 *
 * Amounts: Stripe wants minor units (paise for INR), like Razorpay.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly base = 'https://api.stripe.com/v1';

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(this.config.get<string>('STRIPE_SECRET_KEY'));
  }

  getPublishableKey(): string {
    return this.config.get<string>('STRIPE_PUBLISHABLE_KEY') ?? '';
  }

  /** amount in RUPEES (major units); converted to minor units here. */
  async createPaymentIntent(
    params: {
      amount: number;
      currency?: string;
      metadata?: Record<string, string>;
    },
    secretKeyOverride?: string,
  ): Promise<{ id: string; client_secret: string; amount: number; currency: string; status: string }> {
    const body: Record<string, string> = {
      amount: String(Math.round(params.amount * 100)),
      currency: (params.currency ?? 'inr').toLowerCase(),
      'automatic_payment_methods[enabled]': 'true',
    };
    for (const [k, v] of Object.entries(params.metadata ?? {})) {
      body[`metadata[${k}]`] = v;
    }
    return this.post('/payment_intents', body, secretKeyOverride);
  }

  async getPaymentIntent(
    id: string,
    secretKeyOverride?: string,
  ): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
  }> {
    const response = await fetch(`${this.base}/payment_intents/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${this.secretKey(secretKeyOverride)}` },
    });
    if (!response.ok) {
      const err = await response.text().catch(() => 'unknown');
      throw new Error(`Stripe API ${response.status}: ${err}`);
    }
    return (await response.json()) as any;
  }

  /**
   * Verify a `Stripe-Signature` header (t=...,v1=...) against the raw body:
   * v1 = HMAC-SHA256(`${t}.${rawBody}`, webhook secret), timing-safe, with a
   * replay tolerance window.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string, toleranceSeconds = 300): boolean {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret || !signatureHeader) return false;

    const parts = new Map<string, string[]>();
    for (const piece of signatureHeader.split(',')) {
      const [k, v] = piece.split('=', 2);
      if (!k || v === undefined) continue;
      const key = k.trim();
      parts.set(key, [...(parts.get(key) ?? []), v.trim()]);
    }
    const timestamp = Number(parts.get('t')?.[0]);
    const candidates = parts.get('v1') ?? [];
    if (!Number.isFinite(timestamp) || candidates.length === 0) return false;
    if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

    const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const expectedBuf = Buffer.from(expected);
    return candidates.some((candidate) => {
      const candidateBuf = Buffer.from(candidate);
      return candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf);
    });
  }

  // ────────────────────────────────────────────────────────────────

  /**
   * Refund a PaymentIntent, wholly or in part. Refunds were previously
   * ledger-only — this actually moves the money back.
   *
   * `amount` is in the major unit and converted to the smallest unit here.
   */
  async refundPayment(
    params: { paymentIntentId: string; amount?: number; reason?: string },
    secretKeyOverride?: string,
  ): Promise<{ id: string; amount: number; status: string }> {
    const form: Record<string, string> = {
      payment_intent: params.paymentIntentId,
    };
    if (params.amount != null) {
      const minor = Math.round(Number(params.amount) * 100);
      if (!Number.isFinite(minor) || minor <= 0) {
        throw new Error('Invalid refund amount');
      }
      form.amount = String(minor);
    }
    // Stripe only accepts a fixed enum here; free-text goes in metadata.
    if (params.reason) form['metadata[reason]'] = params.reason.slice(0, 500);

    return this.post<{ id: string; amount: number; status: string }>(
      '/refunds',
      form,
      secretKeyOverride,
    );
  }

  private secretKey(override?: string): string {
    const key = override?.trim() || this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
    return key;
  }

  private async post<T>(path: string, form: Record<string, string>, secretKeyOverride?: string): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey(secretKeyOverride)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
    });
    if (!response.ok) {
      const err = await response.text().catch(() => 'unknown');
      throw new Error(`Stripe API ${response.status}: ${err}`);
    }
    return (await response.json()) as T;
  }
}
