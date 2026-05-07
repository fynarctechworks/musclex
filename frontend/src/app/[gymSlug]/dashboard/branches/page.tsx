"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  AccessDenied,
  LoadingSkeleton,
  PageHeader,
} from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  IndianRupee,
  ScanLine,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import {
  BranchScorecard,
  type BranchScorecardData,
} from "@/components/dashboard/branch-scorecard";
import { PortfolioMap } from "@/components/dashboard/portfolio-map";
import { FreshnessPill } from "@/components/dashboard/freshness-pill";
import { cn } from "@/lib/utils";

interface PortfolioPayload {
  branches: BranchScorecardData[];
  rollup: {
    branch_count: number;
    total_active_members: number;
    total_today_revenue: number;
    total_mrr: number;
    total_check_ins_today: number;
    total_outstanding_dues: number;
    total_renewals_at_risk_7d: number;
    mean_revenue_wow_pct: number | null;
    use_map_view: boolean;
  };
  generated_at: string;
}

type RankBy = "today_revenue" | "mrr" | "check_ins_7d" | "active_members";

export default function PortfolioPage() {
  const { allowed, checked } = useRequirePermission("dashboard", "view", "deny");
  const { gymPath } = useGymSlug();
  const setActiveBranch = useAuthStore((s) => s.setActiveBranch);
  const [rankBy, setRankBy] = useState<RankBy>("today_revenue");
  const [view, setView] = useState<"auto" | "cards" | "map">("auto");

  const { data, isLoading, dataUpdatedAt } = useQuery<PortfolioPayload>({
    queryKey: ["dashboard", "portfolio"],
    queryFn: () => apiClient.get("/dashboard/portfolio"),
    refetchInterval: 60_000,
  });

  const ranked = useMemo(() => {
    if (!data) return [];
    return [...data.branches].sort((a, b) => {
      const av = (a[rankBy] as number) ?? 0;
      const bv = (b[rankBy] as number) ?? 0;
      return bv - av;
    });
  }, [data, rankBy]);

  const useMap =
    view === "map" || (view === "auto" && data?.rollup.use_map_view === true);

  const outlierCount = data?.branches.filter((b) => b.outliers.length > 0)
    .length ?? 0;

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="dashboard" />
      </AppLayout>
    );
  }

  const onBranchClick = (branchId: string) => {
    setActiveBranch(branchId);
    window.location.href = gymPath("/dashboard");
  };

  return (
    <AppLayout>
      <div className="mb-2">
        <Link
          href={gymPath("/dashboard")}
          className="text-[13px] text-primary hover:text-primary/80 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>

      <PageHeader
        title="Portfolio"
        description={
          data
            ? `${data.rollup.branch_count} branch${data.rollup.branch_count === 1 ? "" : "es"} · ${data.rollup.total_active_members.toLocaleString()} members · ₹${data.rollup.total_mrr.toLocaleString()} MRR`
            : "Compare performance across all your branches."
        }
        actions={
          <div className="flex items-center gap-3">
            <FreshnessPill asOf={data?.generated_at ?? dataUpdatedAt} staleThresholdSec={120} />
            <ViewToggle view={view} onChange={setView} hasMap={!!data?.rollup.use_map_view} />
          </div>
        }
        className="mb-6"
      />

      {/* Chain rollup tile-strip */}
      {data && data.rollup.branch_count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          <RollupTile
            icon={Users}
            label="Members"
            value={data.rollup.total_active_members.toLocaleString()}
          />
          <RollupTile
            icon={IndianRupee}
            label="Today's Revenue"
            value={`₹${data.rollup.total_today_revenue.toLocaleString()}`}
          />
          <RollupTile
            icon={TrendingUp}
            label="MRR"
            value={`₹${data.rollup.total_mrr.toLocaleString()}`}
          />
          <RollupTile
            icon={ScanLine}
            label="Check-ins Today"
            value={data.rollup.total_check_ins_today.toLocaleString()}
          />
          <RollupTile
            icon={AlertTriangle}
            label="Outliers"
            value={outlierCount.toString()}
            warn={outlierCount > 0}
          />
        </div>
      )}

      {/* Mean WoW + chain trend banner */}
      {data && data.rollup.mean_revenue_wow_pct !== null && (
        <div
          className={cn(
            "mb-6 rounded-xl border px-4 py-3 flex items-center gap-3",
            data.rollup.mean_revenue_wow_pct >= 0
              ? "border-success/30 bg-success/5"
              : "border-amber-500/30 bg-amber-500/5",
          )}
        >
          {data.rollup.mean_revenue_wow_pct >= 0 ? (
            <ArrowUpRight className="w-5 h-5 text-success" />
          ) : (
            <ArrowDownRight className="w-5 h-5 text-amber-500" />
          )}
          <p className="text-[13px] text-foreground">
            Chain revenue is{" "}
            <span className="font-semibold tabular-nums">
              {data.rollup.mean_revenue_wow_pct >= 0 ? "up" : "down"}{" "}
              {Math.abs(data.rollup.mean_revenue_wow_pct).toFixed(1)}%
            </span>{" "}
            week-over-week (mean across reporting branches).
          </p>
        </div>
      )}

      {/* View body */}
      {isLoading || !data ? (
        <LoadingSkeleton className="h-64" />
      ) : data.rollup.branch_count === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-[14px] text-foreground">No branches yet.</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Add a branch to start comparing performance.
          </p>
        </div>
      ) : useMap ? (
        <PortfolioMap branches={ranked} onBranchClick={onBranchClick} />
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">Rank by</span>
            <RankSelect value={rankBy} onChange={setRankBy} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ranked.map((b, i) => (
              <BranchScorecard
                key={b.branch_id}
                data={b}
                rank={i + 1}
                href={gymPath(`/dashboard?branch=${b.branch_id}`)}
              />
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}

function ViewToggle({
  view,
  onChange,
  hasMap,
}: {
  view: "auto" | "cards" | "map";
  onChange: (v: "auto" | "cards" | "map") => void;
  hasMap: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden text-[12px]">
      {(["auto", "cards", "map"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "px-2.5 py-1 transition-colors",
            view === v
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v === "auto" ? `Auto${hasMap ? " (map)" : ""}` : v[0].toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );
}

function RankSelect({
  value,
  onChange,
}: {
  value: RankBy;
  onChange: (v: RankBy) => void;
}) {
  const options: Array<{ key: RankBy; label: string }> = [
    { key: "today_revenue", label: "Today's revenue" },
    { key: "mrr", label: "MRR" },
    { key: "check_ins_7d", label: "Check-ins (7d)" },
    { key: "active_members", label: "Active members" },
  ];
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden text-[12px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "px-2.5 py-1 transition-colors",
            value === o.key
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RollupTile({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-3 py-2.5",
        warn ? "border-amber-500/40" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "w-3.5 h-3.5",
            warn ? "text-amber-500" : "text-primary",
          )}
        />
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-1 text-[15px] font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
