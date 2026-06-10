"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Search, QrCode, ScanFace, WifiOff, Upload, Clock, Command as CommandIcon, ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  useCreateCheckIn,
  useFacialCheckIn,
  useRecentCheckIns,
  useSyncCheckIns,
  useCheckInRealtime,
  offlineQueue,
  CheckinSearch,
  QRScanner,
  FaceScanner,
  CheckinResult,
  CheckinSuccessToastStack,
  CheckinFeed,
  CapacityWidget,
  VisitAnalytics,
  EntryAlerts,
  MemberHotkeyPalette,
  OverrideDialog,
  RecentMembersDock,
} from "@/features/checkins";
import type {
  CheckInResponse,
  EntryAlert,
  RecentMember,
  SuccessToastItem,
} from "@/features/checkins";
import { lookupDenial } from "@/features/checkins/denial-catalog";

type CheckInMode = "search" | "qr" | "face";

export default function CheckInPage() {
  const { allowed, checked } = useRequirePermission("check_ins", "view", "deny");
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchId = activeBranchId || (user?.branch_ids?.[0] ?? "");

  const [mode, setMode] = useState<CheckInMode>("search");
  // `result` holds DENIALS only — successes stream into `successToasts`
  // so reception isn't blocked by a full-screen overlay between scans.
  const [result, setResult] = useState<CheckInResponse | null>(null);
  const [successToasts, setSuccessToasts] = useState<SuccessToastItem[]>([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Override dialog state — populated when the orchestrator returns
  // `severity: 'overridable'` and the user has the override permission.
  const [overrideTarget, setOverrideTarget] = useState<{
    member_id: string;
    member_name: string | null;
    denial_reason: string;
    denial_message: string;
    last_input: {
      member_id?: string;
      qr_code?: string;
      branch_id: string;
      checkin_method: string;
    };
  } | null>(null);

  const canOverride = user?.permission_codes?.includes('check_ins.override') ?? false;

  const createCheckIn = useCreateCheckIn();
  const facialCheckIn = useFacialCheckIn();
  const syncMutation = useSyncCheckIns();

  const { status: realtimeStatus, isLive } = useCheckInRealtime({
    branchId: branchId || null,
    enabled: Boolean(branchId),
  });

  const { data: recentData, isLoading: feedLoading } = useRecentCheckIns(branchId, 20, {
    realtimeActive: isLive,
  });
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

  // Successes push into a small toast stack instead of opening the
  // full-screen overlay; the operator's hands stay free to scan the next
  // person. Cap visible to 3 — older successes are still in the live feed.
  const pushSuccessToast = useCallback((res: CheckInResponse, method: string) => {
    setSuccessToasts((prev) => {
      const next: SuccessToastItem = {
        id: res.check_in?.id ?? crypto.randomUUID(),
        member_name: res.member_name ?? res.check_in?.member?.full_name ?? null,
        member_code: res.member_code ?? res.check_in?.member?.member_code ?? null,
        membership_status: res.membership_status ?? null,
        membership_end_date: res.membership_end_date ?? null,
        membership_days_remaining: res.membership_days_remaining ?? null,
        membership_plan_name: res.membership_plan_name ?? null,
        method,
        checked_in_at: res.check_in?.checked_in_at ?? new Date().toISOString(),
      };
      return [next, ...prev].slice(0, 3);
    });
  }, []);

  const dismissSuccessToast = useCallback((id: string) => {
    setSuccessToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Manual / QR Check-in handler. Wraps the mutation so we can intercept
  // 'overridable' denials and offer staff with the override permission a
  // chance to force-allow with a written reason.
  const handleCheckIn = useCallback(
    (data: { member_id?: string; qr_code?: string; branch_id: string; checkin_method: string }) => {
      if (!isOnline) {
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
        onSuccess: (res: CheckInResponse) => {
          // Surface the overridable denial via OverrideDialog instead of
          // the regular full-screen result overlay.
          if (
            res &&
            res.success === false &&
            (res as { severity?: string }).severity === 'overridable' &&
            canOverride
          ) {
            setOverrideTarget({
              member_id: data.member_id ?? '',
              member_name: (res as { member_name?: string }).member_name ?? null,
              denial_reason: (res as { failure_reason?: string }).failure_reason ?? 'denied',
              denial_message: (res as { message?: string }).message ?? 'Check-in denied',
              last_input: data,
            });
            return;
          }
          // Successes → toast stack; denials → full-screen modal so the
          // operator reads the "why" and any actionable next step.
          if (res.success) {
            pushSuccessToast(res, data.checkin_method);
          } else {
            setResult(res);
          }
        },
      });
    },
    [createCheckIn, isOnline, canOverride, pushSuccessToast]
  );

  // Confirm override → re-send the same input with override flags set.
  const handleOverrideConfirm = useCallback(
    (reason: string) => {
      if (!overrideTarget) return;
      createCheckIn.mutate(
        {
          ...overrideTarget.last_input,
          override_authorized: true,
          override_reason: reason,
        },
        {
          onSuccess: (res: CheckInResponse) => {
            setOverrideTarget(null);
            // An override that succeeded is still a success — show it as
            // a toast (not a blocking overlay) so the desk keeps moving.
            if (res.success) {
              pushSuccessToast(res, overrideTarget.last_input.checkin_method);
            } else {
              setResult(res);
            }
          },
        }
      );
    },
    [createCheckIn, overrideTarget, pushSuccessToast]
  );

  // Cmd-K palette pick → trigger manual check-in.
  const handlePalettePick = useCallback(
    (m: { id: string; full_name: string; member_code: string }) => {
      if (!branchId) {
        toast.error('Select a branch first.');
        return;
      }
      handleCheckIn({
        member_id: m.id,
        branch_id: branchId,
        checkin_method: 'manual',
      });
    },
    [handleCheckIn, branchId]
  );

  // Recent-member dock pick → repeat last check-in.
  const handleRecentPick = useCallback(
    (m: RecentMember) => {
      if (!branchId) return;
      handleCheckIn({
        member_id: m.member_id,
        branch_id: branchId,
        checkin_method: 'manual',
      });
    },
    [handleCheckIn, branchId]
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
        {
          onSuccess: (res) => {
            if (res.success) {
              pushSuccessToast(res, 'facial');
            } else {
              setResult(res);
            }
          },
        }
      );
    },
    [facialCheckIn, branchId, pushSuccessToast]
  );

  const dismissResult = useCallback(() => setResult(null), []);

  // ── Global keyboard shortcuts ────────────────────────────────
  // Cmd/Ctrl-K: open palette
  // Q / M / F: switch mode (only when no input is focused)
  // Esc: dismiss result overlay or close palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      if (e.key === 'Escape') {
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (result) {
          setResult(null);
          return;
        }
      }

      if (inField) return;

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setMode('qr');
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setMode('search');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setMode('face');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, result]);

  // Derive recent members from the live feed for the quick-repeat dock.
  const recentMembers = useMemo<RecentMember[]>(() => {
    return recentCheckIns
      .filter((c) => c.status === 'success' && c.member?.full_name)
      .map((c) => ({
        member_id: c.member_id,
        full_name: c.member!.full_name,
        member_code: c.member!.member_code ?? '',
        profile_photo_url: c.member?.profile_photo_url ?? null,
        last_seen_at: c.checked_in_at,
      }));
  }, [recentCheckIns]);

  const modes: { key: CheckInMode; label: string; icon: React.ElementType; shortcut: string }[] = [
    { key: "search", label: "Manual", icon: Search, shortcut: "M" },
    { key: "qr", label: "QR Code", icon: QrCode, shortcut: "Q" },
    { key: "face", label: "Face ID", icon: ScanFace, shortcut: "F" },
  ];

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="check_ins" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ─── Left: Check-In Panel ─── */}
        <div className="flex-1 min-w-0">
          <div className="mb-4 flex items-start justify-between gap-4">
            <PageHeader
              title="Front Desk Check-In"
              description="Search, scan QR, or use Face ID"
              className=""
            />
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
              >
                <CommandIcon className="h-3.5 w-3.5" />
                Quick search
                <kbd className="ml-1 hidden sm:inline rounded-sm border border-hairline bg-canvas-soft-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!branchId) {
                    toast.error('Select a branch first.');
                    return;
                  }
                  window.open(`/kiosk/${branchId}`, '_blank', 'noopener,noreferrer');
                }}
                disabled={!branchId}
                title="Open the full-screen Gate Scanner in a new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Gate Scanner
              </Button>
            </div>
          </div>

          {/* Offline Banner */}
          {!isOnline && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-4 py-2.5 text-warning-deep text-sm">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>Offline mode — check-ins will sync when connection returns</span>
            </div>
          )}

          {/* Sync Pending Banner */}
          {offlineCount > 0 && isOnline && (
            <div className="mb-4 flex items-center justify-between rounded-md border border-link/30 bg-link-soft px-4 py-2.5 text-link-deep text-sm">
              <span>{offlineCount} check-in{offlineCount > 1 ? "s" : ""} pending sync</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncOffline}
                disabled={syncMutation.isPending}
              >
                <Upload className="h-3 w-3" /> Sync Now
              </Button>
            </div>
          )}

          {/* Mode Tabs — Design.md tab-ghost pattern */}
          <div className="flex gap-2 mb-5">
            {modes.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-2 px-4 h-10 rounded-md text-sm font-medium transition-colors ${
                  mode === m.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-hairline text-muted-foreground hover:text-foreground hover:bg-canvas-soft"
                }`}
                title={`Shortcut: ${m.shortcut}`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
                <kbd
                  aria-hidden="true"
                  className={`hidden md:inline ml-1 rounded-sm border px-1.5 py-0 font-mono text-[10px] ${
                    mode === m.key
                      ? "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground"
                      : "border-hairline bg-canvas-soft text-muted-foreground"
                  }`}
                >
                  {m.shortcut}
                </kbd>
              </button>
            ))}
          </div>

          {/* Recent Members Dock — one-tap repeat for the most recent check-ins */}
          {recentMembers.length > 0 && (
            <div className="mb-5">
              <RecentMembersDock members={recentMembers} onPick={handleRecentPick} />
            </div>
          )}

          {/* Check-In Method */}
          <div className="rounded-lg border border-hairline bg-card p-5 shadow-level-2">
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
          {/* Capacity — `max` is 0 until branch.max_capacity is wired
              up; the widget renders an honest "set capacity" CTA. */}
          <CapacityWidget current={currentInGym} max={0} />

          {/* Visit Analytics — avgDurationMinutes is null until we capture
              exit times; the widget renders "—" instead of fake data. */}
          <VisitAnalytics
            todayCount={todayCount}
            peakHour={peakHour}
            avgDurationMinutes={null}
            returningMembers={returningCount}
          />

          {/* Live Feed */}
          <div className="rounded-lg border border-hairline bg-card p-4 shadow-level-2">
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Check-ins
              <RealtimeStatusBadge status={realtimeStatus} />
            </h3>
            <CheckinFeed checkIns={recentCheckIns} isLoading={feedLoading} />
          </div>
        </div>
      </div>

      {/* ─── Non-blocking Success Toast Stack ─── */}
      <CheckinSuccessToastStack
        items={successToasts}
        onDismiss={dismissSuccessToast}
      />

      {/* ─── Full-screen Result Overlay (denials only) ─── */}
      {result && (
        <CheckinResult result={result} onDismiss={dismissResult} />
      )}

      {/* ─── Cmd-K Member Palette ─── */}
      <MemberHotkeyPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        branchId={branchId}
        onPick={handlePalettePick}
      />

      {/* ─── Override Dialog (permission-gated) ─── */}
      <OverrideDialog
        open={!!overrideTarget}
        onOpenChange={(open) => {
          if (!open) setOverrideTarget(null);
        }}
        denialReason={overrideTarget?.denial_reason ?? null}
        denialMessage={overrideTarget?.denial_message ?? null}
        memberName={overrideTarget?.member_name ?? null}
        canOverride={canOverride}
        onConfirm={handleOverrideConfirm}
        isSubmitting={createCheckIn.isPending}
      />
    </AppLayout>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function RealtimeStatusBadge({ status }: { status: string }) {
  const isLive = status === 'connected';
  const isConnecting = status === 'connecting';
  const isError = status === 'error' || status === 'disconnected';

  const dotClass = isLive
    ? 'bg-success animate-pulse'
    : isConnecting
    ? 'bg-warning animate-pulse'
    : isError
    ? 'bg-error'
    : 'bg-hairline-strong';

  const label = isLive
    ? 'Live'
    : isConnecting
    ? 'Connecting…'
    : isError
    ? 'Reconnecting…'
    : 'Idle';

  return (
    <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
      <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

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

/**
 * Builds the right-rail alerts list from the live feed. Sources every
 * piece of copy from the shared denial catalog, so the alert pane,
 * the result overlay, the kiosk denial screen, and the override dialog
 * all speak the same language.
 *
 * Bug fix: the rule engine emits `membership_expired`, not `expired` —
 * the prior implementation matched the wrong code and never surfaced
 * the most common alert.
 */
function deriveAlerts(
  checkIns: Array<{
    status: string;
    failure_reason?: string;
    member?: { full_name: string };
  }>,
): EntryAlert[] {
  const alerts: EntryAlert[] = [];
  const seen = new Set<string>();

  for (const ci of checkIns) {
    if (!ci.failure_reason || seen.has(ci.failure_reason)) continue;
    seen.add(ci.failure_reason);

    const entry = lookupDenial(ci.failure_reason);
    const who = ci.member?.full_name ?? "A member";

    alerts.push({
      type: alertTypeFor(ci.failure_reason),
      severity: alertSeverityFor(entry.severity),
      title: entry.title,
      message: `${who} — ${entry.headline}`,
    });
  }

  return alerts;
}

function alertTypeFor(reason: string): EntryAlert["type"] {
  if (reason.startsWith("membership_") || reason === "no_active_membership") return "expiring";
  if (reason === "no_credits") return "balance";
  return "balance";
}

function alertSeverityFor(s: ReturnType<typeof lookupDenial>["severity"]): EntryAlert["severity"] {
  if (s === "block") return "danger";
  if (s === "warn") return "warning";
  return "info";
}
