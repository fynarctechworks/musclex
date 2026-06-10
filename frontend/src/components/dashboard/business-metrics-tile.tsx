"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Activity, TrendingDown, Coins, Target } from "lucide-react";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import { LoadingSkeleton, ErrorState } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { BusinessMetrics } from "@/types";

interface BusinessMetricsTileProps {
  branchId?: string;
  currency?: string;
}

/**
 * Wave 11 — Business intelligence strip.
 * 5 stats: Growth · Retention · Churn · LTV · CAC.
 * CAC renders as "—" until a marketing_spend table is wired into the schema.
 */
export function BusinessMetricsTile({
  branchId,
  currency = "₹",
}: BusinessMetricsTileProps) {
  const params = branchId ? { branch_id: branchId } : undefined;
  const { data, isLoading, isError, refetch } = useQuery<BusinessMetrics>({
    queryKey: queryKeys.dashboard.businessMetrics(branchId),
    queryFn: () => apiClient.get("/dashboard/business-metrics", { params }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-level-2 transition-shadow hover:shadow-level-3 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-canvas-soft-2 text-primary">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold leading-tight text-foreground truncate">
              Business Performance
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
              Growth, retention, churn, lifetime value
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-24" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState
          variant="server"
          title="Couldn't load metrics"
          description="The business-metrics service didn't respond."
          onRetry={() => refetch()}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Stat
            label="Growth"
            sublabel="30d"
            icon={TrendingUp}
            value={formatPercent(data.growth_rate_30d)}
            tone={signTone(data.growth_rate_30d)}
          />
          <Stat
            label="Retention"
            sublabel="90d"
            icon={Activity}
            value={formatPercent(data.retention_rate_90d)}
            tone={data.retention_rate_90d >= 70 ? "good" : "neutral"}
          />
          <Stat
            label="Churn"
            sublabel="30d"
            icon={TrendingDown}
            value={formatPercent(data.churn_rate_30d)}
            tone={data.churn_rate_30d <= 5 ? "good" : "bad"}
          />
          <Stat
            label="LTV"
            sublabel="lifetime"
            icon={Coins}
            value={`${currency}${data.ltv_estimate.toLocaleString()}`}
            tone="neutral"
          />
          <Stat
            label="CAC"
            sublabel="per signup"
            icon={Target}
            value={
              data.cac_estimate === null
                ? "—"
                : `${currency}${data.cac_estimate.toLocaleString()}`
            }
            tone="neutral"
            hint={
              data.cac_estimate === null
                ? "Connect a marketing-spend source to enable CAC."
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

function formatPercent(v: number) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function signTone(v: number): "good" | "bad" | "neutral" {
  if (v > 0) return "good";
  if (v < 0) return "bad";
  return "neutral";
}

function Stat({
  label,
  sublabel,
  icon: Icon,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  sublabel?: string;
  icon: typeof TrendingUp;
  value: string;
  tone?: "good" | "bad" | "neutral";
  hint?: string;
}) {
  const valueClass =
    tone === "good"
      ? "text-success"
      : tone === "bad"
        ? "text-destructive"
        : "text-foreground";

  return (
    <div
      className="flex min-w-0 flex-col justify-between gap-2 rounded-lg border border-border/60 bg-background/30 p-3"
      title={hint}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-xl font-semibold leading-tight tabular-nums",
            valueClass,
          )}
          title={value}
        >
          {value}
        </p>
        {sublabel && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}
