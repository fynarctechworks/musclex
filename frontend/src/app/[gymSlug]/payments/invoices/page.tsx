"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, FileText, ArrowLeft, Download, Mail, MessageCircle, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  AccessDenied,
  PageHeader,
  EmptyState,
  StatusBadge,
} from "@/components/shared";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useCurrency } from "@/lib/hooks/use-currency";
import { useAuthStore } from "@/stores/auth-store";
import { useInvoices, useInvoicePdfLink, useSendInvoice } from "@/features/payments";
import { format } from "date-fns";

interface InvoiceRow {
  id: string;
  invoice_number?: string;
  member_name?: string;
  member_code?: string;
  status?: string;
  total?: number;
  amount?: number;
  due_date?: string;
  created_at?: string;
}

export default function InvoicesListPage() {
  const { allowed, checked } = useRequirePermission("payments", "view", "deny");
  const { gymPath } = useGymSlug();
  const CURRENCY_SYMBOL = useCurrency();
  const { activeBranchId } = useAuthStore();
  const [status, setStatus] = useState<string>("");

  const { data, isLoading } = useInvoices({
    branch_id: activeBranchId || undefined,
    status: status || undefined,
    limit: 50,
  });

  const pdfMut = useInvoicePdfLink();
  const sendMut = useSendInvoice();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const openPdf = async (id: string) => {
    setPendingId(id);
    try {
      const res = (await pdfMut.mutateAsync(id)) as { signed_url?: string };
      if (res?.signed_url) window.open(res.signed_url, "_blank", "noopener");
    } finally {
      setPendingId(null);
    }
  };

  const send = async (id: string, channel: "email" | "whatsapp") => {
    setPendingId(`${id}:${channel}`);
    try {
      await sendMut.mutateAsync({ id, channels: [channel] });
    } finally {
      setPendingId(null);
    }
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="payments" />
      </AppLayout>
    );
  }

  const invoices: InvoiceRow[] = Array.isArray(data)
    ? (data as InvoiceRow[])
    : ((data as { data?: InvoiceRow[] })?.data ?? []);

  const filters = [
    { label: "All", value: "" },
    { label: "Pending", value: "pending" },
    { label: "Paid", value: "paid" },
    { label: "Partial", value: "partial" },
    { label: "Cancelled", value: "cancelled" },
  ];

  return (
    <AppLayout>
      <Link
        href={gymPath("/finance/payments")}
        className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Payments
      </Link>

      <PageHeader
        title="Invoices"
        description="Issue, track, and manage member invoices"
        actions={
          <Link href={gymPath("/payments/invoices/new")}>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-1.5" /> New Invoice
            </Button>
          </Link>
        }
      />

      <div className="flex gap-2 mt-6 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              status === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : invoices.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Create your first invoice to bill members for memberships, classes, or products."
            action={
              <Link href={gymPath("/payments/invoices/new")}>
                <Button className="bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4 mr-1.5" /> Create Invoice
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-canvas-soft">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Invoice #</th>
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Due Date</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-t border-border hover:bg-canvas-soft transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-foreground">
                    {inv.invoice_number ?? inv.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {inv.member_name ?? "—"}
                    {inv.member_code && (
                      <span className="text-muted-foreground ml-1.5">
                        ({inv.member_code})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status ?? "pending"} />
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">
                    {CURRENCY_SYMBOL}
                    {Number(inv.total ?? inv.amount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inv.due_date
                      ? format(new Date(inv.due_date), "dd MMM yyyy")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inv.created_at
                      ? format(new Date(inv.created_at), "dd MMM yyyy")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openPdf(inv.id)}
                        disabled={pendingId === inv.id}
                        title="Download PDF"
                        className="p-1.5 rounded hover:bg-canvas-soft-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {pendingId === inv.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => send(inv.id, "email")}
                        disabled={pendingId === `${inv.id}:email`}
                        title="Email invoice"
                        className="p-1.5 rounded hover:bg-canvas-soft-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {pendingId === `${inv.id}:email` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => send(inv.id, "whatsapp")}
                        disabled={pendingId === `${inv.id}:whatsapp`}
                        title="Send via WhatsApp"
                        className="p-1.5 rounded hover:bg-canvas-soft-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {pendingId === `${inv.id}:whatsapp` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MessageCircle className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
