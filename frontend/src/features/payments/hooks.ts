import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import {
  paymentsApi,
  expensesApi,
  expenseCategoriesApi,
  invoicesApi,
  posReceiptsApi,
  refundsApi,
  discountsApi,
  financialReportsApi,
  type PaymentFilters,
  type ExpenseFilters,
  type ExpenseCategoryInput,
  type ExportExpensesInput,
  type InvoiceFilters,
  type RefundFilters,
} from './api';
import { toast } from 'sonner';

// ── Payments ──────────────────────────────────────────────

export function usePayments(filters?: PaymentFilters) {
  return useQuery({
    queryKey: queryKeys.payments.list(filters),
    queryFn: () => paymentsApi.list(filters),
  });
}

export function useRecordCashPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentsApi.recordCash,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.payments.all });
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success('Cash payment recorded');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreatePaymentOrder() {
  return useMutation({
    mutationFn: paymentsApi.createOrder,
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: paymentsApi.verifyPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.payments.all });
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success('Payment verified');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Expenses ──────────────────────────────────────────────

export function useExpenses(filters?: ExpenseFilters) {
  return useQuery({
    queryKey: queryKeys.expenses.list(filters),
    queryFn: () => expensesApi.list(filters),
  });
}

export function useExpenseTimeline(filters?: ExpenseFilters) {
  return useQuery({
    queryKey: queryKeys.expenses.timeline(filters),
    queryFn: () => expensesApi.timeline(filters),
    enabled: !!filters?.branch_id,
  });
}

export function useExpenseSummary(branchId?: string, month?: string) {
  return useQuery({
    queryKey: queryKeys.expenses.summary(branchId, month),
    queryFn: () => expensesApi.summary(branchId!, month),
    enabled: !!branchId,
  });
}

export function useExpenseIntelligence(
  branchId?: string,
  range?: { date_from?: string; date_to?: string },
) {
  return useQuery({
    queryKey: queryKeys.expenses.intelligence(branchId ?? '', range),
    queryFn: () => expensesApi.intelligence(branchId!, range),
    enabled: !!branchId,
  });
}

export function useExpense(id?: string) {
  return useQuery({
    queryKey: queryKeys.expenses.detail(id ?? ''),
    queryFn: () => expensesApi.getById(id!),
    enabled: !!id,
  });
}

function invalidateExpenseCaches(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.expenses.all });
  qc.invalidateQueries({ queryKey: queryKeys.finance.all });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: expensesApi.create,
    onSuccess: () => {
      invalidateExpenseCaches(qc);
      toast.success('Expense recorded');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReverseExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      notes,
    }: {
      id: string;
      reason?: string;
      notes?: string;
    }) => expensesApi.reverse(id, { reason, notes }),
    onSuccess: () => {
      invalidateExpenseCaches(qc);
      toast.success('Expense reversed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useExportExpenses() {
  return useMutation({
    mutationFn: async (params: ExportExpensesInput) => {
      const blob = (await expensesApi.exportFile(params)) as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = params.format === 'xlsx' ? 'xls' : 'csv';
      a.href = url;
      a.download = `expenses-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Expense Categories ────────────────────────────────────

export function useExpenseCategories(branchId?: string, includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.expenses.categories({ branchId, includeInactive }),
    queryFn: () =>
      expenseCategoriesApi.list({
        branch_id: branchId,
        include_inactive: includeInactive,
      }),
  });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseCategoryInput) =>
      expenseCategoriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all });
      toast.success('Category created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ExpenseCategoryInput> & { is_active?: boolean };
    }) => expenseCategoriesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all });
      toast.success('Category updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeactivateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expenseCategoriesApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all });
      toast.success('Category deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Invoices ──────────────────────────────────────────────

export function useInvoices(filters?: InvoiceFilters) {
  return useQuery({
    queryKey: queryKeys.finance.invoices(filters),
    queryFn: () => invoicesApi.list(filters),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.finance.invoice(id),
    queryFn: () => invoicesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast.success('Invoice created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'paid' | 'partial' | 'cancelled' | 'refunded' }) =>
      invoicesApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast.success('Invoice status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useInvoicePdfLink() {
  return useMutation({
    mutationFn: (id: string) => invoicesApi.pdfLink(id),
    onError: (err: Error) => toast.error(`PDF failed: ${err.message}`),
  });
}

export function useSendInvoice() {
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      channels: Array<'email' | 'whatsapp'>;
      email_override?: string;
      phone_override?: string;
    }) => invoicesApi.send(id, body),
    onSuccess: (data) => {
      const deliveries = (data as { deliveries?: Array<{ channel: string; status: string }> })?.deliveries ?? [];
      const ok = deliveries.filter((d) => d.status === 'sent').map((d) => d.channel);
      const fail = deliveries.filter((d) => d.status !== 'sent').map((d) => d.channel);
      if (ok.length) toast.success(`Sent via ${ok.join(', ')}`);
      if (fail.length) toast.error(`Failed: ${fail.join(', ')}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePosReceiptPdfLink() {
  return useMutation({
    mutationFn: ({ saleId, format }: { saleId: string; format?: 'a4' | 'thermal_80mm' }) =>
      posReceiptsApi.pdfLink(saleId, format ?? 'a4'),
    onError: (err: Error) => toast.error(`Receipt failed: ${err.message}`),
  });
}

export function useSendPosReceipt() {
  return useMutation({
    mutationFn: ({ saleId, ...body }: {
      saleId: string;
      channels: Array<'email' | 'whatsapp'>;
      format?: 'a4' | 'thermal_80mm';
      email_override?: string;
      phone_override?: string;
    }) => posReceiptsApi.send(saleId, body),
    onSuccess: (data) => {
      const deliveries = (data as { deliveries?: Array<{ channel: string; status: string }> })?.deliveries ?? [];
      const ok = deliveries.filter((d) => d.status === 'sent').map((d) => d.channel);
      const fail = deliveries.filter((d) => d.status !== 'sent').map((d) => d.channel);
      if (ok.length) toast.success(`Receipt sent via ${ok.join(', ')}`);
      if (fail.length) toast.error(`Failed: ${fail.join(', ')}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Refunds ───────────────────────────────────────────────

export function useRefunds(filters?: RefundFilters) {
  return useQuery({
    queryKey: queryKeys.finance.refunds(filters),
    queryFn: () => refundsApi.list(filters),
  });
}

export function useProcessRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refundsApi.process,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      qc.invalidateQueries({ queryKey: queryKeys.payments.all });
      toast.success('Refund processed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Discounts ─────────────────────────────────────────────

export function useDiscounts(filters?: { is_active?: boolean; applicable_to?: string }) {
  return useQuery({
    queryKey: queryKeys.finance.discounts(filters),
    queryFn: () => discountsApi.list(filters),
  });
}

export function useValidateDiscount() {
  return useMutation({
    mutationFn: (code: string) => discountsApi.validate(code),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: discountsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.finance.all });
      toast.success('Discount created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Financial Reports ─────────────────────────────────────

export function useDailyReport(branchId: string, date?: string) {
  return useQuery({
    queryKey: queryKeys.finance.dailyReport(branchId, date),
    queryFn: () => financialReportsApi.daily(branchId, date),
    enabled: !!branchId,
  });
}

export function useMonthlyReport(branchId: string, year?: number, month?: number) {
  return useQuery({
    queryKey: queryKeys.finance.monthlyReport(branchId, year, month),
    queryFn: () => financialReportsApi.monthly(branchId, year, month),
    enabled: !!branchId,
  });
}

export function useFinancialDashboard(branchId: string) {
  return useQuery({
    queryKey: queryKeys.finance.dashboard(branchId),
    queryFn: () => financialReportsApi.dashboard(branchId),
    enabled: !!branchId,
  });
}

export function useMembershipRevenue(branchId: string, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: queryKeys.finance.membershipRevenue(branchId, dateFrom, dateTo),
    queryFn: () => financialReportsApi.membershipRevenue(branchId, dateFrom, dateTo),
    enabled: !!branchId,
  });
}
