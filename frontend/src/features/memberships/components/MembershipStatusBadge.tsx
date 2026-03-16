"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { MemberMembership } from "@/types";

type MembershipStatusType = MemberMembership["status"];

const membershipStatusVariant: Record<
  MembershipStatusType,
  "active" | "expiring" | "expired" | "frozen" | "pending" | "inactive"
> = {
  active: "active",
  pending: "pending",
  paused: "frozen",
  frozen: "frozen",
  expired: "expired",
  cancelled: "expired",
  renewed: "active",
};

const membershipStatusLabel: Record<MembershipStatusType, string> = {
  active: "Active",
  pending: "Pending",
  paused: "Paused",
  frozen: "Frozen",
  expired: "Expired",
  cancelled: "Cancelled",
  renewed: "Renewed",
};

interface MembershipStatusBadgeProps {
  status: MembershipStatusType;
  className?: string;
}

export function MembershipStatusBadge({ status, className }: MembershipStatusBadgeProps) {
  return (
    <StatusBadge
      variant={membershipStatusVariant[status]}
      label={membershipStatusLabel[status]}
      className={className}
    />
  );
}
