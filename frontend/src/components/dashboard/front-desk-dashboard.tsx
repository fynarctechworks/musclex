"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ScanLine,
  Users,
  CalendarClock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader, AccessDenied, LoadingSkeleton } from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { queryKeys } from "@/services/query-client";
import { PulseCard } from "./pulse-card";
import { FreshnessPill } from "./freshness-pill";
import { ActionStack } from "./action-stack";
import type { ActionItem } from "./action-stack";
import { AdvisorDrawer } from "./advisor-drawer";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useActions } from "@/hooks/use-actions";
import { useRealtimeCheckIns } from "@/hooks/use-realtime-checkins";
import type { PulseKpis } from "@/types";

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  member_name?: string;
  member_code?: string;
  branch_name?: string;
  method?: string;
  timestamp: string;
}

/**
 * Front-Desk Compact Mode (§3.4 of the World #1 Dashboard plan).
 *
 * Drastically reduced surface — no revenue, no MRR, no churn. The desk
 * staff see what matters at the door: who's here, who's expected, who has
 * dues to collect, who's on the roster. Designed to remain fluid during
 * the 6 PM rush.
 */
export function FrontDeskDashboard() {
  const { gymPath } = useGymSlug();
  const { activeBranchId } = useAuthStore();
  const { allowed, checked } = useRequirePermission("dashboard", "view", "deny");
  const branchId = activeBranchId || undefined;
  const branchParams = branchId ? { branch_id: branchId } : undefined;

  const { data: pulse, isLoading: pulseLoading } = useQuery<PulseKpis>({
    queryKey: queryKeys.dashboard.pulse(branchId),
    queryFn: () => apiClient.get("/dashboard/pulse", { params: branchParams }),
    refetchInterval: 30_000,
  });

  const { data: activity, dataUpdatedAt: activityUpdatedAt } = useQuery<
    ActivityItem[]
  >({
    queryKey: queryKeys.dashboard.activityFeed(20, branchId),
    queryFn: () =>
      apiClient.get("/dashboard/activity-feed", {
        params: { limit: 20, ...branchParams },
      }),
    refetchInterval: 15_000,
  });

  const { latestCheckIn, checkInCount, isConnected } = useRealtimeCheckIns();

  const mergedActivity = useMemo(() => {
    const base = activity ?? [];
    if (!latestCheckIn) return base;
    const realtimeItem: ActivityItem = {
      id: latestCheckIn.id,
      type: "check_in",
      message: `New check-in via ${latestCheckIn.checkin_method}`,
      timestamp: latestCheckIn.checked_in_at,
    };
    if (base.some((i) => i.id === realtimeItem.id)) return base;
    return [realtimeItem, ...base].slice(0, 20);
  }, [activity, latestCheckIn]);

  const {
    actions: serverActions,
    isLoading: actionsLoading,
    dismiss,
    snooze,
    resolve,
  } = useActions({ branchId });

  const actions = useMemo<ActionItem[]>(
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

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="dashboard" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Front Desk"
        description="What's happening at the door right now."
        actions={
          <FreshnessPill
            asOf={pulse?.generated_at ?? activityUpdatedAt}
            staleThresholdSec={60}
          />
        }
        className="mb-6"
      />

      {/* Compact KPIs — 3 large cards instead of 6 */}
      {pulseLoading || !pulse ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <PulseCard
            label="Active Members"
            value={pulse.active_members.value.toLocaleString()}
            icon={Users}
            asOf={pulse.active_members.as_of}
            href={gymPath("/members")}
          />
          <PulseCard
            label="Check-ins Today"
            value={pulse.check_ins_today.value.toLocaleString()}
            icon={ScanLine}
            delta_pct={pulse.check_ins_today.delta_pct}
            delta_label={pulse.check_ins_today.delta_label}
            sparkline={pulse.check_ins_today.sparkline}
            asOf={pulse.check_ins_today.as_of}
            href={gymPath("/check-ins")}
            className="md:col-span-2"
          />
        </div>
      )}

      {/* Working canvas: live feed (left, big) | desk-action queue (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Live Check-ins
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isConnected ? "bg-success animate-pulse" : "bg-muted"
                  }`}
                  title={isConnected ? "Realtime connected" : "Realtime disconnected"}
                />
                {checkInCount > 0 && (
                  <span className="text-xs text-primary font-normal">
                    +{checkInCount} new
                  </span>
                )}
              </h2>
              <FreshnessPill asOf={activityUpdatedAt} staleThresholdSec={60} />
            </div>
            <div className="space-y-2 max-h-[640px] overflow-y-auto">
              {mergedActivity.length > 0 ? (
                mergedActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 rounded-md bg-background/40 border border-border/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-foreground truncate">
                        {item.member_name ?? item.message}
                      </p>
                      {item.member_code && (
                        <p className="text-[12px] text-muted-foreground truncate">
                          {item.member_code}
                          {item.method ? ` · ${item.method.replace("_", " ")}` : ""}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-3">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 bg-background/20 p-6 text-center">
                  <CalendarClock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-[13px] text-foreground">No check-ins yet today.</p>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    They'll appear here as members arrive.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <ActionStack items={actions} loading={actionsLoading} />
        </div>
      </div>

      <AdvisorDrawer
        context={{ screen: "front_desk", branch_id: branchId ?? null }}
      />
    </AppLayout>
  );
}
