import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/** Per-gym key override (from payment_gateway_configs); falls back to env. */
export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

/**
 * Thin Razorpay client over the public REST API (https://api.razorpay.com/v1).
 * Deliberately SDK-free — uses native `fetch` (Node 18+) + `crypto` so we add no
 * new dependency. Keys: an explicit per-gym `creds` argument wins (sourced from
 * the gym's payment_gateway_configs row by PaymentsService); otherwise the
 * platform env keys (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`).
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly apiBase = 'https://api.razorpay.com/v1';

  constructor(private readonly config: ConfigService) {}

  private get envKeyId(): string {
    return this.config.get<string>('RAZORPAY_KEY_ID', '');
  }
  private get envKeySecret(): string {
    return this.config.get<string>('RAZORPAY_KEY_SECRET', '');
  }

  private resolve(creds?: RazorpayCredentials): RazorpayCredentials {
    if (creds?.keyId && creds?.keySecret) return creds;
    return { keyId: this.envKeyId, keySecret: this.envKeySecret };
  }

  /** True when platform-global keys are configured (per-gym may still exist). */
  get configured(): boolean {
    return !!(this.envKeyId && this.envKeySecret);
  }

  getKeyId(creds?: RazorpayCredentials): string {
    return this.resolve(creds).keyId;
  }

  private authHeader(creds: RazorpayCredentials): string {
    return 'Basic ' + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
  }

  /**
   * Refund a captured payment, wholly or in part.
   *
   * Refunds were previously ledger-only — `Refund.gateway_refund_id` existed in
   * the schema but nothing ever called a gateway, so the money never actually
   * left. `speed: 'normal'` (not 'optimum') keeps this on the free rail.
   *
   * `amount` is in the major unit and converted to paise here. Returns the
   * Razorpay refund, whose `id` is stored as `gateway_refund_id`.
   */
  async refundPayment(
    params: {
      /** Razorpay payment id (`pay_...`), NOT our internal payment row id. */
      gatewayPaymentId: string;
      /** Omit for a full refund. */
      amount?: number;
      notes?: Record<string, string>;
    },
    creds?: RazorpayCredentials,
  ): Promise<{ id: string; amount: number; status: string }> {
    const resolved = this.resolve(creds);
    if (!resolved.keyId || !resolved.keySecret) {
      throw new BadRequestException('Razorpay is not configured');
    }

    const body: Record<string, unknown> = { speed: 'normal' };
    if (params.amount != null) {
      const minor = Math.round(Number(params.amount) * 100);
      if (!Number.isFinite(minor) || minor <= 0) {
        throw new BadRequestException('Invalid refund amount');
      }
      body.amount = minor;
    }
    if (params.notes) body.notes = params.notes;

    let res: Response;
    try {
      res = await fetch(
        `${this.apiBase}/payments/${encodeURIComponent(params.gatewayPaymentId)}/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.authHeader(resolved),
          },
          body: JSON.stringify(body),
        },
      );
    } catch (err) {
      this.logger.error(`Razorpay refund request failed: ${(err as Error).message}`);
      throw new BadRequestException('Could not reach Razorpay');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Razorpay refund failed (${res.status}): ${text}`);
      throw new BadRequestException(
        `Razorpay rejected the refund: ${res.status === 400 ? text.slice(0, 200) : res.status}`,
      );
    }
    return (await res.json()) as { id: string; amount: number; status: string };
  }

  /**
   * Create a Razorpay order. `amount` is in the major unit (e.g. rupees) and is
   * converted to the smallest unit (paise) here. Returns the Razorpay order.
   */
  async createOrder(
    params: {
      amount: number;
      currency?: string;
      receipt: string;
      notes?: Record<string, string>;
    },
    creds?: RazorpayCredentials,
  ): Promise<{ id: string; amount: number; currency: string; status: string }> {
    const resolved = this.resolve(creds);
    if (!resolved.keyId || !resolved.keySecret) {
      throw new BadRequestException(
        'Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or the gym\'s gateway config)',
      );
    }
    const amountMinor = Math.round(Number(params.amount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      throw new BadRequestException('Invalid order amount');
    }

    let res: Response;
    try {
      res = await fetch(`${this.apiBase}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader(resolved),
        },
        body: JSON.stringify({
          amount: amountMinor,
          currency: params.currency || 'INR',
          receipt: params.receipt,
          notes: params.notes,
          payment_capture: 1,
        }),
      });
    } catch (err) {
      this.logger.error(`Razorpay order request failed: ${(err as Error).message}`);
      throw new BadRequestException('Could not reach Razorpay');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Razorpay order create failed (${res.status}): ${text}`);
      throw new BadRequestException('Failed to create Razorpay order');
    }
    return (await res.json()) as { id: string; amount: number; currency: string; status: string };
  }

  /**
   * Fetch an order by id. Used to read back the server-set `notes` (plan,
   * billing_cycle, studio_id) authoritatively during verify — so a client
   * cannot pay for a cheap order then claim an expensive plan.
   */
  async getOrder(
    orderId: string,
    creds?: RazorpayCredentials,
  ): Promise<{
    id: string;
    amount: number;
    amount_paid: number;
    currency: string;
    status: string;
    notes?: Record<string, string>;
  }> {
    const resolved = this.resolve(creds);
    if (!resolved.keyId || !resolved.keySecret) {
      throw new BadRequestException('Razorpay is not configured');
    }
    let res: Response;
    try {
      res = await fetch(`${this.apiBase}/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: this.authHeader(resolved) },
      });
    } catch (err) {
      this.logger.error(`Razorpay order fetch failed: ${(err as Error).message}`);
      throw new BadRequestException('Could not reach Razorpay');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Razorpay order fetch failed (${res.status}): ${text}`);
      throw new BadRequestException('Failed to fetch Razorpay order');
    }
    return (await res.json()) as {
      id: string;
      amount: number;
      amount_paid: number;
      currency: string;
      status: string;
      notes?: Record<string, string>;
    };
  }

  /**
   * Verify the Razorpay Checkout handshake signature.
   * Razorpay signs `${order_id}|${payment_id}` with the **key secret** (NOT the
   * webhook secret) using HMAC-SHA256. Timing-safe compare.
   */
  verifyCheckoutSignature(
    orderId: string,
    paymentId: string,
    signature: string,
    creds?: RazorpayCredentials,
  ): boolean {
    const { keySecret } = this.resolve(creds);
    if (!keySecret || !signature) return false;
    const expected = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
