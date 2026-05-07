"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import type { Payment, PaginatedResponse } from "@/lib/types";
import { format } from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useCurrency } from "@/lib/hooks/use-currency";
import { useAuthStore } from "@/stores/auth-store";

export default function PaymentsListPage() {
  const { allowed, checked } = useRequirePermission("payments", "view", "deny");
  const { gymPath } = useGymSlug();
  const CURRENCY_SYMBOL = useCurrency();
  const { activeBranchId } = useAuthStore();
  const [status, setStatus] = useState("");
  const [page] = useState(1);

  const { data } = useQuery({
    queryKey: ["payments", status, page, activeBranchId],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Payment>>("/payments", {
        params: { status: status || undefined, page, limit: 20, ...(activeBranchId ? { branch_id: activeBranchId } : {}) },
      }),
  });

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="payments" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">Payments</h1>
        <Link href={gymPath("/finance/payments/new")}><Button className="bg-primary text-primary-foreground">+ Record Payment</Button></Link>
      </div>

      <div className="flex gap-3 mb-4">
        {["", "paid", "pending", "failed"].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-md text-sm ${status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border">
            {["Receipt", "Member", "Amount", "Method", "Status", "Date"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data?.data?.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted">
                <td className="px-4 py-3 text-sm font-mono text-primary">{p.receipt_number}</td>
                <td className="px-4 py-3 text-sm text-foreground">{p.member?.full_name || "-"}</td>
                <td className="px-4 py-3 text-sm text-foreground">{CURRENCY_SYMBOL}{Number(p.amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{p.payment_method}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status === "paid" ? "active" : "expired"} /></td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{p.paid_at ? format(new Date(p.paid_at), "MMM d, yyyy") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.data?.length && <p className="p-8 text-center text-sm text-muted-foreground">No payments found</p>}
      </div>
    </AppLayout>
  );
}
