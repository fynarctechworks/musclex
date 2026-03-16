"use client";

import React from "react";
import { format } from "date-fns";
import { Activity, QrCode, ScanFace, Search, Wifi } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import type { CheckIn } from "@/types";

interface CheckinFeedProps {
  checkIns: CheckIn[];
  isLoading?: boolean;
}

const methodIcons: Record<string, React.ReactNode> = {
  manual: <Search className="h-3.5 w-3.5" />,
  qr: <QrCode className="h-3.5 w-3.5" />,
  facial: <ScanFace className="h-3.5 w-3.5" />,
  rfid: <Wifi className="h-3.5 w-3.5" />,
};

const methodLabels: Record<string, string> = {
  manual: "Manual",
  qr: "QR Code",
  facial: "Face ID",
  rfid: "RFID",
};

export function CheckinFeed({ checkIns, isLoading }: CheckinFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-2.5 w-20 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (checkIns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Activity className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No check-ins yet today</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[500px] overflow-y-auto">
      {checkIns.map((ci) => (
        <div
          key={ci.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {ci.member?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {ci.member?.full_name ?? "Unknown"}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {methodIcons[ci.checkin_method] ?? null}
                {methodLabels[ci.checkin_method] ?? ci.checkin_method}
              </span>
              <span>&bull;</span>
              <span>{format(new Date(ci.checked_in_at), "h:mm a")}</span>
            </div>
          </div>
          <StatusBadge
            status={ci.status === "success" ? "active" : ci.status === "failed" ? "expired" : "frozen"}
          />
        </div>
      ))}
    </div>
  );
}
