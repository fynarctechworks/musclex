import { apiClient } from '@/services/api-client';
import type {
  PlanChangePreview,
  SubscriptionRenewalPreview,
  SubscriptionStatusResponse,
} from './types';

export const subscriptionApi = {
  getStatus: () =>
    apiClient.get<SubscriptionStatusResponse>('/subscription/status'),

  getEvents: (limit = 50) =>
    apiClient.get<
      Array<{
        id: string;
        event_type: string;
        from_status: string | null;
        to_status: string | null;
        plan_name: string | null;
        billing_cycle: string | null;
        amount: string | null;
        currency: string | null;
        period_start: string | null;
        period_end: string | null;
        actor_type: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }>
    >('/subscription/events', { params: { limit } }),

  getRenewalPreview: (opts?: {
    plan?: string;
    billing_cycle?: 'monthly' | 'annual';
  }) =>
    apiClient.get<SubscriptionRenewalPreview>('/subscription/renewal-preview', {
      params: opts,
    }),

  renew: (body: {
    plan?: string;
    billing_cycle?: 'monthly' | 'annual';
    currency?: string;
    payment_reference: string;
    payment_method: PaymentMethod;
    billing_name?: string;
    billing_email?: string;
    billing_address?: string;
    tax_id?: string;
  }) =>
    apiClient.post<{
      success: boolean;
      period_start: string;
      period_end: string;
      invoice_number: string;
      invoice_id: string;
      payment_method: PaymentMethod;
      payment_reference: string;
      plan: string;
      billing_cycle: 'monthly' | 'annual';
      plan_changed: boolean;
      amount: number;
      subscription: SubscriptionStatusResponse['subscription'];
    }>('/subscription/renew', body),

  /** Create a Razorpay order for an online renewal / plan switch. */
  createOrder: (body: {
    plan?: string;
    billing_cycle?: 'monthly' | 'annual';
    coupon_code?: string;
  }) =>
    apiClient.post<{
      order_id: string;
      key_id: string;
      amount: number;
      currency: string;
      plan: string;
      billing_cycle: 'monthly' | 'annual';
      plan_display_name: string;
      list_price?: number;
      coupon_code?: string | null;
      coupon_name?: string | null;
      discount_amount?: number;
    }>('/subscription/create-order', body),

  /**
   * Validate a platform coupon (created in the SaaS Control Center) and get the
   * resulting breakdown. Preview only — the charged amount is always recomputed
   * server-side when the order is created.
   */
  validateCoupon: (body: {
    code: string;
    plan?: string;
    billing_cycle?: 'monthly' | 'annual';
  }) =>
    apiClient.post<{
      valid: boolean;
      coupon_code: string | null;
      coupon_name: string | null;
      discount_amount: number;
      /** Nothing left to pay — activate via redeemCoupon, not Razorpay. */
      covers_full_amount: boolean;
      list_price: number;
      subtotal: number;
      gst_percent: number;
      gst_label: string;
      gst_amount: number;
      total: number;
    }>('/subscription/validate-coupon', body),

  /**
   * Redeem a coupon that covers the full amount — activates the subscription
   * with no gateway payment. The server re-resolves the coupon and refuses
   * unless the total is genuinely zero.
   */
  redeemCoupon: (body: {
    code: string;
    plan?: string;
    billing_cycle?: 'monthly' | 'annual';
    billing_name?: string;
    billing_email?: string;
    billing_address?: string;
    tax_id?: string;
  }) =>
    apiClient.post<{
      invoice_id: string;
      invoice_number: string;
      period_start: string;
      period_end: string;
      plan_changed: boolean;
      amount: number;
    }>('/subscription/redeem-coupon', body),

  /** Verify the Razorpay Checkout handshake; records the renewal server-side. */
  verifyPayment: (body: {
    gateway_order_id: string;
    gateway_payment_id: string;
    signature: string;
    billing_name?: string;
    billing_email?: string;
    billing_address?: string;
    tax_id?: string;
  }) =>
    apiClient.post<{
      success: boolean;
      invoice_number: string;
      invoice_id: string;
      plan: string;
      billing_cycle: 'monthly' | 'annual';
      plan_changed: boolean;
      amount: number;
    }>('/subscription/verify', body),

  listInvoices: (opts: { limit?: number; cursor?: string } = {}) =>
    apiClient.get<{
      items: Array<{
        id: string;
        invoice_number: string;
        amount: number;
        currency: string;
        status: string;
        billing_period_start: string;
        billing_period_end: string;
        paid_at: string | null;
        created_at: string;
      }>;
      next_cursor: string | null;
    }>('/subscription/invoices', { params: opts }),

  invoicePdfUrl: (invoiceId: string, download = false) =>
    `/api/v1/subscription/invoices/${invoiceId}/pdf${download ? '?download=1' : ''}`,

  cancel: (body: { reason?: string } = {}) =>
    apiClient.post<{
      success: boolean;
      message: string;
      access_until: string | null;
      /** True when the end-of-period downgrade to the Free plan was scheduled. */
      downgrade_to_free_scheduled?: boolean;
      reactivation_available: boolean;
    }>('/subscription/cancel', body),

  // ── Mid-cycle plan changes (proration engine) ──────────────────

  /** Server-side preview: is this an immediate prorated upgrade, a scheduled change, or renewal-due? */
  getChangePlanPreview: (opts: {
    plan: string;
    billing_cycle?: 'monthly' | 'annual';
  }) =>
    apiClient.get<PlanChangePreview>('/subscription/change-plan/preview', {
      params: opts,
    }),

  /**
   * Execute a plan change. Scheduled changes need no payment fields; manual
   * prorated upgrades need payment_method + payment_reference. Razorpay
   * upgrades use createChangePlanOrder + verifyPayment instead.
   */
  changePlan: (body: {
    plan: string;
    billing_cycle?: 'monthly' | 'annual';
    payment_method?: PaymentMethod;
    payment_reference?: string;
    billing_name?: string;
    billing_email?: string;
    billing_address?: string;
    tax_id?: string;
  }) =>
    apiClient.post<{
      success: boolean;
      mode: 'immediate_prorated' | 'scheduled';
      // scheduled:
      change_type?: string;
      target_plan?: string;
      target_plan_display_name?: string;
      target_cycle?: 'monthly' | 'annual';
      effective_at?: string;
      message?: string;
      // immediate_prorated:
      plan?: string;
      previous_plan?: string;
      invoice_number?: string;
      invoice_id?: string;
      amount?: number;
    }>('/subscription/change-plan', body),

  /** Razorpay order for an immediate prorated upgrade (verify applies it). */
  createChangePlanOrder: (body: {
    plan: string;
    billing_cycle?: 'monthly' | 'annual';
  }) =>
    apiClient.post<{
      order_id: string;
      key_id: string;
      amount: number;
      currency: string;
      plan: string;
      plan_display_name: string;
      billing_cycle: 'monthly' | 'annual';
      remaining_days: number;
      unused_credit: number;
      remaining_cost: number;
      subtotal: number;
      gst_percent: number;
      gst_label: string;
      gst_amount: number;
      total: number;
    }>('/subscription/change-plan/create-order', body),

  /** Cancel the pending scheduled plan change (keep the current plan). */
  cancelScheduledChange: () =>
    apiClient.delete<{
      success: boolean;
      cancelled: {
        target_plan: string;
        target_cycle: 'monthly' | 'annual';
        effective_at: string;
      };
    }>('/subscription/change-plan/scheduled'),
};

export type PaymentMethod = 'razorpay';

/**
 * Platform-subscription payments are GATEWAY-ONLY. This is a remote SaaS
 * payment (gym → MuscleX) — honor-system manual modes (cash, "enter your own
 * UTR") are unverifiable and were removed; the backend rejects them too.
 * Card / UPI / netbanking / wallet are all available INSIDE Razorpay Checkout.
 */
export const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
  comingSoon?: boolean;
}> = [
  { value: 'razorpay', label: 'Razorpay Checkout', description: 'Pay securely by card, UPI, netbanking or wallet — recorded automatically.' },
];
