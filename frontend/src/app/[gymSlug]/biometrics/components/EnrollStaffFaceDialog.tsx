"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScanFace, CameraOff, Check, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { staffBiometricsApi } from "@/features/staff/api";
import {
  diagnoseCameraError,
  preflightCamera,
  type CameraDiagnosis,
} from "@/features/checkins/useCameraDiagnosis";

/**
 * On-device face enrollment for STAFF. Captures a 128-dim descriptor via
 * face-api.js (no image leaves the device) and persists on the backend via
 * the staff biometric enrollment endpoint. The descriptor powers face-driven
 * clock-in / clock-out from any kiosk.
 */
export function EnrollStaffFaceDialog({
  staffId,
  staffName,
  open,
  onClose,
}: {
  staffId: string;
  staffName: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef = useRef<any>(null);

  const [stage, setStage] = useState<
    "idle" | "loading" | "scanning" | "captured" | "error"
  >("idle");
  const [diagnosis, setDiagnosis] = useState<CameraDiagnosis | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(
    null,
  );
  const [loadingModels, setLoadingModels] = useState(false);

  const enrollMutation = useMutation({
    mutationFn: (descriptor: number[]) =>
      staffBiometricsApi.enrollFace({ staff_id: staffId, descriptor }),
    onSuccess: () => {
      toast.success(`Face enrolled for ${staffName}`);
      queryClient.invalidateQueries({
        queryKey: ["staff-biometric", "enrollments"],
      });
      stopCamera();
      onClose();
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not enroll staff face"),
  });

  const loadModels = useCallback(async () => {
    if (faceapiRef.current) return;
    setLoadingModels(true);
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
      toast.error("Failed to load face recognition models");
      throw new Error("models");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    const pre = preflightCamera();
    if (pre) {
      setDiagnosis(pre);
      setStage("error");
      return;
    }
    setDiagnosis(null);
    setStage("loading");
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
      setStage("scanning");
    } catch (err) {
      setDiagnosis(diagnoseCameraError(err));
      setStage("error");
    }
  }, [loadModels]);

  const capture = useCallback(async () => {
    if (!videoRef.current || !faceapiRef.current) return;
    const faceapi = faceapiRef.current;
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detection) {
        toast.error("No face detected — make sure your face is clearly visible");
        return;
      }
      const descriptor = Array.from(detection.descriptor as Float32Array);
      setCapturedDescriptor(descriptor);
      setStage("captured");
    } catch {
      toast.error("Face capture failed — please try again");
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setStage("idle");
      setCapturedDescriptor(null);
      setDiagnosis(null);
    }
  }, [open, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleConfirm = () => {
    if (!capturedDescriptor) return;
    enrollMutation.mutate(capturedDescriptor);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" />
            Enroll Staff Face — {staffName}
          </DialogTitle>
          <DialogDescription>
            Computed on this device — no photo leaves the browser. Used for
            clock-in / clock-out at the kiosk.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-ink">
          {stage === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-on-primary/70">
              <ScanFace className="h-12 w-12" />
              <p className="text-sm">Click &quot;Start Camera&quot; to begin enrollment</p>
            </div>
          )}

          {stage === "error" && diagnosis && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/80 p-6 text-center text-on-primary">
              <CameraOff className="h-10 w-10 text-warning" />
              <p className="text-sm font-medium">{diagnosis.title}</p>
              <p className="text-xs text-on-primary/70 max-w-md">{diagnosis.message}</p>
              <p className="text-xs text-on-primary/90 max-w-md font-medium mt-2">
                {diagnosis.fix}
              </p>
            </div>
          )}

          <video
            ref={videoRef}
            className={`h-full w-full object-cover transition-opacity duration-fast ${
              stage === "scanning" || stage === "captured" ? "opacity-100" : "opacity-0"
            }`}
            muted
            playsInline
          />

          {stage === "captured" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-success/20 backdrop-blur-sm">
              <div className="rounded-full bg-success/90 p-4">
                <Check className="h-10 w-10 text-on-primary" />
              </div>
              <p className="text-sm font-medium text-on-primary">Face captured</p>
            </div>
          )}

          {(loadingModels || enrollMutation.isPending) && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/60">
              <Loader2 className="h-8 w-8 motion-safe:animate-spin text-on-primary" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {stage === "idle" || stage === "error" ? (
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={startCamera} disabled={loadingModels}>
                <ScanFace className="h-4 w-4 mr-2" /> Start Camera
              </Button>
            </>
          ) : stage === "scanning" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  stopCamera();
                  setStage("idle");
                }}
              >
                Cancel
              </Button>
              <Button onClick={capture}>
                <ScanFace className="h-4 w-4 mr-2" /> Capture Face
              </Button>
            </>
          ) : stage === "captured" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setCapturedDescriptor(null);
                  setStage("scanning");
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Retake
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={enrollMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" /> Save Enrollment
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
