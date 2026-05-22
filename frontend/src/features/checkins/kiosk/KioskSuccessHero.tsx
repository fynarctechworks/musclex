'use client';

import * as React from 'react';
import { CheckCircle2, User as UserIcon } from 'lucide-react';

interface KioskSuccessHeroProps {
  memberName: string;
  memberCode?: string | null;
  photoUrl?: string | null;
  membershipStatus?: string | null;
  visible: boolean;
}

/**
 * Full-bleed success overlay shown immediately after a successful kiosk
 * check-in. Auto-dismiss timing is owned by the parent (it co-ordinates
 * with the sound cue and analytics ping).
 *
 * Contrast contract:
 *   - Background is solid `bg-success` (deep green).
 *   - All foreground text/icons use `text-success-foreground` (white) or
 *     `text-on-primary`. Inner accents use `bg-on-primary/15` chips with
 *     `text-on-primary` — never `text-success` on `bg-success`.
 *
 * Animation: scale-in for the panel, ping pulse around the checkmark.
 * Respects prefers-reduced-motion.
 */
export function KioskSuccessHero({
  memberName,
  memberCode,
  photoUrl,
  membershipStatus,
  visible,
}: KioskSuccessHeroProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-success transition-opacity duration-fast motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`flex w-full max-w-3xl flex-col items-center gap-8 px-8 transition-transform duration-fast motion-reduce:transition-none ${
          visible ? 'scale-100' : 'scale-95'
        }`}
      >
        {/* Big check mark with ping halo */}
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-full bg-on-primary/25 motion-safe:animate-ping" />
          <CheckCircle2
            className="relative h-28 w-28 text-success-foreground drop-shadow-level-5"
            aria-hidden="true"
          />
        </div>

        {/* Member photo, on a translucent white wash so it's visible against the
            success background regardless of the member's own complexion. */}
        <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-on-primary/30 bg-on-primary/15 shadow-level-5">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-16 w-16 text-success-foreground" aria-hidden="true" />
          )}
        </div>

        {/* Identity block — name leads (visually + in SR reading order). */}
        <div className="text-center">
          <div className="text-display-xl font-semibold tracking-tight text-success-foreground">
            {memberName}
          </div>
          {memberCode && (
            <div className="mt-2 text-body-md font-mono uppercase tracking-widest text-success-foreground/80">
              {memberCode}
            </div>
          )}
          {membershipStatus && (
            <div className="mt-3 inline-flex items-center rounded-full bg-on-primary/15 px-4 py-1 text-body-sm font-medium uppercase tracking-wide text-success-foreground">
              {membershipStatus}
            </div>
          )}
        </div>

        <div className="text-display-sm font-medium text-success-foreground/90">
          Welcome back. Have a great workout.
        </div>
      </div>
    </div>
  );
}
