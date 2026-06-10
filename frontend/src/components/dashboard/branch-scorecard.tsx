"use client";

import { ArrowDownRight, ArrowUpRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BranchScorecardData {
  branch_id: string;
  branch_name: string;
  active_members: number;
  today_revenue: number;
  mrr: number;
  check_ins_today: number;
  check_ins_7d: number;
  outstanding_dues: number;
  renewals_at_risk_7d: number;
  revenue_per_member: number | null;
  check_ins_per_member_7d: number | null;
  revenue_wow_pct: number | null;
  check_ins_wow_pct: number | null;
  revenue_sparkline_14d: number[];
  check_ins_sparkline_14d: number[];
  outliers: string[];
}

interface BranchScorecardProps {
  data: BranchScorecardData;
  rank?: number;
  href?: string;
  className?: string;
}

export function BranchScorecard({
  data,
  rank,
  href,
  className,
}: BranchScorecardProps) {
  const card = (
    <div
      className={cn(
        "rounded-lg border bg-card p-5 transition-colors",
        data.outliers.length > 0
          ? "border-warning/30"
          : "border-border hover:border-primary/40",
        href && "cursor-pointer",
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {rank !== undefined && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-canvas-soft-2 text-[11px] font-semibold text-primary">
                {rank}
              </span>
            )}
            <h3 className="text-[15px] font-semibold text-foreground truncate">
              {data.branch_name}
            </h3>
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {data.active_members.toLocaleString()} active members
          </p>
        </div>
        {data.outliers.length > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning"
            title={data.outliers.join(" · ")}
          >
            <AlertTriangle className="h-3 w-3" />
            outlier
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          label="Revenue (7d)"
          value={`₹${(data.revenue_per_member !== null
            ? data.revenue_per_member * data.active_members
            : 0
          ).toLocaleString()}`}
          delta={data.revenue_wow_pct}
          deltaLabel="WoW"
          sparkline={data.revenue_sparkline_14d}
          positiveIs="good"
        />
        <Metric
          label="Check-ins (7d)"
          value={data.check_ins_7d.toLocaleString()}
          delta={data.check_ins_wow_pct}
          deltaLabel="WoW"
          sparkline={data.check_ins_sparkline_14d}
          positiveIs="good"
        />
      </div>

      {/* Per-capita row */}
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <PerCapita
          label="₹/member"
          value={
            data.revenue_per_member !== null
              ? `₹${data.revenue_per_member.toLocaleString()}`
              : "—"
          }
        />
        <PerCapita
          label="visits/mem"
          value={
            data.check_ins_per_member_7d !== null
              ? data.check_ins_per_member_7d.toFixed(1)
              : "—"
          }
        />
        <PerCapita
          label="dues"
          value={`₹${(data.outstanding_dues ?? 0).toLocaleString()}`}
          warn={data.outstanding_dues > 0}
        />
      </div>

      {data.outliers.length > 0 && (
        <ul className="mt-3 space-y-1">
          {data.outliers.map((o, i) => (
            <li key={i} className="text-[11px] text-warning">
              · {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block h-full">
        {card}
      </a>
    );
  }
  return card;
}

function Metric({
  label,
  value,
  delta,
  deltaLabel,
  sparkline,
  positiveIs,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaLabel: string;
  sparkline: number[];
  positiveIs: "good" | "bad";
}) {
  const hasDelta = delta !== null;
  const dir = !hasDelta || delta === 0 ? "flat" : delta! > 0 ? "up" : "down";
  const isGood =
    dir === "flat" ? null : positiveIs === "good" ? dir === "up" : dir === "down";
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : null;
  const colorClass =
    isGood === null
      ? "text-muted-foreground"
      : isGood
        ? "text-success"
        : "text-destructive";

  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-1">
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium",
              colorClass,
            )}
            title={`${(delta as number) >= 0 ? "+" : ""}${(delta as number).toFixed(1)}% ${deltaLabel}`}
          >
            {Arrow && <Arrow className="h-3 w-3" strokeWidth={2.5} />}
            {Math.abs(delta as number).toFixed(1)}%
          </span>
        )}
        <MiniSparkline data={sparkline} className={colorClass} />
      </div>
    </div>
  );
}

function PerCapita({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/50 bg-background/30 px-2 py-1.5",
      )}
    >
      <p
        className={cn(
          "text-[12px] font-semibold tabular-nums",
          warn ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function MiniSparkline({
  data,
  className,
}: {
  data: number[];
  className?: string;
}) {
  if (!data || data.length < 2) return null;
  const w = 60;
  const h = 14;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-3.5 w-16", className)}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
      />
    </svg>
  );
}
