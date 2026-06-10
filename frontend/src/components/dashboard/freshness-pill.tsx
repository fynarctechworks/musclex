"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FreshnessPillProps {
  asOf: string | number | null | undefined;
  className?: string;
  /** Threshold (seconds) above which the pill turns warning. Default 300s. */
  staleThresholdSec?: number;
}

/**
 * "Updated 8s ago" pill — the dashboard's honesty signal. Stale data
 * (>5 min by default) flips the pill amber so users never trust a
 * silently-frozen number.
 */
export function FreshnessPill({
  asOf,
  className,
  staleThresholdSec = 300,
}: FreshnessPillProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  if (!asOf) return null;
  const ts = typeof asOf === "string" ? new Date(asOf).getTime() : asOf;
  if (!Number.isFinite(ts)) return null;

  const ageSec = Math.max(0, Math.round((now - ts) / 1000));
  const stale = ageSec > staleThresholdSec;
  const label = formatAge(ageSec);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]",
        stale
          ? "bg-warning/10 text-warning"
          : "bg-canvas-soft text-muted-foreground",
        className,
      )}
      title={new Date(ts).toLocaleString()}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          stale ? "bg-warning" : "bg-success animate-pulse",
        )}
      />
      Updated {label}
    </span>
  );
}

function formatAge(ageSec: number): string {
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.floor(ageSec / 3600)}h ago`;
  return `${Math.floor(ageSec / 86400)}d ago`;
}
