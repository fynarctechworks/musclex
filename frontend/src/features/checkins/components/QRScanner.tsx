"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { QrCode, Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureError, Source } from "@/lib/observability/capture";
import { ScannerStage, type ScannerState } from "./ScannerStage";
import { CameraBlockedPanel } from "./CameraBlockedPanel";
import {
  diagnoseCameraError,
  preflightCamera,
  useCameraReadiness,
  type CameraDiagnosis,
} from "../useCameraDiagnosis";

interface QRScannerProps {
  onScan: (qrCode: string) => void;
  isPending: boolean;
  /** Visual tone for camera-blocked panel. Kiosk passes "dark". */
  tone?: 'card' | 'dark';
}

/**
 * QR check-in scanner. The framing chrome (corner brackets, animated
 * scan-line, state chip, microcopy) is delegated to ScannerStage so
 * QR and Face scanners share the same visual language.
 *
 * Camera errors are now diagnosed (insecure context / denied / in use /
 * no camera) so the operator sees an actionable fix instead of a vague
 * toast. The manual QR input remains visible at all times — operators
 * never get stuck if the camera is uncooperative.
 */
export function QRScanner({ onScan, isPending, tone = 'card' }: QRScannerProps) {
  const [state, setState] = useState<ScannerState>("off");
  const [manualCode, setManualCode] = useState("");
  const [diagnosis, setDiagnosis] = useState<CameraDiagnosis | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const processingRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-flight + live permission watch. If the browser already knows the
  // permission is denied, we surface that BEFORE the user clicks Start.
  const readiness = useCameraReadiness();

  // Reflect external mutation state into the chrome — when the parent's
  // mutation is in flight, show 'busy' instead of 'scanning'.
  useEffect(() => {
    setState((prev) => {
      if (prev === "off" || prev === "error" || prev === "starting") return prev;
      if (isPending) return "busy";
      if (prev === "busy") return "scanning";
      return prev;
    });
  }, [isPending]);

  const onScanSuccess = useCallback(
    (decodedText: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      if (scannerRef.current) {
        try { scannerRef.current.pause(true); } catch {}
      }

      setState("busy");
      onScan(decodedText);

      resumeTimerRef.current = setTimeout(() => {
        processingRef.current = false;
        if (scannerRef.current) {
          try { scannerRef.current.resume(); } catch {}
        }
        setState("scanning");
        resumeTimerRef.current = null;
      }, 3000);
    },
    [onScan]
  );

  const startScanner = async () => {
    // Block early on insecure context / missing API — saves the user a
    // confusing prompt that would never appear.
    const pre = preflightCamera();
    if (pre) {
      setState("error");
      setDiagnosis(pre);
      return;
    }
    setDiagnosis(null);
    setState("starting");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-scanner-view");
      scannerRef.current = scanner;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      try {
        await scanner.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
      } catch (envErr) {
        // First attempt (rear camera) failed — try the first enumerated
        // device (laptops usually only have one, facing-user).
        const devices = await Html5Qrcode.getCameras().catch(() => null);
        if (!devices || devices.length === 0) {
          throw envErr instanceof Error ? envErr : new Error("No camera found on this device");
        }
        await scanner.start(devices[0].id, config, onScanSuccess, () => {});
      }

      setState("scanning");
    } catch (err) {
      const dx = diagnoseCameraError(err);
      setDiagnosis(dx);
      setState("error");
      captureError(Source.QR, err, { module: "qr-checkin-scanner", severity: "MEDIUM" });
    }
  };

  // html5-qrcode throws "Cannot stop, scanner is not running or paused"
  // synchronously when stop() runs against a NOT_STARTED instance. The
  // state console we used to see came from React StrictMode invoking
  // the unmount cleanup before the scanner ever started. We now check
  // `getState()` first (2 = SCANNING, 3 = PAUSED) and silently no-op
  // otherwise — that error is noise, not a bug.
  const safeStopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      const state = typeof scanner.getState === 'function' ? scanner.getState() : 2;
      if (state === 2 || state === 3) {
        await scanner.stop();
      }
    } catch {
      // Library can still throw if we lose a race with auto-pause; swallow.
    } finally {
      try { scanner.clear?.(); } catch { /* clear() depends on stopped state */ }
    }
  }, []);

  const stopScanner = async () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    await safeStopScanner();
    scannerRef.current = null;
    setState("off");
  };

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      safeStopScanner().finally(() => {
        scannerRef.current = null;
      });
    };
    // safeStopScanner is stable (no deps); ESLint can't see that through
    // the useCallback boundary in this file. Intentional empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode("");
    }
  };

  const handleRetry = () => {
    setDiagnosis(null);
    readiness.recheck();
    startScanner();
  };

  const isActive = state !== "off" && state !== "error";

  // Pre-emptive block (no Start click yet): show the diagnosis inline so
  // the operator can fix it before wasting a click.
  const proactiveDiagnosis = !diagnosis && state === 'off' ? readiness.diagnosis : null;

  return (
    <div className="space-y-4">
      <ScannerStage
        state={state}
        shape="rect"
        tone="dark"
        offIcon={<QrCode className="h-8 w-8" />}
        offLabel="Tap below to start scanning"
      >
        {/* html5-qrcode warns when the container has no fixed dimensions
            ("please check the style of container, or the props width/
            height"). We set explicit pixels here AND keep h-/w-full so
            the camera fills the framed area. */}
        <div
          id="qr-scanner-view"
          style={{ width: '100%', height: '100%', minHeight: 240 }}
          className={`${isActive ? "opacity-100" : "opacity-0"} transition-opacity duration-fast`}
        />
      </ScannerStage>

      {/* Diagnosis panel — shown when the scanner failed to start OR the
          browser has already denied permission. */}
      {(diagnosis || proactiveDiagnosis) && (
        <CameraBlockedPanel
          diagnosis={diagnosis ?? proactiveDiagnosis!}
          onRetry={handleRetry}
          tone={tone}
        />
      )}

      <div>
        {state === "off" || state === "error" ? (
          <Button
            onClick={startScanner}
            className="w-full h-12 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={readiness.permission === 'denied' || !!proactiveDiagnosis}
          >
            <Camera className="h-5 w-5" aria-hidden="true" />
            <span>Start QR Scanner</span>
          </Button>
        ) : (
          <Button
            onClick={stopScanner}
            variant="outline"
            className="w-full h-12 text-base font-medium"
          >
            <CameraOff className="h-5 w-5" aria-hidden="true" />
            <span>Stop Scanner</span>
          </Button>
        )}
      </div>

      {/* Manual QR fallback — always available so the operator never
          gets stuck when a camera is uncooperative. */}
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <QrCode
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Enter QR code manually…"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="h-12 pl-10 bg-card border-hairline"
            aria-label="Enter QR code manually"
          />
        </div>
        <Button
          type="submit"
          disabled={!manualCode.trim() || isPending}
          className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            "Submit"
          )}
        </Button>
      </form>
    </div>
  );
}
