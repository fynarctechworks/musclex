"use client";

import React from "react";
import { Users, Settings } from "lucide-react";

interface CapacityWidgetProps {
  current: number;
  /** Branch capacity. Pass 0 (or omit) when no capacity has been configured. */
  max: number;
}

export function CapacityWidget({ current, max }: CapacityWidgetProps) {
  // When max isn't configured, show an honest "set capacity" panel
  // instead of a fake "0/80" bar.
  if (!max || max <= 0) {
    return (
      <div className="rounded-lg border border-hairline border-dashed bg-card p-4">
        <div className="flex items-center gap-2 text-body-sm font-medium text-foreground mb-2">
          <Users className="h-4 w-4 text-primary" />
          Current Capacity
        </div>
        <p className="text-body-sm text-muted-foreground">
          {current} member{current === 1 ? '' : 's'} in the gym now.
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-body-sm text-link-deep">
          <Settings className="h-3.5 w-3.5" />
          Set a branch capacity in Settings to see occupancy.
        </p>
      </div>
    );
  }

  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;

  const color =
    pct >= 90
      ? "text-error"
      : pct >= 70
      ? "text-warning"
      : "text-success";

  const barColor =
    pct >= 90
      ? "bg-error"
      : pct >= 70
      ? "bg-warning"
      : "bg-success";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="h-4 w-4 text-primary" />
          Current Capacity
        </div>
        <span className={`text-lg font-semibold ${color}`}>
          {current}/{max}
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-slow ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-right">
        {Math.round(pct)}% occupied
      </p>
    </div>
  );
}
