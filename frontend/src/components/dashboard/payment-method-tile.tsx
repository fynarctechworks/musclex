"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/shared";
import { cn } from "@/lib/utils";
import type { PaymentMethodItem, PaymentMethodKey } from "@/types";

interface PaymentMethodTileProps {
  branchId?: string;
  from?: string;
  to?: string;
  className?: string;
}

const METHOD_LABELS: Record<PaymentMethodKey, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  razorpay: "Razorpay",
  stripe: "Stripe",
};

// Primary + accent variants only (per design rules)
const METHOD_COLORS: Record<PaymentMethodKey, string> = {
  cash: "hsl(var(--primary))",
  card: "hsl(var(--primary) / 0.85)",
  upi: "hsl(var(--primary) / 0.7)",
  bank_transfer: "hsl(var(--primary) / 0.55)",
  razorpay: "hsl(var(--primary) / 0.4)",
  stripe: "hsl(var(--accent-foreground) / 0.6)",
};

export function PaymentMethodTile({
  branchId,
  from,
  to,
  className,
}: PaymentMethodTileProps) {
  const queryParams = new URLSearchParams();
  if (branchId) queryParams.set("branch_id", branchId);
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);

  const url = queryParams.toString()
    ? `/dashboard/payment-methods?${queryParams.toString()}`
    : `/dashboard/payment-methods`;

  const { data, isLoading, isError, refetch } = useQuery<PaymentMethodItem[]>({
    queryKey: queryKeys.dashboard.paymentMethods(branchId, from, to),
    queryFn: () => apiClient.get(url),
  });

  const total = useMemo(
    () => (data ?? []).reduce((s, r) => s + r.amount, 0),
    [data],
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">
          Payment Methods
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-6" />
          <LoadingSkeleton className="h-24" />
        </div>
      ) : isError ? (
        <ErrorState
          variant="server"
          description="Couldn't load payment method breakdown."
          onRetry={() => refetch()}
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Once members pay, the breakdown by method will appear here."
        />
      ) : (
        <div className="space-y-4">
          {/* Horizontal stacked share bar */}
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label="Payment method share"
          >
            {data.map((row) => (
              <div
                key={row.method}
                className="h-full transition-all"
                style={{
                  width: `${row.share_pct}%`,
                  backgroundColor: METHOD_COLORS[row.method],
                }}
                title={`${METHOD_LABELS[row.method]}: ${row.share_pct.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Legend */}
          <table className="w-full text-[12px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-medium py-2">Method</th>
                <th className="text-right font-medium py-2">Count</th>
                <th className="text-right font-medium py-2">Amount</th>
                <th className="text-right font-medium py-2">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.method}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="py-2 text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: METHOD_COLORS[row.method] }}
                      />
                      {METHOD_LABELS[row.method]}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-muted-foreground">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="py-2 text-right font-mono text-foreground">
                    ₹{row.amount.toLocaleString()}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {row.share_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-2 text-muted-foreground">Total</td>
                <td />
                <td className="pt-2 text-right font-mono text-foreground">
                  ₹{total.toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
