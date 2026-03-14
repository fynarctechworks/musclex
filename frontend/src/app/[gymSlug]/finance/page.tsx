"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import type { Payment, Expense, PaginatedResponse } from "@/lib/types";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

export default function FinancePage() {
  const { gymPath } = useGymSlug();
  const { data: payments } = useQuery({
    queryKey: ["recent-payments"],
    queryFn: () => apiClient.get<PaginatedResponse<Payment>>("/payments?limit=50"),
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => apiClient.get<Expense[]>("/expenses"),
  });

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const allPayments = payments?.data ?? [];
    const allExpenses = expenses ?? [];

    const monthlyRevenue = allPayments
      .filter((p) => p.status === "paid" && new Date(p.paid_at || p.created_at) >= monthStart)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const pendingCount = allPayments.filter((p) => p.status === "pending").length;

    const totalExpenses = allExpenses
      .filter((e) => new Date(e.expense_date) >= monthStart)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const netProfit = monthlyRevenue - totalExpenses;

    return { monthlyRevenue, pendingCount, totalExpenses, netProfit };
  }, [payments, expenses]);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Finance</h1>
          <p className="text-sm text-muted-foreground mt-1">Financial overview and transactions</p>
        </div>
        <div className="flex gap-2">
          <Link href={gymPath("/finance/payments/new")}><Button className="bg-primary text-primary-foreground">+ Record Payment</Button></Link>
          <Link href={gymPath("/finance/expenses/new")}><Button variant="outline" className="border-border text-muted-foreground">+ Add Expense</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon={DollarSign} label="Monthly Revenue" value={`₹${kpis.monthlyRevenue.toLocaleString("en-IN")}`} trend={{ value: 0, isPositive: true }} />
        <KPICard icon={AlertCircle} label="Pending Payments" value={String(kpis.pendingCount)} />
        <KPICard icon={TrendingDown} label="Total Expenses" value={`₹${kpis.totalExpenses.toLocaleString("en-IN")}`} trend={{ value: 0, isPositive: false }} />
        <KPICard icon={TrendingUp} label="Net Profit" value={`₹${kpis.netProfit.toLocaleString("en-IN")}`} trend={{ value: 0, isPositive: kpis.netProfit >= 0 }} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Recent Transactions</h2>
        <div className="space-y-3">
          {payments?.data?.length ? payments.data.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm text-foreground">{p.member?.full_name || "Member"}</p>
                <p className="text-xs text-muted-foreground">{p.receipt_number} • {p.payment_method}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">₹{Number(p.amount).toLocaleString()}</p>
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
