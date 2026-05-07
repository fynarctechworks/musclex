"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { TileCard } from "./tile-card";
import { cn } from "@/lib/utils";

interface HeatmapResponse {
  cells: number[][];
  max_value: number;
  average: number;
  outliers: Array<{ day_of_week: number; hour: number; value: number; z_score: number }>;
  generated_at: string;
  window_days: number;
}

interface HeatmapTileProps {
  branchId?: string;
  days?: number;
  onInspect?: () => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];

export function HeatmapTile({ branchId, days = 30, onInspect }: HeatmapTileProps) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);

  const { data, isLoading, dataUpdatedAt, error } = useQuery<HeatmapResponse>({
    queryKey: ["dashboard", "heatmap", branchId ?? "all", days],
    queryFn: () =>
      apiClient.get("/dashboard/heatmap", {
        params: { branch_id: branchId, days },
      }),
    refetchInterval: 5 * 60 * 1000,
  });

  const outlierMap = useMemo(() => {
    const m = new Map<string, { z_score: number }>();
    data?.outliers?.forEach((o) => m.set(`${o.day_of_week}-${o.hour}`, { z_score: o.z_score }));
    return m;
  }, [data?.outliers]);

  const cellOpacity = (value: number) => {
    if (!data?.max_value) return 0;
    return Math.min(1, value / data.max_value);
  };

  const hoverCell =
    hover && data?.cells?.[hover.d]?.[hover.h] !== undefined
      ? { value: data.cells[hover.d][hover.h], outlier: outlierMap.get(`${hover.d}-${hover.h}`) }
      : null;

  return (
    <TileCard
      title="Footfall Heatmap"
      size={2}
      freshness={data?.generated_at ?? dataUpdatedAt}
      onInspect={onInspect}
      loading={isLoading}
      error={error ? "Heatmap unavailable" : null}
      empty={!isLoading && !data?.cells?.length}
      emptyDescription="Once you have 7+ days of check-ins, the heatmap will populate."
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>Last {data?.window_days ?? days} days</span>
        <span className="tabular-nums">
          avg <span className="text-foreground font-medium">{Math.round(data?.average ?? 0)}</span> per cell
        </span>
      </div>

      {/* Hour-of-day axis */}
      <div className="flex items-center gap-1 mb-1.5 pl-9">
        <div className="grid flex-1" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
          {HOUR_LABELS.map((label) => (
            <span key={label} className="text-[10px] text-muted-foreground/70 tabular-nums">
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {DAYS.map((dayLabel, d) => (
          <div key={d} className="flex items-center gap-1">
            <span className="w-8 text-[11px] font-medium text-muted-foreground tabular-nums">
              {dayLabel}
            </span>
            <div
              className="grid flex-1 gap-[2px]"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
            >
              {Array.from({ length: 24 }).map((_, h) => {
                const value = data?.cells?.[d]?.[h] ?? 0;
                const opacity = cellOpacity(value);
                const outlier = outlierMap.get(`${d}-${h}`);
                const isHover = hover?.d === d && hover?.h === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onMouseEnter={() => setHover({ d, h })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ d, h })}
                    onBlur={() => setHover(null)}
                    aria-label={`${dayLabel} ${HOUR_LABELS[Math.floor(h / 3)] ?? h}: ${value} check-ins`}
                    className={cn(
                      "relative h-7 overflow-hidden rounded-[3px] bg-secondary/60 ring-offset-1 transition-all",
                      "hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-primary",
                      outlier && "ring-1 ring-success",
                      isHover && "ring-1 ring-primary",
                    )}
                  >
                    {opacity > 0 && (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-[3px]"
                        style={{
                          backgroundColor: "hsl(var(--primary))",
                          opacity,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="tabular-nums">0</span>
          <div
            className="h-2 w-24 rounded-sm border border-border/60"
            style={{
              background:
                "linear-gradient(to right, hsl(var(--secondary)), hsl(var(--primary)))",
            }}
          />
          <span className="tabular-nums">{data?.max_value ?? 0}</span>
        </div>
        {hoverCell ? (
          <span className="tabular-nums truncate">
            {DAYS[hover!.d]} {HOUR_LABELS[Math.floor(hover!.h / 3)] ?? `${hover!.h}h`} ·{" "}
            <span className="text-foreground font-medium">{hoverCell.value}</span>
            {hoverCell.outlier && (
              <span className="text-success ml-1">
                · {hoverCell.outlier.z_score.toFixed(1)}σ
              </span>
            )}
          </span>
        ) : data?.outliers?.length ? (
          <span>
            {data.outliers.length} peak cell
            {data.outliers.length === 1 ? "" : "s"} flagged
          </span>
        ) : null}
      </div>
    </TileCard>
  );
}
