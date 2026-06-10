"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  RotateCcw,
  Tag,
  Wallet,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import {
  ErrorState,
  LoadingSkeleton,
} from "@/components/shared";
import { cn } from "@/lib/utils";
import type { RevenueSummary } from "@/types";

interface RevenueSummaryTileProps {
  branchId?: string;
  from?: string;
  to?: string;
  className?: string;
}

interface StatProps {
  label: string;
  value: string;
  icon: React.ElementType;
  delta_pct: number;
  /** When true, an increase is bad (e.g. refunds going up). */
  invertDelta?: boolean;
  hint?: string;
}

function Stat({ label, value, icon: Icon, delta_pct, invertDelta, hint }: StatProps) {
  const isUp = delta_pct > 0;
  const isDown = delta_pct < 0;
  // Determine sentiment: for refunds, "up" is bad
  const isPositive = invertDelta ? isDown : isUp;
  const isNegative = invertDelta ? isUp : isDown;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-canvas-soft-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {delta_pct !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              isPositive && "bg-canvas-soft-2 text-primary",
              isNegative && "bg-destructive/10 text-destructive",
              !isPositive && !isNegative && "bg-muted text-muted-foreground",
            )}
          >
            {isUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {isUp ? "+" : ""}
            {delta_pct.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function RevenueSummaryTile({
  branchId,
  from,
  to,
  className,
}: RevenueSummaryTileProps) {
  const queryParams = new URLSearchParams();
  if (branchId) queryParams.set("branch_id", branchId);
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);

  const url = queryParams.toString()
    ? `/dashboard/revenue-summary?${queryParams.toString()}`
    : `/dashboard/revenue-summary`;

  const { data, isLoading, isError, refetch } = useQuery<RevenueSummary>({
    queryKey: queryKeys.dashboard.revenueSummary(branchId, from, to),
    queryFn: () => apiClient.get(url),
  });

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">
          Revenue Summary
        </h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-24" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState
          variant="server"
          description="Couldn't load revenue summary."
          onRetry={() => refetch()}
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Refunds"
            value={`₹${data.refunds.amount.toLocaleString()}`}
            icon={RotateCcw}
            delta_pct={data.period_delta.refunds_pct}
            invertDelta
            hint={`${data.refunds.count} processed`}
          />
          <Stat
            label="Discounts"
            value={`₹${data.discounts.amount.toLocaleString()}`}
            icon={Tag}
            delta_pct={data.period_delta.discounts_pct}
            invertDelta
            hint={`${data.discounts.count} invoices`}
          />
          <Stat
            label="Tax Collected"
            value={`₹${data.tax_collected.toLocaleString()}`}
            icon={Receipt}
            delta_pct={data.period_delta.tax_pct}
          />
          <Stat
            label="Net Revenue"
            value={`₹${data.net_revenue.toLocaleString()}`}
            icon={Wallet}
            delta_pct={data.period_delta.net_revenue_pct}
          />
        </div>
      )}
    </div>
  );
}
