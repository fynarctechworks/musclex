"use client";

import { useAuthStore } from "@/stores/auth-store";

export type DashboardRoleView =
  | "owner"
  | "manager"
  | "trainer"
  | "front_desk";

export interface RoleCapabilities {
  view: DashboardRoleView;
  see_financials: boolean;
  see_churn_signals: boolean;
  scope_to_self: boolean;
  branch_only: boolean;
  compact_mode: boolean;
}

/**
 * Mirrors backend `resolveRoleView` so the frontend renders the right
 * variant. Server is still the source of truth — these capabilities only
 * decide WHICH dashboard layout to mount, never what numbers to trust.
 */
export function useRoleView(): {
  view: DashboardRoleView;
  caps: RoleCapabilities;
} {
  const role = useAuthStore((s) => s.user?.role) ?? "front_desk";

  let view: DashboardRoleView;
  if (
    role === "owner" ||
    role === "super_admin" ||
    role === "brand_owner" ||
    role === "multi_branch_owner"
  ) {
    view = "owner";
  } else if (role === "manager") {
    view = "manager";
  } else if (role === "trainer") {
    view = "trainer";
  } else {
    view = "front_desk";
  }

  return { view, caps: capabilitiesFor(view) };
}

function capabilitiesFor(view: DashboardRoleView): RoleCapabilities {
  switch (view) {
    case "owner":
      return {
        view,
        see_financials: true,
        see_churn_signals: true,
        scope_to_self: false,
        branch_only: false,
        compact_mode: false,
      };
    case "manager":
      return {
        view,
        see_financials: true,
        see_churn_signals: true,
        scope_to_self: false,
        branch_only: true,
        compact_mode: false,
      };
    case "trainer":
      return {
        view,
        see_financials: false,
        see_churn_signals: true,
        scope_to_self: true,
        branch_only: true,
        compact_mode: false,
      };
    case "front_desk":
    default:
      return {
        view,
        see_financials: false,
        see_churn_signals: false,
        scope_to_self: false,
        branch_only: true,
        compact_mode: true,
      };
  }
}
