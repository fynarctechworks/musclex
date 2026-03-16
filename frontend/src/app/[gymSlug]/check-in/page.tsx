"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Search, QrCode, ScanFace, WifiOff, Upload, Clock } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  useCreateCheckIn,
  useFacialCheckIn,
  useRecentCheckIns,
  useSyncCheckIns,
  offlineQueue,
  CheckinSearch,
  QRScanner,
  FaceScanner,
  CheckinResult,
  CheckinFeed,
  CapacityWidget,
  VisitAnalytics,
  EntryAlerts,
} from "@/features/checkins";
import type { CheckInResponse, EntryAlert } from "@/features/checkins";

type CheckInMode = "search" | "qr" | "face";

export default function CheckInPage() {
  const user = useAuthStore((s) => s.user);
  const branchId = user?.branch_ids?.[0] ?? "";

  const [mode, setMode] = useState<CheckInMode>("search");
  const [result, setResult] = useState<CheckInResponse | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  const createCheckIn = useCreateCheckIn();
  const facialCheckIn = useFacialCheckIn();
  const syncMutation = useSyncCheckIns();

  const { data: recentData, isLoading: feedLoading } = useRecentCheckIns(branchId, 20);
  const recentCheckIns = recentData?.data ?? [];

  // Derive analytics from recent data
  const todayCount = recentCheckIns.length;
  const peakHour = derivePeakHour(recentCheckIns);
  const returningCount = new Set(recentCheckIns.map((c) => c.member_id)).size;

  // Derive capacity (approximate from today's unique members)
  const currentInGym = new Set(
    recentCheckIns
      .filter((c) => c.status === "success")
      .map((c) => c.member_id)
  ).size;

  // Derive alerts from recent check-ins
  const alerts = deriveAlerts(recentCheckIns);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Check offline queue count
  useEffect(() => {
    offlineQueue.count().then(setOfflineCount);
  }, [result]);

  // Sync offline queue when back online
  useEffect(() => {
    if (!isOnline) return;
    offlineQueue.count().then((c) => {
      if (c > 0) {
        syncMutation.mutate(
          [],  // Will be populated by sync handler
          { onSuccess: async () => { await offlineQueue.clear(); setOfflineCount(0); } }
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleSyncOffline = async () => {
    const pending = await offlineQueue.getAll();
    if (pending.length === 0) return;
    syncMutation.mutate(
      pending.map((p) => ({
        member_id: p.member_id,
        branch_id: p.branch_id,
        checkin_method: p.checkin_method,
        checked_in_at: p.checked_in_at,
      })),
      {
        onSuccess: async () => {
          await offlineQueue.clear();
          setOfflineCount(0);
        },
      }
    );
  };

  // Manual / QR Check-in handler
  const handleCheckIn = useCallback(
    (data: { member_id?: string; qr_code?: string; branch_id: string; checkin_method: string }) => {
      if (!isOnline) {
        // Store offline
        const id = crypto.randomUUID();
        offlineQueue.add({
          id,
          member_id: data.member_id ?? "",
          member_name: "Offline check-in",
          branch_id: data.branch_id,
          checkin_method: data.checkin_method,
          checked_in_at: new Date().toISOString(),
        });
        setOfflineCount((c) => c + 1);
        toast.info("Saved offline. Will sync when connection returns.");
        return;
      }

      createCheckIn.mutate(data, {
        onSuccess: (res) => setResult(res),
      });
    },
    [createCheckIn, isOnline]
  );

  // QR scan handler
  const handleQRScan = useCallback(
    (qrCode: string) => {
      handleCheckIn({
        qr_code: qrCode,
        branch_id: branchId,
        checkin_method: "qr",
      });
    },
    [handleCheckIn, branchId]
  );

  // Face scan handler
  const handleFaceMatch = useCallback(
    (descriptor: number[]) => {
      facialCheckIn.mutate(
        { descriptor, branch_id: branchId },
        { onSuccess: (res) => setResult(res) }
      );
    },
    [facialCheckIn, branchId]
  );

  const dismissResult = useCallback(() => setResult(null), []);

  const modes: { key: CheckInMode; label: string; icon: React.ElementType }[] = [
    { key: "search", label: "Manual", icon: Search },
    { key: "qr", label: "QR Code", icon: QrCode },
    { key: "face", label: "Face ID", icon: ScanFace },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ─── Left: Check-In Panel ─── */}
        <div className="flex-1 min-w-0">
          <PageHeader
            title="Front Desk Check-In"
            description="Search, scan QR, or use Face ID"
            className="mb-4"
          />

          {/* Offline Banner */}
          {!isOnline && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5 text-yellow-400 text-sm">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>Offline mode — check-ins will sync when connection returns</span>
            </div>
          )}

          {/* Sync Pending Banner */}
          {offlineCount > 0 && isOnline && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2.5 text-blue-400 text-sm">
              <span>{offlineCount} check-in{offlineCount > 1 ? "s" : ""} pending sync</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncOffline}
                disabled={syncMutation.isPending}
                className="text-xs"
              >
                <Upload className="h-3 w-3 mr-1" /> Sync Now
              </Button>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-5">
            {modes.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all ${
                  mode === m.key
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>

          {/* Check-In Method */}
          <div className="rounded-xl border border-border bg-card p-5">
            {mode === "search" && (
              <CheckinSearch
                branchId={branchId}
                isPending={createCheckIn.isPending}
                onSubmit={handleCheckIn}
              />
            )}
            {mode === "qr" && (
              <QRScanner
                onScan={handleQRScan}
                isPending={createCheckIn.isPending}
              />
            )}
            {mode === "face" && (
              <FaceScanner
                onMatch={handleFaceMatch}
                isPending={facialCheckIn.isPending}
              />
            )}
          </div>

          {/* Entry Alerts */}
          {alerts.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">Alerts</h3>
              <EntryAlerts alerts={alerts} />
            </div>
          )}
        </div>

        {/* ─── Right: Sidebar ─── */}
        <div className="w-full lg:w-80 xl:w-96 space-y-5 shrink-0">
          {/* Capacity */}
          <CapacityWidget current={currentInGym} max={80} />

          {/* Visit Analytics */}
          <VisitAnalytics
            todayCount={todayCount}
            peakHour={peakHour}
            avgDurationMinutes={45}
            returningMembers={returningCount}
          />

          {/* Live Feed */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Check-ins
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                Live • 5s refresh
              </span>
            </h3>
            <CheckinFeed checkIns={recentCheckIns} isLoading={feedLoading} />
          </div>
        </div>
      </div>

      {/* ─── Full-screen Result Overlay ─── */}
      {result && (
        <CheckinResult result={result} onDismiss={dismissResult} />
      )}
    </AppLayout>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function derivePeakHour(checkIns: Array<{ checked_in_at: string }>): string {
  if (checkIns.length === 0) return "--";
  const hours: Record<number, number> = {};
  for (const ci of checkIns) {
    const h = new Date(ci.checked_in_at).getHours();
    hours[h] = (hours[h] || 0) + 1;
  }
  let maxH = 0;
  let maxCount = 0;
  for (const [h, count] of Object.entries(hours)) {
    if (count > maxCount) {
      maxCount = count;
      maxH = Number(h);
    }
  }
  const period = maxH >= 12 ? "PM" : "AM";
  const display = maxH === 0 ? 12 : maxH > 12 ? maxH - 12 : maxH;
  return `${display}:00 ${period}`;
}

function deriveAlerts(checkIns: Array<{ status: string; failure_reason?: string; member?: { full_name: string } }>): EntryAlert[] {
  const alerts: EntryAlert[] = [];
  const seen = new Set<string>();
  for (const ci of checkIns) {
    if (ci.failure_reason && !seen.has(ci.failure_reason)) {
      seen.add(ci.failure_reason);
      if (ci.failure_reason === "expired") {
        alerts.push({
          type: "expiring",
          severity: "danger",
          title: "Expired Membership",
          message: `${ci.member?.full_name ?? "A member"} tried to check in with expired membership`,
        });
      } else if (ci.failure_reason === "no_credits") {
        alerts.push({
          type: "balance",
          severity: "warning",
          title: "No Credits Remaining",
          message: `${ci.member?.full_name ?? "A member"} has no class credits left`,
        });
      } else if (ci.failure_reason === "wrong_branch") {
        alerts.push({
          type: "balance",
          severity: "warning",
          title: "Wrong Branch",
          message: `${ci.member?.full_name ?? "A member"} attempted check-in at wrong branch`,
        });
      }
    }
  }
  return alerts;
}
