"use client";

import React, { useMemo, useState } from "react";
import { format, subDays, parseISO, eachDayOfInterval } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type { CheckIn } from "@/types";

interface VisitTrendChartProps {
  checkIns?: CheckIn[];
  className?: string;
}

type RangeKey = "7d" | "30d" | "90d";
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "90 Days", days: 90 },
];

export function VisitTrendChart({ checkIns, className }: VisitTrendChartProps) {
  const [range, setRange] = useState<RangeKey>("30d");

  const chartData = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? 30;
    const now = new Date();
    const start = subDays(now, days - 1);

    const interval = eachDayOfInterval({ start, end: now });
    const countByDate = new Map<string, number>();

    // Initialize all dates to 0
    for (const d of interval) {
      countByDate.set(format(d, "yyyy-MM-dd"), 0);
    }

    // Count check-ins per date
    if (checkIns) {
      for (const ci of checkIns) {
        const dateStr = format(parseISO(ci.checked_in_at), "yyyy-MM-dd");
        if (countByDate.has(dateStr)) {
          countByDate.set(dateStr, (countByDate.get(dateStr) ?? 0) + 1);
        }
      }
    }

    return interval.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return {
        date: days <= 7 ? format(d, "EEE") : format(d, "MMM dd"),
        visits: countByDate.get(key) ?? 0,
      };
    });
  }, [checkIns, range]);

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Visit Trends</h3>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md transition-colors",
                range === r.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value) => [String(value), "Visits"]}
              />
              <Area
                type="monotone"
                dataKey="visits"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No visit data available
          </div>
        )}
      </div>
    </div>
  );
}
