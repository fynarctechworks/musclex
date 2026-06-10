'use client';

import * as React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';

export interface SuccessToastItem {
  id: string;
  member_name: string | null;
  member_code?: string | null;
  membership_status: string | null;
  membership_end_date?: string | null;
  membership_days_remaining?: number | null;
  membership_plan_name?: string | null;
  method: string;
  checked_in_at: string;
}

interface CheckinSuccessToastStackProps {
  items: SuccessToastItem[];
  onDismiss: (id: string) => void;
  /** ms before each toast self-dismisses. Default 2500. */
  ttlMs?: number;
}

/**
 * Reception-side non-blocking success toast stack.
 *
 * Why this exists: the full-screen `CheckinResult` overlay was the second-biggest
 * reception-friction issue — every successful check-in stole 4s of the desk's
 * attention and blocked the next scan. During rush hour that's a queue maker.
 *
 * Design:
 *  - Fixed bottom-right column of small cards (non-modal).
 *  - Up to 3 visible at once — older entries fade to ~60% opacity so the
 *    operator can see "yep, that just stacked" without being overwhelmed.
 *  - role="status" + aria-live="polite" so screen readers announce each
 *    arrival without interrupting (which `aria-live="assertive"` would).
 *  - Each toast self-dismisses after 2.5s; the operator can also tap × to
 *    clear it sooner.
 *  - Respects prefers-reduced-motion (no slide; just fade).
 *
 * Denials still use the full-screen modal — there the operator needs to
 * read, decide, and possibly override.
 */
export function CheckinSuccessToastStack({
  items,
  onDismiss,
  ttlMs = 2500,
}: CheckinSuccessToastStackProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Recent successful check-ins"
      className="pointer-events-none fixed bottom-6 right-6 z-40 flex w-[min(22rem,calc(100vw-3rem))] flex-col-reverse gap-2"
    >
      {items.map((item, idx) => (
        <SuccessToast
          key={item.id}
          item={item}
          stackIndex={idx}
          onDismiss={onDismiss}
          ttlMs={ttlMs}
        />
      ))}
    </div>
  );
}

function SuccessToast({
  item,
  stackIndex,
  onDismiss,
  ttlMs,
}: {
  item: SuccessToastItem;
  stackIndex: number;
  onDismiss: (id: string) => void;
  ttlMs: number;
}) {
  React.useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), ttlMs);
    return () => clearTimeout(t);
  }, [item.id, onDismiss, ttlMs]);

  // Older toasts (further down the stack) get dimmer + slightly smaller
  // so the freshest one reads as primary at a glance.
  const dim =
    stackIndex === 0 ? 'opacity-100' : stackIndex === 1 ? 'opacity-80' : 'opacity-60';
  const scale = stackIndex === 0 ? 'scale-100' : 'scale-[0.98]';

  const time = (() => {
    try {
      return format(new Date(item.checked_in_at), 'h:mm a');
    } catch {
      return '';
    }
  })();

  return (
    <div
      className={`pointer-events-auto relative flex items-center gap-3 rounded-xl border border-success/30 bg-card px-4 py-3 shadow-level-4 transition-all duration-fast ${dim} ${scale} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-reduce:animate-none`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15">
        <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-body-md font-semibold text-foreground">
            {item.member_name ?? 'Member'}
          </p>
          {time && (
            <span className="shrink-0 text-body-sm text-muted-foreground tabular-nums">
              {time}
            </span>
          )}
        </div>
        {item.member_code && (
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {item.member_code}
          </p>
        )}
        <p className="truncate text-body-sm text-muted-foreground">
          {item.membership_plan_name ?? 'Checked in'}
          {item.membership_status ? (
            <span className="capitalize"> · {item.membership_status.replace(/_/g, ' ')}</span>
          ) : null}
        </p>
        {item.membership_end_date && (
          <p className="truncate text-[11px] text-muted-foreground">
            {(() => {
              try {
                const end = new Date(item.membership_end_date);
                const days = item.membership_days_remaining ?? null;
                const dateStr = format(end, 'MMM d, yyyy');
                if (days === null) return `Expires ${dateStr}`;
                if (days < 0) return `Expired ${dateStr}`;
                if (days === 0) return `Expires today (${dateStr})`;
                return `Expires ${dateStr} · ${days} day${days === 1 ? '' : 's'} left`;
              } catch {
                return null;
              }
            })()}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={`Dismiss check-in confirmation for ${item.member_name ?? 'member'}`}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors duration-fast hover:bg-canvas-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
