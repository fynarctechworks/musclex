"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ScanFace, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FaceScannerProps {
  onMatch: (descriptor: number[]) => void;
  isPending: boolean;
}

export function FaceScanner({ onMatch, isPending }: FaceScannerProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef = useRef<any>(null);

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
      toast.error("Failed to load face recognition models. Check /public/models/ directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  const startCamera = async () => {
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
      setCameraActive(true);
      startDetection();
    } catch {
      toast.error("Camera access denied.");
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startDetection = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !faceapiRef.current || isPending) return;

      const faceapi = faceapiRef.current;
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const descriptor = Array.from(detection.descriptor as Float32Array);
        onMatch(descriptor);
        // Pause detection for 3s after a match attempt
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeout(() => startDetection(), 3000);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="relative bg-background" style={{ minHeight: cameraActive ? "320px" : "0px" }}>
          <video
            ref={videoRef}
            className={`w-full rounded-t-xl ${cameraActive ? "block" : "hidden"}`}
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
          {cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-primary/50 rounded-full" />
            </div>
          )}
        </div>
        <div className="p-3">
          {!cameraActive ? (
            <Button
              onClick={startCamera}
              disabled={loading}
              className="w-full h-12 text-base bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading Models...</>
              ) : (
                <><ScanFace className="h-5 w-5 mr-2" /> Start Face Scanner</>
              )}
            </Button>
          ) : (
            <Button
              onClick={stopCamera}
              variant="outline"
              className="w-full h-12 text-base"
            >
              <CameraOff className="h-5 w-5 mr-2" /> Stop Scanner
            </Button>
          )}
        </div>
      </div>
      {cameraActive && (
        <p className="text-sm text-muted-foreground text-center animate-pulse">
          <ScanFace className="inline h-4 w-4 mr-1" />
          Looking for faces... Please face the camera.
        </p>
      )}
    </div>
  );
}
