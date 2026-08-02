"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { LoadingSkeleton , AccessDenied } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const TrainerSessionsChart = dynamic(
  () => import("./_chart").then((m) => ({ default: m.TrainerSessionsChart })),
  { ssr: false, loading: () => <LoadingSkeleton className="h-64 w-full" /> },
);
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useRequirePermission } from "@/hooks/use-require-permission";

interface TrainerLeaderboardRow {
  trainer_id: string;
  sessions_conducted: number;
  members_trained: number;
  revenue_generated: string | number;
  no_show_rate: string | number;
  period_start: string;
  period_end: string;
  trainer: { full_name: string; specializations?: string[] | null };
}

export default function StaffAnalyticsPage() {
  // Leaderboard exposes per-trainer revenue → gate on analytics, not staff
  const { allowed, checked } = useRequirePermission("analytics", "view", "deny");
  const { gymPath } = useGymSlug();
  const { data, isLoading } = useQuery<TrainerLeaderboardRow[]>({
    queryKey: ["trainer-leaderboard"],
    queryFn: () => apiClient.get("/analytics/trainers/leaderboard"),
    enabled: checked && allowed,
  });

  const chartData = (data ?? []).map((t) => ({
    trainer_name: t.trainer.full_name,
    sessions_conducted: t.sessions_conducted,
  }));

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="analytics" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={gymPath("/staff")}
        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Staff
      </Link>
      <h1 className="text-xl font-semibold text-foreground mb-6">
        Trainer Performance
      </h1>

      {isLoading ? (
        <LoadingSkeleton className="h-96" />
      ) : (
        <>
          {/* Chart */}
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Sessions Conducted by Trainer (latest period)
            </h2>
            <div className="h-64">
              {chartData.length > 0 ? (
                <TrainerSessionsChart data={chartData} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No trainer data available
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-semibold text-muted-foreground">
                    Trainer
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                    Sessions
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                    Members Trained
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                    No-show Rate
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.map((t) => (
                  <tr
                    key={t.trainer_id}
                    className="border-b border-border last:border-0 hover:bg-canvas-soft"
                  >
                    <td className="p-4 text-sm text-foreground font-medium">
                      {t.trainer.full_name}
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {t.sessions_conducted}
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {t.members_trained}
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {Number(t.no_show_rate).toFixed(1)}%
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      ₹{Number(t.revenue_generated).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
