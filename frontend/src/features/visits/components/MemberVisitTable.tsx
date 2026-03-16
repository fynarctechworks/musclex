"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Clock } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { CheckIn } from "@/types";

interface MemberVisitTableProps {
  checkIns?: CheckIn[];
  loading?: boolean;
  className?: string;
}

export function MemberVisitTable({ checkIns, loading, className }: MemberVisitTableProps) {
  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 bg-muted rounded" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted/50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!checkIns || checkIns.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-6", className)}>
        <EmptyState
          icon={Clock}
          title="No visit records"
          description="Visit history will appear here once the member checks in."
        />
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <h3 className="text-base font-semibold text-foreground mb-4">Recent Visits</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Date
              </th>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Time
              </th>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Method
              </th>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {checkIns.map((ci) => {
              const dt = parseISO(ci.checked_in_at);
              return (
                <tr key={ci.id} className="border-b border-border last:border-0">
                  <td className="py-3 text-foreground">
                    {format(dt, "MMM dd, yyyy")}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {format(dt, "hh:mm a")}
                  </td>
                  <td className="py-3 text-muted-foreground capitalize">
                    {ci.checkin_method.replace(/_/g, " ")}
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      variant={
                        ci.status === "success"
                          ? "active"
                          : ci.status === "pending"
                          ? "pending"
                          : "expired"
                      }
                      label={ci.status.charAt(0).toUpperCase() + ci.status.slice(1)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
