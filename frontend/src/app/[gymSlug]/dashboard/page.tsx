"use client";

import { useState, type ReactNode } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { cn } from "@/lib/utils";
import { PageHeader, AccessDenied, LoadingSkeleton } from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { apiClient } from "@/lib/api";
import { Branch, PulseKpis } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { queryKeys } from "@/services/query-client";
import {
  Users,
  IndianRupee,
  TrendingUp,
  Activity,
  ArrowRight,
  CalendarClock,
  ScanLine,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { PulseCard } from "@/components/dashboard/pulse-card";
import { FreshnessPill } from "@/components/dashboard/freshness-pill";
import { ActionStack } from "@/components/dashboard/action-stack";
import type { ActionItem } from "@/components/dashboard/action-stack";
import { FrontDeskDashboard } from "@/components/dashboard/front-desk-dashboard";
import { TrainerCockpit } from "@/components/dashboard/trainer-cockpit";
import { MobileDashboard } from "@/components/dashboard/mobile-dashboard";
import { BriefingCard } from "@/components/dashboard/briefing-card";
import { AdvisorDrawer } from "@/components/dashboard/advisor-drawer";
import {
  KpiInspector,
  type InspectableMetric,
} from "@/components/dashboard/kpi-inspector";
import { useActions } from "@/hooks/use-actions";
import { useRoleView } from "@/hooks/use-role-view";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useRestatements } from "@/hooks/use-restatements";
import { useTelemetry, useMountEvent } from "@/hooks/use-telemetry";
import { useRealtimeCheckIns } from "@/hooks/use-realtime-checkins";
// Wave 8–14 dashboard upgrade
import { DashboardFilterProvider } from "@/components/dashboard/dashboard-filter-context";
import { DashboardFilterBar } from "@/components/dashboard/dashboard-filter-bar";
import { OccupancyGauge } from "@/components/dashboard/occupancy-gauge";
import { TodaysClassesTile } from "@/components/dashboard/todays-classes-tile";
import { RevenueMixTile } from "@/components/dashboard/revenue-mix-tile";
import { PaymentMethodTile } from "@/components/dashboard/payment-method-tile";
import { RevenueSummaryTile } from "@/components/dashboard/revenue-summary-tile";
import { RetentionCurveTile } from "@/components/dashboard/retention-curve-tile";
import { SegmentTile } from "@/components/dashboard/segment-tile";
import { BusinessMetricsTile } from "@/components/dashboard/business-metrics-tile";
import { HeatmapTile } from "@/components/dashboard/heatmap-tile";
import { InventoryTile } from "@/components/dashboard/inventory-tile";
import { StatusBar } from "@/components/dashboard/status-bar";
import { DashboardCustomizer } from "@/components/dashboard/dashboard-customizer";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";

