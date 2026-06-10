'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Settings2, Shield, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Analytics', href: '/admin/referrals', icon: BarChart3 },
  { label: 'Reward Rules', href: '/admin/referrals/rules', icon: Settings2 },
  { label: 'Fraud Queue', href: '/admin/referrals/fraud', icon: Shield },
];

export default function AdminReferralsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Top Bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-4">
            {/* Back to app */}
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>App</span>
            </Link>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Admin
              </span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-[13px] font-semibold text-foreground">
                Referral Program
              </span>
            </div>

            <div className="flex-1" />

            {/* Tab nav in header */}
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => {
                const isActive =
                  tab.href === '/admin/referrals'
                    ? pathname === '/admin/referrals'
                    : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                      isActive
                        ? 'bg-canvas-soft text-foreground'
                        : 'text-muted-foreground hover:bg-canvas-soft/60 hover:text-foreground'
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
