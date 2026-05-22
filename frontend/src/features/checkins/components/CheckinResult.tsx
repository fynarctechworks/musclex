"use client";

import React, { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import type { CheckInResponse } from "../types";
import { lookupDenial } from "../denial-catalog";

function formatExpiry(
  iso?: string | null,
  daysRemaining?: number | null,
): string | null {
  if (!iso) return null;
  try {
    const end = new Date(iso);
    const dateStr = format(end, "MMM d, yyyy");
    if (daysRemaining === null || daysRemaining === undefined) {
      return `Expires ${dateStr}`;
    }
    if (daysRemaining < 0) return `Expired on ${dateStr}`;
    if (daysRemaining === 0) return `Expires today (${dateStr})`;
    return `Expires ${dateStr} · ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;
  } catch {
    return null;
  }
}

interface CheckinResultProps {
  result: CheckInResponse;
  onDismiss: () => void;
}

/**
 * Reception-side full-screen check-in result.
 *
 * Priority rules:
 *  - SUCCESS: member name leads, membership status as humanized chip.
 *  - DENIAL: human-readable HEADLINE/MESSAGE leads (the "why" with
 *    specifics like "until 2026-06-12"). The reason CODE is reduced to
 *    a small monospace badge — useful for the operator to ask support
 *    about, but no longer the primary signal.
 *  - DENIAL also surfaces the catalog's "next step" — actionable
 *    guidance instead of just "Denied".
 */
export function CheckinResult({ result, onDismiss }: CheckinResultProps) {
  // Auto-dismiss after 4 seconds (success) / 5 seconds (denial)
  useEffect(() => {
    const ttl = result.success ? 4000 : 5000;
    const timer = setTimeout(onDismiss, ttl);
    return () => clearTimeout(timer);
  }, [onDismiss, result.success]);

  if (result.success) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in duration-fast"
        onClick={onDismiss}
      >
        <div
          className="w-full max-w-sm rounded-2xl border border-success/40 bg-card p-8 text-center shadow-level-5 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2 duration-medium"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-success/15 flex items-center justify-center motion-safe:animate-in motion-safe:zoom-in-50 duration-medium">
            <CheckCircle2 className="h-12 w-12 text-success" aria-hidden="true" />
          </div>
          <h2 className="text-display-sm font-semibold text-foreground mb-1">
            Check-In Successful
          </h2>
          {result.member_name && (
            <p className="text-body-lg font-medium text-foreground">
              {result.member_name}
            </p>
          )}
          {result.member_code && (
            <p className="font-mono text-xs text-muted-foreground mt-0.5">
              {result.member_code}
            </p>
          )}
          {(result.membership_plan_name || result.membership_status) && (
            <div className="mt-3 inline-flex flex-col items-center gap-1 rounded-lg border border-success/30 bg-success/5 px-4 py-2">
              {result.membership_plan_name && (
                <p className="text-body-sm font-medium text-foreground">
                  {result.membership_plan_name}
                </p>
              )}
              {result.membership_status && (
                <p className="text-body-sm text-success capitalize">
                  ✓ {result.membership_status.replace(/_/g, " ")}
                </p>
              )}
              {(() => {
                const exp = formatExpiry(
                  result.membership_end_date,
                  result.membership_days_remaining,
                );
                return exp ? (
                  <p className="text-xs text-muted-foreground">{exp}</p>
                ) : null;
              })()}
            </div>
          )}
          <p className="mt-4 text-body-sm text-muted-foreground">
            Tap anywhere to dismiss · auto-closes in 4s
          </p>
        </div>
      </div>
    );
  }

  const catalog = lookupDenial(result.failure_reason ?? null);
  const headline = result.message ?? catalog.headline;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in duration-fast"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-error/30 bg-card p-8 text-center shadow-level-5 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2 duration-medium"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-error/15 flex items-center justify-center motion-safe:animate-in motion-safe:zoom-in-50 duration-medium">
          <XCircle className="h-12 w-12 text-error" aria-hidden="true" />
        </div>

        {/* Member name (when known) leads — useful for the operator. */}
        {result.member_name && (
          <p className="text-body-lg font-medium text-foreground">
            {result.member_name}
          </p>
        )}
        {result.member_code && (
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            {result.member_code}
          </p>
        )}

        {/* HUMAN MESSAGE is now primary — this is the "why". */}
        <h2 className="mt-1 text-display-sm font-semibold text-foreground">
          {catalog.title}
        </h2>
        <p className="mt-2 text-body-md text-muted-foreground">{headline}</p>

        {(result.membership_plan_name || result.membership_end_date) && (
          <div className="mt-3 rounded-lg border border-hairline bg-canvas-soft px-4 py-2 text-left">
            {result.membership_plan_name && (
              <p className="text-body-sm font-medium text-foreground">
                {result.membership_plan_name}
              </p>
            )}
            {(() => {
              const exp = formatExpiry(
                result.membership_end_date,
                result.membership_days_remaining,
              );
              return exp ? (
                <p className="text-xs text-error font-medium">{exp}</p>
              ) : null;
            })()}
          </div>
        )}

        {/* Actionable next step. */}
        <p className="mt-3 text-body-sm font-medium text-foreground">
          {catalog.next_step}
        </p>

        {/* Reason code reduced to a small monospace audit badge. */}
        {result.failure_reason && (
          <div className="mt-4 flex items-center justify-center gap-2 text-body-sm">
            <span className="rounded-md bg-canvas-soft px-2 py-0.5 font-mono text-muted-foreground">
              {result.failure_reason}
            </span>
            {catalog.is_overridable && (
              <span className="text-link-deep">override available</span>
            )}
          </div>
        )}

        <p className="mt-4 text-body-sm text-muted-foreground">
          Tap anywhere to dismiss · auto-closes in 5s
        </p>
      </div>
    </div>
  );
}
