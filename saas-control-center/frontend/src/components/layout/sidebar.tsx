'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tenants', label: 'Tenants', icon: Building2 },
  { href: '/call-center', label: 'Call Center', icon: Phone },
  { href: '/plans', label: 'Plans', icon: Package },
  { href: '/subscriptions', label: 'Subscriptions', icon: ListChecks },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/referrals', label: 'Referrals', icon: Gift },
  { href: '/feature-flags', label: 'Feature Flags', icon: ToggleLeft },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            M
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            MuscleX SCC
          </span>
        </div>
      </div>
      <nav className="space-y-0.5 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
