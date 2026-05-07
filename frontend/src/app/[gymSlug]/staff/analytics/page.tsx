"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { LoadingSkeleton , AccessDenied } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useRequirePermission } from "@/hooks/use-require-permission";

interface TrainerPerformance {
  trainer_id: string;
  trainer_name: string;
  total_classes: number;
  total_enrollments: number;
  avg_occupancy: number;
  performance_score: number;
}

export default function StaffAnalyticsPage() {
  const { allowed, checked } = useRequirePermission("staff", "view", "deny");
  const { gymPath } = useGymSlug();
  const { data, isLoading } = useQuery<TrainerPerformance[]>({
    queryKey: ["trainer-performance"],
    queryFn: () => apiClient.get("/analytics/trainer-performance"),
  });


  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="staff" />
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
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Avg Occupancy Rate by Trainer
            </h2>
            <div className="h-64">
              {data && data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="trainer_name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar
                      dataKey="avg_occupancy"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No trainer data available
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-semibold text-muted-foreground">
                    Trainer
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                    Classes
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                    Total Enrollments
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                    Avg Occupancy
                  </th>
                  <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.map((trainer) => (
                  <tr
                    key={trainer.trainer_id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="p-4 text-sm text-foreground font-medium">
                      {trainer.trainer_name}
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {trainer.total_classes}
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {trainer.total_enrollments}
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {trainer.avg_occupancy}%
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {trainer.performance_score}/100
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
