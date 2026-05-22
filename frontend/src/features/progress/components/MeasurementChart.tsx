"use client";

import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import type { BodyStat } from "@/features/progress";

interface MeasurementChartProps {
  data?: BodyStat[];
  className?: string;
}

type MetricKey = "weight" | "body_fat" | "muscle_mass";

const METRICS: { key: MetricKey; label: string; color: string; unit: string }[] = [
  { key: "weight", label: "Weight", color: "hsl(var(--primary))", unit: "kg" },
  { key: "body_fat", label: "Body Fat", color: "#F59E0B", unit: "%" },
  { key: "muscle_mass", label: "Muscle Mass", color: "#34C77A", unit: "kg" },
];

export function MeasurementChart({ data, className }: MeasurementChartProps) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set<MetricKey>(["weight", "body_fat", "muscle_mass"])
  );

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    // Sort ascending by date for chart
    return [...data]
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map((stat) => ({
        date: format(parseISO(stat.recorded_at), "MMM dd"),
        fullDate: format(parseISO(stat.recorded_at), "MMM dd, yyyy"),
        weight: stat.weight ? Number(stat.weight) : null,
        body_fat: stat.body_fat ? Number(stat.body_fat) : null,
        muscle_mass: stat.muscle_mass ? Number(stat.muscle_mass) : null,
      }));
  }, [data]);

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Progress Charts</h3>
        <div className="flex gap-2">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md border transition-colors",
                activeMetrics.has(m.key)
                  ? "border-primary bg-canvas-soft-2 text-foreground"
                  : "border-border text-muted-foreground hover:bg-canvas-soft"
              )}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: m.color }}
              />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                }}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload;
                  return item?.fullDate ?? "";
                }}
              />
              <Legend />
              {METRICS.filter((m) => activeMetrics.has(m.key)).map((m) => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={`${m.label} (${m.unit})`}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            {chartData.length === 1
              ? "Add another measurement to see trends"
              : "No measurement data yet"}
          </div>
        )}
      </div>
    </div>
  );
}
