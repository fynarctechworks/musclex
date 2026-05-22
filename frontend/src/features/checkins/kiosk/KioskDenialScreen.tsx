'use client';

import * as React from 'react';
import { XCircle } from 'lucide-react';
import { lookupDenial } from '../denial-catalog';

interface KioskDenialScreenProps {
  memberName: string | null;
  denialReason: string | null;
  message: string | null;
  visible: boolean;
}

/**
 * Full-bleed denial overlay shown to MEMBERS at the kiosk. Tells them
 * what happened in plain English (not just "denied") so they know
 * whether to wait at reception or come back later.
 *
 * Override flows do NOT live here — they require staff intervention via
 * the Reception Workbench (Phase 3f).
 *
 * Contrast contract:
 *   - Background is solid `bg-error`.
 *   - All foreground uses `text-on-primary` (white). Reason chip uses a
 *     translucent `bg-on-primary/15` wash with `text-on-primary` text —
 *     never `text-error` on `bg-error`.
 *
 * Catalog-driven copy: title + headline + next-step come from the
 * shared denial catalog so every surface (kiosk / reception / alerts)
 * speaks the same language.
 */
export function KioskDenialScreen({
  memberName,
  denialReason,
  message,
  visible,
}: KioskDenialScreenProps) {
  const catalog = lookupDenial(denialReason);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-error transition-opacity duration-fast motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`flex w-full max-w-3xl flex-col items-center gap-8 px-8 text-center transition-transform duration-fast motion-reduce:transition-none ${
          visible ? 'scale-100 motion-safe:animate-[wiggle_180ms_ease-out]' : 'scale-95'
        }`}
      >
        <XCircle className="h-28 w-28 text-on-primary drop-shadow-level-5" aria-hidden="true" />

        <div>
          {memberName && (
            <div className="text-display-lg font-semibold text-on-primary">{memberName}</div>
          )}

          {/* Reason title — biggest readable signal */}
          <div className="mt-3 text-display-md font-medium uppercase tracking-wide text-on-primary">
            {catalog.title}
          </div>

          {/* Human message — what the server actually said. This is
              now PRIMARY over the reason code. */}
          {(message || catalog.headline) && (
            <div className="mt-3 max-w-xl mx-auto text-body-lg text-on-primary/90">
              {message ?? catalog.headline}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-on-primary/30 bg-on-primary/15 px-6 py-4 text-body-lg font-medium text-on-primary">
          Please see reception
        </div>
      </div>

      <style jsx>{`
        @keyframes wiggle {
          0%, 100% { transform: translateX(0) scale(1); }
          25% { transform: translateX(-8px) scale(1); }
          50% { transform: translateX(8px) scale(1); }
          75% { transform: translateX(-4px) scale(1); }
        }
      `}</style>
    </div>
  );
}
