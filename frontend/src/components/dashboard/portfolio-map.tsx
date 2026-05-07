"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BranchScorecardData } from "./branch-scorecard";

type SortKey =
  | "name"
  | "active_members"
  | "today_revenue"
  | "mrr"
  | "check_ins_7d"
  | "outstanding_dues"
  | "revenue_wow_pct"
  | "check_ins_wow_pct";

interface PortfolioMapProps {
  branches: BranchScorecardData[];
  onBranchClick?: (branchId: string) => void;
  className?: string;
}

/**
 * Dense, sortable table for chains with too many branches to fit a card grid
 * (auto-engaged when count > 8 per plan §8.2). Designed for chain operators
 * scanning for outliers — sparklines + WoW deltas inline, sortable by any
 * column, outlier rows highlighted amber.
 */
export function PortfolioMap({
  branches,
  onBranchClick,
  className,
}: PortfolioMapProps) {
  const [sortKey, setSortKey] = useState<SortKey>("today_revenue");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...branches];
    copy.sort((a, b) => {
      const av = pick(a, sortKey);
      const bv = pick(b, sortKey);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return dir === "asc"
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av);
    });
    return copy;
  }, [branches, sortKey, dir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setDir(k === "name" ? "asc" : "desc");
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-background/40">
              <Th onClick={() => toggleSort("name")} active={sortKey === "name"}>
                Branch
              </Th>
              <Th
                onClick={() => toggleSort("active_members")}
                active={sortKey === "active_members"}
                align="right"
              >
                Members
              </Th>
              <Th
                onClick={() => toggleSort("today_revenue")}
                active={sortKey === "today_revenue"}
                align="right"
              >
                Today
              </Th>
              <Th
                onClick={() => toggleSort("mrr")}
                active={sortKey === "mrr"}
                align="right"
              >
                MRR
              </Th>
              <Th
                onClick={() => toggleSort("check_ins_7d")}
                active={sortKey === "check_ins_7d"}
                align="right"
              >
                Visits 7d
              </Th>
              <Th
                onClick={() => toggleSort("revenue_wow_pct")}
                active={sortKey === "revenue_wow_pct"}
                align="right"
              >
                Rev WoW
              </Th>
              <Th
                onClick={() => toggleSort("check_ins_wow_pct")}
                active={sortKey === "check_ins_wow_pct"}
                align="right"
              >
                Visits WoW
              </Th>
              <Th
                onClick={() => toggleSort("outstanding_dues")}
                active={sortKey === "outstanding_dues"}
                align="right"
              >
                Dues
              </Th>
              <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              <tr
                key={b.branch_id}
                onClick={() => onBranchClick?.(b.branch_id)}
                className={cn(
                  "border-b border-border/40 last:border-0 transition-colors",
                  onBranchClick && "cursor-pointer hover:bg-muted/30",
                  b.outliers.length > 0 && "bg-amber-500/5",
                )}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {b.outliers.length > 0 && (
                      <AlertTriangle
                        className="h-3.5 w-3.5 shrink-0 text-amber-500"
                        aria-label="Outlier"
                      />
                    )}
                    <span className="text-[13px] font-medium text-foreground">
                      {b.branch_name}
                    </span>
                  </div>
                  {b.outliers.length > 0 && (
                    <span className="block text-[11px] text-amber-500/90 mt-0.5">
                      {b.outliers[0]}
                    </span>
                  )}
                </td>
                <Td align="right">{b.active_members.toLocaleString()}</Td>
                <Td align="right">₹{b.today_revenue.toLocaleString()}</Td>
                <Td align="right">₹{b.mrr.toLocaleString()}</Td>
                <Td align="right">{b.check_ins_7d.toLocaleString()}</Td>
                <Td align="right">
                  <Delta value={b.revenue_wow_pct} positiveIs="good" />
                </Td>
                <Td align="right">
                  <Delta value={b.check_ins_wow_pct} positiveIs="good" />
                </Td>
                <Td align="right">
                  <span
                    className={cn(
                      b.outstanding_dues > 0 && "text-amber-500",
                    )}
                  >
                    ₹{b.outstanding_dues.toLocaleString()}
                  </span>
                </Td>
                <td className="px-3 py-2.5">
                  <RowSpark data={b.revenue_sparkline_14d} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-[13px] text-muted-foreground"
                >
                  No branches to compare yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  align,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  align?: "left" | "right";
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-[11px] uppercase tracking-wide select-none",
        align === "right" ? "text-right" : "text-left",
        onClick && "cursor-pointer hover:bg-muted/30",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown className="h-3 w-3 opacity-60" />}
      </span>
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 text-[13px] tabular-nums text-foreground",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </td>
  );
}

function Delta({
  value,
  positiveIs,
}: {
  value: number | null;
  positiveIs: "good" | "bad";
}) {
  if (value === null)
    return <span className="text-muted-foreground">—</span>;
  const dir = value === 0 ? "flat" : value > 0 ? "up" : "down";
  const isGood =
    dir === "flat" ? null : positiveIs === "good" ? dir === "up" : dir === "down";
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : null;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-0.5 text-[12px] font-medium",
        isGood === null
          ? "text-muted-foreground"
          : isGood
            ? "text-success"
            : "text-destructive",
      )}
    >
      {Arrow && <Arrow className="h-3 w-3" strokeWidth={2.5} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function RowSpark({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const w = 80;
  const h = 16;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data
    .map(
      (v, i) =>
        `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-4 w-20 text-primary"
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

function pick(b: BranchScorecardData, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return b.branch_name;
    case "active_members":
      return b.active_members;
    case "today_revenue":
      return b.today_revenue;
    case "mrr":
      return b.mrr;
    case "check_ins_7d":
      return b.check_ins_7d;
    case "outstanding_dues":
      return b.outstanding_dues;
    case "revenue_wow_pct":
      return b.revenue_wow_pct;
    case "check_ins_wow_pct":
      return b.check_ins_wow_pct;
  }
}
