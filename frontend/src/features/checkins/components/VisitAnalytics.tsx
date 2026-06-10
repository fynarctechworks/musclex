"use client";

import React from "react";
import { Activity, Clock, Timer, UserCheck } from "lucide-react";

interface VisitAnalyticsProps {
  todayCount: number;
  peakHour: string;
  /** Avg duration in minutes. Pass `null` when no exit-time data exists yet. */
  avgDurationMinutes: number | null;
  returningMembers: number;
}

export function VisitAnalytics({
  todayCount,
  peakHour,
  avgDurationMinutes,
  returningMembers,
}: VisitAnalyticsProps) {
  // Honest empty-state: show "—" instead of a fabricated number when we
  // have no exit-time data. A real average will land here once the
  // check-out feature ships.
  const avgDisplay = avgDurationMinutes == null ? '—' : `${avgDurationMinutes}m`;

  const stats = [
    { label: "Today's Check-ins", value: todayCount, icon: Activity, color: "text-primary" },
    { label: "Peak Hour", value: peakHour, icon: Clock, color: "text-warning" },
    { label: "Avg Duration", value: avgDisplay, icon: Timer, color: "text-success" },
    { label: "Returning", value: returningMembers, icon: UserCheck, color: "text-foreground" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" /> Visit Analytics
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-canvas-soft p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
