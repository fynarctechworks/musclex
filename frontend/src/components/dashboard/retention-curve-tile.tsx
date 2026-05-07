"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { TrendingDown } from "lucide-react";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import { LoadingSkeleton, EmptyState, ErrorState } from "@/components/shared";
import type { CohortsResponse } from "@/types";

interface RetentionCurveTileProps {
  branchId?: string;
  months?: number;
}

/**
 * Wave 11 — Cohort Retention Curve.
 * X = month offset 0..N from cohort start, Y = % retained, one line per cohort.
 * Cohort line colors are primary/accent variants with opacity ramps —
 * no new design tokens.
 */
export function RetentionCurveTile({
  branchId,
  months = 12,
}: RetentionCurveTileProps) {
  const params: Record<string, unknown> = { months };
  if (branchId) params.branch_id = branchId;

  const { data, isLoading, isError, refetch } = useQuery<CohortsResponse>({
    queryKey: queryKeys.dashboard.cohorts(branchId, months),
    queryFn: () => apiClient.get("/dashboard/cohorts", { params }),
    staleTime: 60 * 60 * 1000,
  });

  const validCohorts = (data?.cohorts ?? []).filter(
    (c) => c.size > 0 && c.retention.length > 0,
  );
  const maxOffset = validCohorts.reduce(
    (max, c) => Math.max(max, c.retention.length - 1),
    0,
  );
  const chartRows = Array.from({ length: maxOffset + 1 }, (_, m) => {
    const row: Record<string, number | string> = { offset: `M${m}` };
    for (const c of validCohorts) {
      if (m < c.retention.length) row[c.cohort_month] = c.retention[m];
    }
    return row;
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <TrendingDown className="h-4 w-4 rotate-180" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold leading-tight text-foreground truncate">
              Cohort Retention
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
              % of each cohort still active month-over-month
            </p>
          </div>
        </div>
        {data?.generated_at && (
          <span className="text-[11px] text-muted-foreground whitespace-nowrap mt-1">
            as of {new Date(data.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64 w-full" />
      ) : isError ? (
        <ErrorState
          variant="server"
          title="Couldn't load cohorts"
          description="The retention service didn't respond."
          onRetry={() => refetch()}
        />
      ) : validCohorts.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="No cohort data yet"
          description="Once you have a few months of signups and check-ins, retention curves will appear here."
        />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartRows}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="offset"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                  fontSize: "12px",
                }}
                formatter={((value: unknown) => {
                  const num = typeof value === "number" ? value : Number(value) || 0;
                  return [`${num}%`, ""];
                }) as unknown as never}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                iconType="line"
                verticalAlign="bottom"
                height={28}
              />
              {validCohorts.map((c, i) => {
                const opacity =
                  validCohorts.length === 1
                    ? 1
                    : 0.35 + (0.65 * i) / (validCohorts.length - 1);
                const useAccent = i % 2 === 1;
                return (
                  <Line
                    key={c.cohort_month}
                    type="monotone"
                    dataKey={c.cohort_month}
                    stroke={
                      useAccent ? "hsl(var(--accent))" : "hsl(var(--primary))"
                    }
                    strokeOpacity={opacity}
                    strokeWidth={1.75}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
