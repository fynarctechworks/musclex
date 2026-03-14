"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

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

export function KPICard({ label, value, trend, icon: Icon, className }: KPICardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-5 transition-colors hover:border-border/80",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
              trend.isPositive
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {trend.isPositive ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-foreground tracking-tight">{value}</p>
    </div>
  );
}
