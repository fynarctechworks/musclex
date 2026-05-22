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
  category_id?: string;
  category?: string;
  status?: 'confirmed' | 'pending' | 'reversed';
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateExpenseInput {
  branch_id: string;
  /** Either category_id (preferred) or category slug */
  category_id?: string;
  category?: string;
  description: string;
  amount: number;
  currency?: string;
  expense_date: string;
  receipt_url?: string;
  vendor?: string;
  notes?: string;
  payment_method?: 'cash' | 'bank_transfer' | 'upi' | 'card';
  idempotency_key?: string;
}

export interface ReverseExpenseInput {
  reason?: string;
  notes?: string;
}

export interface ExportExpensesInput {
  format: 'csv' | 'xlsx';
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  category_id?: string;
}

export const expensesApi = {
  list: (filters?: ExpenseFilters) =>
    apiClient.get('/expenses', { params: filters }),

  timeline: (filters?: ExpenseFilters) =>
    apiClient.get('/expenses/timeline', { params: filters }),

  summary: (branchId: string, month?: string) =>
    apiClient.get('/expenses/summary', {
      params: { branch_id: branchId, month },
    }),

  intelligence: (branchId: string, range?: { date_from?: string; date_to?: string }) =>
    apiClient.get('/expenses/intelligence', {
      params: { branch_id: branchId, ...range },
    }),

  getById: (id: string) =>
    apiClient.get(`/expenses/${id}`),

  create: (data: CreateExpenseInput) =>
    apiClient.post('/expenses', data),

  reverse: (id: string, data: ReverseExpenseInput) =>
    apiClient.post(`/expenses/${id}/reverse`, data),

  exportFile: async (params: ExportExpensesInput): Promise<Blob> => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const url = new URL(`${base}/expenses/export`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
    const stored = typeof window !== 'undefined' ? localStorage.getItem('auth-storage') : null;
    const token = stored ? (JSON.parse(stored)?.state?.accessToken ?? null) : null;
    const activeBranchId = stored ? (JSON.parse(stored)?.state?.activeBranchId ?? null) : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (activeBranchId) headers['X-Active-Branch-Id'] = activeBranchId;
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`Export failed: ${res.status} ${res.statusText}`);
    return res.blob();
  },
};

// ── Expense Categories ────────────────────────────────────

export interface ExpenseCategoryInput {
  name: string;
  branch_id?: string | null;
  icon?: string;
  color?: string;
  sort_order?: number;
}

export const expenseCategoriesApi = {
  list: (filters?: { branch_id?: string; include_inactive?: boolean }) =>
    apiClient.get('/expense-categories', { params: filters }),

  create: (data: ExpenseCategoryInput) =>
    apiClient.post('/expense-categories', data),

  update: (
    id: string,
    data: Partial<ExpenseCategoryInput> & { is_active?: boolean },
  ) => apiClient.patch(`/expense-categories/${id}`, data),

  deactivate: (id: string) =>
    apiClient.delete(`/expense-categories/${id}`),
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
    place_of_supply?: string;
  }) => apiClient.post('/invoices', data),

  updateStatus: (id: string, status: 'pending' | 'paid' | 'partial' | 'cancelled' | 'refunded') =>
    apiClient.patch(`/invoices/${id}/status`, { status }),

  cancel: (id: string) =>
    apiClient.post(`/invoices/${id}/cancel`),

  /** Returns { document_id, signed_url, storage_path } pointing at the rendered PDF. */
  pdfLink: (id: string) =>
    apiClient.get(`/invoices/${id}/pdf`, { params: { inline: 'false' } }),

  /** Opens the inline PDF stream in a new tab — returns the URL with auth header preflight handled. */
  pdfStreamUrl: (id: string) => `/invoices/${id}/pdf`,

  send: (id: string, body: {
    channels: Array<'email' | 'whatsapp'>;
    email_override?: string;
    phone_override?: string;
  }) => apiClient.post(`/invoices/${id}/send`, body),
};

// ── POS receipts (document engine) ────────────────────────
export const posReceiptsApi = {
  pdfLink: (saleId: string, format: 'a4' | 'thermal_80mm' = 'a4') =>
    apiClient.get(`/pos/sales/${saleId}/receipt`, { params: { inline: 'false', format } }),

  send: (saleId: string, body: {
    channels: Array<'email' | 'whatsapp'>;
    format?: 'a4' | 'thermal_80mm';
    email_override?: string;
    phone_override?: string;
  }) => apiClient.post(`/pos/sales/${saleId}/send-receipt`, body),
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
