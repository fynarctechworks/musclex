"use client";

import { cn } from "@/lib/utils";

type StatusVariant =
  | "active"
  | "expiring"
  | "expired"
  | "frozen"
  | "pending"
  | "inactive";

/**
 * StatusBadge — Design.md soft-pill semantic chips.
 * Each variant uses the brand's *-soft background + *-deep text pairing.
 * Adds a 1.5 px leading dot for at-a-glance status scanning.
 */
const variantStyles: Record<StatusVariant, { fill: string; dot: string }> = {
  active: {
    fill: "bg-success/12 text-success",
    dot: "bg-success",
  },
  expiring: {
    fill: "bg-warning-soft text-warning-deep",
    dot: "bg-warning",
  },
  expired: {
    fill: "bg-error-soft text-error-deep",
    dot: "bg-error",
  },
  frozen: {
    fill: "bg-link-soft text-link-deep",
    dot: "bg-link",
  },
  pending: {
    fill: "bg-warning-soft text-warning-deep",
    dot: "bg-warning",
  },
  inactive: {
    fill: "bg-canvas-soft-2 text-muted-foreground",
    dot: "bg-hairline-strong",
  },
};

const variantLabels: Record<StatusVariant, string> = {
  active: "Active",
  expiring: "Expiring",
  expired: "Expired",
  frozen: "Frozen",
  pending: "Pending",
  inactive: "Inactive",
};

const statusToVariant: Record<string, StatusVariant> = {
  active: "active",
  expiring_soon: "expiring",
  expired: "expired",
  frozen: "frozen",
  pending: "pending",
  inactive: "inactive",
  paid: "active",
  failed: "expired",
  refunded: "expired",
  partial: "expiring",
  success: "active",
  draft: "pending",
  sent: "active",
  scheduled: "pending",
  cancelled: "expired",
  paused: "frozen",
  renewed: "active",
};

export interface StatusBadgeProps {
  variant?: StatusVariant;
  status?: string;
  label?: string;
  /** Hide the leading dot. */
  hideDot?: boolean;
  className?: string;
}

export function StatusBadge({
  variant,
  status,
  label,
  hideDot,
  className,
}: StatusBadgeProps) {
  const resolvedVariant =
    variant || statusToVariant[status || ""] || "pending";
  const resolvedLabel =
    label ||
    (status
      ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : variantLabels[resolvedVariant]);

  const styles = variantStyles[resolvedVariant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium leading-none h-6",
        styles.fill,
        className
      )}
    >
      {!hideDot && <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />}
      {resolvedLabel}
    </span>
  );
}
