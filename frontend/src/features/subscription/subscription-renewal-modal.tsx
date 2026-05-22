'use client';

import React from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { AlertCircle, ArrowRight, Lock, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSubscription } from './subscription-provider';

/**
 * Global subscription warning modal.
 *
 * This modal does NOT perform payment. Its job is to STOP a user mid-flow
 * when their subscription needs attention and route them to the proper
 * plans page where they can choose to renew the same plan or switch.
 *
 * Auto-opens on:
 *   - first auth load if status != active
 *   - any transition into a worse state (active→grace, grace→locked, etc.)
 *   - 403 SUBSCRIPTION_LOCKED API response (via window event)
 *
 * Suppresses itself when the user is already on /settings/subscription —
 * no point showing a "go to plans page" CTA if they're already there.
 *
 * LOCKED / SUSPENDED cannot be permanently dismissed (re-opens every 4h).
 */
export function SubscriptionRenewalModal() {
  const { subscription, modalOpen, dismissModal } = useSubscription();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname() ?? '';
  const gymSlug = (params?.gymSlug as string) || '';

  if (!subscription || !modalOpen) return null;

  // If we're already on the subscription/plans page, don't show the modal —
  // the page itself is the renewal surface.
  if (pathname.endsWith('/settings/subscription')) return null;

  const isLocked = subscription.status === 'locked';
  const isSuspended = subscription.status === 'suspended';
  const isGrace = subscription.status === 'grace_period';
  // Grace is read-only but dismissable — modal re-appears every 4h via the
  // provider's interval. Locked/suspended stay hard-blocking.
  const isDismissible = !isLocked && !isSuspended;

  const HeaderIcon = isSuspended ? ShieldAlert : (isLocked || isGrace) ? Lock : AlertCircle;
  const iconTone = isSuspended || isLocked
    ? 'text-error'
    : isGrace
      ? 'text-warning'
      : 'text-link';

  const headline = (() => {
    if (subscription.status === 'suspended') return 'Account suspended';
    if (subscription.status === 'locked') return 'Your account is locked';
    if (subscription.status === 'grace_period') {
      const d = subscription.days_until_expiry ?? 0;
      return d === 0
        ? 'Your subscription expired today'
        : `Your subscription expired ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`;
    }
    if (subscription.days_until_expiry !== null && subscription.days_until_expiry > 0)
      return `Subscription renews in ${subscription.days_until_expiry} day${
        subscription.days_until_expiry === 1 ? '' : 's'
      }`;
    return 'Subscription';
  })();

  const body = (() => {
    if (isSuspended)
      return 'Your account has been suspended by an administrator. Please contact support to restore access.';
    if (isLocked)
      return 'Your grace period has ended. Choose a plan — same or different — to unlock writes and continue using the app.';
    if (subscription.status === 'grace_period')
      return `Your subscription has expired. The account is read-only until you renew — your data stays exactly as it is, and writes resume the moment payment goes through.`;
    return 'Your subscription is about to renew. Review your plan and update payment details if needed.';
  })();

  const handlePrimary = () => {
    if (isSuspended) {
      window.location.href = 'mailto:support@fitsyncpro.app';
      return;
    }
    if (gymSlug) {
      router.push(`/${gymSlug}/settings/subscription`);
      // close the modal after navigation so the page renders cleanly.
      dismissModal();
    }
  };

  return (
    <Dialog
      open={modalOpen}
      onOpenChange={(open) => {
        if (!open && isDismissible) dismissModal();
      }}
    >
      <DialogContent
        className={`sm:max-w-[460px] ${!isDismissible ? '[&>button[aria-label="Close"]]:hidden [&>button:last-child]:hidden' : ''}`}
        onPointerDownOutside={(e) => {
          if (!isDismissible) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!isDismissible) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (!isDismissible) e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`mt-1 ${iconTone}`}>
              <HeaderIcon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <DialogTitle>{headline}</DialogTitle>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-2 sm:justify-between sm:gap-2">
          {isDismissible ? (
            <Button variant="outline" onClick={dismissModal}>
              Remind me later
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground">
              This reappears every 4 hours.
            </div>
          )}
          <Button onClick={handlePrimary}>
            {isSuspended ? 'Contact support' : 'Choose plan & renew'}
            {!isSuspended && <ArrowRight className="ml-1.5 h-4 w-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
