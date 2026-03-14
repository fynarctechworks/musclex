"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { LoadingSkeleton } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, TrendingUp, Users, AlertTriangle, Calendar } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface DailyBriefing {
  date: string;
  summary: string;
  metrics: {
    label: string;
    value: string;
    change?: string;
  }[];
  alerts: string[];
  recommendations: string[];
}

export default function DailyBriefingPage() {
  const { gymPath } = useGymSlug();
  const { data: briefing, isLoading } = useQuery<DailyBriefing>({
    queryKey: ["daily-briefing"],
    queryFn: () => apiClient.get("/ai/daily-briefing"),
  });

  return (
    <AppLayout>
      <Link
        href={gymPath("/ai")}
        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to AI Advisor
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-500" /> Daily Briefing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {briefing?.date
            ? new Date(briefing.date).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "Today's overview"}
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-96" />
      ) : briefing ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Summary
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {briefing.summary}
            </p>
          </div>

          {/* Key Metrics */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Key Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {briefing.metrics.map((metric, i) => (
                <div key={i} className="bg-muted rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {metric.value}
                  </p>
                  {metric.change && (
                    <p
                      className={`text-xs mt-1 ${
                        metric.change.startsWith("+")
                          ? "text-primary"
                          : "text-destructive"
                      }`}
                    >
                      {metric.change} from yesterday
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          {briefing.alerts.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Alerts
              </h2>
              <ul className="space-y-2">
                {briefing.alerts.map((alert, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                    {alert}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {briefing.recommendations.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />{" "}
                Recommendations
              </h2>
              <ul className="space-y-2">
                {briefing.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground">
            No briefing available. Check back tomorrow morning.
          </p>
        </div>
      )}
    </AppLayout>
  );
}
