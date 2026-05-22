"use client";

import React from "react";
import { AlertTriangle, CreditCard, HeartPulse, UserPlus, TrendingDown } from "lucide-react";
import type { EntryAlert } from "../types";

interface EntryAlertsProps {
  alerts: EntryAlert[];
}

const alertIcons: Record<EntryAlert["type"], React.ReactNode> = {
  expiring: <CreditCard className="h-4 w-4" />,
  balance: <AlertTriangle className="h-4 w-4" />,
  medical: <HeartPulse className="h-4 w-4" />,
  new_member: <UserPlus className="h-4 w-4" />,
  churn_risk: <TrendingDown className="h-4 w-4" />,
};

const severityStyles: Record<EntryAlert["severity"], string> = {
  info: "border-link/30 bg-link/5 text-link",
  warning: "border-warning/30 bg-warning/5 text-warning",
  danger: "border-error/30 bg-error/5 text-error",
};

export function EntryAlerts({ alerts }: EntryAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${severityStyles[alert.severity]}`}
        >
          <span className="mt-0.5 shrink-0">{alertIcons[alert.type]}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{alert.title}</p>
            <p className="text-xs opacity-80">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
