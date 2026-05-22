"use client";

import React, { useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  CalendarDays,
  DollarSign,
  UserCog,
  Megaphone,
  Bot,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Menu,
  Building2,
  ChevronsLeft,
  Package,
  BarChart3,
  LogOut,
  User,
  ChevronRight,
  CreditCard,
  Activity,
  UserPlus,
  ShoppingCart,
  BookUser,
  ScanFace,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { toast } from "sonner";
import type { Branch } from "@/lib/types";
import { TwoFactorBanner } from "@/components/shared/two-factor-banner";
import { SubscriptionBanner } from "@/features/subscription";
import { useSessionSync } from "@/hooks/use-session-sync";
import { useAuth } from "@/hooks/use-auth";

/* ─── Nav item type ─── */
type NavItem = { label: string; href: string; icon: React.ElementType; feature?: string; module?: string };

/* ─── Mobile bottom nav tabs ─── */
const mobileNavTabs: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { label: "Members", href: "/members", icon: Users, module: "members" },
  { label: "Schedule", href: "/schedule", icon: CalendarDays, module: "classes" },
  { label: "Finance", href: "/finance", icon: DollarSign, module: "payments" },
  { label: "AI", href: "/ai", icon: Bot, module: "ai" },
];

/* ─── Gym navigation (filtered by plan features) ─── */
const gymNavItems: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",        icon: LayoutDashboard, module: "dashboard" },
  { label: "Members",     href: "/members",           icon: Users,        feature: "member_management", module: "members" },
  { label: "Memberships", href: "/memberships/plans", icon: CreditCard,   feature: "member_management", module: "members" },
  { label: "Check-ins",   href: "/check-in",          icon: UserCheck,    feature: "check_in", module: "check_ins" },
  { label: "Biometrics",  href: "/biometrics",        icon: ScanFace,     feature: "check_in", module: "members" },
  { label: "Visits",      href: "/visits",            icon: Activity,     feature: "check_in", module: "check_ins" },
  { label: "Schedule",    href: "/schedule",          icon: CalendarDays, feature: "class_scheduling", module: "classes" },
  { label: "Finance",     href: "/finance",           icon: DollarSign,   feature: "manual_payments", module: "payments" },
  { label: "Staff",       href: "/staff",             icon: UserCog,      feature: "staff_management", module: "staff" },
  { label: "Marketing",   href: "/marketing",         icon: Megaphone,    feature: "marketing_campaigns", module: "marketing" },
];

const gymSecondaryNavItems: NavItem[] = [
  { label: "CRM",         href: "/crm",        icon: BookUser,      feature: "member_management", module: "members" },
  { label: "Referrals",   href: "/referrals",  icon: UserPlus,      feature: "marketing_campaigns", module: "marketing" },
  { label: "Inventory",   href: "/inventory",  icon: Package,       module: "settings" },
  { label: "POS",         href: "/pos",        icon: ShoppingCart, module: "payments" },
  { label: "Reports",     href: "/reports",    icon: BarChart3,     feature: "basic_reports", module: "reports" },
  { label: "AI Advisor",  href: "/ai",         icon: Bot,           feature: "ai_advisor", module: "ai" },
];

const bottomNavItems: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings, module: "settings" },
];

/** Filter nav items against the plan's feature map. Items without a feature key are always shown. */
function filterByFeatures(items: NavItem[], features: Record<string, boolean>): NavItem[] {
  return items.filter((item) => !item.feature || features[item.feature] === true);
}

/** Filter nav items by user permission. Items without a module are always shown. Owners/admins always pass. */
function filterByPermissions(
  items: NavItem[],
  can: (module: string, action: string) => boolean,
): NavItem[] {
  return items.filter((item) => !item.module || can(item.module, "view"));
}

