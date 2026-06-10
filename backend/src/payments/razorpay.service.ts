import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Thin Razorpay client over the public REST API (https://api.razorpay.com/v1).
 * Deliberately SDK-free — uses native `fetch` (Node 18+) + `crypto` so we add no
 * new dependency. Keys come from env (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`);
 * per-gym overrides via `payment_gateway_configs` can be layered on later.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly apiBase = 'https://api.razorpay.com/v1';

  constructor(private readonly config: ConfigService) {}

  private get keyId(): string {
    return this.config.get<string>('RAZORPAY_KEY_ID', '');
  }
  private get keySecret(): string {
    return this.config.get<string>('RAZORPAY_KEY_SECRET', '');
  }

  /** True when both key id + secret are configured. */
  get configured(): boolean {
    return !!(this.keyId && this.keySecret);
  }

  getKeyId(): string {
    return this.keyId;
  }

  private authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  /**
   * Create a Razorpay order. `amount` is in the major unit (e.g. rupees) and is
   * converted to the smallest unit (paise) here. Returns the Razorpay order.
   */
  async createOrder(params: {
    amount: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number; currency: string; status: string }> {
    if (!this.configured) {
      throw new BadRequestException(
        'Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)',
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
          Authorization: this.authHeader(),
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
  async getOrder(orderId: string): Promise<{
    id: string;
    amount: number;
    amount_paid: number;
    currency: string;
    status: string;
    notes?: Record<string, string>;
  }> {
    if (!this.configured) {
      throw new BadRequestException('Razorpay is not configured');
    }
    let res: Response;
    try {
      res = await fetch(`${this.apiBase}/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: this.authHeader() },
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
  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.keySecret || !signature) return false;
    const expected = createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
