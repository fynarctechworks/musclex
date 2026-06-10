"use client";

import React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { KPICard, PageHeader, LoadingSkeleton, AccessDenied } from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import {
  Activity,
  TrendingUp,
  Users,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useDashboardKpis } from "@/features/dashboard";
import { useVisitHeatmap, useVisitsList } from "@/features/visits";
import dynamic from "next/dynamic";
import { VisitHeatmap } from "@/features/visits/components";

const VisitTrendChart = dynamic(
  () =>
    import("@/features/visits/components/VisitTrendChart").then((m) => ({
      default: m.VisitTrendChart,
    })),
  { ssr: false, loading: () => <LoadingSkeleton className="h-64 w-full" /> },
);
const PeakHoursChart = dynamic(
  () =>
    import("@/features/visits/components/PeakHoursChart").then((m) => ({
      default: m.PeakHoursChart,
    })),
  { ssr: false, loading: () => <LoadingSkeleton className="h-64 w-full" /> },
);
import type { Branch } from "@/lib/types";

export default function VisitsPage() {
  const { allowed, checked } = useRequirePermission("check_ins", "view", "deny");
  const { gymPath } = useGymSlug();
  const { user, activeBranchId } = useAuthStore();
  const isOwner = user?.role === "owner";

  const branchId = activeBranchId || undefined;

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiClient.get("/branches"),
    enabled: isOwner,
  });

  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis(branchId);
  const { data: heatmap, isLoading: heatmapLoading } = useVisitHeatmap(branchId);
  const { data: checkInsResult } = useVisitsList({
    branch_id: branchId,
    limit: 500,
    date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  const todayCheckIns = kpis?.check_ins_today ?? 0;
  const avgAttendance = kpis?.avg_attendance_rate ?? 0;
  const activeMembers = kpis?.active_members ?? 0;
  const expiringSoon = kpis?.expiring_soon_count ?? 0;

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="check_ins" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Visit Analytics"
        description="Track attendance patterns, peak hours, and member engagement."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href={gymPath("/members/at-risk")}
              className="text-[13px] text-primary hover:text-primary/80 flex items-center gap-1"
            >
              At-Risk Members <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        }
        className="mb-6"
      />

      {/* KPI Cards */}
      {kpisLoading ? (
        <LoadingSkeleton className="h-28" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            label="Check-ins Today"
            value={todayCheckIns}
            icon={Activity}
          />
          <KPICard
            label="Avg Attendance Rate"
            value={`${avgAttendance}%`}
            icon={TrendingUp}
          />
          <KPICard
            label="Active Members"
            value={activeMembers}
            icon={Users}
          />
          <KPICard
            label="Expiring Soon"
            value={expiringSoon}
            icon={AlertTriangle}
          />
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {heatmapLoading ? (
          <LoadingSkeleton className="h-80" />
        ) : (
          <VisitHeatmap data={heatmap} />
        )}
        <PeakHoursChart data={heatmap} />
      </div>

      {/* Visit Trends — full width */}
      <VisitTrendChart checkIns={checkInsResult?.data} />
    </AppLayout>
  );
}
