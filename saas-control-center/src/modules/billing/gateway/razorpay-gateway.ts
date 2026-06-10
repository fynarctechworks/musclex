import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  BillingGateway,
  ChargeInput,
  ChargeResult,
  RefundInput,
  RefundResult,
} from './billing-gateway.interface';

/**
 * RazorpayGateway — REST adapter over axios (no `razorpay` SDK dependency).
 *
 * Headless server-initiated charges require a previously-saved Razorpay
 * recurring token, surfaced as `ChargeInput.customer_token`. When absent
 * (current schema state — Subscription has no token field yet) we return a
 * structured FAILED result so the caller (BillingService / auto-renew cron)
 * can transition the subscription to PAST_DUE for manual follow-up.
 *
 * Refunds are synchronous and work against any captured payment id, no token
 * required.
 */
@Injectable()
export class RazorpayGateway implements BillingGateway {
  readonly name = 'razorpay';
  private readonly logger = new Logger(RazorpayGateway.name);
  private readonly http: AxiosInstance;

  constructor(config: ConfigService) {
    const keyId = config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      throw new Error(
        'RazorpayGateway selected but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing',
      );
    }
    this.http = axios.create({
      baseURL: 'https://api.razorpay.com/v1',
      timeout: 15_000,
      auth: { username: keyId, password: keySecret },
    });
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (!input.customer_token) {
      return {
        status: 'FAILED',
        failure_reason:
          'No saved Razorpay recurring token on file for tenant — manual collection required',
      };
    }
    try {
      const { data } = await this.http.post('/payments/create/recurring', {
        email: undefined,
        contact: undefined,
        amount: this.toMinor(input.amount),
        currency: input.currency,
        token: input.customer_token,
        notes: {
          tenant_id: input.tenant_id,
          payment_id: input.payment_id,
        },
        description: input.description,
      });
      const status: ChargeResult['status'] = data?.status === 'captured' ? 'PAID' : 'PENDING';
      return {
        status,
        gateway_payment_id: data?.id,
        raw: data,
      };
    } catch (err) {
      return this.formatError<ChargeResult>(err, 'FAILED');
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    try {
      const { data } = await this.http.post(
        `/payments/${encodeURIComponent(input.gateway_payment_id)}/refund`,
        {
          amount: this.toMinor(input.amount),
          notes: input.reason ? { reason: input.reason } : undefined,
        },
      );
      const status: RefundResult['status'] =
        data?.status === 'processed' ? 'REFUNDED'
        : data?.status === 'pending' ? 'PENDING'
        : 'FAILED';
      return {
        status,
        gateway_refund_id: data?.id,
        raw: data,
      };
    } catch (err) {
      return this.formatError<RefundResult>(err, 'FAILED');
    }
  }

  private toMinor(amount: number): number {
    return Math.round(amount * 100);
  }

  private formatError<T extends { status: string; failure_reason?: string; raw?: unknown }>(
    err: unknown,
    fallbackStatus: T['status'],
  ): T {
    if (err instanceof AxiosError) {
      const reason =
        (err.response?.data as any)?.error?.description ??
        err.message ??
        'Razorpay request failed';
      this.logger.warn(
        `Razorpay error [${err.response?.status ?? 'no-status'}]: ${reason}`,
      );
      return {
        status: fallbackStatus,
        failure_reason: reason,
        raw: err.response?.data,
      } as T;
    }
    this.logger.error(`Razorpay unexpected error: ${(err as Error)?.message}`);
    return {
      status: fallbackStatus,
      failure_reason: (err as Error)?.message ?? 'unknown gateway error',
    } as T;
  }
}
