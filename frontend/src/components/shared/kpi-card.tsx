"use client";

import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: LucideIcon;
  className?: string;
}

/**
 * KPI Card — Design.md card-marketing chrome.
 * Canvas surface, hairline border, level-2 stacked shadow, ink display-md
 * value. Trend pill uses success/error soft tokens.
 */
export function KPICard({
  label,
  value,
  trend,
  icon: Icon,
  className,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "group rounded-lg border border-hairline bg-card p-5 shadow-level-2",
        "transition-shadow duration-fast ease-out hover:shadow-level-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-canvas-soft-2">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              trend.isPositive
                ? "bg-success/12 text-success"
                : "bg-error-soft text-error-deep"
            )}
          >
            {trend.isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-display-md text-foreground">{value}</p>
    </div>
  );
}
