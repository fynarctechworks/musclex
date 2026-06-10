"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  Shield,
  Save,
  Building2,
  Eye,
  Ban,
  RotateCcw,
  ChevronDown,
  UserCog,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader, LoadingSkeleton, AccessDenied, EmptyState } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiClient } from "@/lib/api";
import type { Staff, Branch } from "@/types";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import {
  useStaffPermissions,
  useUpdatePermissions,
  useUpdateStaffBranchAccess,
} from "@/features/staff";
import { cn } from "@/lib/utils";

// Permission matrix — mirrors backend ALL_PERMISSIONS registry
// Keep in sync with backend/src/auth/rbac-seed.service.ts MODULES_ACTIONS
const PERMISSION_MODULES: Record<string, { label: string; actions: string[] }> = {
  dashboard: { label: "Dashboard", actions: ["view", "export"] },
  members: { label: "Members", actions: ["view", "create", "edit", "delete", "export"] },
  check_ins: { label: "Check-ins", actions: ["view", "create", "edit", "delete", "export"] },
  payments: { label: "Payments", actions: ["view", "create", "edit", "delete", "export"] },
  classes: { label: "Classes", actions: ["view", "create", "edit", "delete", "export"] },
  staff: { label: "Staff", actions: ["view", "create", "edit", "delete", "export"] },
  marketing: { label: "Marketing", actions: ["view", "create", "edit", "delete", "export"] },
  ai: { label: "AI Advisor", actions: ["view", "create"] },
  settings: { label: "Settings", actions: ["view", "edit"] },
  branches: { label: "Branches", actions: ["view", "create", "edit", "delete"] },
  organizations: { label: "Organizations", actions: ["view", "create", "edit", "delete"] },
  reports: { label: "Reports", actions: ["view", "export"] },
  roles: { label: "Roles", actions: ["view", "create", "edit", "delete"] },
};

type OverrideState = "grant" | "deny" | "inherit";

function getOverrideState(code: string, grants: Set<string>, denials: Set<string>): OverrideState {
  if (grants.has(code)) return "grant";
  if (denials.has(code)) return "deny";
  return "inherit";
}

/* ─── Staff list item ─── */
function StaffRow({
  staff,
  active,
  onClick,
}: {
  staff: Staff;
  active: boolean;
  onClick: () => void;
}) {
  const initials = staff.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        active
          ? "bg-canvas-soft-2 text-foreground"
          : "text-muted-foreground hover:bg-canvas-soft/60 hover:text-foreground"
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-canvas-soft-2 text-primary text-[11px] font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground truncate">{staff.full_name}</p>
        <p className="text-[11px] text-muted-foreground truncate capitalize">
          {staff.role?.replace(/_/g, " ") || "staff"}
        </p>
      </div>
      {!staff.is_active && (
        <span className="text-[10px] text-muted-foreground/60 uppercase">Inactive</span>
      )}
    </button>
  );
}

/* ─── Collapsible section header ─── */
function SectionHeader({
  icon: Icon,
  title,
  description,
  open,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-canvas-soft/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="text-left">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronDown
        className={cn(
          "h-4 w-4 text-muted-foreground transition-transform",
          open && "rotate-180"
        )}
      />
    </button>
  );
}

