/**
 * Provider-agnostic billing gateway contract used by BillingService.retryPayment
 * and (next phase) SubscriptionService auto-renewal. All amounts at this layer
 * are in major currency units (rupees) — adapters convert internally.
 */

export interface ChargeInput {
  amount: number;
  currency: string;
  tenant_id: string;
  payment_id: string;
  description?: string;
  /**
   * Optional saved-payment-method reference (e.g. Razorpay recurring token).
   * Required by the Razorpay adapter for headless server-initiated charges.
   * Sandbox ignores this.
   */
  customer_token?: string | null;
}

export type ChargeStatus = 'PAID' | 'FAILED' | 'PENDING';

export interface ChargeResult {
  status: ChargeStatus;
  gateway_payment_id?: string;
  failure_reason?: string;
  raw?: unknown;
}

export interface RefundInput {
  gateway_payment_id: string;
  amount: number;
  currency: string;
  reason?: string;
}

export type RefundStatus = 'REFUNDED' | 'PENDING' | 'FAILED';

export interface RefundResult {
  status: RefundStatus;
  gateway_refund_id?: string;
  failure_reason?: string;
  raw?: unknown;
}

export interface BillingGateway {
  readonly name: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}

export const BILLING_GATEWAY = Symbol('BILLING_GATEWAY');
