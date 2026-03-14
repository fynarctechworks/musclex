"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuthStore } from "@/stores/auth-store";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import type { Branch } from "@/lib/types";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/members", icon: Users },
  { label: "Check-ins", href: "/check-in", icon: UserCheck },
  { label: "Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Finance", href: "/finance", icon: DollarSign },
  { label: "Staff", href: "/staff", icon: UserCog },
  { label: "Marketing", href: "/marketing", icon: Megaphone },
  { label: "AI Advisor", href: "/ai", icon: Bot },
];

const bottomNavItems = [
  { label: "Settings", href: "/settings", icon: Settings },
];

function SidebarContent({ pathname, basePath }: { pathname: string; basePath: string }) {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#111111]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">F</span>
        </div>
        <span className="text-[15px] font-semibold text-foreground tracking-tight">
          FitSync Pro
        </span>
      </div>

      <div className="mx-4 h-px bg-border dark:bg-white/[0.08]" />

      {/* Nav Items */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const fullHref = `${basePath}${item.href}`;
            const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");
            return (
              <Link
                key={item.href}
                href={fullHref}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-muted dark:bg-white/[0.08] text-foreground dark:text-white"
                    : "text-muted-foreground hover:bg-muted dark:hover:bg-white/[0.04] hover:text-foreground dark:hover:text-white/80"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom nav */}
      <div className="px-3 pb-3">
        <div className="mx-1 mb-3 h-px bg-border dark:bg-white/[0.08]" />
        {bottomNavItems.map((item) => {
          const fullHref = `${basePath}${item.href}`;
          const isActive = pathname === fullHref;
          return (
            <Link
              key={item.href}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-muted dark:bg-white/[0.08] text-foreground dark:text-white"
                  : "text-muted-foreground hover:bg-muted dark:hover:bg-white/[0.04] hover:text-foreground dark:hover:text-white/80"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { gymSlug, gymPath } = useGymSlug();
  const basePath = `/${gymSlug}`;

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-white dark:bg-[#111111] lg:block">
        <SidebarContent pathname={pathname} basePath={basePath} />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 bg-white dark:bg-[#111111] p-0 border-border">
          <SidebarContent pathname={pathname} basePath={basePath} />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search members, classes, or reports..."
              className="h-9 bg-secondary border-border pl-9 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Branch Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[13px] h-8"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{branches?.[0]?.name ?? "Branch"}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-popover border-border"
              >
                {(branches ?? []).map((b) => (
                  <DropdownMenuItem
                    key={b.id}
                    className="text-popover-foreground text-[13px] focus:bg-accent"
                  >
                    {b.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground h-8 w-8"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 pl-1 h-8"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-[13px] font-medium text-foreground leading-tight">
                      {user?.full_name ?? "User"}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize leading-tight">
                      {user?.role ?? "staff"}
                    </p>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-popover border-border"
              >
                <DropdownMenuItem
                  className="text-popover-foreground text-[13px] focus:bg-accent"
                  onClick={() => router.push(gymPath("/settings"))}
                >
                  Settings
                </DropdownMenuItem>
                <Separator className="bg-border" />
                <DropdownMenuItem
                  className="text-destructive focus:bg-accent cursor-pointer text-[13px]"
                  onClick={handleLogout}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
