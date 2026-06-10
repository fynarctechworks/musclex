import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { generateIdempotencyKey } from '@/lib/idempotency';
import type { Payment, ApiResponse } from '@/types';

interface PaymentFilters {
  page?: number;
  limit?: number;
  status?: string;
  tenant_id?: string;
  gateway?: string;
}

export interface BillingIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  title: string;
  detail?: string;
}

export interface TenantBillingDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    owner_email: string;
    owner_name: string;
    phone: string | null;
    plan: { id: string; name: string; price_monthly: number; price_yearly: number } | null;
  };
  subscription: {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    auto_renew: boolean;
    canceled_at: string | null;
  } | null;
  billing_info: {
    billing_name: string | null;
    billing_email: string | null;
    billing_address: string | null;
    tax_id: string | null;
    gstin: string | null;
    business_name: string | null;
    currency: string | null;
    billing_cycle: string | null;
  } | null;
  lifecycle: {
    plan: string | null;
    status: string | null;
    subscription_status: string | null;
    subscription_start: string | null;
    subscription_expires_at: string | null;
    next_billing_date: string | null;
    trial_ends_at: string | null;
    grace_until: string | null;
    locked_at: string | null;
    suspended_at: string | null;
  } | null;
  invoices: Array<{
    id: string;
    invoice_number: string;
    amount: number;
    currency: string;
    status: string;
    billing_period_start: string | null;
    billing_period_end: string | null;
    paid_at: string | null;
    invoice_url: string | null;
    created_at: string;
  }>;
  payments: Payment[];
  summary: {
    total_paid: number;
    paid_count: number;
    pending_count: number;
    failed_count: number;
    refunded_count: number;
    invoice_count: number;
    last_payment_at: string | null;
    currency: string;
  };
  issues: BillingIssue[];
}

export function useTenantBillingDetail(tenantId: string | null) {
  return useQuery({
    queryKey: ['billing-detail', tenantId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TenantBillingDetail>>(
        `/billing/tenants/${tenantId}`,
      );
      return data.data;
    },
    enabled: !!tenantId,
  });
}

export function usePayments(filters: PaymentFilters = {}) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '')
          params.set(key, String(value));
      });
      const { data } = await api.get(`/billing/payments?${params}`);
      return data as {
        data: Payment[];
        meta: { total: number; page: number; limit: number; total_pages: number };
      };
    },
  });
}

/**
 * Generates a single Idempotency-Key per mutation invocation. React Query may
 * retry the network call internally; all retries reuse the same key so the
 * backend can replay the original response rather than re-executing.
 */
function postWithIdempotency<T>(path: string) {
  return async () => {
    const key = generateIdempotencyKey();
    const { data } = await api.post<ApiResponse<T>>(path, null, {
      headers: { 'Idempotency-Key': key },
    });
    return data.data;
  };
}

export function useRetryPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      postWithIdempotency<Payment>(`/billing/payments/${id}/retry`)(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}

export function useMarkPaymentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      postWithIdempotency<Payment>(`/billing/payments/${id}/mark-paid`)(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      postWithIdempotency<Payment>(`/billing/payments/${id}/refund`)(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}
