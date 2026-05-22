"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    label?: string;
  };
  className?: string;
}

/**
 * StatCard — compact inline metric (no icon).
 * Design.md card-marketing chrome, mono-caps label, display-md value.
 */
export function StatCard({ label, value, change, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-hairline bg-card px-4 py-3 shadow-level-2",
        className
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-display-md text-foreground">{value}</span>
        {change && (
          <span
            className={cn(
              "text-xs font-medium",
              change.value >= 0 ? "text-success" : "text-error-deep"
            )}
          >
            {change.value >= 0 ? "+" : ""}
            {change.value}%
            {change.label && (
              <span className="ml-1 text-muted-foreground font-normal">
                {change.label}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
