import { apiClient } from '@/services/api-client';
import type {
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
  createOrder: (body: { plan?: string; billing_cycle?: 'monthly' | 'annual' }) =>
    apiClient.post<{
      order_id: string;
      key_id: string;
      amount: number;
      currency: string;
      plan: string;
      billing_cycle: 'monthly' | 'annual';
      plan_display_name: string;
    }>('/subscription/create-order', body),

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
      reactivation_available: boolean;
    }>('/subscription/cancel', body),
};

export type PaymentMethod =
  | 'upi'
  | 'card'
  | 'netbanking'
  | 'bank_transfer'
  | 'cash'
  | 'razorpay';

export const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
  comingSoon?: boolean;
}> = [
  { value: 'upi',           label: 'UPI',              description: 'Pay via GPay, PhonePe, Paytm, BHIM. Enter UPI reference / UTR.' },
  { value: 'card',          label: 'Card',             description: 'Visa, Mastercard, RuPay. Enter authorization reference.' },
  { value: 'netbanking',    label: 'Net Banking',      description: 'IMPS / NEFT direct bank transfer. Enter UTR.' },
  { value: 'bank_transfer', label: 'Bank Transfer',    description: 'NEFT / RTGS to our settlement account. Enter UTR.' },
  { value: 'cash',          label: 'Cash / Cheque',    description: 'Manual reconciliation. Enter receipt reference.' },
  { value: 'razorpay',      label: 'Razorpay Checkout', description: 'Pay instantly by card, UPI, netbanking or wallet — auto-recorded.' },
];
