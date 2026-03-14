import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import {
  paymentsApi,
  expensesApi,
  invoicesApi,
  refundsApi,
  discountsApi,
  financialReportsApi,
  type PaymentFilters,
  type ExpenseFilters,
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

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: expensesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all });
      toast.success('Expense recorded');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      expensesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all });
      toast.success('Expense updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: expensesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all });
      toast.success('Expense deleted');
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
