"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { LoadingSkeleton, AccessDenied } from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useDailyBriefing } from "@/features/ai";
import type { DailyBriefing, BriefingAlert } from "@/features/ai";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Users,
  AlertTriangle,
  Calendar,
  CalendarCheck,
  DollarSign,
  Clock,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

// ── Metric display config ─────────────────────────────────

const METRIC_CONFIG = [
  { key: "total_members" as const, label: "Total Members", icon: Users, format: (v: number) => String(v) },
  { key: "active_members" as const, label: "Active Members", icon: Users, format: (v: number) => String(v) },
  { key: "today_check_ins" as const, label: "Today's Check-ins", icon: CalendarCheck, format: (v: number) => String(v) },
  { key: "expiring_this_week" as const, label: "Expiring This Week", icon: Clock, format: (v: number) => String(v) },
  { key: "revenue_today" as const, label: "Revenue Today", icon: DollarSign, format: (v: number) => `₹${v.toLocaleString()}` },
  { key: "pending_payments" as const, label: "Pending Payments", icon: CreditCard, format: (v: number) => String(v) },
];

const ALERT_STYLES: Record<string, string> = {
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-primary",
};

export default function DailyBriefingPage() {
  const { allowed, checked } = useRequirePermission("ai", "view", "deny");
  const { gymPath } = useGymSlug();
  const { data: briefing, isLoading } = useDailyBriefing();

  const b = briefing as DailyBriefing | undefined;

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="ai" />
      </AppLayout>
    );
  }

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
          <Sparkles className="w-6 h-6 text-warning" /> Daily Briefing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {b?.date
            ? new Date(b.date).toLocaleDateString("en-US", {
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
      ) : b ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Summary
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {b.summary}
            </p>
          </div>

          {/* Key Metrics — mapped from named object */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Key Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {METRIC_CONFIG.map((m) => {
                const val = b.metrics?.[m.key];
                if (val == null) return null;
                const Icon = m.icon;
                return (
                  <div key={m.key} className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </div>
                    <p className="text-xl font-semibold text-foreground">
                      {m.format(val)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alerts — objects with type, title, message */}
          {b.alerts && b.alerts.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" /> Alerts
              </h2>
              <ul className="space-y-3">
                {b.alerts.map((alert: BriefingAlert, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span
                      className={`w-2 h-2 ${ALERT_STYLES[alert.type] ?? "bg-primary"} rounded-full mt-1.5 flex-shrink-0`}
                    />
                    <div>
                      <p className="font-medium text-foreground">{alert.title}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{alert.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {b.recommendations && b.recommendations.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />{" "}
                Recommendations
              </h2>
              <ul className="space-y-2">
                {b.recommendations.map((rec: string, i: number) => (
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
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            No briefing available. Check back tomorrow morning.
          </p>
        </div>
      )}
    </AppLayout>
  );
}
