"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Eye, FileText, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { subscriptionApi } from "./api";
import { fetchBlob } from "@/services/api-client";
import { PdfViewerModal } from "@/components/shared";

/**
 * Lists subscription invoices for the current tenant and lets the user
 * preview them in an in-app PDF viewer + download.
 *
 * The PDF viewer is the shared <PdfViewerModal> so subscription receipts
 * look identical to member-payment receipts.
 */
export function InvoicesSection({
  focusInvoiceId,
}: {
  focusInvoiceId?: string | null;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["subscription", "invoices"],
    queryFn: () => subscriptionApi.listInvoices({ limit: 25 }),
    staleTime: 30_000,
  });

  const [previewId, setPreviewId] = useState<string | null>(null);

  // Deep-link from /checkout?...&redirect → /subscription?invoice=ID
  useEffect(() => {
    if (focusInvoiceId) setPreviewId(focusInvoiceId);
  }, [focusInvoiceId]);

  const invoices = data?.items ?? [];
  const focused = previewId ? invoices.find((i) => i.id === previewId) : null;

  return (
    <section className="bg-card border border-border rounded-lg shadow-level-2 shadow-black/5 overflow-hidden">
      <header className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
        <div className="h-9 w-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Invoices
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every subscription payment generates a receipt. Preview or download
            as PDF.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-error">
          We couldn't load your invoices. Try refreshing the page.
        </div>
      ) : invoices.length === 0 ? (
        <div className="p-10 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">
            No invoices yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your first invoice will appear here after a successful renewal.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {invoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              onPreview={() => setPreviewId(inv.id)}
            />
          ))}
        </div>
      )}

      {previewId && (
        <PdfViewerModal
          title={`Invoice ${focused?.invoice_number ?? ""}`}
          previewUrl={subscriptionApi.invoicePdfUrl(previewId, false)}
          downloadUrl={subscriptionApi.invoicePdfUrl(previewId, true)}
          downloadFilename={`${focused?.invoice_number || "invoice"}.pdf`}
          onClose={() => setPreviewId(null)}
        />
      )}
    </section>
  );
}

// ─── Row ───────────────────────────────────────────────────────
function InvoiceRow({
  invoice,
  onPreview,
}: {
  invoice: {
    id: string;
    invoice_number: string;
    amount: number;
    currency: string;
    status: string;
    billing_period_start: string;
    billing_period_end: string;
    paid_at: string | null;
    created_at: string;
  };
  onPreview: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await fetchBlob(subscriptionApi.invoicePdfUrl(invoice.id, true));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't download invoice PDF.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const statusColor =
    invoice.status === "paid"
      ? "bg-success/10 text-success ring-success/20"
      : invoice.status === "pending"
        ? "bg-warning/10 text-warning ring-warning/20"
        : "bg-error/10 text-error ring-error/20";

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-6 py-3.5 hover:bg-canvas-soft/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-sm font-semibold text-foreground">
            {invoice.invoice_number}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusColor}`}
          >
            {invoice.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {format(new Date(invoice.billing_period_start), "d MMM")} —{" "}
          {format(new Date(invoice.billing_period_end), "d MMM yyyy")}
          {invoice.paid_at && (
            <>
              {" "}· Paid {format(new Date(invoice.paid_at), "d MMM yyyy")}
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-3 self-stretch sm:self-auto">
        <div className="text-right mr-1 min-w-[80px]">
          <p className="text-sm font-semibold text-foreground">
            {invoice.currency === "INR" ? "₹" : invoice.currency + " "}
            {invoice.amount.toLocaleString("en-IN")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onPreview}>
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              PDF
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
