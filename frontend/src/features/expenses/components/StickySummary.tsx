"use client";

import { CloudOff, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/hooks/use-currency";
import { useExpenseSummary } from "@/features/payments";
import type { ExpenseSummary } from "@/types";
import { useExpenseSyncQueue } from "@/features/expenses/offline-queue";

interface StickySummaryProps {
  branchId: string;
}

export function StickySummary({ branchId }: StickySummaryProps) {
  const CURRENCY = useCurrency();
  const { data, isLoading } = useExpenseSummary(branchId);
  const summary = (data ?? null) as ExpenseSummary | null;
  const { pendingCount, syncing, sync } = useExpenseSyncQueue();

  const fmt = (n: number) =>
    `${CURRENCY}${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Today
        </p>
        <p className="mt-1 text-xl font-semibold text-foreground">
          {isLoading ? "…" : fmt(summary?.today.total ?? 0)}
        </p>
        <p className="text-xs text-muted-foreground">
          {summary?.today.count ?? 0} entries
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          This Month
        </p>
        <p className="mt-1 text-xl font-semibold text-foreground">
          {isLoading ? "…" : fmt(summary?.month.total ?? 0)}
        </p>
        <p className="text-xs text-muted-foreground">
          {summary?.month.count ?? 0} entries
        </p>
      </div>

      <div className="col-span-2 rounded-xl border border-border bg-card p-4 sm:col-span-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Offline Queue
        </p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xl font-semibold text-foreground">
            {pendingCount}
          </p>
          {pendingCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={syncing}
              onClick={() => void sync()}
              className="h-8 gap-1 border-border text-xs"
            >
              {syncing ? (
                <RefreshCcw className="h-3 w-3 animate-spin" />
              ) : (
                <CloudOff className="h-3 w-3" />
              )}
              {syncing ? "Syncing" : "Sync now"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {pendingCount === 0 ? "All changes synced" : "Pending sync"}
        </p>
      </div>
    </div>
  );
}
