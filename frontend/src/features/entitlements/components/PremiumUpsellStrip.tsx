'use client';

import React, { useEffect } from 'react';
import { ArrowUpRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEntitlements } from '../entitlement-provider';
import { getFeatureMeta, FeatureKey } from '../registry';
import { trackUpsell } from '../analytics';
import { PremiumTag } from './PremiumTag';

/**
 * Dashboard "Unlock more" strip (audit: dashboard enhancements).
 *
 * Renders a compact locked card for each premium feature the current plan does NOT include,
 * drawn from a curated highlight list. Clicking a card opens the shared UpgradeModal.
 *
 * Renders NOTHING when the tenant already has all highlighted features (e.g. enterprise),
 * so it never adds noise for fully-unlocked accounts.
 */

// Curated, high-intent upsell highlights shown on the dashboard. Order = priority.
const DASHBOARD_HIGHLIGHTS: FeatureKey[] = [
  'ai_advisor',
  'multi_branch',
  'marketing_campaigns',
  'class_scheduling',
];

export function PremiumUpsellStrip({ className }: { className?: string }) {
  const { state, openUpgrade, loading } = useEntitlements();

  const locked = DASHBOARD_HIGHLIGHTS.filter((key) => state(key) === 'locked');

  useEffect(() => {
    if (!loading && locked.length > 0) {
      trackUpsell('feature_viewed', {
        source: 'dashboard_upsell_strip',
        features: locked.join(','),
      });
    }
    // Fire once per locked-set change.
  }, [loading, locked.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || locked.length === 0) return null;

  return (
    <section className={cn('mt-8', className)} aria-label="Premium features to unlock">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Unlock More
        </h2>
        <p className="text-xs text-muted-foreground">Available on higher plans</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {locked.map((key) => {
          const meta = getFeatureMeta(key);
          if (!meta) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => openUpgrade(key, 'dashboard_upsell_strip')}
              className="group relative flex h-full flex-col gap-2 rounded-lg border border-hairline bg-card p-4 text-left transition-shadow hover:shadow-level-2"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-canvas-soft-2 text-muted-foreground">
                  <Lock className="h-4 w-4" aria-hidden />
                </span>
                <PremiumTag requiredPlan={meta.requiredPlan} showLock={false} />
              </div>
              <div className="mt-1">
                <h3 className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                  {meta.name}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{meta.why}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-link group-hover:text-link-deep">
                Upgrade to unlock
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
