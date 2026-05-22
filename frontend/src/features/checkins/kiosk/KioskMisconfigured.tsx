'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

interface KioskMisconfiguredProps {
  branchId: string;
  onExitRequest: () => void;
}

/**
 * Shown when the kiosk URL contains a branch id we can't resolve. The
 * prior behaviour was to silently fall back to the literal label "this
 * branch" and let staff scan into a tenant they don't actually own —
 * every scan would fail server-side with cryptic errors.
 *
 * This screen makes the misconfiguration loud and actionable. Staff
 * sees the UUID, can copy it, and can long-press to exit the kiosk via
 * the same PIN flow.
 */
export function KioskMisconfigured({ branchId, onExitRequest }: KioskMisconfiguredProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-ink px-8 text-center text-on-primary"
    >
      <div className="flex max-w-2xl flex-col items-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning/15">
          <AlertTriangle className="h-10 w-10 text-warning" aria-hidden="true" />
        </div>

        <h1 className="text-display-lg font-semibold">Kiosk not configured</h1>

        <p className="text-body-lg text-on-primary/80">
          We couldn&apos;t find the branch this kiosk URL points to. Show this
          to your administrator so they can fix the link or re-pair the
          device.
        </p>

        <div className="w-full rounded-2xl border border-on-primary/15 bg-on-primary/10 px-6 py-4 text-left">
          <div className="text-body-sm uppercase tracking-widest text-on-primary/60">
            Branch ID in URL
          </div>
          <code className="mt-1 block break-all font-mono text-body-md text-on-primary">
            {branchId || '(empty)'}
          </code>
        </div>

        <button
          onClick={onExitRequest}
          className="mt-4 rounded-full bg-on-primary/15 px-6 py-3 text-body-md font-medium text-on-primary transition hover:bg-on-primary/25 active:scale-95"
        >
          Long-press to exit kiosk
        </button>
      </div>
    </div>
  );
}
