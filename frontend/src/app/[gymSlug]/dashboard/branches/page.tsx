"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { LoadingSkeleton } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface BranchComparison {
  branch_id: string;
  branch_name: string;
  active_members: number;
  monthly_revenue: number;
  avg_attendance: number;
  new_signups: number;
}

export default function BranchComparisonPage() {
  const { gymPath } = useGymSlug();
  const { data, isLoading } = useQuery<BranchComparison[]>({
    queryKey: ["branch-comparison"],
    queryFn: () => apiClient.get("/dashboard/branch-comparison"),
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <Link
          href={gymPath("/dashboard")}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Branch Comparison</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare performance across all your branches.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">
                  Branch
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                  Active Members
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                  Monthly Revenue
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                  Avg Attendance
                </th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">
                  New Signups
                </th>
              </tr>
            </thead>
            <tbody>
              {data && data.length > 0 ? (
                data.map((branch) => (
                  <tr
                    key={branch.branch_id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="p-4 text-sm text-foreground font-medium">
                      {branch.branch_name}
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {branch.active_members}
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      ₹{branch.monthly_revenue.toLocaleString()}
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {branch.avg_attendance}%
                    </td>
                    <td className="p-4 text-sm text-foreground text-right">
                      {branch.new_signups}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-muted-foreground"
                  >
                    No branch data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
