'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Why this exists: the scanner code used to swallow every camera error into
 * a generic "Camera access denied" toast. Operators couldn't tell the
 * difference between "I'm on http://192.168.x:3000 and the browser refuses
 * non-secure contexts" vs. "I denied the prompt" vs. "Teams is holding the
 * webcam". Each needs a different fix.
 *
 * This module owns the diagnosis. The scanner just calls
 * `diagnoseCameraError(err)` and renders the result.
 */

export type CameraBlockReason =
  | 'insecure_context'
  | 'no_mediadevices'
  | 'permission_denied'
  | 'permission_dismissed'
  | 'in_use'
  | 'no_camera'
  | 'hardware_failure'
  | 'overconstrained'
  | 'unknown';

export interface CameraDiagnosis {
  reason: CameraBlockReason;
  title: string;
  message: string;
  /** Short, actionable verb-led step the operator can perform RIGHT NOW. */
  fix: string;
  /** True if user gesture (click "try again") may resolve it. */
  retryable: boolean;
  /** Ordered list of extra checks for power users / IT. */
  detailedSteps?: string[];
  /** Raw browser error class (e.g. "NotFoundError") — surfaced so support
   *  can pattern-match in logs and so the operator can google it. */
  rawErrorName?: string;
  /** Raw browser error message — surfaced for the same reason. */
  rawErrorMessage?: string;
}

/**
 * Detect the operating system from the user-agent so we can hand
 * OS-specific privacy-setting paths. Returns the bucket only, not the
 * version — that's all the diagnoser needs.
 */
function detectOS(): 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  // userAgentData (more reliable) when present.
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } })
    .userAgentData?.platform?.toLowerCase();
  const hint = platform ?? ua;
  if (hint.includes('windows') || hint.includes('win32') || hint.includes('win64')) return 'windows';
  if (hint.includes('iphone') || hint.includes('ipad') || hint.includes('ipod')) return 'ios';
  if (hint.includes('android')) return 'android';
  if (hint.includes('mac')) return 'macos';
  if (hint.includes('linux')) return 'linux';
  return 'other';
}

/** OS-specific privacy-settings steps for "no camera" / "permission" cases. */
function osPrivacySteps(os: ReturnType<typeof detectOS>): string[] {
  switch (os) {
    case 'windows':
      return [
        'Open Windows Settings → Privacy & security → Camera.',
        'Turn ON "Camera access" (system-wide toggle at the top).',
        'Turn ON "Let apps access your camera".',
        'Scroll down → enable "Let desktop apps access your camera" — this controls browsers.',
        'Reload this page after toggling.',
      ];
    case 'macos':
      return [
        'Open System Settings → Privacy & Security → Camera.',
        'Toggle ON the entry for your browser (Chrome / Safari / Edge).',
        'Quit and reopen the browser — macOS only applies the change on next launch.',
      ];
    case 'ios':
      return [
        'Open iOS Settings → Safari → Camera → Allow.',
        'Or: Settings → Privacy & Security → Camera → Safari (or your browser) → On.',
      ];
    case 'android':
      return [
        'Long-press the browser icon → App info → Permissions → Camera → Allow.',
        'Reload this page after toggling.',
      ];
    default:
      return [
        'Check your operating system’s privacy settings — make sure the browser is allowed to use the camera.',
      ];
  }
}

/**
 * Browser-API preconditions — call before invoking getUserMedia so we
 * can fail fast with the right message instead of waiting for a vague
 * NotAllowedError.
 */
