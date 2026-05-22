'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AlertTriangle, Lock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from './subscription-provider';

/**
 * Sticky banner shown at the top of every authenticated layout when the
 * tenant is in GRACE_PERIOD, LOCKED, or SUSPENDED — OR when expiring within
 * 7 days.
 *
 * The CTA navigates to /settings/subscription where the user picks a plan
 * (same or different) before going through payment — NOT to an inline
 * payment modal.
 */
export function SubscriptionBanner() {
  const { subscription } = useSubscription();
  const router = useRouter();
  const params = useParams();
  const gymSlug = (params?.gymSlug as string) || '';

  if (!subscription) return null;

  const { status, days_until_expiry, grace_days_remaining } = subscription;

  // ACTIVE + plenty of runway → nothing to show.
  if (
    status === 'active' &&
    (days_until_expiry === null || days_until_expiry > 7)
  ) {
    return null;
  }

  let tone: 'info' | 'warning' | 'danger' = 'info';
  let Icon = AlertTriangle;
  let title = '';
  let body = '';

  if (status === 'suspended') {
    tone = 'danger';
    Icon = ShieldAlert;
    title = 'Account suspended';
    body =
      'Your account has been suspended by an administrator. Please contact support.';
  } else if (status === 'locked') {
    tone = 'danger';
    Icon = Lock;
    title = 'Account locked — read-only mode';
    body =
      'Your subscription expired and the grace period ended. Choose a plan to restore full access.';
  } else if (status === 'grace_period') {
    tone = 'danger';
    Icon = Lock;
    title = `Subscription expired — read-only mode (${grace_days_remaining} day${
      grace_days_remaining === 1 ? '' : 's'
    } of grace left)`;
    body =
      'Your data is safe and visible, but you can\'t add or change anything until you renew. After grace ends, the account is fully locked.';
  } else if (status === 'active' && days_until_expiry !== null) {
    tone = 'info';
    Icon = AlertTriangle;
    title = `Subscription renews in ${days_until_expiry} day${
      days_until_expiry === 1 ? '' : 's'
    }`;
    body = 'Review your plan and renewal details on the subscription page.';
  }

  const colors = {
    info:    'bg-link-soft border-link/30 text-link-deep',
    warning: 'bg-warning-soft border-warning/30 text-warning-deep',
    danger:  'bg-error-soft border-error/30 text-error-deep',
  }[tone];

  const cta = status === 'suspended' ? 'Contact support' : 'Choose plan & renew';

  const handleClick = () => {
    if (status === 'suspended') {
      window.location.href = 'mailto:support@fitsyncpro.app';
      return;
    }
    if (gymSlug) {
      router.push(`/${gymSlug}/settings/subscription`);
    }
  };

  return (
    <div
      className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${colors}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-0.5 text-xs opacity-90">{body}</div>
        </div>
      </div>
      <Button
        size="sm"
        variant={tone === 'danger' ? 'destructive' : 'default'}
        onClick={handleClick}
        className="shrink-0"
      >
        {cta}
      </Button>
    </div>
  );
}
