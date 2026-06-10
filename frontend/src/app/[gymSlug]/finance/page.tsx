"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import type { Payment, PaginatedResponse } from "@/lib/types";
import type { ExpenseSummary } from "@/types";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useCurrency } from "@/lib/hooks/use-currency";
import { useAuthStore } from "@/stores/auth-store";
import { queryKeys } from "@/services/query-client";
import { useExpenseSummary } from "@/features/payments";

export default function FinancePage() {
  const { allowed, checked } = useRequirePermission("payments", "view", "deny");
  const { gymPath } = useGymSlug();
  const CURRENCY_SYMBOL = useCurrency();
  const { activeBranchId } = useAuthStore();

  const { data: payments, isError: paymentsError } = useQuery({
    queryKey: queryKeys.payments.list({ limit: 50, branch_id: activeBranchId || undefined }),
    queryFn: () => apiClient.get<PaginatedResponse<Payment>>("/payments", { params: { limit: 50, ...(activeBranchId ? { branch_id: activeBranchId } : {}) } }),
  });

  const { data: summaryRaw } = useExpenseSummary(activeBranchId ?? undefined);
  const expenseSummary = summaryRaw as ExpenseSummary | undefined;

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const allPayments = payments?.data ?? [];

    const monthlyRevenue = allPayments
      .filter((p) => p.status === "paid" && new Date(p.paid_at || p.created_at) >= monthStart)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const pendingCount = allPayments.filter((p) => p.status === "pending").length;

    // Pre-aggregated by the backend — respects reversals (signed amounts).
    const totalExpenses = Number(expenseSummary?.month.total ?? 0);

    const netProfit = monthlyRevenue - totalExpenses;

    return { monthlyRevenue, pendingCount, totalExpenses, netProfit };
  }, [payments, expenseSummary]);

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="payments" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Finance"
        description="Financial overview and transactions"
        actions={
          <div className="flex gap-2">
            <Link href={gymPath("/finance/payments/new")}><Button className="bg-primary text-primary-foreground">+ Record Payment</Button></Link>
            <Link href={gymPath("/finance/expenses?compose=1")}><Button variant="outline" className="border-border text-muted-foreground">+ Add Expense</Button></Link>
          </div>
        }
        className="mb-6"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard icon={DollarSign} label="Monthly Revenue" value={`${CURRENCY_SYMBOL}${kpis.monthlyRevenue.toLocaleString("en-IN")}`} trend={{ value: 0, isPositive: true }} />
        <KPICard icon={AlertCircle} label="Pending Payments" value={String(kpis.pendingCount)} />
        <KPICard icon={TrendingDown} label="Total Expenses" value={`${CURRENCY_SYMBOL}${kpis.totalExpenses.toLocaleString("en-IN")}`} trend={{ value: 0, isPositive: false }} />
        <KPICard icon={TrendingUp} label="Net Profit" value={`${CURRENCY_SYMBOL}${kpis.netProfit.toLocaleString("en-IN")}`} trend={{ value: 0, isPositive: kpis.netProfit >= 0 }} />
      </div>

      <div className="mb-6 flex justify-end">
        <Link href={gymPath("/finance/expenses")} className="text-sm text-primary hover:text-primary/80">
          View Expenses →
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Recent Transactions</h2>
        <div className="space-y-3">
          {paymentsError && <p className="text-sm text-error mb-2">Failed to load payments. Check your permissions.</p>}
          {payments?.data?.length ? payments.data.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm text-foreground">{p.member?.full_name || "Member"}</p>
                <p className="text-xs text-muted-foreground">{p.receipt_number} • {p.payment_method}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{CURRENCY_SYMBOL}{Number(p.amount).toLocaleString()}</p>
                <StatusBadge status={p.status === "paid" ? "active" : p.status === "pending" ? "expiring_soon" : "expired"} />
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">No transactions yet</p>}
        </div>
        <Link href={gymPath("/finance/payments")} className="block mt-4 text-sm text-primary hover:text-primary/80">View all payments →</Link>
      </div>
    </AppLayout>
  );
}
