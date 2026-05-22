'use client';

import * as React from 'react';
import { Camera as CameraIcon, CameraOff, Loader2, ScanLine, ShieldCheck } from 'lucide-react';

export type ScannerState = 'off' | 'starting' | 'scanning' | 'busy' | 'found' | 'denied' | 'error';
export type ScannerShape = 'rect' | 'circle';

interface ScannerStageProps {
  /** The camera surface (e.g. <video> or <div id="qr-scanner-view">). */
  children: React.ReactNode;
  state: ScannerState;
  shape?: ScannerShape;
  /** Microcopy under the frame. Falls back to a sensible state-derived line. */
  caption?: string;
  /** Empty-state hero shown when state === 'off'. */
  offIcon?: React.ReactNode;
  offLabel?: string;
  /** "Use light/dark on overlays" — dark by default (entrance lighting). */
  tone?: 'dark' | 'light';
  className?: string;
}

/**
 * Visual chrome that wraps a camera surface in a premium scanner frame.
 *
 *  ┌─┐                          ┌─┐
 *  └─┘   ─── scan sweep line ─── └─┘
 *
 *  ┌─┐                          ┌─┐
 *  └─┘                          └─┘
 *
 * - Four corner brackets (SVG, currentColor — caller controls hue).
 * - For QR (`shape="rect"`): a 1.8s top↓bottom gradient sweep line —
 *   only visible while `state === 'scanning'`.
 * - For face (`shape="circle"`): a 1.6s ring pulse + soft halo —
 *   visible while `state === 'scanning'`, switches to `success`
 *   color and STOPS pulsing on `state === 'found'`.
 * - State chip in top-right; caption below the frame; off-state hero
 *   in the middle when the camera isn't running.
 *
 * Respects `prefers-reduced-motion`. All tones use design tokens.
 *
 * Designed to be reused by `QRScanner`, `FaceScanner`, and any future
 * kiosk/turnstile UI without duplicating chrome logic.
 */
