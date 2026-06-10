"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScanFace, CameraOff, Check, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { biometricApi } from "@/features/checkins/api";
import {
  diagnoseCameraError,
  preflightCamera,
  type CameraDiagnosis,
} from "@/features/checkins/useCameraDiagnosis";

interface EnrollBiometricDialogProps {
  memberId: string;
  memberName: string;
  branchId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * On-device face enrollment. Captures a 128-dim descriptor via face-api.js
 * (no image leaves the device) and persists it on the backend via the
 * biometric enrollment endpoint. The descriptor is then used by the
 * pgvector matcher during facial check-in.
 */
export function EnrollBiometricDialog({
  memberId,
  memberName,
  branchId,
  open,
  onClose,
}: EnrollBiometricDialogProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef = useRef<any>(null);

  const [stage, setStage] = useState<"idle" | "loading" | "scanning" | "captured" | "error">("idle");
  const [diagnosis, setDiagnosis] = useState<CameraDiagnosis | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  const enrollments = useQuery({
    queryKey: ["biometric", "member", memberId],
    queryFn: () => biometricApi.listForMember(memberId),
    enabled: open,
  });

  const enrollMutation = useMutation({
    mutationFn: (descriptor: number[]) =>
      biometricApi.enrollFace({
        member_id: memberId,
        branch_id: branchId,
        descriptor,
      }),
    onSuccess: () => {
      toast.success(`Face enrolled for ${memberName}`);
      queryClient.invalidateQueries({ queryKey: ["biometric", "member", memberId] });
      stopCamera();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Could not enroll face"),
  });

  const revokeMutation = useMutation({
    mutationFn: (enrollmentId: string) => biometricApi.revoke(enrollmentId, branchId),
    onSuccess: () => {
      toast.success("Enrollment removed");
      queryClient.invalidateQueries({ queryKey: ["biometric", "member", memberId] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not remove enrollment"),
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

  // Auto-attempt continuous detection while scanning. As soon as a face is
  // detected the operator can press Capture.
  useEffect(() => {
    if (stage !== "scanning") return;
    // Just keep the stream live; capture is gated behind the Capture button.
  }, [stage]);

  // Cleanup on unmount / close
  useEffect(() => {
    if (!open) {
      stopCamera();
      setStage("idle");
      setCapturedDescriptor(null);
      setDiagnosis(null);
    }
  }, [open, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleConfirm = () => {
    if (!capturedDescriptor) return;
    enrollMutation.mutate(capturedDescriptor);
  };

  const handleRetake = () => {
    setCapturedDescriptor(null);
    setStage("scanning");
  };

  const existingFaceEnrollments = (enrollments.data ?? []).filter(
    (e) => e.modality === "face" && !e.revoked_at,
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" />
            Enroll Face — {memberName}
          </DialogTitle>
          <DialogDescription>
            The face descriptor is computed on this device and stored as a vector;
            no photo leaves the browser. The member can then check in via Face ID.
          </DialogDescription>
        </DialogHeader>

        {/* Existing enrollments */}
        {existingFaceEnrollments.length > 0 && (
          <div className="rounded-md border border-hairline bg-canvas-soft p-3">
            <p className="text-xs font-medium text-foreground mb-2">
              Active enrollments ({existingFaceEnrollments.length})
            </p>
            <div className="space-y-1.5">
              {existingFaceEnrollments.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span>
                    Face · enrolled {new Date(e.enrolled_at).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeMutation.mutate(e.id)}
                    disabled={revokeMutation.isPending}
                    className="h-7 px-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camera area */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-ink">
          {stage === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-on-primary/70">
              <ScanFace className="h-12 w-12" />
              <p className="text-sm">Click "Start Camera" to begin enrollment</p>
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
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={startCamera} disabled={loadingModels}>
                <ScanFace className="h-4 w-4 mr-2" />
                Start Camera
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
                <ScanFace className="h-4 w-4 mr-2" />
                Capture Face
              </Button>
            </>
          ) : stage === "captured" ? (
            <>
              <Button variant="ghost" onClick={handleRetake}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Retake
              </Button>
              <Button onClick={handleConfirm} disabled={enrollMutation.isPending}>
                <Check className="h-4 w-4 mr-2" />
                Save Enrollment
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Convenience hook so call sites don't need to pass branch through props.
 */
export function useDefaultBranchId(): string {
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return activeBranchId || (user?.branch_ids?.[0] ?? "");
}