export function preflightCamera(): CameraDiagnosis | null {
  if (typeof window === 'undefined') return null;

  // navigator.mediaDevices is only exposed on secure contexts. The two
  // exceptions are localhost / 127.0.0.1 / ::1 — which the browser treats
  // as secure even over plain http. If we're on a LAN IP without TLS,
  // there will be no mediaDevices and no useful error.
  if (!window.isSecureContext) {
    const host = window.location?.hostname ?? '';
    return {
      reason: 'insecure_context',
      title: 'Camera blocked — insecure connection',
      message:
        `This page is on \`${host || window.location?.host || 'a non-secure URL'}\` over plain http. ` +
        'Browsers only allow camera access on secure pages (https://) or on localhost.',
      fix: 'Open this page via http://localhost:3000 instead of the LAN IP.',
      retryable: false,
      detailedSteps: [
        'In your browser, change the URL host to "localhost" (e.g. http://localhost:3000) and reload.',
        'If you need to access from another device, use an HTTPS tunnel like ngrok / cloudflared.',
        'You can also enable Chrome flag chrome://flags/#unsafely-treat-insecure-origin-as-secure ' +
          'for the current host (dev only).',
      ],
    };
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return {
      reason: 'no_mediadevices',
      title: 'Camera API unavailable',
      message:
        "This browser doesn't expose a working MediaDevices API. " +
        'Older browsers and some embedded webviews drop it.',
      fix: 'Use a recent Chrome, Edge, Safari, or Firefox build.',
      retryable: false,
    };
  }

  return null;
}

/**
 * Map a thrown error from `getUserMedia` or `Html5Qrcode.start` into a
 * stable diagnosis. Robust to the various names browsers use.
 *
 * The richer the OS hints, the better. The most common Windows 11 case
 * is `NotFoundError` thrown not because no camera exists but because the
 * OS-level "Camera access" privacy toggle is OFF — the device is hidden
 * from the browser entirely. We surface that as the *first* step in
 * the troubleshooting list.
 */
export function diagnoseCameraError(err: unknown): CameraDiagnosis {
  const e = err as { name?: string; message?: string };
  const name = (e?.name ?? '').toString();
  const msg = (e?.message ?? '').toString().toLowerCase();
  const os = detectOS();
  const osSteps = osPrivacySteps(os);

  const withRaw = (dx: CameraDiagnosis): CameraDiagnosis => ({
    ...dx,
    rawErrorName: name || undefined,
    rawErrorMessage: e?.message ?? undefined,
  });

  // DOMException names take priority — they're stable across vendors.
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return withRaw({
      reason: 'permission_denied',
      title: 'Camera permission denied',
      message:
        'The browser blocked camera access for this site. Allow it, then reload.',
      fix: 'Click the lock icon in the address bar → Site settings → Camera → Allow.',
      retryable: true,
      detailedSteps: [
        'In the URL bar, click the lock (or info) icon.',
        '"Site settings" → set Camera to "Allow".',
        'Reload this page.',
        '— Still blocked? It may be the OS, not the browser:',
        ...osSteps,
      ],
    });
  }

  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return withRaw({
      reason: 'in_use',
      title: 'Camera busy',
      message:
        'Another app is using the camera (Zoom, Teams, Meet, OBS, another tab). ' +
        "The OS won't let two processes own it.",
      fix: 'Close the other app or browser tab using the camera, then retry.',
      retryable: true,
      detailedSteps: [
        'Close Zoom / Teams / Google Meet / Slack / OBS if open.',
        'Close any other browser tab that may be using video.',
        'On Windows: open Task Manager → end "Camera Frame Server" if stuck.',
        os === 'windows'
          ? 'If it persists, toggle Windows Settings → Privacy → Camera OFF then ON.'
          : 'Reboot if it remains stuck after closing other apps.',
      ],
    });
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    // The big Windows 11 trap: this fires when the OS privacy toggle is OFF
    // even though a camera is physically present. We surface that FIRST.
    return withRaw({
      reason: 'no_camera',
      title: os === 'windows' ? 'Camera blocked or missing' : 'No camera detected',
      message:
        os === 'windows'
          ? "Windows didn't expose any camera to this browser. Most often this " +
            'means the OS Camera-access toggle is off, not that the camera is broken.'
          : "We couldn't find a camera connected to this machine.",
      fix:
        os === 'windows'
          ? 'Open Windows Settings → Privacy & security → Camera → turn ON.'
          : 'Connect a webcam, or fall back to QR / manual search.',
      retryable: true,
      detailedSteps: osSteps,
    });
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return withRaw({
      reason: 'overconstrained',
      title: 'Camera settings unsupported',
      message: "The connected camera doesn't support the requested resolution or facing mode.",
      fix: 'Try again — the scanner will fall back to the default camera.',
      retryable: true,
    });
  }

  // Message-based fallbacks for libraries that don't always throw a DOMException.
  if (msg.includes('permission') || msg.includes('denied') || msg.includes('not allowed')) {
    return withRaw({
      reason: 'permission_denied',
      title: 'Camera permission denied',
      message:
        'The browser blocked camera access for this site. Allow it, then reload.',
      fix: 'Click the lock icon in the address bar → Site settings → Camera → Allow.',
      retryable: true,
      detailedSteps: osSteps,
    });
  }

  if (msg.includes('no camera') || msg.includes('no device')) {
    return withRaw({
      reason: 'no_camera',
      title: 'No camera detected',
      message: "We couldn't find a camera connected to this machine.",
      fix:
        os === 'windows'
          ? 'Open Windows Settings → Privacy → Camera and turn it ON.'
          : 'Connect a webcam or use manual QR / search instead.',
      retryable: true,
      detailedSteps: osSteps,
    });
  }

  return withRaw({
    reason: 'unknown',
    title: 'Camera unavailable',
    message: e?.message ?? 'The camera failed to start for an unknown reason.',
    fix: 'Try again, or fall back to QR / manual search.',
    retryable: true,
    detailedSteps: osSteps,
  });
}

