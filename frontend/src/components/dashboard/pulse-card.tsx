"use client";

import {
  LucideIcon,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Search,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PulseCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta_pct?: number | null;
  delta_label?: string;
  /**
   * Visual semantics of a positive delta. For most KPIs (revenue, members,
   * check-ins) up = good = success. For dues / risk KPIs, up = bad = danger.
   */
  positiveIs?: "good" | "bad";
  subtitle?: string;
  sparkline?: number[];
  href?: string;
  asOf?: string;
  className?: string;
  /** Wave 7 — opens "show your work" panel for this metric. */
  on_inspect?: () => void;
  /** Wave 7 — when set, surfaces a "▴ restated" marker. */
  restatement?: { delta_pct: number; prior_value: number; prior_date: string };
}

/**
 * Pulse Strip card — the dashboard's hero element. One number, one delta,
 * one sparkline, one click-through. Designed to be answerable in ≤2 seconds
 * (per the World #1 Dashboard plan, §5.2).
 */
export function PulseCard({
  label,
  value,
  icon: Icon,
  delta_pct,
  delta_label,
  positiveIs = "good",
  subtitle,
  sparkline,
  href,
  asOf,
  className,
  on_inspect,
  restatement,
}: PulseCardProps) {
  const hasDelta = delta_pct !== undefined && delta_pct !== null;
  const direction =
    !hasDelta || delta_pct === 0
      ? "flat"
      : (delta_pct as number) > 0
      ? "up"
      : "down";

  const isGood =
    direction === "flat"
      ? null
      : positiveIs === "good"
      ? direction === "up"
      : direction === "down";

  const deltaClass =
    isGood === null
      ? "text-muted-foreground bg-canvas-soft-2"
      : isGood
      ? "text-success bg-success/12"
      : "text-error-deep bg-error-soft";

  const ArrowIcon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
      ? ArrowDownRight
      : Minus;

  const card = (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-lg border border-hairline bg-card p-5 shadow-level-2 transition-[border-color,box-shadow] duration-fast ease-out",
        href && "hover:border-hairline-strong/40 hover:shadow-level-3 cursor-pointer",
        className,
      )}
      data-as-of={asOf}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-canvas-soft-2">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        <div className="flex items-center gap-1">
        {on_inspect && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              on_inspect();
            }}
            aria-label="Show how this is calculated"
            title="Show your work"
            className="rounded-sm p-1 text-muted-foreground hover:bg-canvas-soft hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              deltaClass,
            )}
            title={
              delta_label
                ? `${(delta_pct as number) >= 0 ? "+" : ""}${(delta_pct as number).toFixed(1)}% ${delta_label}`
                : asOf
                  ? `As of ${new Date(asOf).toLocaleString()}`
                  : undefined
            }
          >
            <ArrowIcon className="h-3 w-3" strokeWidth={2.5} />
            {Math.abs(delta_pct as number).toFixed(1)}%
          </span>
        )}
        </div>
      </div>

      {restatement && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning-deep">
          <AlertCircle className="h-3 w-3" />
          ▴ Restated · was{" "}
          {restatement.prior_value.toLocaleString()} on{" "}
          {restatement.prior_date}
        </div>
      )}

      <p className="mt-3 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-display-md text-foreground tabular-nums">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}

      <div
        className={cn(
          "mt-auto pt-3",
          isGood === null
            ? "text-muted-foreground"
            : isGood
              ? "text-success"
              : "text-error-deep",
        )}
      >
        <Sparkline data={sparkline ?? []} />
      </div>
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

/**
 * Tiny SVG sparkline. Inherits color from `currentColor` so the parent can
 * paint it via Tailwind text-* classes (text-success / text-destructive /
 * text-muted-foreground) — no inline-style HSL gymnastics needed.
 */
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) {
    return <div className="h-8 opacity-0" aria-hidden />;
  }
  const w = 100;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `M0,${h} L${points.split(" ").join(" L")} L${w},${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden
    >
      <path d={areaPath} fill="currentColor" fillOpacity={0.15} stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