export function ScannerStage({
  children,
  state,
  shape = 'rect',
  caption,
  offIcon,
  offLabel,
  tone = 'dark',
  className,
}: ScannerStageProps) {
  const isCircle = shape === 'circle';
  const isOff = state === 'off';
  const isScanning = state === 'scanning';
  const isBusy = state === 'busy' || state === 'starting';
  const isFound = state === 'found';
  const isDenied = state === 'denied';
  const isError = state === 'error';

  const bracketHue =
    isFound ? 'text-success'
    : isDenied ? 'text-error'
    : isError ? 'text-warning'
    : tone === 'dark' ? 'text-on-primary' : 'text-foreground';

  const frameBg = tone === 'dark' ? 'bg-ink' : 'bg-canvas-soft';
  const captionTone = tone === 'dark' ? 'text-on-primary/70' : 'text-muted-foreground';

  const fallbackCaption = (() => {
    if (caption) return caption;
    switch (state) {
      case 'off': return null;
      case 'starting': return 'Starting camera…';
      case 'scanning': return shape === 'rect' ? 'Align QR inside the frame' : 'Stand still and face the camera';
      case 'busy': return 'Checking…';
      case 'found': return 'Got it!';
      case 'denied': return 'Try again';
      case 'error': return 'Camera unavailable';
      default: return null;
    }
  })();

  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`}>
      <div
        className={`relative w-full overflow-hidden ${isCircle ? 'aspect-square rounded-full' : 'aspect-video rounded-3xl'} ${frameBg}`}
        role="region"
        aria-label="Scanner camera frame"
        aria-busy={isBusy || isScanning}
      >
        {/* Camera surface (the actual <video>) sits behind the chrome. */}
        <div className="absolute inset-0">{children}</div>

        {/* Empty-state hero when the camera isn't running. */}
        {isOff && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${captionTone}`}>
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${tone === 'dark' ? 'bg-on-primary/10' : 'bg-canvas-soft-2'}`}>
              {offIcon ?? <CameraIcon className="h-8 w-8" aria-hidden="true" />}
            </div>
            {offLabel && <div className="text-body-md font-medium">{offLabel}</div>}
          </div>
        )}

        {/* Error overlay — camera couldn't start. */}
        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/40 backdrop-blur-sm">
            <CameraOff className="h-10 w-10 text-warning" aria-hidden="true" />
            <div className={`text-body-sm font-medium ${captionTone}`}>Camera unavailable</div>
          </div>
        )}

        {/* Corner brackets — visible whenever a camera is active or we're showing the frame intent. */}
        {!isOff && !isError && (
          <>
            {/* Frame brackets: SVG, currentColor, so the bracketHue class drives them. */}
            <div className={`pointer-events-none absolute inset-0 ${bracketHue} transition-colors duration-fast`} aria-hidden="true">
              {isCircle ? (
                <CircleReticle isFound={isFound} isScanning={isScanning} />
              ) : (
                <RectBrackets />
              )}
            </div>

            {/* Scan-line sweep (rect only, only while scanning). */}
            {!isCircle && isScanning && (
              <div className="pointer-events-none absolute inset-x-[12%] top-[14%] bottom-[14%] motion-safe:animate-[scan-sweep_1.8s_ease-in-out_infinite] motion-reduce:hidden" aria-hidden="true">
                <div className="h-[2px] w-full rounded-full bg-gradient-to-r from-transparent via-success to-transparent shadow-[0_0_24px_4px] shadow-success/40" />
              </div>
            )}

            {/* State chip top-right. */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <StateChip state={state} tone={tone} />
            </div>
          </>
        )}
      </div>

      {/* Caption row */}
      {fallbackCaption && (
        <div className={`flex items-center justify-center gap-2 text-body-sm ${captionTone} ${isScanning ? 'motion-safe:animate-pulse motion-reduce:animate-none' : ''}`}>
          {isScanning && <ScanLine className="h-4 w-4" aria-hidden="true" />}
          {isFound && <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />}
          {isBusy && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
          <span>{fallbackCaption}</span>
        </div>
      )}

      <style jsx>{`
        @keyframes scan-sweep {
          0%   { transform: translateY(0%); opacity: 0; }
          10%  { opacity: 1; }
          50%  { transform: translateY(100%); opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(0%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Decoration parts ────────────────────────────────────────────────

function RectBrackets() {
  // 4 corners. Each is a 14% inset L-shape made of 2 thin strokes,
  // drawn in `currentColor` so the parent controls hue & state.
  const len = 'w-10 h-10 md:w-12 md:h-12';
  const stroke = 'border-current';
  const radius = 'rounded-md';
  return (
    <>
      <div className={`absolute top-3 left-3 ${len} border-t-[3px] border-l-[3px] ${stroke} ${radius} drop-shadow-level-2`} />
      <div className={`absolute top-3 right-3 ${len} border-t-[3px] border-r-[3px] ${stroke} ${radius} drop-shadow-level-2`} />
      <div className={`absolute bottom-3 left-3 ${len} border-b-[3px] border-l-[3px] ${stroke} ${radius} drop-shadow-level-2`} />
      <div className={`absolute bottom-3 right-3 ${len} border-b-[3px] border-r-[3px] ${stroke} ${radius} drop-shadow-level-2`} />
    </>
  );
}

function CircleReticle({ isScanning, isFound }: { isScanning: boolean; isFound: boolean }) {
  // Two concentric circles: an inner solid stroke (the target ring) and
  // an outer pulsing halo while scanning.
  return (
    <>
      {/* Outer halo — pulses while scanning, disappears on found. */}
      {isScanning && !isFound && (
        <div className="absolute inset-[8%] rounded-full border-2 border-current opacity-30 motion-safe:animate-ping" />
      )}
      {/* Inner target ring. */}
      <div className={`absolute inset-[12%] rounded-full border-[3px] border-current ${isFound ? 'opacity-100' : 'opacity-70'} drop-shadow-level-2 transition-opacity duration-fast`} />
    </>
  );
}

function StateChip({ state, tone }: { state: ScannerState; tone: 'dark' | 'light' }) {
  if (state === 'off' || state === 'starting') return null;
  const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide';

  if (state === 'scanning') {
    return (
      <span className={`${base} ${tone === 'dark' ? 'bg-on-primary/15 text-on-primary' : 'bg-canvas-soft text-foreground'}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-success motion-safe:animate-pulse" aria-hidden="true" />
        Scanning
      </span>
    );
  }
  if (state === 'busy') {
    return (
      <span className={`${base} ${tone === 'dark' ? 'bg-on-primary/15 text-on-primary' : 'bg-canvas-soft text-foreground'}`}>
        <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden="true" />
        Working
      </span>
    );
  }
  if (state === 'found') {
    return (
      <span className={`${base} bg-success/20 text-success-foreground`}>
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Got it
      </span>
    );
  }
  if (state === 'denied') {
    return (
      <span className={`${base} bg-error/20 text-on-primary`}>
        Denied
      </span>
    );
  }
  return null;
}
