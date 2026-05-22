"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12a";
  if (i < 12) return `${i}a`;
  if (i === 12) return "12p";
  return `${i - 12}p`;
});

interface VisitHeatmapProps {
  /** 7×24 grid: heatmap[day][hour] = count */
  data?: number[][];
  className?: string;
}

function getIntensityClass(value: number, max: number): string {
  if (max === 0 || value === 0) return "bg-canvas-soft";
  const ratio = value / max;
  if (ratio < 0.25) return "bg-canvas-soft-2";
  if (ratio < 0.5) return "bg-primary/40";
  if (ratio < 0.75) return "bg-primary/65";
  return "bg-primary";
}

export function VisitHeatmap({ data, className }: VisitHeatmapProps) {
  const maxValue = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.flat(), 0);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
        <h3 className="text-base font-semibold text-foreground mb-4">Visit Heatmap</h3>
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No heatmap data available
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Visit Heatmap</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm bg-canvas-soft" />
            <div className="w-3 h-3 rounded-sm bg-canvas-soft-2" />
            <div className="w-3 h-3 rounded-sm bg-primary/40" />
            <div className="w-3 h-3 rounded-sm bg-primary/65" />
            <div className="w-3 h-3 rounded-sm bg-primary" />
          </div>
          <span>More</span>
        </div>
      </div>

      <TooltipProvider>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex">
              <div className="w-10 shrink-0" />
              {HOUR_LABELS.map((label, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 text-center text-[10px] text-muted-foreground pb-1",
                    i % 3 !== 0 && "hidden sm:block"
                  )}
                >
                  {i % 3 === 0 ? label : ""}
                </div>
              ))}
            </div>

            {/* Grid rows */}
            {DAY_LABELS.map((day, dayIdx) => (
              <div key={dayIdx} className="flex items-center gap-0">
                <div className="w-10 shrink-0 text-xs text-muted-foreground pr-2 text-right">
                  {day}
                </div>
                <div className="flex-1 flex gap-[2px]">
                  {Array.from({ length: 24 }, (_, hourIdx) => {
                    const value = data[dayIdx]?.[hourIdx] ?? 0;
                    return (
                      <Tooltip key={hourIdx} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex-1 aspect-square rounded-sm transition-colors cursor-default min-w-[14px]",
                              getIntensityClass(value, maxValue)
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <span className="font-medium">{value} check-in{value !== 1 ? "s" : ""}</span>
                          <br />
                          <span className="text-muted-foreground">
                            {day} {HOUR_LABELS[hourIdx]}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
