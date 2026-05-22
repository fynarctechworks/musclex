'use client';

import * as React from 'react';
import {
  CameraOff,
  RefreshCcw,
  ShieldAlert,
  Lock,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ListChecks,
} from 'lucide-react';
import type { CameraDiagnosis } from '../useCameraDiagnosis';

interface CameraBlockedPanelProps {
  diagnosis: CameraDiagnosis;
  onRetry: () => void;
  /** When true, render in dark/kiosk tone instead of card tone. */
  tone?: 'card' | 'dark';
  /** Compact mode for inside the scanner stage. */
  compact?: boolean;
}

/**
 * Drop-in panel that explains exactly WHY the camera isn't working and what
 * to do about it.
 *
 * Layers of information (so the operator sees what they need without being
 * overwhelmed):
 *  1. Title + headline message — the *what*.
 *  2. One-line "fix" callout with a lightbulb — the *now what*.
 *  3. Retry button (if the failure is recoverable).
 *  4. Collapsible "Step-by-step troubleshooting" — OS-aware list (e.g.
 *     Windows 11 Privacy → Camera path) plus the raw browser error name
 *     so IT can pattern-match in logs.
 */
export function CameraBlockedPanel({
  diagnosis,
  onRetry,
  tone = 'card',
  compact = false,
}: CameraBlockedPanelProps) {
  const [expanded, setExpanded] = React.useState(false);

  const isInsecure = diagnosis.reason === 'insecure_context';
  const isPermission = diagnosis.reason === 'permission_denied';
  const Icon = isInsecure ? Lock : isPermission ? ShieldAlert : CameraOff;

  const containerClass =
    tone === 'dark'
      ? 'rounded-2xl border border-on-primary/15 bg-on-primary/5 text-on-primary'
      : 'rounded-lg border border-warning/30 bg-warning-soft text-warning-deep';

  const iconBg =
    tone === 'dark' ? 'bg-on-primary/15 text-on-primary' : 'bg-warning/15 text-warning-deep';

  const subText = tone === 'dark' ? 'text-on-primary/70' : 'text-warning-deep/80';

  const fixBg =
    tone === 'dark'
      ? 'bg-on-primary/10 border-on-primary/20 text-on-primary'
      : 'bg-card border-hairline text-foreground';

  const stepsBg =
    tone === 'dark'
      ? 'bg-on-primary/5 border-on-primary/15 text-on-primary/90'
      : 'bg-card border-hairline text-foreground';

  const codeBg =
    tone === 'dark'
      ? 'bg-on-primary/10 text-on-primary/80'
      : 'bg-canvas-soft text-muted-foreground';

  const hasDetail =
    (diagnosis.detailedSteps?.length ?? 0) > 0 || !!diagnosis.rawErrorName || !!diagnosis.rawErrorMessage;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`${containerClass} flex w-full flex-col gap-3 ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body-md font-semibold">{diagnosis.title}</p>
          {!compact && <p className={`mt-0.5 text-body-sm ${subText}`}>{diagnosis.message}</p>}
        </div>
      </div>

      <div className={`flex items-start gap-2 rounded-md border px-3 py-2 ${fixBg}`}>
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-body-sm">{diagnosis.fix}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {diagnosis.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors duration-fast ${
              tone === 'dark'
                ? 'bg-on-primary text-ink hover:bg-on-primary/90'
                : 'bg-warning-deep text-on-primary hover:bg-warning-deep/90'
            }`}
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
        )}

        {hasDetail && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors duration-fast ${
              tone === 'dark'
                ? 'border border-on-primary/20 text-on-primary/80 hover:bg-on-primary/10'
                : 'border border-hairline text-foreground hover:bg-canvas-soft'
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            {expanded ? 'Hide steps' : 'Show troubleshooting'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {expanded && hasDetail && (
        <div className={`flex flex-col gap-3 rounded-md border px-3 py-3 ${stepsBg}`}>
          {(diagnosis.detailedSteps?.length ?? 0) > 0 && (
            <ol className="ml-5 list-decimal space-y-1 text-body-sm">
              {diagnosis.detailedSteps!.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
          {(diagnosis.rawErrorName || diagnosis.rawErrorMessage) && (
            <div className="border-t border-hairline/40 pt-2 text-body-sm">
              <div className={`mb-1 text-[11px] uppercase tracking-wide ${subText}`}>
                Browser error (for support)
              </div>
              <code className={`inline-block rounded px-2 py-0.5 font-mono ${codeBg}`}>
                {diagnosis.rawErrorName ?? 'Error'}
                {diagnosis.rawErrorMessage ? ` — ${diagnosis.rawErrorMessage}` : ''}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
