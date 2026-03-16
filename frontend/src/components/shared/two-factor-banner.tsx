'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { twoFactorApi } from '@/features/auth/two-factor-api';
import { useGymSlug } from '@/lib/hooks/use-gym-slug';

/**
 * Persistent banner shown to authenticated users who haven't enabled 2FA.
 * Dismissible per session (localStorage key).
 * Follows the pattern used by GitHub, Stripe, and Vercel.
 */
export function TwoFactorBanner() {
  const { user, isAuthenticated } = useAuthStore();
  const { gymPath } = useGymSlug();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Only show for owners/admins
    const role = user.role?.toLowerCase();
    if (role !== 'owner' && role !== 'admin') return;

    // Check dismiss state (per session)
    const dismissed = sessionStorage.getItem('2fa-banner-dismissed');
    if (dismissed === 'true') return;

    // Check 2FA status from API
    twoFactorApi
      .getStatus()
      .then((status) => {
        if (!status.enabled) setVisible(true);
      })
      .catch(() => {
        // Silently ignore — don't block UI for a banner
      });
  }, [isAuthenticated, user]);

  if (!visible) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('2fa-banner-dismissed', 'true');
    setVisible(false);
  };

  return (
    <div className="relative bg-primary/5 border border-primary/20 rounded-lg mx-4 mt-4 lg:mx-6 lg:mt-6 mb-0 px-4 py-3 flex items-center gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
        <ShieldAlert className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground font-medium">
          Secure your account with Two-Factor Authentication
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Protect your studio data with an authenticator app. Takes less than a minute.
        </p>
      </div>
      <Link
        href={gymPath('/settings/security')}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors"
      >
        Enable Now
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
