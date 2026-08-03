"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { useRefunds, useProcessRefund } from "@/features/payments/hooks";
import type { Payment, PaginatedResponse } from "@/lib/types";
import { format } from "date-fns";
import { useCurrency } from "@/lib/hooks/use-currency";

interface RefundRow {
  id: string;
  refund_amount: string | number;
  reason: string | null;
  status: string;
  created_at: string;
  payment?: {
    id: string;
    receipt_number: string;
    amount: string | number;
    payment_method: string;
  } | null;
  member?: { id: string; full_name: string; member_code: string } | null;
  processed_by_staff?: { id: string; full_name: string } | null;
}

export default function RefundsPage() {
  const { allowed, checked } = useRequirePermission("payments", "view", "deny");
  const CURRENCY_SYMBOL = useCurrency();
  const [status, setStatus] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const { data } = useRefunds({ status: status || undefined, limit: 50 });
  const refunds: RefundRow[] = (data as { data?: RefundRow[] } | undefined)?.data ?? [];

  // Recent paid payments to pick from when processing a refund
  const { data: paidPayments } = useQuery({
    queryKey: ["payments", "refundable"],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Payment>>("/payments", {
        params: { status: "paid", limit: 50 },
      }),
    enabled: dialogOpen,
  });

  const processRefund = useProcessRefund();
  const selectedPayment = paidPayments?.data?.find((p) => p.id === paymentId);

  const submit = () => {
    if (!paymentId || !amount) return;
    processRefund.mutate(
      {
        payment_id: paymentId,
        refund_amount: Number(amount),
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setPaymentId("");
          setAmount("");
          setReason("");
        },
      },
    );
  };

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
        <h1 className="text-xl font-semibold text-foreground">Refunds</h1>
        <Button
          className="bg-primary text-primary-foreground"
          onClick={() => setDialogOpen(true)}
        >
          + Process Refund
        </Button>
      </div>

      <div className="flex gap-3 mb-4">
        {["", "completed", "pending", "failed"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-md text-sm ${status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Receipt", "Member", "Refunded", "Original", "Reason", "Processed By", "Status", "Date"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted">
                <td className="px-4 py-3 text-sm font-mono text-primary">{r.payment?.receipt_number ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-foreground">{r.member?.full_name ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {CURRENCY_SYMBOL}{Number(r.refund_amount).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {r.payment ? `${CURRENCY_SYMBOL}${Number(r.payment.amount).toLocaleString()}` : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground max-w-48 truncate">{r.reason ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.processed_by_staff?.full_name ?? "-"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status === "completed" ? "active" : r.status === "failed" ? "expired" : "pending"} />
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {format(new Date(r.created_at), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!refunds.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">No refunds found</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="refund-payment">Payment</Label>
              <select
                id="refund-payment"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                className="w-full mt-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select a paid payment…</option>
                {paidPayments?.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.receipt_number} — {p.member?.full_name ?? "Unknown"} — {CURRENCY_SYMBOL}
                    {Number(p.amount).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="refund-amount">Refund amount</Label>
              <Input
                id="refund-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={selectedPayment ? `Max ${Number(selectedPayment.amount)}` : "0.00"}
              />
            </div>
            <div>
              <Label htmlFor="refund-reason">Reason (optional)</Label>
              <Textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this payment being refunded?"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground"
                disabled={!paymentId || !amount || processRefund.isPending}
                onClick={submit}
              >
                {processRefund.isPending ? "Processing…" : "Process Refund"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
