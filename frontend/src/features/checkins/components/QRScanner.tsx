"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { QrCode, Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface QRScannerProps {
  onScan: (qrCode: string) => void;
  isPending: boolean;
}

export function QRScanner({ onScan, isPending }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const processingRef = useRef(false);

  const onScanSuccess = useCallback(
    (decodedText: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      // Pause scanner
      if (scannerRef.current) {
        try { scannerRef.current.pause(true); } catch {}
      }

      onScan(decodedText);

      // Resume after 3 seconds
      setTimeout(() => {
        processingRef.current = false;
        if (scannerRef.current) {
          try { scannerRef.current.resume(); } catch {}
        }
      }, 3000);
    },
    [onScan]
  );

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-scanner-view");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}
      );
      setScanning(true);
    } catch {
      toast.error("Camera access denied. Use manual QR input.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera View */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          id="qr-scanner-view"
          className="w-full bg-background"
          style={{ minHeight: scanning ? "280px" : "0px" }}
        />
        <div className="p-3">
          {!scanning ? (
            <Button
              onClick={startScanner}
              className="w-full h-12 text-base bg-primary hover:bg-primary/90"
            >
              <Camera className="h-5 w-5 mr-2" /> Start QR Scanner
            </Button>
          ) : (
            <Button
              onClick={stopScanner}
              variant="outline"
              className="w-full h-12 text-base"
            >
              <CameraOff className="h-5 w-5 mr-2" /> Stop Scanner
            </Button>
          )}
        </div>
      </div>

      {/* Manual QR Input */}
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter QR code manually..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="pl-9 h-12 bg-muted border-border"
          />
        </div>
        <Button
          type="submit"
          disabled={!manualCode.trim() || isPending}
          className="h-12 px-6 bg-primary"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
        </Button>
      </form>
    </div>
  );
}
