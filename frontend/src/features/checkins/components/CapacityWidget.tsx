"use client";

import React from "react";
import { Users } from "lucide-react";

interface CapacityWidgetProps {
  current: number;
  max: number;
}

export function CapacityWidget({ current, max }: CapacityWidgetProps) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;

  const color =
    pct >= 90
      ? "text-red-500"
      : pct >= 70
      ? "text-yellow-500"
      : "text-success";

  const barColor =
    pct >= 90
      ? "bg-red-500"
      : pct >= 70
      ? "bg-yellow-500"
      : "bg-success";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="h-4 w-4 text-primary" />
          Current Capacity
        </div>
        <span className={`text-lg font-bold ${color}`}>
          {current}/{max}
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-right">
        {Math.round(pct)}% occupied
      </p>
    </div>
  );
}