/* ─── Main page ─── */
export default function StaffPermissionsPage() {
  const { gymPath } = useGymSlug();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === "owner" || user?.role === "brand_owner";

  // ── Data ────────────────────────────────────────────────
  const { data: staffResponse, isLoading: staffLoading } = useQuery<{
    data: Staff[];
    total: number;
  }>({
    queryKey: ["staff", "list", "permissions"],
    queryFn: () => apiClient.get("/staff", { params: { limit: 500 } }),
    enabled: isOwner,
  });
  const staffList = staffResponse?.data;

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiClient.get("/branches"),
    staleTime: 5 * 60 * 1000,
  });

  // ── Selection ───────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    const q = search.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.role?.toLowerCase().includes(q)
    );
  }, [staffList, search]);

  // Auto-select first staff
  useEffect(() => {
    if (!selectedId && filteredStaff.length > 0) {
      setSelectedId(filteredStaff[0].id);
    }
  }, [filteredStaff, selectedId]);

  const selected = useMemo(
    () => staffList?.find((s) => s.id === selectedId) ?? null,
    [staffList, selectedId]
  );

  // ── Permissions editor state ────────────────────────────
  const { data: permsData, isLoading: permsLoading } = useStaffPermissions(selectedId ?? "");
  const updatePermsMutation = useUpdatePermissions();
  const updateBranchesMutation = useUpdateStaffBranchAccess();

  const [grants, setGrants] = useState<Set<string>>(new Set());
  const [denials, setDenials] = useState<Set<string>>(new Set());
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState<{ perms: boolean; branches: boolean }>({
    perms: false,
    branches: false,
  });

  // Reset local state whenever selection changes or data loads
  useEffect(() => {
    if (permsData && typeof permsData === "object" && "grants" in permsData) {
      const p = permsData as { grants: string[]; denials: string[] };
      setGrants(new Set(p.grants || []));
      setDenials(new Set(p.denials || []));
      setDirty((d) => ({ ...d, perms: false }));
    }
  }, [permsData, selectedId]);

  useEffect(() => {
    if (selected) {
      setBranchIds([...(selected.branch_ids || [])]);
      setDirty((d) => ({ ...d, branches: false }));
    }
  }, [selected]);

  // Section open/closed state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    branches: true,
    modules: true,
  });
  const toggle = (k: string) => setOpenSections((s) => ({ ...s, [k]: !s[k] }));

  // Per-module expansion
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // ── Helpers ─────────────────────────────────────────────
  const setCodeState = (code: string, state: OverrideState) => {
    setGrants((g) => {
      const next = new Set(g);
      if (state === "grant") next.add(code);
      else next.delete(code);
      return next;
    });
    setDenials((d) => {
      const next = new Set(d);
      if (state === "deny") next.add(code);
      else next.delete(code);
      return next;
    });
    setDirty((prev) => ({ ...prev, perms: true }));
  };

  const applyModuleAction = (mod: string, type: "grant_all" | "read_only" | "deny_all" | "clear") => {
    const actions = PERMISSION_MODULES[mod].actions;
    setGrants((g) => {
      const next = new Set(g);
      actions.forEach((a) => {
        const code = `${mod}.${a}`;
        next.delete(code);
        if (type === "grant_all") next.add(code);
        else if (type === "read_only" && (a === "view" || a === "export")) next.add(code);
      });
      return next;
    });
    setDenials((d) => {
      const next = new Set(d);
      actions.forEach((a) => {
        const code = `${mod}.${a}`;
        next.delete(code);
        if (type === "deny_all") next.add(code);
        else if (type === "read_only" && a !== "view" && a !== "export") next.add(code);
      });
      return next;
    });
    setDirty((prev) => ({ ...prev, perms: true }));
  };

  const toggleBranch = (bid: string) => {
    setBranchIds((ids) => {
      const next = ids.includes(bid) ? ids.filter((i) => i !== bid) : [...ids, bid];
      return next;
    });
    setDirty((prev) => ({ ...prev, branches: true }));
  };

  const savePermissions = () => {
    if (!selected) return;
    updatePermsMutation.mutate(
      {
        staffId: selected.id,
        data: { grants: Array.from(grants), denials: Array.from(denials) },
      },
      { onSuccess: () => setDirty((d) => ({ ...d, perms: false })) }
    );
  };

  const saveBranches = () => {
    if (!selected) return;
    updateBranchesMutation.mutate(
      { staffId: selected.id, branch_ids: branchIds },
      { onSuccess: () => setDirty((d) => ({ ...d, branches: false })) }
    );
  };

  // ── Access gate (owner only) ────────────────────────────
  if (user && !isOwner) {
    return (
      <AppLayout>
        <AccessDenied module="permission management" />
      </AppLayout>
    );
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Back link */}
        <Link
          href={gymPath("/settings")}
          className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Settings
        </Link>

        <PageHeader
          title="Staff Permissions"
          description="Override role-based permissions and branch access per staff member."
        />

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
          {/* ─── Staff list ─── */}
          <aside className="bg-card border border-border rounded-lg overflow-hidden h-fit lg:sticky lg:top-4">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search staff…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-[13px]"
                />
              </div>
            </div>
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="p-2 space-y-0.5">
                {staffLoading ? (
                  <div className="p-3 space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <LoadingSkeleton key={i} className="h-11 w-full rounded-lg" />
                    ))}
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={UserCog}
                      title="No staff found"
                      description={search ? "Try a different search." : "Add staff first."}
                    />
                  </div>
                ) : (
                  filteredStaff.map((s) => (
                    <StaffRow
                      key={s.id}
                      staff={s}
                      active={s.id === selectedId}
                      onClick={() => setSelectedId(s.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* ─── Editor ─── */}
          <section className="space-y-4">
            {!selected ? (
              <div className="bg-card border border-border rounded-lg p-10">
                <EmptyState
                  icon={Shield}
                  title="Select a staff member"
                  description="Pick someone from the list to manage their permissions."
                />
              </div>
            ) : (
              <>
                {/* Header card */}
                <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-canvas-soft-2 text-primary font-semibold">
                        {selected.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[15px] font-semibold text-foreground">
                        {selected.full_name}
                      </p>
                      <p className="text-[12px] text-muted-foreground capitalize">
                        {selected.role?.replace(/_/g, " ") || "staff"}
                        {selected.email ? ` • ${selected.email}` : ""}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={gymPath(`/staff/${selected.id}`)}
                    className="text-[12px] text-primary hover:text-primary/80"
                  >
                    View profile →
                  </Link>
                </div>

                {/* ── Branches section ── */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <SectionHeader
                    icon={Building2}
                    title="Branch Access"
                    description={`${branchIds.length} of ${branches?.length ?? 0} branches`}
                    open={openSections.branches}
                    onToggle={() => toggle("branches")}
                  />
                  {openSections.branches && (
                    <div className="px-4 pb-4">
                      {!branches?.length ? (
                        <p className="text-[12px] text-muted-foreground px-1 py-2">
                          No branches yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {branches.map((b) => {
                            const checked = branchIds.includes(b.id);
                            return (
                              <label
                                key={b.id}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors",
                                  checked
                                    ? "border-primary/40 bg-primary/5"
                                    : "border-border hover:bg-canvas-soft/40"
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleBranch(b.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium text-foreground truncate">
                                    {b.name}
                                  </p>
                                  {b.city && (
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {b.city}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {dirty.branches && (
                        <div className="flex justify-end mt-3">
                          <Button
                            size="sm"
                            onClick={saveBranches}
                            disabled={updateBranchesMutation.isPending}
                            className="h-8 text-[12px]"
                          >
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                            {updateBranchesMutation.isPending ? "Saving…" : "Save branches"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Module permissions section ── */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <SectionHeader
                    icon={Shield}
                    title="Module Permissions"
                    description="Override role defaults per module and action"
                    open={openSections.modules}
                    onToggle={() => toggle("modules")}
                  />
                  {openSections.modules && (
                    <div className="px-2 pb-3">
                      {permsLoading ? (
                        <div className="p-4 space-y-2">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <LoadingSkeleton key={i} className="h-10 w-full rounded-lg" />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {Object.entries(PERMISSION_MODULES).map(([mod, def]) => {
                            const actions = def.actions;
                            const expanded = expandedModule === mod;
                            const moduleGrants = actions.filter((a) =>
                              grants.has(`${mod}.${a}`)
                            ).length;
                            const moduleDenials = actions.filter((a) =>
                              denials.has(`${mod}.${a}`)
                            ).length;

                            const badge =
                              moduleDenials === actions.length
                                ? { text: "Disabled", cls: "bg-destructive/10 text-destructive" }
                                : moduleGrants === actions.length
                                  ? { text: "All granted", cls: "bg-success/10 text-success" }
                                  : moduleGrants + moduleDenials > 0
                                    ? { text: `${moduleGrants + moduleDenials} override${moduleGrants + moduleDenials > 1 ? "s" : ""}`, cls: "bg-canvas-soft-2 text-primary" }
                                    : { text: "Role default", cls: "text-muted-foreground bg-canvas-soft" };

                            return (
                              <div key={mod} className="rounded-lg border border-border">
                                <button
                                  onClick={() => setExpandedModule(expanded ? null : mod)}
                                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-canvas-soft/40 rounded-lg transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <ChevronDown
                                      className={cn(
                                        "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                        expanded && "rotate-180"
                                      )}
                                    />
                                    <span className="text-[13px] font-medium text-foreground">
                                      {def.label}
                                    </span>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded",
                                      badge.cls
                                    )}
                                  >
                                    {badge.text}
                                  </span>
                                </button>

                                {expanded && (
                                  <div className="px-3 pb-3 pt-1 border-t border-border bg-background/50">
                                    {/* Module quick actions */}
                                    <div className="flex items-center gap-1.5 flex-wrap py-2">
                                      <button
                                        onClick={() => applyModuleAction(mod, "grant_all")}
                                        className="px-2 py-1 text-[10.5px] rounded bg-success/10 text-success hover:bg-success/20"
                                      >
                                        Grant all
                                      </button>
                                      <button
                                        onClick={() => applyModuleAction(mod, "read_only")}
                                        className="px-2 py-1 text-[10.5px] rounded bg-canvas-soft-2 text-primary hover:bg-canvas-soft-2 inline-flex items-center gap-1"
                                      >
                                        <Eye className="h-3 w-3" /> Read-only
                                      </button>
                                      <button
                                        onClick={() => applyModuleAction(mod, "deny_all")}
                                        className="px-2 py-1 text-[10.5px] rounded bg-destructive/10 text-destructive hover:bg-destructive/20 inline-flex items-center gap-1"
                                      >
                                        <Ban className="h-3 w-3" /> Disable
                                      </button>
                                      <button
                                        onClick={() => applyModuleAction(mod, "clear")}
                                        className="px-2 py-1 text-[10.5px] rounded bg-muted text-muted-foreground hover:bg-canvas-soft-2 inline-flex items-center gap-1"
                                      >
                                        <RotateCcw className="h-3 w-3" /> Reset
                                      </button>
                                    </div>

                                    {/* Per-action toggles */}
                                    <div className="space-y-1 mt-1">
                                      {actions.map((action) => {
                                        const code = `${mod}.${action}`;
                                        const state = getOverrideState(code, grants, denials);

                                        return (
                                          <div
                                            key={code}
                                            className="flex items-center justify-between px-2 py-2 rounded hover:bg-canvas-soft/30"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-[12.5px] font-medium text-foreground capitalize">
                                                {action}
                                              </span>
                                              {state !== "inherit" && (
                                                <span
                                                  className={cn(
                                                    "text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium",
                                                    state === "grant"
                                                      ? "bg-success/10 text-success"
                                                      : "bg-destructive/10 text-destructive"
                                                  )}
                                                >
                                                  {state === "grant" ? "Granted" : "Denied"}
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                              {state !== "inherit" && (
                                                <button
                                                  onClick={() => setCodeState(code, "inherit")}
                                                  className="text-[10.5px] text-muted-foreground hover:text-foreground"
                                                  title="Clear override (use role default)"
                                                >
                                                  Clear
                                                </button>
                                              )}
                                              <Switch
                                                checked={state === "grant"}
                                                onCheckedChange={(v) =>
                                                  setCodeState(code, v ? "grant" : "deny")
                                                }
                                                aria-label={`${action} permission for ${def.label}`}
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sticky save footer */}
                {dirty.perms && (
                  <div className="sticky bottom-4 flex justify-end">
                    <div className="bg-card border border-border rounded-lg shadow-level-4 px-4 py-3 flex items-center gap-3">
                      <span className="text-[12px] text-muted-foreground">
                        You have unsaved permission changes
                      </span>
                      <Button
                        size="sm"
                        onClick={savePermissions}
                        disabled={updatePermsMutation.isPending}
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        {updatePermsMutation.isPending ? "Saving…" : "Save permissions"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
