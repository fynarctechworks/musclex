"use client";

import React, { useEffect, useCallback } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import type { Branch } from "@/lib/types";
import { TwoFactorBanner } from "@/components/shared/two-factor-banner";

/* ─── Navigation Config (Miller's Law: ≤7 primary + 1 bottom) ─── */
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/members", icon: Users },
  { label: "Memberships", href: "/memberships/plans", icon: CreditCard },
  { label: "Check-ins", href: "/check-in", icon: UserCheck },
  { label: "Visits", href: "/visits", icon: Activity },
  { label: "Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Finance", href: "/finance", icon: DollarSign },
  { label: "Staff", href: "/staff", icon: UserCog },
  { label: "Marketing", href: "/marketing", icon: Megaphone },
];

const secondaryNavItems = [
  { label: "Referrals", href: "/referrals", icon: UserPlus },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "POS", href: "/pos", icon: ShoppingCart },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "AI Advisor", href: "/ai", icon: Bot },
];

const bottomNavItems = [
  { label: "Settings", href: "/settings", icon: Settings },
];

/* ─── Breadcrumb extraction from pathname ─── */
function useBreadcrumbs(pathname: string, basePath: string) {
  const stripped = pathname.replace(basePath, "");
  const segments = stripped.split("/").filter(Boolean);

  return segments.map((seg, i) => {
    const href = `${basePath}/${segments.slice(0, i + 1).join("/")}`;
    const label = seg
      .replace(/-/g, " ")
      .replace(/\[.*\]/, "Detail")
      .replace(/^./, (c) => c.toUpperCase());
    return { label, href, isLast: i === segments.length - 1 };
  });
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
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-[7px] text-[13px] font-medium transition-colors",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
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
}: {
  pathname: string;
  basePath: string;
  collapsed: boolean;
  onCollapse?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo + Collapse */}
      <div className={cn("flex h-14 items-center px-4", collapsed ? "justify-center" : "justify-between")}>
        <Link href={`${basePath}/dashboard`} className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <span className="text-[11px] font-bold text-primary-foreground">F</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground tracking-tight">
              FitSync Pro
            </span>
          )}
        </Link>
        {!collapsed && onCollapse && (
          <button
            onClick={onCollapse}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mx-3 h-px bg-border" />

      {/* Primary Nav */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-0.5" role="navigation" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} basePath={basePath} pathname={pathname} collapsed={collapsed} />
          ))}
        </nav>

        {/* Progressive Disclosure: Secondary section */}
        <div className="mt-4">
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Tools
            </p>
          )}
          {collapsed && <div className="mx-auto my-2 h-px w-6 bg-border" />}
          <nav className="flex flex-col gap-0.5">
            {secondaryNavItems.map((item) => (
              <NavLink key={item.href} item={item} basePath={basePath} pathname={pathname} collapsed={collapsed} />
            ))}
          </nav>
        </div>
      </ScrollArea>

      {/* Bottom: Settings */}
      <div className="px-3 pb-3">
        <div className="mx-1 mb-2 h-px bg-border" />
        {bottomNavItems.map((item) => (
          <NavLink key={item.href} item={item} basePath={basePath} pathname={pathname} collapsed={collapsed} />
        ))}
      </div>
    </div>
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

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const sidebarMobileOpen = useUiStore((s) => s.sidebarMobileOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSidebarMobileOpen = useUiStore((s) => s.setSidebarMobileOpen);

  const breadcrumbs = useBreadcrumbs(pathname, basePath);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
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

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar — Fitts's Law: consistent left-edge target */}
        <aside
          className={cn(
            "hidden shrink-0 border-r border-border bg-card transition-[width] duration-200 lg:block",
            sidebarCollapsed ? "w-[60px]" : "w-[220px]"
          )}
        >
          <SidebarContent
            pathname={pathname}
            basePath={basePath}
            collapsed={sidebarCollapsed}
            onCollapse={toggleSidebar}
          />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={sidebarMobileOpen} onOpenChange={setSidebarMobileOpen}>
          <SheetContent side="left" className="w-[220px] bg-card p-0 border-border">
            <SidebarContent pathname={pathname} basePath={basePath} collapsed={false} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar — Jakob's Law: familiar SaaS topbar pattern */}
          <header className="flex h-[52px] items-center gap-3 border-b border-border bg-card px-4 lg:px-5">
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

            {/* Breadcrumbs — contextual navigation */}
            <nav className="hidden md:flex items-center gap-1 text-[13px]" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={crumb.href}>
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                  {crumb.isLast ? (
                    <span className="font-medium text-foreground">{crumb.label}</span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              ))}
            </nav>

            <div className="flex-1" />

            {/* Right actions */}
            <div className="flex items-center gap-1.5">
              {/* Search (Cmd+K) */}
              <Button
                variant="ghost"
                className="hidden sm:flex items-center gap-2 h-8 px-3 text-muted-foreground hover:text-foreground"
                onClick={() => useUiStore.getState().setGlobalSearchOpen(true)}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-[13px]">Search</span>
                <kbd className="ml-1 inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>

              {/* Branch Selector */}
              {branches && branches.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden sm:flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[13px] h-8"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="max-w-[100px] truncate">{branches[0]?.name ?? "Branch"}</span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Switch Branch
                    </DropdownMenuLabel>
                    {branches.map((b) => (
                      <DropdownMenuItem key={b.id} className="text-[13px]">
                        <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                        {b.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

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
                  <div className="border-b border-border px-4 py-3">
                    <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
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
                  <Button variant="ghost" className="flex items-center gap-2 h-8 pl-1 pr-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-[13px] font-medium text-foreground">{user?.full_name ?? "User"}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{user?.role ?? "staff"}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-[13px]" onClick={() => router.push(gymPath("/settings/account"))}>
                    <User className="mr-2 h-3.5 w-3.5" />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-[13px]" onClick={() => router.push(gymPath("/settings"))}>
                    <Settings className="mr-2 h-3.5 w-3.5" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive text-[13px]"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

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
              <div className="border-b border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center justify-between">
                <p className="text-[13px] text-foreground">
                  <span className="font-medium">Finish setting up your gym</span>
                  <span className="text-muted-foreground ml-1.5">— complete the remaining onboarding steps</span>
                </p>
                <Link
                  href={href}
                  className="text-[13px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Continue Setup &rarr;
                </Link>
              </div>
            );
          })()}

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
