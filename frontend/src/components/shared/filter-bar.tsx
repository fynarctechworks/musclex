"use client";

import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Horizontal filter bar — wraps filter chips, selects, and search inputs
 * for a consistent data filtering pattern across list views.
 */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

/**
 * FilterChip — Design.md `tab-ghost` adapted for filter toggles.
 * Active state inverts to ink polarity (canvas-on-ink), inactive sits on
 * canvas-soft-2. Count badge mirrors the active polarity.
 */
export function FilterChip({ label, active, count, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-canvas-soft-2 text-muted-foreground hover:bg-canvas-soft-2/70 hover:text-foreground"
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
            active
              ? "bg-canvas/20 text-on-primary"
              : "bg-hairline text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
