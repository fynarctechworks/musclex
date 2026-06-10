"use client";

import React, { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeftRight,
  Building2,
  CalendarClock,
  Check,
  History,
  Plus,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useBranches } from "@/features/branches";
import { useMemberMemberships } from "@/features/memberships";
import {
  useAccessGrants,
  useGrantTemporaryAccess,
  useRevokeAccess,
  useTransferHistory,
  type MembershipBranchAccess,
} from "@/features/membership-access";
import type { Branch, Member, MemberMembership } from "@/types";
import { AccessNetworkCard } from "./AccessNetworkCard";

interface MemberAccessTabProps {
  memberId: string;
  member: Member;
}

/**
 * Combined access management surface for a member:
 *   - Lists every active/frozen membership with its branch access grants.
 *   - Lets staff grant temporary access (e.g. 7-day travel pass).
 *   - Lets staff revoke non-home-branch grants.
 *   - Shows transfer history.
 *
 * Designed to match the rest of the member tabs in look and density.
 */
export function MemberAccessTab({ memberId, member }: MemberAccessTabProps) {
  const { data: memberships, isLoading: loadingMemberships } =
    useMemberMemberships(memberId);
  const { data: branches } = useBranches();
  const { data: transfers } = useTransferHistory(memberId);

  const [grantOpenFor, setGrantOpenFor] = useState<MemberMembership | null>(
    null,
  );

  const branchMap = useMemo(() => {
    const m = new Map<string, Branch>();
    (branches as Branch[] | undefined)?.forEach((b) => m.set(b.id, b));
    return m;
  }, [branches]);

  const activeMemberships =
    (memberships as MemberMembership[] | undefined)?.filter(
      (m) => m.status === "active" || m.status === "frozen",
    ) ?? [];

  if (loadingMemberships) {
    return (
      <div className="space-y-3">
        <LoadingSkeleton className="h-48 w-full" />
        <LoadingSkeleton className="h-48 w-full" />
      </div>
    );
  }

  if (activeMemberships.length === 0) {
    return (
      <EmptyState
        title="No active memberships"
        description="Assign an active membership to manage cross-branch access."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Member-facing "your access network" summary — the differentiating
          surface that makes all-access tangible. Lives above the staff
          management cards so members reading their own profile see it first. */}
      <AccessNetworkCard memberId={memberId} />

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Staff actions
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Use{" "}
              <span className="font-medium text-foreground">
                Grant temporary access
              </span>{" "}
              below to open extra branches for a limited window — perfect for
              travel or short-term needs. Use{" "}
              <span className="font-medium text-foreground">Transfer</span>{" "}
              (top of profile) to change the member&apos;s permanent home
              branch.
            </p>
          </div>
        </div>
      </div>

      {activeMemberships.map((m) => (
        <MembershipAccessCard
          key={m.id}
          membership={m}
          memberHomeBranchId={member.branch_id ?? ""}
          branchMap={branchMap}
          onGrant={() => setGrantOpenFor(m)}
        />
      ))}

      {/* Transfer history */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Transfer history
          </h3>
        </div>
        {!transfers || transfers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            No branch transfers recorded.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {transfers.map((t) => {
              const from = branchMap.get(t.from_branch_id);
              const to = branchMap.get(t.to_branch_id);
              return (
                <li key={t.id} className="px-4 py-3 flex items-start gap-3">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="text-foreground">
                      <span className="font-medium">
                        {from?.name ?? t.from_branch_id.slice(0, 8)}
                      </span>{" "}
                      → <span className="font-medium">
                        {to?.name ?? t.to_branch_id.slice(0, 8)}
                      </span>
                    </p>
                    {t.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.reason}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(t.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {grantOpenFor && (
        <GrantAccessModal
          memberId={memberId}
          membership={grantOpenFor}
          branches={(branches as Branch[]) ?? []}
          existingGrantBranchIds={[]}
          onClose={() => setGrantOpenFor(null)}
        />
      )}
    </div>
  );
}

// ── Per-membership card ─────────────────────────────────────────────────

function MembershipAccessCard({
  membership,
  memberHomeBranchId,
  branchMap,
  onGrant,
}: {
  membership: MemberMembership;
  memberHomeBranchId: string;
  branchMap: Map<string, Branch>;
  onGrant: () => void;
}) {
  const { data: grants, isLoading } = useAccessGrants(membership.id);
  const revoke = useRevokeAccess(membership.id);

  const accessType =
    (membership.plan as { access_type?: string })?.access_type ??
    "single_branch";

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {membership.plan?.name ?? "Membership"}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                membership.status === "active"
                  ? "bg-primary/10 text-primary"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {membership.status}
            </span>
            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground capitalize">
              {accessType.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Home branch:{" "}
            <span className="text-foreground">
              {branchMap.get(membership.branch_id)?.name ??
                membership.branch_id.slice(0, 8)}
            </span>
            {membership.end_date && (
              <>
                {" · "}
                Valid until{" "}
                <span className="text-foreground">
                  {format(new Date(membership.end_date), "dd MMM yyyy")}
                </span>
              </>
            )}
          </p>
        </div>
        <Button
          onClick={onGrant}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          Grant temporary access
        </Button>
      </div>

      <div className="px-4 py-3">
        {isLoading ? (
          <LoadingSkeleton className="h-16 w-full" />
        ) : !grants || grants.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No branch grants recorded yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {grants.map((g: MembershipBranchAccess) => {
              const branch = g.branch ?? branchMap.get(g.branch_id);
              const isHome =
                g.branch_id === membership.branch_id ||
                g.branch_id === memberHomeBranchId;
              const expired =
                g.expires_at && new Date(g.expires_at).getTime() < Date.now();
              return (
                <li
                  key={g.id}
                  className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2"
                >
                  <Building2
                    className={`h-4 w-4 mt-0.5 ${
                      expired ? "text-muted-foreground" : "text-primary"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {branch?.name ?? g.branch_id.slice(0, 8)}
                      </span>
                      {isHome && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <Check className="h-3 w-3" />
                          Home
                        </span>
                      )}
                      {g.expires_at && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            expired
                              ? "bg-muted text-muted-foreground"
                              : "bg-warning/10 text-warning"
                          }`}
                        >
                          <CalendarClock className="h-3 w-3" />
                          {expired
                            ? "Expired"
                            : `Until ${format(
                                new Date(g.expires_at),
                                "dd MMM yyyy",
                              )}`}
                        </span>
                      )}
                    </div>
                    {g.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {g.reason}
                      </p>
                    )}
                  </div>
                  {!isHome && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revoke.mutate(g.branch_id)}
                      disabled={revoke.isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Revoke access"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Grant temporary access modal ────────────────────────────────────────

function GrantAccessModal({
  memberId,
  membership,
  branches,
  existingGrantBranchIds,
  onClose,
}: {
  memberId: string;
  membership: MemberMembership;
  branches: Branch[];
  existingGrantBranchIds: string[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("travel pass");
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const grant = useGrantTemporaryAccess(memberId);

  const candidates = branches.filter(
    (b) =>
      b.id !== membership.branch_id &&
      b.is_active !== false &&
      !existingGrantBranchIds.includes(b.id),
  );

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  const handleSubmit = () => {
    if (selected.length === 0 || !expiresAt) return;
    const iso = new Date(`${expiresAt}T23:59:59`).toISOString();
    grant.mutate(
      {
        membership_id: membership.id,
        branch_ids: selected,
        expires_at: iso,
        reason: reason || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-level-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-base font-semibold text-foreground">
            Grant Temporary Access
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Add cross-branch access on{" "}
          <span className="font-medium text-foreground">
            {membership.plan?.name}
          </span>{" "}
          for a limited window. Re-grants extend the expiry.
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Branches to grant *
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {candidates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No other active branches available.
                </p>
              )}
              {candidates.map((b) => {
                const on = selected.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggle(b.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {on ? <Check className="h-3 w-3" /> : null}
                    {b.name}
                    {b.city ? (
                      <span className="text-muted-foreground/70">
                        · {b.city}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Valid until *
              </label>
              <input
                type="date"
                value={expiresAt}
                min={new Date().toISOString().slice(0, 10)}
                max={
                  membership.end_date
                    ? new Date(membership.end_date)
                        .toISOString()
                        .slice(0, 10)
                    : undefined
                }
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              {membership.end_date && (
                <p className="text-xs text-muted-foreground">
                  Cannot extend past membership end date (
                  {format(new Date(membership.end_date), "dd MMM yyyy")}).
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="travel pass, promotional…"
                maxLength={500}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              selected.length === 0 || !expiresAt || grant.isPending
            }
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            {grant.isPending
              ? "Granting…"
              : `Grant access to ${selected.length || 0} branch${
                  selected.length === 1 ? "" : "es"
                }`}
          </Button>
        </div>
      </div>
    </div>
  );
}
