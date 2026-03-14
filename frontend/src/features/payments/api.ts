import { apiClient } from '@/services/api-client';

// ── Payments ──────────────────────────────────────────────

export interface PaymentFilters {
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const paymentsApi = {
  list: (filters?: PaymentFilters) =>
    apiClient.get('/payments', { params: filters }),

  recordCash: (data: {
    member_id: string;
    membership_id?: string;
    branch_id: string;
    amount: number;
    notes?: string;
  }) => apiClient.post('/payments/cash', data),

  createOrder: (data: {
    member_id: string;
    plan_id: string;
    branch_id: string;
    gateway: 'razorpay' | 'stripe';
  }) => apiClient.post('/payments/create-order', data),

  verifyPayment: (data: {
    gateway_payment_id: string;
    gateway_order_id: string;
    signature: string;
    member_id: string;
    plan_id: string;
    branch_id: string;
  }) => apiClient.post('/payments/verify', data),

  getInvoiceForPayment: (paymentId: string) =>
    apiClient.get(`/payments/${paymentId}/invoice`),
};

// ── Expenses ──────────────────────────────────────────────

export interface ExpenseFilters {
  branch_id?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const expensesApi = {
  list: (filters?: ExpenseFilters) =>
    apiClient.get('/expenses', { params: filters }),

  create: (data: {
    branch_id: string;
    category: string;
    description: string;
    amount: number;
    expense_date: string;
    receipt_url?: string;
    recorded_by_staff_id: string;
  }) => apiClient.post('/expenses', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/expenses/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/expenses/${id}`),
};

// ── Invoices ──────────────────────────────────────────────

export interface InvoiceFilters {
  branch_id?: string;
  member_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceLineItem {
  item_type: 'membership' | 'class' | 'personal_training' | 'product';
  item_id?: string;
  description: string;
  quantity?: number;
  unit_price: number;
}

export const invoicesApi = {
  list: (filters?: InvoiceFilters) =>
    apiClient.get('/invoices', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/invoices/${id}`),

  create: (data: {
    branch_id: string;
    member_id: string;
    items: InvoiceLineItem[];
    discount_id?: string;
    discount_code?: string;
    tax_rate_id?: string;
    due_date?: string;
    notes?: string;
  }) => apiClient.post('/invoices', data),

  updateStatus: (id: string, status: 'pending' | 'paid' | 'partial' | 'cancelled' | 'refunded') =>
    apiClient.patch(`/invoices/${id}/status`, { status }),

  cancel: (id: string) =>
    apiClient.post(`/invoices/${id}/cancel`),
};

// ── Refunds ───────────────────────────────────────────────

export interface RefundFilters {
  payment_id?: string;
  member_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const refundsApi = {
  list: (filters?: RefundFilters) =>
    apiClient.get('/refunds', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/refunds/${id}`),

  process: (data: {
    payment_id: string;
    refund_amount: number;
    reason?: string;
    processed_by?: string;
  }) => apiClient.post('/refunds', data),
};

// ── Discounts ─────────────────────────────────────────────

export const discountsApi = {
  list: (filters?: { is_active?: boolean; applicable_to?: string }) =>
    apiClient.get('/discounts', { params: filters }),

  get: (id: string) =>
    apiClient.get(`/discounts/${id}`),

  validate: (code: string) =>
    apiClient.get(`/discounts/validate/${code}`),

  create: (data: {
    name: string;
    code?: string;
    discount_type: 'percentage' | 'fixed';
    value: number;
    min_purchase?: number;
    max_discount?: number;
    valid_from: string;
    valid_until?: string;
    max_uses?: number;
    applicable_to?: 'membership' | 'class' | 'personal_training' | 'all';
  }) => apiClient.post('/discounts', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/discounts/${id}`, data),
};

// ── Tax Rates ─────────────────────────────────────────────

export const taxRatesApi = {
  list: (country?: string) =>
    apiClient.get('/tax-rates', { params: country ? { country } : undefined }),

  create: (data: { country: string; state?: string; tax_name: string; rate: number }) =>
    apiClient.post('/tax-rates', data),

  update: (id: string, data: { rate?: number; is_active?: boolean }) =>
    apiClient.patch(`/tax-rates/${id}`, data),
};

// ── Payment Gateways ──────────────────────────────────────

export const gatewaysApi = {
  list: () =>
    apiClient.get('/payment-gateways'),

  create: (data: {
    gateway_name: 'razorpay' | 'stripe';
    api_key: string;
    secret_key: string;
    webhook_secret?: string;
    is_test_mode?: boolean;
  }) => apiClient.post('/payment-gateways', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/payment-gateways/${id}`, data),
};

// ── Financial Reports ─────────────────────────────────────

export const financialReportsApi = {
  daily: (branchId: string, date?: string) =>
    apiClient.get('/financial-reports/daily', { params: { branch_id: branchId, date } }),

  monthly: (branchId: string, year?: number, month?: number) =>
    apiClient.get('/financial-reports/monthly', { params: { branch_id: branchId, year, month } }),

  dashboard: (branchId: string) =>
    apiClient.get('/financial-reports/dashboard', { params: { branch_id: branchId } }),

  membershipRevenue: (branchId: string, dateFrom?: string, dateTo?: string) =>
    apiClient.get('/financial-reports/membership-revenue', {
      params: { branch_id: branchId, date_from: dateFrom, date_to: dateTo },
    }),

  ledger: (filters?: {
    branch_id?: string;
    reference_type?: string;
    transaction_type?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get('/financial-reports/ledger', { params: filters }),
};
