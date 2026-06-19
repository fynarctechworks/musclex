'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEntitlements } from '../entitlement-provider';
import { trackUpsell } from '../analytics';

/**
 * Standardized upgrade CTA. Two modes:
 *   - default: opens the in-context UpgradeModal for `feature` (recommended).
 *   - direct:  routes straight to /settings/subscription (used inside the modal itself).
 */
export function UpgradeButton({
  feature,
  source,
  label = 'Upgrade Plan',
  direct = false,
  size = 'sm',
  variant = 'default',
  className,
}: {
  feature?: string;
  source?: string;
  label?: string;
  direct?: boolean;
  size?: 'sm' | 'default' | 'md' | 'lg';
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link';
  className?: string;
}) {
  const router = useRouter();
  const params = useParams();
  const gymSlug = (params?.gymSlug as string) || '';
  const { openUpgrade, plan } = useEntitlements();

  const goToSubscription = () => {
    trackUpsell('upgrade_clicked', {
      feature,
      current_plan: plan.rawPlan,
      source: source ?? 'upgrade_button',
    });
    if (gymSlug) router.push(`/${gymSlug}/settings/subscription`);
  };

  const handleClick = () => {
    if (direct || !feature) {
      goToSubscription();
      return;
    }
    openUpgrade(feature, source);
  };

  return (
    <Button size={size} variant={variant} onClick={handleClick} className={className}>
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Button>
  );
}
