"use client";

import React, { useMemo } from "react";
import { format, formatDistanceToNow, isAfter, isBefore } from "date-fns";
import {
  Building2,
  Calendar,
  Check,
  Compass,
  Globe2,
  MapPin,
  Sparkles,
  Sun,
  Ticket,
} from "lucide-react";
import { useBranches } from "@/features/branches";
import { useMemberMemberships } from "@/features/memberships";
import { useAccessGrants } from "@/features/membership-access";
import type { Branch, MemberMembership } from "@/types";

interface AccessNetworkCardProps {
  memberId: string;
  /** When true, hides staff-only language and frames copy for the member. */
  memberFacing?: boolean;
}

/**
 * Plain-English "where can this member check in?" panel.
 *
 * Shows, per active or frozen membership:
 *   - The access scope tier (single / multi / all-access / city / time / class-only)
 *   - The full set of branches the membership unlocks (home + multi-branch
 *     plan list ∪ temporary grants), each with city if available
 *   - Active travel-pass / temporary grants with their expiry countdown
 *
 * Designed to be the *first* thing a member sees on the Access tab —
 * makes the multi-gym value tangible.
 */
export function AccessNetworkCard({
  memberId,
  memberFacing = false,
}: AccessNetworkCardProps) {
  const { data: memberships } = useMemberMemberships(memberId);
  const { data: branches } = useBranches();

  const active = (memberships as MemberMembership[] | undefined)?.filter(
    (m) => m.status === "active" || m.status === "frozen",
  ) ?? [];

  const branchMap = useMemo(() => {
    const m = new Map<string, Branch>();
    (branches as Branch[] | undefined)?.forEach((b) => m.set(b.id, b));
    return m;
  }, [branches]);

  if (active.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-center">
        <Ticket className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">
          No active membership
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {memberFacing
            ? "Activate a membership to see where you can check in."
            : "Assign or activate a membership to populate the access network."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {active.map((m) => (
        <MembershipNetworkCard
          key={m.id}
          membership={m}
          branchMap={branchMap}
          memberFacing={memberFacing}
        />
      ))}
    </div>
  );
}

function MembershipNetworkCard({
  membership,
  branchMap,
  memberFacing,
}: {
  membership: MemberMembership;
  branchMap: Map<string, Branch>;
  memberFacing: boolean;
}) {
  const { data: grants } = useAccessGrants(membership.id);

  const plan = (membership.plan as unknown as {
    access_type?: string;
    tier?: string;
    allowed_branch_ids?: string[];
    allowed_city?: string | null;
    allowed_hours_json?: { start?: string; end?: string; days?: number[] } | null;
  }) ?? {};
  const accessType = plan.access_type ?? "single_branch";
  const tier = plan.tier ?? "basic";

  // Compute the full "where can this membership check in" set.
  const now = new Date();
  const liveGrants =
    grants?.filter(
      (g) => !g.expires_at || isAfter(new Date(g.expires_at), now),
    ) ?? [];
  const grantBranchIds = new Set(liveGrants.map((g) => g.branch_id));

  // Build the displayable branch list from access_type semantics.
  // For all_access we don't enumerate every branch (could be thousands) —
  // we just say "every location" and list known ones for context.
  let resolvedBranchIds: string[] = [];
  if (accessType === "all_access") {
    resolvedBranchIds = Array.from(branchMap.keys());
  } else if (accessType === "multi_branch") {
    const seen: Record<string, true> = {};
    const ids: string[] = [];
    const push = (id: string) => {
      if (!seen[id]) {
        seen[id] = true;
        ids.push(id);
      }
    };
    push(membership.branch_id);
    (plan.allowed_branch_ids ?? []).forEach(push);
    grantBranchIds.forEach(push);
    resolvedBranchIds = ids;
  } else if (accessType === "city_access" && plan.allowed_city) {
    const city = plan.allowed_city.trim().toLowerCase();
    resolvedBranchIds = Array.from(branchMap.values())
      .filter((b) => (b.city ?? "").trim().toLowerCase() === city)
      .map((b) => b.id);
    // Plus any explicit grants (e.g. a travel pass outside the city)
    grantBranchIds.forEach((id) => {
      if (!resolvedBranchIds.includes(id)) resolvedBranchIds.push(id);
    });
  } else {
    // single_branch / time_based / class_only → home + grants
    const ids: string[] = [membership.branch_id];
    grantBranchIds.forEach((id) => {
      if (!ids.includes(id)) ids.push(id);
    });
    resolvedBranchIds = ids;
  }

  const branchObjs = resolvedBranchIds
    .map((id) => branchMap.get(id))
    .filter((b): b is Branch => !!b);

  const totalBranches = branchObjs.length;
  const isFrozen = membership.status === "frozen";

  const scope = describeScope(accessType, plan, branchObjs.length);
  const hoursLine =
    accessType === "time_based"
      ? formatHoursLine(plan.allowed_hours_json ?? null)
      : null;

  // Soon-to-expire grants we should surface up top.
  const expiringGrants = liveGrants
    .filter((g) => g.expires_at)
    .map((g) => ({
      ...g,
      expires_at_date: new Date(g.expires_at as string),
    }))
    .sort((a, b) => a.expires_at_date.getTime() - b.expires_at_date.getTime());

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div
        className={`px-5 py-4 border-b border-border bg-gradient-to-r ${
          tierGradient(tier)
        }`}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold text-foreground">
                {membership.plan?.name ?? "Your Membership"}
              </h3>
              <span className="inline-flex items-center rounded-full bg-card border border-border px-2 py-0.5 text-[11px] font-medium text-foreground capitalize">
                {tier}
              </span>
              {isFrozen && (
                <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                  Frozen
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {scope.headline}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-foreground leading-none">
              {accessType === "all_access" ? "All" : totalBranches}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {accessType === "all_access"
                ? "locations in network"
                : totalBranches === 1
                  ? "branch"
                  : "branches"}
            </p>
          </div>
        </div>

        {membership.end_date && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Valid until{" "}
            <span className="font-medium text-foreground">
              {format(new Date(membership.end_date), "dd MMM yyyy")}
            </span>
            <span className="text-muted-foreground/70">
              ({formatDistanceToNow(new Date(membership.end_date), {
                addSuffix: true,
              })})
            </span>
          </p>
        )}

        {hoursLine && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <Sun className="h-3 w-3" />
            {hoursLine}
          </p>
        )}
      </div>

      {/* Expiring grants strip */}
      {expiringGrants.length > 0 && (
        <div className="px-5 py-3 bg-warning/5 border-b border-border">
          <p className="text-[11px] font-medium uppercase tracking-wider text-warning mb-1.5">
            Travel passes
          </p>
          <div className="space-y-1">
            {expiringGrants.slice(0, 3).map((g) => {
              const expiringSoon = isBefore(
                g.expires_at_date,
                new Date(Date.now() + 3 * 86400000),
              );
              const branch = branchMap.get(g.branch_id);
              return (
                <p key={g.id} className="text-xs text-foreground">
                  <span className="font-medium">
                    {branch?.name ?? g.branch_id.slice(0, 8)}
                  </span>
                  {branch?.city && (
                    <span className="text-muted-foreground"> · {branch.city}</span>
                  )}
                  <span className="text-muted-foreground">
                    {" "}
                    — expires {expiringSoon ? (
                      <span className="text-warning font-medium">
                        {formatDistanceToNow(g.expires_at_date, {
                          addSuffix: true,
                        })}
                      </span>
                    ) : (
                      formatDistanceToNow(g.expires_at_date, {
                        addSuffix: true,
                      })
                    )}
                  </span>
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Branch grid */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5">
          {accessType === "all_access"
            ? "Branches in your network"
            : "Where you can check in"}
        </p>
        {branchObjs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No branches resolved yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {branchObjs.map((b) => {
              const isHome = b.id === membership.branch_id;
              const isTemporary = grantBranchIds.has(b.id) && !isHome;
              return (
                <div
                  key={b.id}
                  className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2.5"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-md ${
                      isHome
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isHome ? (
                      <Compass className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {b.name}
                    </p>
                    {b.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {b.city}
                      </p>
                    )}
                  </div>
                  {isHome && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <Check className="h-2.5 w-2.5" />
                      Home
                    </span>
                  )}
                  {isTemporary && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      Travel
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {accessType === "all_access" && (
          <p className="mt-3 text-xs text-muted-foreground flex items-start gap-1.5">
            <Globe2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
            New branches added to your gym network will be automatically
            available — no extra cost.
          </p>
        )}
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────

function describeScope(
  accessType: string,
  plan: { allowed_city?: string | null },
  branchCount: number,
): { headline: string } {
  switch (accessType) {
    case "all_access":
      return {
        headline: "All-access pass — check in at every gym in the network.",
      };
    case "multi_branch":
      return {
        headline: `Multi-branch access — ${branchCount} locations included.`,
      };
    case "city_access":
      return {
        headline: plan.allowed_city
          ? `City-wide access in ${plan.allowed_city}.`
          : "City-wide access.",
      };
    case "time_based":
      return { headline: "Off-peak / scheduled access plan." };
    case "class_only":
      return {
        headline: "Class-only pass — access during booked sessions.",
      };
    case "single_branch":
    default:
      return { headline: "Home-branch access." };
  }
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHoursLine(
  spec: { start?: string; end?: string; days?: number[] } | null,
): string | null {
  if (!spec || !spec.start || !spec.end) return null;
  const days =
    spec.days && spec.days.length > 0
      ? spec.days.map((d) => DAYS[d] ?? "?").join(", ")
      : "every day";
  return `${spec.start} – ${spec.end}, ${days}`;
}

function tierGradient(tier: string): string {
  switch (tier) {
    case "vip":
      return "from-purple-500/10 via-purple-500/5 to-transparent";
    case "elite":
      return "from-primary/10 via-primary/5 to-transparent";
    case "pro":
      return "from-success/10 via-success/5 to-transparent";
    case "basic":
    default:
      return "from-muted via-muted/50 to-transparent";
  }
}
