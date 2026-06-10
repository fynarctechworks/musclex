"use client";

import React from "react";
import { format } from "date-fns";
import { Activity, QrCode, ScanFace, Search, Wifi, CheckCircle2, XCircle } from "lucide-react";
import type { CheckIn } from "@/types";

interface CheckinFeedProps {
  checkIns: CheckIn[];
  isLoading?: boolean;
}

const methodIcons: Record<string, React.ReactNode> = {
  manual: <Search className="h-3.5 w-3.5" aria-hidden="true" />,
  qr: <QrCode className="h-3.5 w-3.5" aria-hidden="true" />,
  facial: <ScanFace className="h-3.5 w-3.5" aria-hidden="true" />,
  rfid: <Wifi className="h-3.5 w-3.5" aria-hidden="true" />,
};

const methodLabels: Record<string, string> = {
  manual: "Manual",
  qr: "QR Code",
  facial: "Face ID",
  rfid: "RFID",
};

/**
 * Live check-in feed.
 *
 * Visual + a11y guarantees:
 *  - The newest row gets a `motion-safe:animate-in fade-in-up` entrance
 *    so an operator can see new arrivals at a glance even when not looking
 *    directly at the panel.
 *  - The list root is an `aria-live="polite"` region so screen readers
 *    announce new check-ins as they happen.
 *  - Outcome tone is its own variant (success/denied/pending) instead
 *    of reusing the membership StatusBadge — semantically correct and
 *    visually distinct.
 */
export function CheckinFeed({ checkIns, isLoading }: CheckinFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 motion-safe:animate-pulse">
            <div className="h-8 w-8 rounded-full bg-canvas-soft" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 bg-canvas-soft rounded" />
              <div className="h-2.5 w-20 bg-canvas-soft rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (checkIns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Activity className="h-8 w-8 mb-2 opacity-50" aria-hidden="true" />
        <p className="text-body-sm">No check-ins yet today</p>
      </div>
    );
  }

  // Newest first. The key uses ci.id so a new arriving row re-mounts
  // and replays the `animate-in` keyframe (rows already in the list
  // keep their mount and don't re-animate).
  return (
    <ul
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Recent check-ins"
      className="space-y-1 max-h-[500px] overflow-y-auto"
    >
      {checkIns.map((ci, idx) => (
        <FeedRow key={ci.id} ci={ci} isNewest={idx === 0} />
      ))}
    </ul>
  );
}

function FeedRow({ ci, isNewest }: { ci: CheckIn; isNewest: boolean }) {
  const outcome = ci.status === "success" ? "success" : "denied";

  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-fast hover:bg-canvas-soft ${
        isNewest ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 duration-medium" : ""
      }`}
    >
      <div className="h-8 w-8 rounded-full bg-canvas-soft-2 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
        {ci.member?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-medium text-foreground truncate">
          {ci.member?.full_name ?? "Unknown"}
        </p>
        <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            {methodIcons[ci.checkin_method] ?? null}
            {methodLabels[ci.checkin_method] ?? ci.checkin_method}
          </span>
          <span aria-hidden="true">&bull;</span>
          <span>{format(new Date(ci.checked_in_at), "h:mm a")}</span>
        </div>
      </div>
      <OutcomePill outcome={outcome} />
    </li>
  );
}

function OutcomePill({ outcome }: { outcome: "success" | "denied" }) {
  if (outcome === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-body-sm text-success">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        In
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-error/15 px-2 py-0.5 text-body-sm text-error">
      <XCircle className="h-3 w-3" aria-hidden="true" />
      Denied
    </span>
  );
}
