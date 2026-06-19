'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PLAN_DISPLAY_NAME, PlanName } from '../registry';

/**
 * Small pill that marks a nav item / card as plan-locked. Shows the plan that unlocks it
 * (e.g. "Pro") with a lock glyph. Purely presentational.
 */
export function PremiumTag({
  requiredPlan,
  className,
  showLock = true,
}: {
  requiredPlan: PlanName;
  className?: string;
  showLock?: boolean;
}) {
  return (
    <Badge
      variant="info"
      size="sm"
      className={cn('gap-1 font-medium', className)}
      aria-label={`Available in ${PLAN_DISPLAY_NAME[requiredPlan]} plan`}
    >
      {showLock && <Lock className="h-3 w-3" aria-hidden />}
      {PLAN_DISPLAY_NAME[requiredPlan]}
    </Badge>
  );
}
