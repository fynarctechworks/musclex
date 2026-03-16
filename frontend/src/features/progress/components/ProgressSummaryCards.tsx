"use client";

import React from "react";
import { TrendingDown, TrendingUp, Scale, Dumbbell, Percent, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgressSummary } from "@/features/progress";

interface ProgressSummaryCardsProps {
  summary?: ProgressSummary;
  loading?: boolean;
}

function formatChange(value: number | null | undefined, unit: string, invert = false): {
  text: string;
  positive: boolean;
} {
  if (value === null || value === undefined) return { text: "—", positive: true };
  const rounded = Math.round(value * 10) / 10;
  const isPositive = invert ? rounded < 0 : rounded > 0;
  const sign = rounded > 0 ? "+" : "";
  return { text: `${sign}${rounded}${unit}`, positive: isPositive };
}

export function ProgressSummaryCards({ summary, loading }: ProgressSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
            <div className="h-4 w-20 bg-muted rounded mb-3" />
            <div className="h-7 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const latest = summary?.latest;
  const changes = summary?.changes;

  const weightChange = formatChange(changes?.weight, "kg", true);
  const fatChange = formatChange(changes?.body_fat, "%", true);
  const muscleChange = formatChange(changes?.muscle_mass, "kg");
  const bmiValue = latest?.bmi ? Number(latest.bmi).toFixed(1) : "—";

  const cards = [
    {
      label: "Current Weight",
      value: latest?.weight ? `${Number(latest.weight).toFixed(1)} kg` : "—",
      change: weightChange,
      icon: Scale,
    },
    {
      label: "Body Fat",
      value: latest?.body_fat ? `${Number(latest.body_fat).toFixed(1)}%` : "—",
      change: fatChange,
      icon: Percent,
    },
    {
      label: "Muscle Mass",
      value: latest?.muscle_mass ? `${Number(latest.muscle_mass).toFixed(1)} kg` : "—",
      change: muscleChange,
      icon: Dumbbell,
    },
    {
      label: "BMI",
      value: bmiValue,
      change: null,
      icon: Activity,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <card.icon className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{card.value}</p>
          {card.change && card.change.text !== "—" && (
            <div className="flex items-center gap-1 mt-1">
              {card.change.positive ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  card.change.positive ? "text-emerald-500" : "text-destructive"
                )}
              >
                {card.change.text}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
