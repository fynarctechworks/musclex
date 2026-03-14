"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, XCircle, Camera, CameraOff } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface CheckInResult {
  success: boolean;
  member_name?: string;
  message?: string;
  failure_reason?: string;
}

export default function QrCheckInPage() {
  const { gymPath } = useGymSlug();
  const [qrCode, setQrCode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const branchId = user?.branch_ids?.[0] ?? "";

  const checkInMutation = useMutation({
    mutationFn: (code: string) =>
      apiClient.post<CheckInResult>("/check-ins", {
        qr_code: code,
        branch_id: branchId,
        checkin_method: "qr",
      }),
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        toast.success(`${data.member_name} checked in!`);
        queryClient.invalidateQueries({ queryKey: ["recent-checkins"] });
      } else {
        toast.error(data.failure_reason || data.message || "Check-in failed");
      }
    },
    onError: (err: Error) => {
      setResult({ success: false, message: err.message });
      toast.error(err.message);
    },
  });

  const onScanSuccess = useCallback(
    (decodedText: string) => {
      // Pause scanning while processing
      if (html5QrRef.current) {
        html5QrRef.current.pause(true);
      }
      setQrCode(decodedText);
      checkInMutation.mutate(decodedText);
      // Resume after 3 seconds
      setTimeout(() => {
        if (html5QrRef.current) {
          try {
            html5QrRef.current.resume();
          } catch {
            // Scanner may have been stopped
          }
        }
      }, 3000);
    },
    [checkInMutation]
  );

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      html5QrRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {} // ignore scan errors (no QR found in frame)
      );
      setScanning(true);
    } catch {
      toast.error("Could not access camera. Please use manual input.");
    }
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
      } catch {
        // Already stopped
      }
      html5QrRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href={gymPath("/check-in")}
          className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-xl font-semibold text-foreground">QR Check-in</h1>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* Camera Scanner */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div
            id="qr-reader"
            ref={scannerRef}
            className="w-full rounded-lg overflow-hidden bg-background"
            style={{ minHeight: scanning ? "300px" : "0px" }}
          />
          {!scanning ? (
            <Button
              onClick={startScanner}
              className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Camera className="mr-2 h-4 w-4" /> Start Camera Scanner
            </Button>
          ) : (
            <Button
              onClick={stopScanner}
              variant="ghost"
              className="w-full mt-2 text-muted-foreground"
            >
              <CameraOff className="mr-2 h-4 w-4" /> Stop Scanner
            </Button>
          )}
        </div>

        {/* Manual Input Fallback */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Or enter QR code manually:
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter QR code"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              className="bg-background border-border text-foreground"
            />
            <Button
              onClick={() => checkInMutation.mutate(qrCode)}
              disabled={!qrCode || checkInMutation.isPending}
              className="bg-primary text-primary-foreground"
            >
              Check In
            </Button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`rounded-xl border p-4 flex items-center gap-3 ${
              result.success
                ? "border-primary bg-primary/10"
                : "border-destructive bg-destructive/10"
            }`}
          >
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-primary" />
            ) : (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {result.success ? "Check-in Successful" : "Check-in Failed"}
              </p>
              <p className="text-xs text-muted-foreground">
                {result.member_name || result.message}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
