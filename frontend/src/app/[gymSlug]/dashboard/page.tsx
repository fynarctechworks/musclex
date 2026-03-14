"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { KPICard } from "@/components/shared";
import { LoadingSkeleton } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { DashboardKPIs, Branch } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  Users,
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  Activity,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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

interface AlertItem {
  id: string;
  severity: "high" | "medium" | "low";
  message: string;
}

export default function DashboardPage() {
  const { gymPath } = useGymSlug();
  const { user } = useAuthStore();
  const isOwner = user?.role === "owner";
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const branchParam =
    isOwner && selectedBranch !== "all"
      ? `?branch_id=${selectedBranch}`
      : "";

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiClient.get("/branches"),
    enabled: isOwner,
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery<DashboardKPIs>({
    queryKey: ["dashboard-kpis", selectedBranch],
    queryFn: () => apiClient.get(`/dashboard/kpis${branchParam}`),
  });

  const { data: revenueData } = useQuery<RevenueDataPoint[]>({
    queryKey: ["dashboard-revenue", selectedBranch],
    queryFn: () =>
      apiClient.get(`/dashboard/revenue-chart?months=6${isOwner && selectedBranch !== "all" ? `&branch_id=${selectedBranch}` : ""}`),
  });

  const { data: activity } = useQuery<ActivityItem[]>({
    queryKey: ["dashboard-activity"],
    queryFn: () => apiClient.get("/dashboard/activity-feed?limit=10"),
  });

  const { data: alerts } = useQuery<AlertItem[]>({
    queryKey: ["dashboard-alerts"],
    queryFn: () => apiClient.get("/dashboard/alerts"),
  });

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {isOwner && selectedBranch !== "all"
              ? `Showing data for ${branches?.find((b) => b.id === selectedBranch)?.name ?? "selected branch"}`
              : "Here\u0027s what\u0027s happening at your studio today."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isOwner && branches && branches.length > 1 && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="text-[13px] bg-card border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <Link
            href={gymPath("/dashboard/branches")}
            className="text-[13px] text-primary hover:text-primary/80 flex items-center gap-1"
          >
            Branch Comparison <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {kpisLoading ? (
        <LoadingSkeleton className="h-32" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            label="Active Members"
            value={kpis?.active_members ?? 0}
            icon={Users}
          />
          <KPICard
            label="Monthly Revenue"
            value={`₹${(kpis?.monthly_revenue ?? 0).toLocaleString()}`}
            icon={IndianRupee}
          />
          <KPICard
            label="Avg Attendance"
            value={`${kpis?.avg_attendance_rate ?? 0}%`}
            icon={TrendingUp}
          />
          <KPICard
            label="Expiring Soon"
            value={kpis?.expiring_soon_count ?? 0}
            icon={AlertTriangle}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">Revenue Trend</h2>
          <div className="h-64">
            {revenueData && revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
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

        {/* Alerts */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">Alerts</h2>
          <div className="space-y-3">
            {alerts && alerts.length > 0 ? (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.severity === "high"
                      ? "border-destructive/30 bg-destructive/10"
                      : alert.severity === "medium"
                        ? "border-amber-500/30 bg-amber-500/10"
                        : "border-primary/30 bg-primary/10"
                  }`}
                >
                  <p className="text-[13px] text-foreground">
                    {alert.message}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-muted-foreground">No alerts</p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="mt-6 bg-card border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Recent Activity
        </h2>
        <div className="space-y-3">
          {activity && activity.length > 0 ? (
            activity.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <p className="text-[13px] text-foreground">{item.message}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-muted-foreground">No recent activity</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
