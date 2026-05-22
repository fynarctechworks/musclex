"use client";

import React from "react";
import { Activity, TrendingUp, Calendar, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useMemberVisitStats, useVisitsList } from "@/features/visits";
import { MemberVisitTable } from "@/features/visits/components";
import { VisitTrendChart } from "@/features/visits/components";

interface MemberVisitsTabProps {
  memberId: string;
}

export function MemberVisitsTab({ memberId }: MemberVisitsTabProps) {
  const { data: stats, isLoading: statsLoading } = useMemberVisitStats(memberId);
  const { data: checkInsResult, isLoading: checkInsLoading } = useVisitsList({
    member_id: memberId,
    limit: 100,
    date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  if (statsLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-28" />
        <LoadingSkeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Visit Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total Visits</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">{stats?.total_visits ?? 0}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Last 30 Days</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">{stats?.visits_last_30_days ?? 0}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Avg / Week</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {stats?.avg_visits_per_week?.toFixed(1) ?? "0.0"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Last Visit</span>
          </div>
          <p className="text-sm font-medium text-foreground">
            {stats?.last_visit
              ? format(parseISO(stats.last_visit), "MMM dd, yyyy")
              : "Never"}
          </p>
        </div>
      </div>

      {/* Visit Trend Chart */}
      <VisitTrendChart checkIns={checkInsResult?.data} />

      {/* Visit History Table */}
      <MemberVisitTable checkIns={checkInsResult?.data} loading={checkInsLoading} />
    </div>
  );
}
