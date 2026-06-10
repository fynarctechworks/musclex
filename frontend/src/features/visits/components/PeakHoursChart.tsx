"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12am";
  if (i < 12) return `${i}am`;
  if (i === 12) return "12pm";
  return `${i - 12}pm`;
});

interface PeakHoursChartProps {
  /** 7×24 heatmap grid */
  data?: number[][];
  className?: string;
}

export function PeakHoursChart({ data, className }: PeakHoursChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Sum all days per hour
    return Array.from({ length: 24 }, (_, hour) => {
      const total = data.reduce((sum, dayRow) => sum + (dayRow[hour] ?? 0), 0);
      return {
        hour: HOUR_LABELS[hour],
        visits: total,
      };
    });
  }, [data]);

  const peakHour = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((max, d) => (d.visits > max.visits ? d : max), chartData[0]);
  }, [chartData]);

  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Peak Hours</h3>
        {peakHour && peakHour.visits > 0 && (
          <span className="text-xs text-muted-foreground">
            Peak: <span className="text-primary font-medium">{peakHour.hour}</span>{" "}
            ({peakHour.visits} visits)
          </span>
        )}
      </div>

      <div className="h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="hour"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                interval={2}
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
              <Bar
                dataKey="visits"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No peak hours data available
          </div>
        )}
      </div>
    </div>
  );
}