/**
 * Reactive permission watcher — exposes the live `navigator.permissions`
 * state when available. This lets the UI show "blocked" BEFORE the user
 * clicks Start (the lock icon in the URL bar then becomes the obvious fix).
 *
 * Falls back gracefully on Safari < 16 where camera permissions aren't
 * queryable: state stays 'unsupported' and we don't block the UI.
 */
export type CameraPermissionState = 'unsupported' | 'prompt' | 'granted' | 'denied';

export function useCameraPermissionState(): CameraPermissionState {
  const [state, setState] = useState<CameraPermissionState>('unsupported');

  useEffect(() => {
    let cancelled = false;
    let status: PermissionStatus | null = null;

    async function probe() {
      if (typeof navigator === 'undefined' || !navigator.permissions) return;
      try {
        // `camera` is the standardized name; some older builds gate it.
        // The cast is required because TS lib.dom doesn't include camera
        // in the permission name union on all targets.
        status = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (cancelled) return;
        setState(status.state as CameraPermissionState);
        status.onchange = () => {
          if (!cancelled && status) setState(status.state as CameraPermissionState);
        };
      } catch {
        // Browser doesn't support camera in Permissions API (Safari) —
        // we just stay 'unsupported' and let getUserMedia speak for itself.
      }
    }

    probe();
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  return state;
}

/**
 * Convenience: combined pre-check + (optional) live permission state.
 * Returns either a blocking diagnosis (render an explanation panel) or
 * null (safe to start the scanner).
 */
export function useCameraReadiness(): {
  diagnosis: CameraDiagnosis | null;
  permission: CameraPermissionState;
  recheck: () => void;
} {
  const permission = useCameraPermissionState();
  const [diagnosis, setDiagnosis] = useState<CameraDiagnosis | null>(null);

  const recheck = useCallback(() => {
    const pre = preflightCamera();
    if (pre) {
      setDiagnosis(pre);
      return;
    }
    if (permission === 'denied') {
      const os = detectOS();
      setDiagnosis({
        reason: 'permission_denied',
        title: 'Camera permission denied',
        message:
          "This site is currently blocked from using the camera. Allow it " +
          'in your browser site settings, then reload.',
        fix: 'Click the lock icon in the address bar → Camera → Allow → reload.',
        retryable: true,
        detailedSteps: [
          'In the URL bar, click the lock (or info) icon next to the address.',
          'Find "Camera" and switch it to "Allow".',
          'Reload this page.',
          '— Still blocked? Check OS settings:',
          ...osPrivacySteps(os),
        ],
      });
      return;
    }
    setDiagnosis(null);
  }, [permission]);

  useEffect(() => {
    recheck();
  }, [recheck]);

  return { diagnosis, permission, recheck };
}