interface RevenueDataPoint {
  month: string;
  revenue: number;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export default function DashboardPage() {
  // Mobile / role-rendered shell selection.
  //   §14: mobile is a different product, not a shrunken desktop.
  //   §3:  five role variants — owner/manager/trainer/front-desk.
  // Server enforces the visibility matrix; this only picks which layout.
  const { view } = useRoleView();
  const isMobile = useIsMobile();

  if (isMobile && (view === "owner" || view === "manager")) {
    return <MobileDashboard />;
  }
  if (view === "front_desk") return <FrontDeskDashboard />;
  if (view === "trainer") return <TrainerCockpit />;
  return (
    <DashboardFilterProvider>
      <OwnerManagerDashboard />
    </DashboardFilterProvider>
  );
}

function OwnerManagerDashboard() {
  const { gymPath } = useGymSlug();
  const { user, activeBranchId } = useAuthStore();
  const isOwner = user?.role === "owner";
  const { allowed, checked } = useRequirePermission("dashboard", "view", "deny");
  const [inspectMetric, setInspectMetric] = useState<InspectableMetric | null>(
    null,
  );
  useMountEvent("dashboard.owner.viewed");
  useTelemetry();

  const branchId = activeBranchId || undefined;
  const branchParams = branchId ? { branch_id: branchId } : undefined;
  const restatements = useRestatements(branchId);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: queryKeys.branches.all,
    queryFn: () => apiClient.get("/branches"),
    enabled: isOwner,
  });

  // ── Pulse Strip — 6 canonical KPIs ────────────────────────────
  const {
    data: pulse,
    isLoading: pulseLoading,
    dataUpdatedAt: pulseUpdatedAt,
  } = useQuery<PulseKpis>({
    queryKey: queryKeys.dashboard.pulse(branchId),
    queryFn: () => apiClient.get("/dashboard/pulse", { params: branchParams }),
    refetchInterval: 60_000,
  });

  const {
    data: setupStatus,
  } = useQuery<{
    has_branches: boolean;
    has_plans: boolean;
    has_members: boolean;
    has_staff: boolean;
    has_classes: boolean;
    has_gym_setup: boolean;
  }>({
    queryKey: ["setup-status", branchId ?? "all"],
    queryFn: () =>
      apiClient.get("/dashboard/setup-status", { params: branchParams }),
    enabled: isOwner,
    staleTime: 60_000,
  });

  const { data: revenueData, dataUpdatedAt: revenueUpdatedAt } = useQuery<
    RevenueDataPoint[]
  >({
    queryKey: queryKeys.dashboard.revenueChart(6, branchId),
    queryFn: () =>
      apiClient.get("/dashboard/revenue-chart", {
        params: { months: 6, ...branchParams },
      }),
  });

  const { data: activity, dataUpdatedAt: activityUpdatedAt } = useQuery<
    ActivityItem[]
  >({
    queryKey: queryKeys.dashboard.activityFeed(10, branchId),
    queryFn: () =>
      apiClient.get("/dashboard/activity-feed", {
        params: { limit: 10, ...branchParams },
      }),
  });

  const { latestCheckIn, checkInCount, isConnected } = useRealtimeCheckIns();

  const {
    actions: serverActions,
    isLoading: actionsLoading,
    dismiss: dismissAction,
    snooze: snoozeAction,
    resolve: resolveAction,
  } = useActions({ branchId });

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
    return [realtimeItem, ...base].slice(0, 10);
  }, [activity, latestCheckIn]);

  const actions = useMemo<ActionItem[]>(
    () =>
      serverActions.map((a) => ({
        ...a,
        cta_href: a.cta_href ? gymPath(a.cta_href) : undefined,
        on_dismiss: dismissAction,
        on_snooze: snoozeAction,
        on_resolve: resolveAction,
      })),
    [serverActions, dismissAction, snoozeAction, resolveAction, gymPath],
  );

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="dashboard" />
      </AppLayout>
    );
  }

  const currency = "₹";

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        description={
          activeBranchId
            ? `Showing data for ${branches?.find((b) => b.id === activeBranchId)?.name ?? "selected branch"}`
            : "Here's what's happening at your studio today."
        }
        actions={
          <div className="flex items-center gap-3">
            <FreshnessPill asOf={pulse?.generated_at ?? pulseUpdatedAt} />
            <Link
              href={gymPath("/dashboard/branches")}
              className="text-sm font-medium text-link hover:text-link-deep flex items-center gap-1 transition-colors"
            >
              Branch Comparison <ArrowRight className="w-4 h-4" />
            </Link>
            <DashboardCustomizer />
          </div>
        }
        className="mb-6"
      />

      {/* Wave 8 — Universal filter bar */}
      <DashboardFilterBar />

      {/* Daily AI Briefing (Wave 5) */}
      <BriefingCard branchId={branchId} />

      {/* Pulse Strip — 6 canonical KPIs */}
      {pulseLoading || !pulse ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <PulseCard
            label="Active Members"
            value={pulse.active_members.value.toLocaleString()}
            icon={Users}
            delta_pct={pulse.active_members.delta_pct}
            delta_label={pulse.active_members.delta_label}
            sparkline={pulse.active_members.sparkline}
            asOf={pulse.active_members.as_of}
            href={gymPath("/members")}
            on_inspect={() => setInspectMetric("active_members")}
            restatement={restatements.get("active_members")}
          />
          <PulseCard
            label="Today's Revenue"
            value={`${currency}${pulse.today_revenue.value.toLocaleString()}`}
            icon={IndianRupee}
            delta_pct={pulse.today_revenue.delta_pct}
            delta_label={pulse.today_revenue.delta_label}
            subtitle={
              pulse.today_revenue.delta_abs !== null && pulse.today_revenue.delta_abs !== 0
                ? `${pulse.today_revenue.delta_abs >= 0 ? "+" : "−"}${currency}${Math.abs(
                    pulse.today_revenue.delta_abs,
                  ).toLocaleString()} ${pulse.today_revenue.delta_label}`
                : pulse.today_revenue.delta_label
            }
            sparkline={pulse.today_revenue.sparkline}
            asOf={pulse.today_revenue.as_of}
            href={gymPath("/payments")}
            on_inspect={() => setInspectMetric("today_revenue")}
            restatement={restatements.get("today_revenue")}
          />
          <PulseCard
            label="MRR"
            value={`${currency}${pulse.mrr.value.toLocaleString()}`}
            icon={TrendingUp}
            delta_pct={pulse.mrr.delta_pct}
            delta_label={pulse.mrr.delta_label}
            subtitle="Monthly recurring revenue"
            sparkline={pulse.mrr.sparkline}
            asOf={pulse.mrr.as_of}
            href={gymPath("/memberships")}
            on_inspect={() => setInspectMetric("mrr")}
            restatement={restatements.get("mrr")}
          />
          <PulseCard
            label="Check-ins Today"
            value={pulse.check_ins_today.value.toLocaleString()}
            icon={ScanLine}
            delta_pct={pulse.check_ins_today.delta_pct}
            delta_label={pulse.check_ins_today.delta_label}
            subtitle={pulse.check_ins_today.delta_label}
            sparkline={pulse.check_ins_today.sparkline}
            asOf={pulse.check_ins_today.as_of}
            href={gymPath("/check-ins")}
            on_inspect={() => setInspectMetric("check_ins_today")}
            restatement={restatements.get("check_ins_today")}
          />
          <PulseCard
            label="Renewals at Risk"
            value={pulse.renewals_at_risk_7d.value.toLocaleString()}
            icon={CalendarClock}
            positiveIs="bad"
            subtitle={
              pulse.renewals_at_risk_7d.value_at_stake > 0
                ? `${currency}${pulse.renewals_at_risk_7d.value_at_stake.toLocaleString()} at stake · next 7 days`
                : "next 7 days"
            }
            asOf={pulse.renewals_at_risk_7d.as_of}
            href={gymPath("/members?filter=expiring_7d")}
            on_inspect={() => setInspectMetric("renewals_at_risk_7d")}
            restatement={restatements.get("renewals_at_risk_7d")}
          />
          <PulseCard
            label="Outstanding Dues"
            value={`${currency}${pulse.outstanding_dues.value.toLocaleString()}`}
            icon={Receipt}
            positiveIs="bad"
            subtitle={
              pulse.outstanding_dues.invoice_count > 0
                ? `${pulse.outstanding_dues.invoice_count} invoice${pulse.outstanding_dues.invoice_count === 1 ? "" : "s"}${
                    pulse.outstanding_dues.oldest_age_days > 0
                      ? ` · oldest ${pulse.outstanding_dues.oldest_age_days}d`
                      : ""
                  }`
                : "all collected"
            }
            asOf={pulse.outstanding_dues.as_of}
            href={gymPath("/payments?status=pending")}
            on_inspect={() => setInspectMetric("outstanding_dues")}
            restatement={restatements.get("outstanding_dues")}
          />
        </div>
      )}

      {isOwner && (
        <SetupChecklist
          gymPath={gymPath}
          hasBranches={setupStatus?.has_branches ?? false}
          hasMembers={setupStatus?.has_members ?? false}
          hasPlans={setupStatus?.has_plans ?? false}
          hasGymSetup={setupStatus?.has_gym_setup ?? false}
        />
      )}

      {/* Working canvas — section heading establishes the second visual zone. */}
      <header className="mt-design-2xl mb-4 flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Today
        </h2>
        <p className="text-xs text-muted-foreground">
          Action queue and trailing activity
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1">
          <ActionStack items={actions} loading={actionsLoading} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-hairline rounded-lg p-5 shadow-level-2 transition-shadow hover:shadow-level-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-canvas-soft-2 text-foreground">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-[-0.01em] leading-tight text-foreground truncate">
                    Revenue Trend
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Last 6 months of paid revenue
                  </p>
                </div>
              </div>
              <FreshnessPill asOf={revenueUpdatedAt} staleThresholdSec={3600} />
            </div>
            <div className="h-64">
              {revenueData && revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No revenue data yet
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-hairline rounded-lg p-5 shadow-level-2 transition-shadow hover:shadow-level-3">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-canvas-soft-2 text-foreground">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-[-0.01em] leading-tight text-foreground flex items-center gap-2 truncate">
                    Recent Activity
                    <span
                      className={cn(
                        "inline-block w-2 h-2 rounded-full shrink-0",
                        isConnected ? "bg-success animate-pulse" : "bg-hairline-strong"
                      )}
                      title={
                        isConnected
                          ? "Realtime connected"
                          : "Realtime disconnected"
                      }
                    />
                    {checkInCount > 0 && (
                      <span className="text-xs text-link font-medium">
                        +{checkInCount} new
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Latest check-ins streamed live
                  </p>
                </div>
              </div>
              <FreshnessPill asOf={activityUpdatedAt} />
            </div>
            <div className="space-y-1">
              {mergedActivity.length > 0 ? (
                mergedActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b border-hairline last:border-0"
                  >
                    <p className="text-sm text-foreground">
                      {item.message}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4 tabular-nums">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recent activity
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wave 8–14 — Personalizable Tile Grid */}
      <DashboardTileGrid
        branchId={branchId}
        onInspect={(m) => setInspectMetric(m)}
        gymPath={gymPath}
      />

      {/* Wave 13 — System Status Bar (sticky bottom) */}
      <div className="mt-8">
        <StatusBar />
      </div>

      <AdvisorDrawer
        context={{
          screen: "dashboard",
          branch_id: branchId ?? null,
          role: user?.role,
        }}
      />

      {inspectMetric && (
        <KpiInspector
          metric={inspectMetric}
          branchId={branchId}
          onClose={() => setInspectMetric(null)}
        />
      )}
    </AppLayout>
  );
}

/**
 * Wave 8–14 — Personalizable working-canvas tile grid.
 *
 * Honors the user's saved layout (visibility, order, size). Falls back to
 * role-default layout when no saved layout exists. Pulse Strip + Action Stack
 * stay outside this grid and are not customizable (sacred per plan §3.1).
 */
type InspectableMetricKey =
  | "active_members"
  | "today_revenue"
  | "mrr"
  | "check_ins_today"
  | "renewals_at_risk_7d"
  | "outstanding_dues";

interface TileGridProps {
  branchId?: string;
  onInspect: (metric: InspectableMetricKey) => void;
  gymPath: (path: string) => string;
}

type SegmentKey =
  | "high_value"
  | "frequent_visitors"
  | "recently_joined"
  | "low_engagement"
  | "inactive"
  | "recently_cancelled";

const SEGMENT_CONFIG: Array<{
  key: SegmentKey;
  title: string;
  description: string;
  tone: "good" | "bad" | "neutral";
}> = [
  { key: "high_value", title: "High-Value Members", description: "Top 10% by lifetime revenue", tone: "good" },
  { key: "frequent_visitors", title: "Frequent Visitors", description: "≥4 check-ins per week (last 30d)", tone: "good" },
  { key: "recently_joined", title: "Recently Joined", description: "Signed up in the last 14 days", tone: "neutral" },
  { key: "low_engagement", title: "Low Engagement", description: "<2 check-ins in last 30 days", tone: "bad" },
  { key: "inactive", title: "Inactive Members", description: "0 check-ins in last 21 days", tone: "bad" },
  { key: "recently_cancelled", title: "Recently Cancelled", description: "Cancelled in last 30 days", tone: "bad" },
];

function DashboardTileGrid({ branchId, onInspect: _onInspect, gymPath: _gymPath }: TileGridProps) {
  const { layout } = useDashboardLayout();
  const tiles = layout?.tiles ?? [];
  const visible = tiles.filter((t) => t.visible);

  // Segment data is shared across 6 SegmentTile instances — fetch once.
  const { data: segments, isLoading: segmentsLoading } = useQuery<
    import("@/types").SegmentsResponse
  >({
    queryKey: queryKeys.dashboard.segments(branchId),
    queryFn: () =>
      apiClient.get("/dashboard/segments", {
        params: branchId ? { branch_id: branchId } : undefined,
      }),
    enabled: visible.some((t) => t.id === "segments"),
    staleTime: 5 * 60 * 1000,
  });

  if (visible.length === 0) return null;

  // Tile span configuration on a 12-column grid — wider tiles for content-rich
  // visualisations, narrow ones for compact stats. Mobile collapses to single
  // column; tablet (md) uses a 6-col grid; desktop (lg+) uses 12.
  const TILE_SPAN: Record<string, string> = {
    occupancy_gauge:    "md:col-span-2 lg:col-span-4",
    todays_classes:     "md:col-span-4 lg:col-span-8",
    payment_methods:    "md:col-span-2 lg:col-span-4",
    revenue_mix:        "md:col-span-4 lg:col-span-8",
    revenue_summary:    "md:col-span-6 lg:col-span-12",
    business_metrics:   "md:col-span-6 lg:col-span-12",
    retention_curve:    "md:col-span-4 lg:col-span-8",
    inventory:          "md:col-span-2 lg:col-span-4",
    footfall_heatmap:   "md:col-span-6 lg:col-span-12",
  };

  const wrapTile = (id: string, node: ReactNode) => (
    <div key={id} className={cn("min-w-0", TILE_SPAN[id] ?? "lg:col-span-4")}>
      {node}
    </div>
  );

  return (
    <section className="mt-8" aria-label="Dashboard analytics">
      {/* Zone heading — sets context, anchors visual hierarchy below the Pulse + Action zone. */}
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Deep Dive
        </h2>
        <p className="text-xs text-muted-foreground">
          Cards reflect the active branch and date range
        </p>
      </header>

      {/*
       * 12-col grid with `items-start` so tiles size to content (no auto-rows-fr
       * stretching that left whitespace inside short tiles). Order in the layout
       * determines visual flow.
       */}
      <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6 items-start">
        {visible.map((tile) => {
          switch (tile.id) {
            case "occupancy_gauge":
              return wrapTile(tile.id, <OccupancyGauge branchId={branchId} />);
            case "todays_classes":
              return wrapTile(tile.id, <TodaysClassesTile branchId={branchId} />);
            case "revenue_mix":
              return wrapTile(tile.id, <RevenueMixTile branchId={branchId} />);
            case "payment_methods":
              return wrapTile(tile.id, <PaymentMethodTile branchId={branchId} />);
            case "revenue_summary":
              return wrapTile(tile.id, <RevenueSummaryTile branchId={branchId} />);
            case "retention_curve":
              return wrapTile(tile.id, <RetentionCurveTile branchId={branchId} />);
            case "segments":
              return (
                <div
                  key={tile.id}
                  className="md:col-span-6 lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {SEGMENT_CONFIG.map((cfg) => (
                    <SegmentTile
                      key={cfg.key}
                      title={cfg.title}
                      description={cfg.description}
                      tone={cfg.tone}
                      segment={segments?.[cfg.key]}
                      isLoading={segmentsLoading}
                    />
                  ))}
                </div>
              );
            case "business_metrics":
              return wrapTile(tile.id, <BusinessMetricsTile branchId={branchId} />);
            case "footfall_heatmap":
              return wrapTile(tile.id, <HeatmapTile branchId={branchId} />);
            case "inventory":
              return wrapTile(tile.id, <InventoryTile branchId={branchId} />);
            default:
              return null;
          }
        })}
      </div>
    </section>
  );
}
