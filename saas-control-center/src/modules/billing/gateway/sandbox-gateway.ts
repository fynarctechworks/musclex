import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  BillingGateway,
  ChargeInput,
  ChargeResult,
  RefundInput,
  RefundResult,
} from './billing-gateway.interface';

/**
 * SandboxGateway — deterministic, no network. Default behaviour is success
 * for both charge and refund. Failure can be forced for testing/dev via:
 *   - env `BILLING_SANDBOX_FORCE=fail` (forces all charges & refunds to fail), or
 *   - per-request: pass an input whose `description` contains the marker
 *     `__force_fail__` (used by integration tests without touching env).
 */
@Injectable()
export class SandboxGateway implements BillingGateway {
  readonly name = 'sandbox';
  private readonly logger = new Logger(SandboxGateway.name);
  private readonly forceFail: boolean;

  constructor(config: ConfigService) {
    this.forceFail = (config.get<string>('BILLING_SANDBOX_FORCE') ?? '').toLowerCase() === 'fail';
    this.logger.log(`SandboxGateway active (forceFail=${this.forceFail})`);
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (this.shouldFail(input.description)) {
      return {
        status: 'FAILED',
        failure_reason: 'sandbox: forced failure',
      };
    }
    return {
      status: 'PAID',
      gateway_payment_id: `sbox_pay_${crypto.randomBytes(8).toString('hex')}`,
      raw: { sandbox: true, charged: input.amount, currency: input.currency },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    if (this.shouldFail(input.reason)) {
      return {
        status: 'FAILED',
        failure_reason: 'sandbox: forced failure',
      };
    }
    return {
      status: 'REFUNDED',
      gateway_refund_id: `sbox_ref_${crypto.randomBytes(8).toString('hex')}`,
      raw: { sandbox: true, refunded: input.amount, currency: input.currency },
    };
  }

  private shouldFail(marker?: string): boolean {
    if (this.forceFail) return true;
    if (marker && marker.includes('__force_fail__')) return true;
    return false;
  }
}
