"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  IndianRupee,
  Receipt,
  ScanLine,
  TrendingUp,
  Users,
  WifiOff,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied, LoadingSkeleton } from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { queryKeys } from "@/services/query-client";
import { PulseCard } from "./pulse-card";
import { PulseCarousel } from "./pulse-carousel";
import { SwipeableActionRow } from "./swipeable-action-row";
import { BriefingCard } from "./briefing-card";
import { AdvisorDrawer } from "./advisor-drawer";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useActions } from "@/hooks/use-actions";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  OfflineCacheKeys,
  offlineGet,
  offlineSet,
  type CachedPayload,
} from "@/lib/offline-cache";
import type { PulseKpis } from "@/types";

/**
 * Mobile Decision Instrument — Wave 6 of the World #1 Dashboard plan.
 *
 * Not a shrunken desktop. The Action Stack is the *primary* surface; the
 * Pulse becomes a swipeable carousel; the AI advisor is one tap away.
 * Cached in IndexedDB so the app loads instantly even on flaky 4G —
 * staleness is shown honestly, never hidden.
 */
export function MobileDashboard() {
  const { gymPath } = useGymSlug();
  const { user, activeBranchId } = useAuthStore();
  const { allowed, checked } = useRequirePermission("dashboard", "view", "deny");
  const { online } = useOnlineStatus();

  const branchId = activeBranchId || undefined;
  const branchParams = branchId ? { branch_id: branchId } : undefined;

  // ── Pulse with offline mirror ────────────────────────────────────
  const [cachedPulse, setCachedPulse] = useState<CachedPayload<PulseKpis> | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    offlineGet<PulseKpis>(OfflineCacheKeys.pulse(branchId)).then((c) => {
      if (live) setCachedPulse(c);
    });
    return () => {
      live = false;
    };
  }, [branchId]);

  const {
    data: pulse,
    isLoading: pulseLoading,
  } = useQuery<PulseKpis>({
    queryKey: queryKeys.dashboard.pulse(branchId),
    queryFn: async () => {
      const data = await apiClient.get<PulseKpis>("/dashboard/pulse", {
        params: branchParams,
      });
      offlineSet(OfflineCacheKeys.pulse(branchId), data);
      return data;
    },
    refetchInterval: online ? 60_000 : false,
    retry: online ? 1 : 0,
    initialData: cachedPulse?.data,
  });

  const {
    actions: serverActions,
    isLoading: actionsLoading,
    dismiss,
    snooze,
    resolve,
  } = useActions({ branchId });

  const actions = useMemo(
    () =>
      serverActions.map((a) => ({
        ...a,
        cta_href: a.cta_href ? gymPath(a.cta_href) : undefined,
        on_dismiss: dismiss,
        on_snooze: snooze,
        on_resolve: resolve,
      })),
    [serverActions, dismiss, snooze, resolve, gymPath],
  );

  // Persist actions for offline view
  useEffect(() => {
    if (serverActions && serverActions.length > 0) {
      offlineSet(OfflineCacheKeys.actions(branchId), serverActions);
    }
  }, [serverActions, branchId]);

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="dashboard" />
      </AppLayout>
    );
  }

  const showOfflineBanner = !online && cachedPulse;
  const cacheAgeMin = cachedPulse
    ? Math.max(0, Math.round((Date.now() - cachedPulse.ts) / 60000))
    : 0;
  const currency = "₹";

  return (
    <AppLayout>
      {/* Sticky header — branch + freshness */}
      <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 px-4 pt-4 pb-2 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[16px] font-semibold text-foreground">Today</h1>
          <span className="text-[11px] text-muted-foreground">
            {user?.full_name?.split(" ")[0] ?? ""}
          </span>
        </div>
        {showOfflineBanner && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-500">
            <WifiOff className="h-3 w-3" />
            Offline — last synced {cacheAgeMin}m ago
          </div>
        )}
      </div>

      {/* Briefing — collapsed thin card on mobile */}
      <BriefingCard branchId={branchId} className="mb-4" />

      {/* Pulse Carousel */}
      {pulseLoading || !pulse ? (
        <LoadingSkeleton className="h-40 mb-5" />
      ) : (
        <div className="mb-5">
          <PulseCarousel>
            {[
              <PulseCard
                key="active_members"
                label="Active Members"
                value={pulse.active_members.value.toLocaleString()}
                icon={Users}
                delta_pct={pulse.active_members.delta_pct}
                delta_label={pulse.active_members.delta_label}
                sparkline={pulse.active_members.sparkline}
                asOf={pulse.active_members.as_of}
                href={gymPath("/members")}
                className="h-full"
              />,
              <PulseCard
                key="today_revenue"
                label="Today's Revenue"
                value={`${currency}${pulse.today_revenue.value.toLocaleString()}`}
                icon={IndianRupee}
                delta_pct={pulse.today_revenue.delta_pct}
                delta_label={pulse.today_revenue.delta_label}
                sparkline={pulse.today_revenue.sparkline}
                asOf={pulse.today_revenue.as_of}
                href={gymPath("/payments")}
                className="h-full"
              />,
              <PulseCard
                key="mrr"
                label="MRR"
                value={`${currency}${pulse.mrr.value.toLocaleString()}`}
                icon={TrendingUp}
                delta_pct={pulse.mrr.delta_pct}
                delta_label={pulse.mrr.delta_label}
                sparkline={pulse.mrr.sparkline}
                asOf={pulse.mrr.as_of}
                href={gymPath("/memberships")}
                className="h-full"
              />,
              <PulseCard
                key="check_ins_today"
                label="Check-ins Today"
                value={pulse.check_ins_today.value.toLocaleString()}
                icon={ScanLine}
                delta_pct={pulse.check_ins_today.delta_pct}
                delta_label={pulse.check_ins_today.delta_label}
                sparkline={pulse.check_ins_today.sparkline}
                asOf={pulse.check_ins_today.as_of}
                href={gymPath("/check-ins")}
                className="h-full"
              />,
              <PulseCard
                key="renewals_at_risk"
                label="Renewals at Risk"
                value={pulse.renewals_at_risk_7d.value.toLocaleString()}
                icon={CalendarClock}
                positiveIs="bad"
                subtitle={
                  pulse.renewals_at_risk_7d.value_at_stake > 0
                    ? `${currency}${pulse.renewals_at_risk_7d.value_at_stake.toLocaleString()} at stake`
                    : "next 7 days"
                }
                asOf={pulse.renewals_at_risk_7d.as_of}
                href={gymPath("/members?filter=expiring_7d")}
                className="h-full"
              />,
              <PulseCard
                key="outstanding_dues"
                label="Outstanding Dues"
                value={`${currency}${pulse.outstanding_dues.value.toLocaleString()}`}
                icon={Receipt}
                positiveIs="bad"
                subtitle={
                  pulse.outstanding_dues.invoice_count > 0
                    ? `${pulse.outstanding_dues.invoice_count} invoice${pulse.outstanding_dues.invoice_count === 1 ? "" : "s"}`
                    : "all collected"
                }
                asOf={pulse.outstanding_dues.as_of}
                href={gymPath("/payments?status=pending")}
                className="h-full"
              />,
            ]}
          </PulseCarousel>
        </div>
      )}

      {/* Action Stack — primary screen on mobile, full-bleed list */}
      <div className="mb-24">
        <h2 className="text-[14px] font-semibold text-foreground mb-2">
          Do this next
        </h2>
        <p className="text-[11px] text-muted-foreground mb-3">
          Swipe right to resolve, left to snooze.
        </p>
        {actionsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-muted/20 animate-pulse"
              />
            ))}
          </div>
        ) : actions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-[14px] text-foreground font-medium">
              You're clear.
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              New actions appear here as renewals approach or payments fail.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {actions.map((a) => (
              <SwipeableActionRow key={a.id} item={a} />
            ))}
          </ul>
        )}
      </div>

      <AdvisorDrawer
        context={{
          screen: "mobile_dashboard",
          branch_id: branchId ?? null,
          role: user?.role,
        }}
      />
    </AppLayout>
  );
}
