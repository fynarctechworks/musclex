'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  ListChecks,
  ToggleLeft,
  BarChart3,
  ScrollText,
  Phone,
  Gift,
  Tag,
  ShieldAlert,
  Smartphone,
  PieChart,
  UserPlus,
  Filter,
  Contact,
  Share2,
  Megaphone,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tenants', label: 'Tenants', icon: Building2 },
  { href: '/call-center', label: 'Call Center', icon: Phone },
  { href: '/plans', label: 'Plans', icon: Package },
  { href: '/discounts', label: 'Discounts', icon: Tag },
  { href: '/subscriptions', label: 'Subscriptions', icon: ListChecks },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/referrals', label: 'Referrals', icon: Gift },
  { href: '/feature-flags', label: 'Feature Flags', icon: ToggleLeft },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/monitoring', label: 'Monitoring', icon: ShieldAlert },
  { href: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

/** Public-fitness-app analytics group (Phase 4). */
const memberAppNav = [
  { href: '/member-app', label: 'App Analytics', icon: Smartphone },
  { href: '/member-app/segmentation', label: 'Segmentation', icon: PieChart },
  { href: '/member-app/leads', label: 'Leads', icon: UserPlus },
  { href: '/member-app/funnel', label: 'Conversion Funnel', icon: Filter },
  { href: '/member-app/crm', label: 'CRM', icon: Contact },
  { href: '/member-app/referrals', label: 'Referral Analytics', icon: Share2 },
  { href: '/member-app/campaigns', label: 'Campaigns', icon: Megaphone },
];

function SidebarBrand() {
  return (
    <div className="flex h-14 items-center border-b border-border px-5">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-wordmark.png" alt="MuscleX" className="h-5 w-auto" />
        <span className="text-[13px] font-semibold tracking-tight text-muted-foreground">
          SCC
        </span>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const renderItem = (item: { href: string; label: string; icon: typeof LayoutDashboard }) => {
    // Exact match for index routes (e.g. /member-app) so they don't stay
    // highlighted on their own sub-pages.
    const isIndex = item.href === '/member-app';
    const isActive = isIndex
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {navItems.map(renderItem)}
      <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Member App
      </p>
      {memberAppNav.map(renderItem)}
    </nav>
  );
}

/** Desktop fixed rail — hidden below the `lg` breakpoint. */
export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r border-border bg-card lg:flex">
      <SidebarBrand />
      <SidebarNav />
    </aside>
  );
}

/** Mobile slide-over drawer — shown below `lg` via the topbar menu button. */
export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  // Close the drawer whenever the route changes (e.g. tapping a nav link).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-60 max-w-[80vw] flex-col gap-0 p-0"
      >
        <SidebarBrand />
        <SidebarNav onNavigate={onClose} />
      </SheetContent>
    </Sheet>
  );
}
