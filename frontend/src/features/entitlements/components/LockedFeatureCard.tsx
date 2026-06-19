'use client';

import React, { useEffect } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFeatureMeta } from '../registry';
import { useEntitlements } from '../entitlement-provider';
import { trackUpsell } from '../analytics';
import { PremiumTag } from './PremiumTag';
import { UpgradeButton } from './UpgradeButton';

/**
 * Visible-but-locked card (audit State 2). Renders the feature's name + value prop, a lock
 * glyph, the plan that unlocks it, and an Upgrade CTA. Optionally wraps real content as a
 * blurred/disabled preview underneath.
 *
 * Use this where the live module content WOULD render for an entitled tenant.
 */
export function LockedFeatureCard({
  feature,
  source = 'locked_card',
  className,
  compact = false,
  children,
}: {
  feature: string;
  source?: string;
  className?: string;
  /** Compact inline variant (for cards/widgets vs. full-page shells). */
  compact?: boolean;
  /** Optional preview content rendered blurred + non-interactive behind the lock overlay. */
  children?: React.ReactNode;
}) {
  const meta = getFeatureMeta(feature);
  const { openUpgrade } = useEntitlements();

  // Fire one "locked feature opened/viewed" event when this card mounts.
  useEffect(() => {
    trackUpsell('locked_feature_opened', { feature, source });
  }, [feature, source]);

  if (!meta) {
    // Unknown feature key — fail safe by rendering children unblocked (don't lock the unknown).
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-hairline bg-card',
        className,
      )}
    >
      {/* Optional blurred preview behind the lock */}
      {children && (
        <div
          aria-hidden
          className="pointer-events-none select-none opacity-40 blur-[2px]"
        >
          {children}
        </div>
      )}

      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 text-center',
          children ? 'absolute inset-0 bg-card/70 backdrop-blur-[1px]' : '',
          compact ? 'p-6' : 'p-10',
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas-soft-2">
          <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-base font-semibold text-foreground tracking-[-0.01em]">
              {meta.name}
            </h3>
            <PremiumTag requiredPlan={meta.requiredPlan} showLock={false} />
          </div>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{meta.why}</p>
        </div>

        {!compact && meta.benefits.length > 0 && (
          <ul className="mx-auto mt-1 grid max-w-md gap-1 text-left text-sm text-muted-foreground">
            {meta.benefits.slice(0, 4).map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {b}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-1 flex items-center gap-2">
          <UpgradeButton feature={feature} source={source} />
          {meta.previewKind !== 'none' && (
            <button
              type="button"
              onClick={() => openUpgrade(feature, `${source}_preview`)}
              className="text-sm font-medium text-link hover:text-link-deep transition-colors"
            >
              See what&apos;s included
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
