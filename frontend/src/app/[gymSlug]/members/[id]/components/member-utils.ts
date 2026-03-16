import type { Member, Payment } from "@/types";

export type MemberStatus = Member["status"];

export const statusToVariant: Record<
  MemberStatus,
  "active" | "expiring" | "expired" | "frozen"
> = {
  active: "active",
  expiring_soon: "expiring",
  expired: "expired",
  frozen: "frozen",
  inactive: "expired",
};

export const statusLabels: Record<MemberStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  frozen: "Frozen",
  inactive: "Inactive",
};

export const paymentStatusVariant: Record<
  Payment["status"],
  "active" | "expiring" | "expired" | "frozen" | "pending"
> = {
  paid: "active",
  pending: "pending",
  partial: "expiring",
  failed: "expired",
  refunded: "frozen",
};
