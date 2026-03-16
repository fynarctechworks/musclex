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
 * Compact inline stat — for dashboards and summary sections.
 * Lighter than KPICard, no icon. Supabase Studio style.
 */
export function StatCard({ label, value, change, className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card px-4 py-3", className)}>
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
        {change && (
          <span
            className={cn(
              "text-[12px] font-medium",
              change.value >= 0 ? "text-primary" : "text-destructive"
            )}
          >
            {change.value >= 0 ? "+" : ""}
            {change.value}%
            {change.label && <span className="ml-0.5 text-muted-foreground font-normal">{change.label}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
