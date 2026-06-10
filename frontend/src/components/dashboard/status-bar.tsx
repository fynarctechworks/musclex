"use client";

/**
 * Wave 13 — System Status Bar.
 *
 * Sticky bottom bar that surfaces backend lane health (API, DB, Redis,
 * WebSocket, Scanner, Sync lag, Queued webhooks). Polls every 15s.
 *
 * Behaviour:
 * - All green       → 32px muted bar.
 * - Any red/danger  → 40px bar + pulsing red border.
 * - Hidden on < md.
 * - Click any dot   → popover with details.
 *
 * Tokens used: --success, --warning, --destructive, --card, --border,
 * --muted-foreground (no new design tokens introduced).
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { queryKeys } from "@/services/query-client";
import type { SystemStatus, HealthState } from "@/lib/types";

type Lane = "api" | "database" | "redis" | "websocket" | "scanner" | "sync" | "webhooks";

interface LaneSpec {
  key: Lane;
  label: string;
  description: string;
}

const LANES: LaneSpec[] = [
  { key: "api", label: "API", description: "REST gateway" },
  { key: "database", label: "DB", description: "Postgres" },
  { key: "redis", label: "Redis", description: "Cache + queues" },
  { key: "websocket", label: "WS", description: "Realtime updates" },
  { key: "scanner", label: "Scan", description: "Check-in scanners" },
  { key: "sync", label: "Sync", description: "Projection lag" },
  { key: "webhooks", label: "Hooks", description: "Outbound queue" },
];

type Tone = "success" | "warning" | "danger";

function laneTone(status: SystemStatus | undefined, lane: Lane): Tone {
  if (!status) return "warning";
  switch (lane) {
    case "api":
      return status.api.healthy ? "success" : "danger";
    case "database":
      return status.database.healthy ? "success" : "danger";
    case "redis":
      return status.redis.healthy ? "success" : "warning";
    case "websocket":
      return status.websocket.healthy ? "success" : "warning";
    case "scanner":
      return status.scanner.healthy ? "success" : "warning";
    case "sync":
      if (status.sync_lag_seconds > 300) return "danger";
      if (status.sync_lag_seconds > 60) return "warning";
      return "success";
    case "webhooks":
      if (status.queued_webhooks > 50) return "danger";
      if (status.queued_webhooks > 5) return "warning";
      return "success";
  }
}

function laneDetail(status: SystemStatus | undefined, lane: Lane): {
  state: HealthState;
  extra?: string;
} {
  if (!status) {
    return { state: { healthy: false, message: "Loading…" } };
  }
  switch (lane) {
    case "api":
      return { state: status.api };
    case "database":
      return { state: status.database };
    case "redis":
      return { state: status.redis };
    case "websocket":
      return { state: status.websocket };
    case "scanner":
      return { state: status.scanner };
    case "sync":
      return {
        state: { healthy: status.sync_lag_seconds <= 60 },
        extra: `Lag: ${formatLag(status.sync_lag_seconds)}`,
      };
    case "webhooks":
      return {
        state: { healthy: status.queued_webhooks <= 5 },
        extra: `Queued: ${status.queued_webhooks}`,
      };
  }
}

function formatLag(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function toneToColor(tone: Tone): string {
  if (tone === "success") return "hsl(var(--success))";
  if (tone === "warning") return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
}

export function StatusBar() {
  const { data: status } = useQuery<SystemStatus>({
    queryKey: queryKeys.dashboard.systemStatus(),
    queryFn: () => apiClient.get("/dashboard/system-status"),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
    retry: 0,
  });

  const [activeLane, setActiveLane] = useState<Lane | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside.
  useEffect(() => {
    if (!activeLane) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setActiveLane(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeLane]);

  const tones = LANES.map((l) => laneTone(status, l.key));
  const hasDanger = tones.includes("danger");
  const heightPx = hasDanger ? 40 : 32;

  return (
    <div
      ref={containerRef}
      className="hidden md:flex fixed bottom-0 left-0 right-0 z-30 border-t bg-card text-[12px] items-center justify-between px-4 transition-all"
      style={{
        height: `${heightPx}px`,
        borderTopColor: hasDanger
          ? "hsl(var(--destructive))"
          : "hsl(var(--border))",
        borderTopWidth: hasDanger ? 2 : 1,
        animation: hasDanger ? "statusbar-pulse 1.5s ease-in-out infinite" : undefined,
        opacity: hasDanger ? 1 : 0.85,
      }}
      role="status"
      aria-live="polite"
    >
      <style jsx>{`
        @keyframes statusbar-pulse {
          0%, 100% { box-shadow: 0 -2px 0 0 hsl(var(--destructive) / 0.0) inset; }
          50%      { box-shadow: 0 -2px 0 0 hsl(var(--destructive) / 0.6) inset; }
        }
      `}</style>

      <div className="flex items-center gap-3">
        {LANES.slice(0, 5).map((lane, i) => (
          <Dot
            key={lane.key}
            lane={lane}
            tone={tones[i]}
            status={status}
            active={activeLane === lane.key}
            onToggle={() =>
              setActiveLane(activeLane === lane.key ? null : lane.key)
            }
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        {LANES.slice(5).map((lane) => {
          const idx = LANES.findIndex((l) => l.key === lane.key);
          return (
            <Dot
              key={lane.key}
              lane={lane}
              tone={tones[idx]}
              status={status}
              active={activeLane === lane.key}
              onToggle={() =>
                setActiveLane(activeLane === lane.key ? null : lane.key)
              }
            />
          );
        })}
      </div>
    </div>
  );
}

interface DotProps {
  lane: LaneSpec;
  tone: Tone;
  status: SystemStatus | undefined;
  active: boolean;
  onToggle: () => void;
}

function Dot({ lane, tone, status, active, onToggle }: DotProps) {
  const detail = laneDetail(status, lane.key);
  const color = toneToColor(tone);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-canvas-soft transition-colors"
        aria-label={`${lane.label} status: ${tone}`}
        aria-expanded={active}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow:
              tone !== "success"
                ? `0 0 0 2px ${color}30`
                : undefined,
          }}
        />
        <span className="text-muted-foreground font-medium">{lane.label}</span>
      </button>
      {active && (
        <div
          className="absolute bottom-full mb-2 left-0 min-w-[220px] rounded-lg border border-border bg-popover text-popover-foreground shadow-level-4 p-3 text-[12px] z-40"
          role="dialog"
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <strong className="text-[13px]">{lane.label}</strong>
            <span className="text-muted-foreground">— {lane.description}</span>
          </div>
          <div className="text-muted-foreground">
            {detail.extra ?? (detail.state.message || (detail.state.healthy ? "Healthy" : "Degraded"))}
          </div>
          {detail.state.latency_ms !== undefined && (
            <div className="text-muted-foreground mt-0.5">
              Latency: {detail.state.latency_ms}ms
            </div>
          )}
          {status?.generated_at && (
            <div className="text-muted-foreground mt-1 text-[11px]">
              Updated {new Date(status.generated_at).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
