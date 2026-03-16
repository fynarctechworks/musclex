"use client";

import React from "react";
import { format } from "date-fns";
import { Clock } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { CheckIn } from "@/types";

interface MemberAttendanceProps {
  checkIns?: CheckIn[];
}

export function MemberAttendance({ checkIns }: MemberAttendanceProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Attendance History
      </h3>
      {checkIns && checkIns.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Date &amp; Time
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Method
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody>
              {checkIns.map((ci) => (
                <tr
                  key={ci.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 text-foreground">
                    {format(
                      new Date(ci.checked_in_at),
                      "MMM dd, yyyy - hh:mm a"
                    )}
                  </td>
                  <td className="py-3 text-muted-foreground capitalize">
                    {ci.checkin_method.replace("_", " ")}
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
                      label={
                        ci.status.charAt(0).toUpperCase() + ci.status.slice(1)
                      }
                    />
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {ci.failure_reason || "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Clock}
          title="No attendance records"
          description="Check-in records will appear here once the member starts checking in."
        />
      )}
    </div>
  );
}
