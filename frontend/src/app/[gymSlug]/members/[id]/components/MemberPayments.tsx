"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { CreditCard, Download, Eye, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PdfViewerModal } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { fetchBlob } from "@/services/api-client";
import { toast } from "sonner";
import type { Payment } from "@/types";
import { paymentStatusVariant } from "./member-utils";

interface MemberPaymentsProps {
  payments?: Payment[];
}

/**
 * Member payment receipts table.
 *
 * Each row renders Preview (opens the in-app PDF viewer) + Download (forces
 * file attachment) buttons. Both call the server-side renderer at
 *   GET /api/v1/payments/:id/pdf
 * which streams a real PDF using the shared invoice template. This matches
 * the gym-subscription invoice flow on /settings/subscription so the same
 * mental model works everywhere a payment generates a receipt.
 */
export function MemberPayments({ payments }: MemberPaymentsProps) {
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Payment History
      </h3>
      {payments && payments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Receipt
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Date
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Amount
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Method
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pmt) => (
                <PaymentRow
                  key={pmt.id}
                  payment={pmt}
                  onPreview={() => setPreviewPayment(pmt)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={CreditCard}
          title="No payment records"
          description="Payment history will appear here once the member makes a payment."
        />
      )}

      {previewPayment && (
        <PdfViewerModal
          title={`Receipt ${previewPayment.receipt_number}`}
          previewUrl={`/api/v1/payments/${previewPayment.id}/pdf`}
          downloadUrl={`/api/v1/payments/${previewPayment.id}/pdf?download=1`}
          downloadFilename={`${previewPayment.receipt_number}.pdf`}
          onClose={() => setPreviewPayment(null)}
        />
      )}
    </div>
  );
}

function PaymentRow({
  payment: pmt,
  onPreview,
}: {
  payment: Payment;
  onPreview: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await fetchBlob(`/api/v1/payments/${pmt.id}/pdf?download=1`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pmt.receipt_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't download receipt.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 font-mono text-xs text-primary">
        {pmt.receipt_number}
      </td>
      <td className="py-3 text-foreground">
        {pmt.paid_at
          ? format(new Date(pmt.paid_at), "MMM dd, yyyy")
          : format(new Date(pmt.created_at), "MMM dd, yyyy")}
      </td>
      <td className="py-3 font-medium text-foreground">
        {pmt.currency === "INR" ? "₹" : "$"}
        {Number(pmt.amount).toFixed(2)}
      </td>
      <td className="py-3 text-muted-foreground capitalize">
        {pmt.payment_method.replace("_", " ")}
      </td>
      <td className="py-3">
        <StatusBadge
          variant={paymentStatusVariant[pmt.status]}
          label={pmt.status.charAt(0).toUpperCase() + pmt.status.slice(1)}
        />
      </td>
      <td className="py-3">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onPreview}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Preview
          </Button>
          <Button
            size="sm"
            variant="outline"
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
      </td>
    </tr>
  );
}
