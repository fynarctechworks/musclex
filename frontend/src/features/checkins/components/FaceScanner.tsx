"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ScanFace, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { captureError, Source } from "@/lib/observability/capture";
import { ScannerStage, type ScannerState } from "./ScannerStage";
import { CameraBlockedPanel } from "./CameraBlockedPanel";
import {
  diagnoseCameraError,
  preflightCamera,
  useCameraReadiness,
  type CameraDiagnosis,
} from "../useCameraDiagnosis";

interface FaceScannerProps {
  onMatch: (descriptor: number[]) => void;
  isPending: boolean;
  /** Visual tone for camera-blocked panel. Kiosk passes "dark". */
  tone?: 'card' | 'dark';
}

/**
 * On-device face scanner using face-api.js. Shares the visual chrome
 * (circle reticle, ring pulse, state chip, captions) with ScannerStage
 * so both QR and Face feel like the same product.
 *
 * Camera errors are now diagnosed (insecure / denied / in-use / no camera)
 * so the operator sees an actionable fix — previously the bare `catch {}`
 * swallowed every signal into a generic "access denied" toast.
 */
export function FaceScanner({ onMatch, isPending, tone = 'card' }: FaceScannerProps) {
  const [state, setState] = useState<ScannerState>("off");
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<CameraDiagnosis | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const foundResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef = useRef<any>(null);

  const readiness = useCameraReadiness();

  useEffect(() => {
    setState((prev) => {
      if (prev === "off" || prev === "error" || prev === "starting") return prev;
      if (isPending) return "busy";
      if (prev === "busy") return "scanning";
      return prev;
    });
  }, [isPending]);

  const loadModels = useCallback(async () => {
    if (faceapiRef.current) return;
    setLoading(true);
    try {
      const faceapi = await import("face-api.js");
      faceapiRef.current = faceapi;
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
    } catch {
      toast.error("Failed to load face recognition models. Check /public/models/.");
    } finally {
      setLoading(false);
    }
  }, []);

  const startDetection = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !faceapiRef.current) return;
      if (isPending) return;

      const faceapi = faceapiRef.current;
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const descriptor = Array.from(detection.descriptor as Float32Array);
        setState("found");
        onMatch(descriptor);

        if (intervalRef.current) clearInterval(intervalRef.current);
        foundResetRef.current = setTimeout(() => {
          setState((prev) => (prev === "off" || prev === "error" ? prev : "scanning"));
          startDetection();
          foundResetRef.current = null;
        }, 3000);
      }
    }, 1000);
  }, [isPending, onMatch]);

  const startCamera = async () => {
    // Fail fast on insecure context / missing API.
    const pre = preflightCamera();
    if (pre) {
      setState("error");
      setDiagnosis(pre);
      return;
    }
    setDiagnosis(null);
    setState("starting");
    try {
      await loadModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("scanning");
      startDetection();
    } catch (err) {
      const dx = diagnoseCameraError(err);
      setDiagnosis(dx);
      setState("error");
      captureError(Source.CAMERA, err, { module: "face-scanner", severity: "MEDIUM" });
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (foundResetRef.current) {
      clearTimeout(foundResetRef.current);
      foundResetRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState("off");
  };

  const handleRetry = () => {
    setDiagnosis(null);
    readiness.recheck();
    startCamera();
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (foundResetRef.current) clearTimeout(foundResetRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const isActive = state !== "off" && state !== "error";

  const proactiveDiagnosis = !diagnosis && state === 'off' ? readiness.diagnosis : null;

  return (
    <div className="space-y-4">
      <ScannerStage
        state={state}
        shape="circle"
        tone="dark"
        offIcon={<ScanFace className="h-8 w-8" />}
        offLabel="Tap below to start the face scanner"
      >
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${isActive ? "opacity-100" : "opacity-0"} transition-opacity duration-fast`}
          muted
          playsInline
          aria-label="Face scanner camera feed"
        />
      </ScannerStage>

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
            onClick={startCamera}
            disabled={loading || readiness.permission === 'denied' || !!proactiveDiagnosis}
            className="w-full h-12 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
                <span>Loading models…</span>
              </>
            ) : (
              <>
                <ScanFace className="h-5 w-5" aria-hidden="true" />
                <span>Start Face Scanner</span>
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={stopCamera}
            variant="outline"
            className="w-full h-12 text-base font-medium"
          >
            <CameraOff className="h-5 w-5" aria-hidden="true" />
            <span>Stop Scanner</span>
          </Button>
        )}
      </div>
    </div>
  );
}
