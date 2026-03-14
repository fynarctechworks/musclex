"use client";

import { cn } from "@/lib/utils";

type StatusVariant = "active" | "expiring" | "expired" | "frozen" | "pending" | "inactive";

const variantStyles: Record<StatusVariant, string> = {
  active: "bg-primary/10 text-primary border-primary/20",
  expiring: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  expired: "bg-destructive/10 text-destructive border-destructive/20",
  frozen: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  inactive: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20",
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
};

export interface StatusBadgeProps {
  variant?: StatusVariant;
  status?: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ variant, status, label, className }: StatusBadgeProps) {
  const resolvedVariant = variant || statusToVariant[status || ""] || "pending";
  const resolvedLabel = label || (status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : variantLabels[resolvedVariant]);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantStyles[resolvedVariant],
        className
      )}
    >
      {resolvedLabel}
    </span>
  );
}
