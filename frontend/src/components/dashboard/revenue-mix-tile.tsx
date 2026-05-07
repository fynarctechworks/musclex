"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PieChart as PieIcon } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/shared";
import { cn } from "@/lib/utils";
import type { RevenueMixGroupBy, RevenueMixItem } from "@/types";

interface RevenueMixTileProps {
  branchId?: string;
  from?: string;
  to?: string;
  /** Path prefix for drilling into payments — e.g. gymPath('/payments'). Optional; defaults to '/payments'. */
  drillToPaymentsHref?: string;
  className?: string;
}

// Donut palette — primary + accent variants only (per design rules)
const DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.85)",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.55)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--accent-foreground) / 0.6)",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
};

export function RevenueMixTile({
  branchId,
  from,
  to,
  drillToPaymentsHref,
  className,
}: RevenueMixTileProps) {
  const [groupBy, setGroupBy] = useState<RevenueMixGroupBy>("plan");

  const queryParams = new URLSearchParams();
  queryParams.set("group_by", groupBy);
  if (branchId) queryParams.set("branch_id", branchId);
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);

  const { data, isLoading, isError, refetch } = useQuery<RevenueMixItem[]>({
    queryKey: queryKeys.dashboard.revenueMix(groupBy, branchId, from, to),
    queryFn: () =>
      apiClient.get(`/dashboard/revenue-mix?${queryParams.toString()}`),
  });

  const chartData = useMemo(() => {
    return (data ?? []).map((row) => ({
      name:
        groupBy === "plan"
          ? row.plan_name ?? "Unknown plan"
          : row.trainer_name ?? "Unknown trainer",
      value: row.revenue_amount,
      share_pct: row.share_pct,
      delta_pct: row.delta_pct,
      member_count: row.member_count,
      sessions_count: row.sessions_count,
      plan_type: row.plan_type,
    }));
  }, [data, groupBy]);

  const total = useMemo(
    () => chartData.reduce((s, r) => s + r.value, 0),
    [chartData],
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Revenue Mix
          </h2>
        </div>
        <Link
          href={drillToPaymentsHref ?? "/payments"}
          className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1"
        >
          View payments <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Tab toggle */}
      <div
        className="inline-flex rounded-md border border-border bg-background p-0.5 mb-4"
        role="tablist"
        aria-label="Revenue mix grouping"
      >
        {(
          [
            { key: "plan", label: "By Plan" },
            { key: "trainer", label: "By Trainer" },
          ] as const
        ).map((tab) => {
          const active = groupBy === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => setGroupBy(tab.key)}
              className={cn(
                "px-3 py-1 text-[12px] font-medium rounded transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-44" />
          <LoadingSkeleton className="h-24" />
        </div>
      ) : isError ? (
        <ErrorState
          variant="server"
          description="Couldn't load revenue mix."
          onRetry={() => refetch()}
        />
      ) : chartData.length === 0 ? (
        <EmptyState
          icon={PieIcon}
          title="No revenue yet"
          description={
            groupBy === "plan"
              ? "When members purchase plans, mix will appear here."
              : "When trainers earn revenue, mix will appear here."
          }
        />
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={86}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="hsl(var(--card))"
                >
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={((val: unknown, _name: unknown, p: unknown) => {
                    const num = typeof val === "number" ? val : Number(val) || 0;
                    const name =
                      (p as { payload?: { name?: string } } | undefined)?.payload?.name ?? "";
                    return [`₹${num.toLocaleString()}`, name];
                  }) as unknown as never}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend / table */}
          <div className="mt-4 max-h-56 overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left font-medium py-2">
                    {groupBy === "plan" ? "Plan" : "Trainer"}
                  </th>
                  <th className="text-right font-medium py-2">Revenue</th>
                  <th className="text-right font-medium py-2">Share</th>
                  <th className="text-right font-medium py-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2 text-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{
                            backgroundColor:
                              DONUT_COLORS[i % DONUT_COLORS.length],
                          }}
                        />
                        <Link
                          href={drillToPaymentsHref ?? "/payments"}
                          className="hover:text-primary transition-colors"
                        >
                          {row.name}
                        </Link>
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-foreground">
                      ₹{row.value.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {row.share_pct.toFixed(1)}%
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right font-medium",
                        (row.delta_pct ?? 0) > 0
                          ? "text-primary"
                          : (row.delta_pct ?? 0) < 0
                            ? "text-destructive"
                            : "text-muted-foreground",
                      )}
                    >
                      {(row.delta_pct ?? 0) > 0 ? "+" : ""}
                      {(row.delta_pct ?? 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-2 text-muted-foreground">Total</td>
                  <td className="pt-2 text-right font-mono text-foreground">
                    ₹{total.toLocaleString()}
                  </td>
                  <td className="pt-2" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
