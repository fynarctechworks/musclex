"use client";

import React from "react";
import { format } from "date-fns";
import { CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { Payment } from "@/types";
import { paymentStatusVariant } from "./member-utils";

interface MemberPaymentsProps {
  payments?: Payment[];
}

export function MemberPayments({ payments }: MemberPaymentsProps) {
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
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pmt) => (
                <tr
                  key={pmt.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 font-mono text-xs text-primary">
                    {pmt.receipt_number}
                  </td>
                  <td className="py-3 text-foreground">
                    {pmt.paid_at
                      ? format(new Date(pmt.paid_at), "MMM dd, yyyy")
                      : format(new Date(pmt.created_at), "MMM dd, yyyy")}
                  </td>
                  <td className="py-3 font-medium text-foreground">
                    {pmt.currency === "INR" ? "\u20B9" : "$"}
                    {Number(pmt.amount).toFixed(2)}
                  </td>
                  <td className="py-3 text-muted-foreground capitalize">
                    {pmt.payment_method.replace("_", " ")}
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      variant={paymentStatusVariant[pmt.status]}
                      label={
                        pmt.status.charAt(0).toUpperCase() +
                        pmt.status.slice(1)
                      }
                    />
                  </td>
                  <td className="py-3">
                    {pmt.invoice_url ? (
                      <a
                        href={pmt.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </td>
                </tr>
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
    </div>
  );
}