/* ─── Breadcrumb extraction from pathname ─── */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a UUID breadcrumb label from already-cached react-query data — no extra API calls */
function useEntityLabel(parentSeg: string, id: string): string {
  const queryClient = useQueryClient();

  const cacheMap: Record<string, string[]> = {
    members: ["members"],
    classes: ["classes"],
    staff: ["staff"],
    campaigns: ["campaigns"],
    leads: ["leads"],
  };

  const listKey = cacheMap[parentSeg];
  if (listKey) {
    const list = queryClient.getQueryData<{ id: string; full_name?: string; name?: string }[]>(listKey);
    const match = list?.find((item) => item.id === id);
    if (match) return match.full_name ?? match.name ?? id.slice(0, 8) + "…";
  }

  // Fall back to a readable truncation — no API call
  return id.slice(0, 8) + "…";
}

function useBreadcrumbs(pathname: string, basePath: string) {
  const stripped = pathname.replace(basePath, "");
  const segments = stripped.split("/").filter(Boolean);

  return segments.map((seg, i) => {
    const href = `${basePath}/${segments.slice(0, i + 1).join("/")}`;
    const isUuid = UUID_REGEX.test(seg);
    const label = isUuid
      ? null // resolved lazily per-breadcrumb via useEntityLabel
      : seg.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
    return { label, seg, isUuid, parentSeg: i > 0 ? segments[i - 1] : "", href, isLast: i === segments.length - 1 };
  });
}

