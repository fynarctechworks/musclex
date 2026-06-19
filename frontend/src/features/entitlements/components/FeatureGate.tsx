'use client';

import React from 'react';
import { useEntitlement } from '../entitlement-provider';
import { LockedFeatureCard } from './LockedFeatureCard';

type GateMode =
  /** Replace children with a LockedFeatureCard upsell shell (default — for page/section bodies). */
  | 'lock'
  /** Render children but disabled + click opens the upgrade modal (for buttons/actions). */
  | 'disable'
  /** Hide children entirely (rarely used — only when even the upsell would leak something). */
  | 'hide';

/**
 * Declarative entitlement boundary. When the tenant's plan includes `feature`, children
 * render normally. When it doesn't, behavior follows `mode`.
 *
 * This is UI-only — the backend remains authoritative and still rejects non-entitled writes.
 */
export function FeatureGate({
  feature,
  mode = 'lock',
  source,
  fallback,
  children,
}: {
  feature: string;
  mode?: GateMode;
  source?: string;
  /** Custom locked render (overrides the default for `lock` mode). */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { available, openUpgrade } = useEntitlement(feature);

  if (available) return <>{children}</>;

  if (mode === 'hide') return null;

  if (mode === 'disable') {
    return (
      <span
        className="relative inline-flex cursor-not-allowed"
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openUpgrade(source);
        }}
        role="button"
        tabIndex={0}
        aria-disabled
      >
        <span className="pointer-events-none opacity-50">{children}</span>
      </span>
    );
  }

  // mode === 'lock'
  if (fallback !== undefined) return <>{fallback}</>;
  return <LockedFeatureCard feature={feature} source={source} />;
}
