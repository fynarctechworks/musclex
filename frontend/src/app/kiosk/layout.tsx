'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';

/**
 * Minimal kiosk layout. Intentionally bypasses the [gymSlug]/layout.tsx
 * chrome (sidebar, subscription banners) — the kiosk is designed for an
 * unattended entrance display, so:
 *  - no nav
 *  - no scrollbars (forced overflow:hidden on body while mounted)
 *  - dark theme by default (entrance lighting is variable)
 *  - rejects unauthenticated users → /login
 *
 * Studio context flows from the staff JWT in localStorage. No URL-embedded
 * gymSlug — operators choose a branch via URL param: /kiosk/[branchSlug]
 */
export default function KioskRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace('/login?next=' + encodeURIComponent(window.location.pathname));
      return;
    }
    setChecked(true);
  }, [isAuthenticated, user, router]);

  // Lock body scroll while in kiosk mode and prevent context menu noise.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const blockMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', blockMenu);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.removeEventListener('contextmenu', blockMenu);
    };
  }, []);

  if (!checked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-ink text-on-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-ink text-on-primary select-none overflow-hidden">
      {children}
    </div>
  );
}