/** Single breadcrumb item — resolves entity name for UUID segments */
function BreadcrumbItem({ crumb, isFirst }: {
  crumb: ReturnType<typeof useBreadcrumbs>[number];
  isFirst: boolean;
}) {
  const entityLabel = useEntityLabel(crumb.parentSeg, crumb.isUuid ? crumb.seg : "");
  const label = crumb.isUuid ? entityLabel : crumb.label!;

  if (crumb.isLast) {
    return (
      <>
        {!isFirst && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
        <span className="font-medium text-foreground">{label}</span>
      </>
    );
  }
  return (
    <>
      {!isFirst && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
      <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
        {label}
      </Link>
    </>
  );
}

/* ─── Sidebar Nav Link ─── */
function NavLink({
  item,
  basePath,
  pathname,
  collapsed,
}: {
  item: { label: string; href: string; icon: React.ElementType };
  basePath: string;
  pathname: string;
  collapsed: boolean;
}) {
  const fullHref = `${basePath}${item.href}`;
  const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");

  const linkContent = (
    <Link
      href={fullHref}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-sm px-2.5 h-8 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-canvas-soft-2 text-foreground"
          : "text-muted-foreground hover:bg-canvas-soft hover:text-foreground"
      )}
    >
      {/* Active indicator — ink bar on the left edge (Design.md `ex-app-shell-row`) */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
      )}
      <item.icon className={cn("h-[15px] w-[15px] shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

/* ─── Sidebar ─── */
function SidebarContent({
  pathname,
  basePath,
  collapsed,
  onCollapse,
  primaryItems,
  secondaryItems,
  secondaryLabel,
}: {
  pathname: string;
  basePath: string;
  collapsed: boolean;
  onCollapse?: () => void;
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  secondaryLabel: string;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo + Collapse — Design.md nav-bar height (64 px) */}
      <div className={cn("flex h-16 items-center px-4", collapsed ? "justify-center" : "justify-between")}>
        <Link href={`${basePath}/dashboard`} className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary">
            <span className="text-[11px] font-semibold text-primary-foreground">M</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
              MuscleX
            </span>
          )}
        </Link>
        {!collapsed && onCollapse && (
          <button
            onClick={onCollapse}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-canvas-soft hover:text-foreground transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mx-3 h-px bg-hairline" />

      {/* Primary Nav */}
      <ScrollArea className="flex-1 px-2.5 py-3">
        <nav className="flex flex-col gap-0.5" role="navigation" aria-label="Main navigation">
          {primaryItems.map((item) => (
            <NavLink key={item.href} item={item} basePath={basePath} pathname={pathname} collapsed={collapsed} />
          ))}
        </nav>

        {secondaryItems.length > 0 && (
          <div className="mt-5">
            {!collapsed && (
              <p className="mb-1.5 px-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {secondaryLabel}
              </p>
            )}
            {collapsed && <div className="mx-auto my-2 h-px w-6 bg-hairline" />}
            <nav className="flex flex-col gap-0.5">
              {secondaryItems.map((item) => (
                <NavLink key={item.href} item={item} basePath={basePath} pathname={pathname} collapsed={collapsed} />
              ))}
            </nav>
          </div>
        )}
      </ScrollArea>

      {/* Bottom: Settings */}
      <div className="px-2.5 pb-3">
        <div className="mx-1 mb-2 h-px bg-hairline" />
        {bottomNavItems.map((item) => (
          <NavLink key={item.href} item={item} basePath={basePath} pathname={pathname} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

/* ─── Mobile Bottom Nav Bar ─── */
function MobileBottomNav({ pathname, basePath, items }: { pathname: string; basePath: string; items: NavItem[] }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-hairline bg-card lg:hidden"
      aria-label="Mobile navigation"
    >
      {items.map((item) => {
        const fullHref = `${basePath}${item.href}`;
        const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");
        return (
          <Link
            key={item.href}
            href={fullHref}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ─── Main Layout ─── */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { gymSlug, gymPath } = useGymSlug();
  const basePath = `/${gymSlug}`;

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const setActiveBranch = useAuthStore((s) => s.setActiveBranch);
  const { refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const sidebarMobileOpen = useUiStore((s) => s.sidebarMobileOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSidebarMobileOpen = useUiStore((s) => s.setSidebarMobileOpen);

  const breadcrumbs = useBreadcrumbs(pathname, basePath);

  // Self-heal stale JWTs that are missing studio_id in user_metadata.
  // Happens when onboarding completed but the client's access_token was
  // issued before the backend wrote studio_id to user_metadata.
  useSessionSync();

  /* ─── Account / plan features (cached 5 min, refetch on window focus) ─── */
  const { data: account } = useQuery<{ features: Record<string, boolean>; subscription: { plan: string } }>({
    queryKey: ["account-overview"],
    queryFn: () => apiClient.get("/settings/account"),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!user,
  });

  const features: Record<string, boolean> = account?.features ?? {};

  const primaryNav = filterByPermissions(filterByFeatures(gymNavItems, features), hasPermission);
  const secondaryNav = filterByPermissions(filterByFeatures(gymSecondaryNavItems, features), hasPermission);
  const mobileNav = filterByPermissions(mobileNavTabs, hasPermission);
  const secondaryLabel = "Tools";

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
    staleTime: 5 * 60 * 1000, // 5 min — branches rarely change, don't refetch on every nav
    gcTime: 30 * 60 * 1000,
  });

  const userInitials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  /* Keyboard shortcut: Cmd/Ctrl+B → toggle sidebar */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    },
    [toggleSidebar]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  /* Refresh user permissions when the tab regains focus so denied modules
     take effect without requiring re-login. Debounced to 30s to avoid thrash. */
  useEffect(() => {
    if (!user) return;
    let lastRun = 0;
    const onFocus = () => {
      const now = Date.now();
      if (now - lastRun < 30_000) return;
      lastRun = now;
      refreshProfile().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, refreshProfile]);

  /* Also refresh on route change so nav between pages picks up fresh perms. */
  useEffect(() => {
    if (!user) return;
    refreshProfile().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* Global plan limit handler → redirect to subscription page */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      toast.error(detail?.message || "Plan limit reached. Upgrade your plan.");
      router.push(gymPath("/settings/subscription"));
    };
    window.addEventListener("plan-limit-reached", handler);
    return () => window.removeEventListener("plan-limit-reached", handler);
  }, [router, gymPath]);

  /* Keep activeBranchId in sync with what the user can actually access.
     - Non-owners: must always have a valid activeBranchId from their assigned branches.
     - Owners with exactly 1 branch: pin to that branch (no "All Branches" fan-out
       across a single gym — every page should scope to the only branch that exists).
     - Owners with 2+ branches: leave activeBranchId as-is (null = All Branches). */
  useEffect(() => {
    if (!user || !branches?.length) return;
    const isOwner = user.role === "owner" || user.role === "brand_owner";
    const assignedBranchIds: string[] =
      (user as { branch_ids?: string[] }).branch_ids ||
      (user as { roles?: { branch_id?: string }[] }).roles
        ?.filter((r) => r.branch_id)
        .map((r) => r.branch_id as string) ||
      [];
    const visible = isOwner
      ? branches
      : branches.filter((b) => assignedBranchIds.includes(b.id));
    if (!visible.length) return;

    if (visible.length === 1) {
      if (activeBranchId !== visible[0].id) setActiveBranch(visible[0].id);
      return;
    }

    if (isOwner) return; // multi-branch owner: respect their selection (incl. null)
    if (!activeBranchId || !visible.some((b) => b.id === activeBranchId)) {
      setActiveBranch(visible[0].id);
    }
  }, [user, branches, activeBranchId, setActiveBranch]);

  const handleLogout = () => {
    logout();
    // Drop every cached query to prevent the next user from seeing prior tenant data.
    queryClient.clear();
    router.push("/login");
  };

  /**
   * Invalidate tenant-scoped queries whenever the active branch changes.
   * Without this, switching branches returns cached data from the previous branch.
   * `auth`/`branches`/`settings` are intentionally preserved (cross-branch).
   */
  const prevBranchRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevBranchRef.current === undefined) {
      prevBranchRef.current = activeBranchId;
      return;
    }
    if (prevBranchRef.current !== activeBranchId) {
      prevBranchRef.current = activeBranchId;
      const preserve = new Set(["auth", "branches", "settings"]);
      queryClient.removeQueries({
        predicate: (q) => {
          const root = q.queryKey?.[0];
          return typeof root === "string" && !preserve.has(root);
        },
      });
    }
  }, [activeBranchId, queryClient]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar — Fitts's Law: consistent left-edge target */}
        <aside
          className={cn(
            "hidden shrink-0 border-r border-hairline bg-card transition-[width] duration-fast lg:block",
            sidebarCollapsed ? "w-[64px]" : "w-[232px]"
          )}
        >
          <SidebarContent
            pathname={pathname}
            basePath={basePath}
            collapsed={sidebarCollapsed}
            onCollapse={toggleSidebar}
            primaryItems={primaryNav}
            secondaryItems={secondaryNav}
            secondaryLabel={secondaryLabel}
          />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={sidebarMobileOpen} onOpenChange={setSidebarMobileOpen}>
          <SheetContent side="left" className="w-[232px] bg-card p-0 border-hairline">
            <SidebarContent pathname={pathname} basePath={basePath} collapsed={false} primaryItems={primaryNav} secondaryItems={secondaryNav} secondaryLabel={secondaryLabel} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar — Jakob's Law: familiar SaaS topbar pattern */}
          <header className="flex h-14 items-center gap-3 border-b border-hairline bg-card px-4 lg:px-5">
            {/* Mobile menu */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8 text-muted-foreground"
              onClick={() => setSidebarMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>

            {/* Collapsed sidebar expand button */}
            {sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex h-8 w-8 text-muted-foreground"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}

            {/* Breadcrumbs — contextual navigation with entity name resolution */}
            <nav className="hidden md:flex items-center gap-1 text-[13px]" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, i) => (
                <BreadcrumbItem key={crumb.href} crumb={crumb} isFirst={i === 0} />
              ))}
            </nav>

            <div className="flex-1" />

            {/* Right actions */}
            <div className="flex items-center gap-1.5">
              {/* Search (Cmd+K) */}
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex items-center gap-2 text-muted-foreground"
                onClick={() => useUiStore.getState().setGlobalSearchOpen(true)}
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
                <kbd className="ml-1 inline-flex h-5 items-center rounded-sm border border-hairline bg-canvas-soft-2 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>

              {/* Branch Selector — owners see all branches + "All Branches";
                  other roles see only branches they're assigned to. */}
              {(() => {
                const isOwner = user?.role === "owner" || user?.role === "brand_owner";
                const assignedBranchIds: string[] =
                  (user as { branch_ids?: string[] } | null)?.branch_ids ||
                  (user as { roles?: { branch_id?: string }[] } | null)?.roles
                    ?.filter((r) => r.branch_id)
                    .map((r) => r.branch_id as string) ||
                  [];
                const visibleBranches = isOwner
                  ? branches ?? []
                  : (branches ?? []).filter((b) => assignedBranchIds.includes(b.id));

                if (!visibleBranches.length) return null;
                // Single-branch gyms (or single-branch access) don't need a switcher
                // at all — there's nothing to switch between, and showing
                // "All Branches" implies cross-branch aggregation that doesn't exist.
                if (visibleBranches.length <= 1) return null;

                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hidden sm:flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[13px] h-8"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="max-w-[120px] truncate">
                          {activeBranchId
                            ? visibleBranches.find((b) => b.id === activeBranchId)?.name ?? "Branch"
                            : isOwner
                              ? "All Branches"
                              : visibleBranches[0]?.name ?? "Branch"}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Switch Branch
                      </DropdownMenuLabel>
                      {isOwner && (
                        <DropdownMenuItem
                          className={cn("text-sm", !activeBranchId && "bg-canvas-soft-2 text-foreground font-medium")}
                          onClick={() => setActiveBranch(null)}
                        >
                          <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          All Branches
                        </DropdownMenuItem>
                      )}
                      {visibleBranches.map((b) => (
                        <DropdownMenuItem
                          key={b.id}
                          className={cn("text-sm", activeBranchId === b.id && "bg-canvas-soft-2 text-foreground font-medium")}
                          onClick={() => setActiveBranch(b.id)}
                        >
                          <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          {b.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })()}

              {/* Notifications */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="border-b border-hairline px-4 py-3">
                    <h4 className="text-sm font-semibold text-foreground tracking-[-0.01em]">Notifications</h4>
                  </div>
                  <div className="flex flex-col items-center justify-center py-10 px-4">
                    <Bell className="h-8 w-8 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No notifications yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">We&apos;ll notify you about important updates</p>
                  </div>
                </PopoverContent>
              </Popover>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-1.5 pl-1 pr-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-canvas-soft-2 text-foreground text-[10px] font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium text-foreground truncate">{user?.full_name ?? "User"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role ?? "staff"}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(gymPath("/settings/account"))}>
                    <User className="mr-2 h-4 w-4" />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(gymPath("/settings"))}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-error-deep focus:text-error-deep"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Subscription lifecycle banner — sits above 2FA */}
          <SubscriptionBanner />

          {/* 2FA reminder banner */}
          <TwoFactorBanner />

          {/* Incomplete onboarding banner */}
          {user?.onboarding_step && user.onboarding_step !== "complete" && (() => {
            const stepRoutes: Record<string, string> = {
              verify_email: "/verify-email",
              studio_info: "/onboarding/studio-info",
              setup_branches: "/onboarding/branches",
              setup_plans: "/onboarding/memberships",
              setup_staff: "/onboarding/staff",
              select_subscription: "/onboarding/subscription",
              select_plan: "/onboarding/subscription",
              setup_studio: "/onboarding/studio-info",
            };
            const href = stepRoutes[user.onboarding_step] || "/onboarding/studio-info";
            return (
              <div className="border-b border-hairline bg-warning-soft px-4 py-2.5 flex items-center justify-between">
                <p className="text-sm text-warning-deep">
                  <span className="font-semibold">Finish setting up your gym</span>
                  <span className="opacity-80 ml-1.5">— complete the remaining onboarding steps</span>
                </p>
                <Link
                  href={href}
                  className="text-sm font-medium text-link hover:text-link-deep transition-colors"
                >
                  Continue Setup &rarr;
                </Link>
              </div>
            );
          })()}

          {/* Page Content — extra bottom padding on mobile for bottom nav bar */}
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="mx-auto max-w-[1400px] p-4 pb-20 lg:px-8 lg:py-8 lg:pb-8">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav pathname={pathname} basePath={basePath} items={mobileNav} />
      </div>
    </TooltipProvider>
  );
}
