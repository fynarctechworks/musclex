"use client";

import { useMemo } from "react";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Info,
  LineChart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type ActionSeverity = "high" | "medium" | "low";
export type ActionKind =
  | "renewal_at_risk"
  | "renewal_imminent"
  | "payment_failed"
  | "dues_overdue"
  | "trainer_no_show"
  | "class_overfill"
  | "lead_cold"
  | "inactive_member"
  | "branch_underperform"
  | "anomaly_check_ins_low"
  | "anomaly_check_ins_high"
  | "anomaly_revenue_low"
  | "anomaly_revenue_high"
  | "info";

export interface ActionEvidence {
  summary: string;
  metric?: string;
  value?: number;
  baseline?: number;
  stdev?: number;
  z_score?: number;
  delta_pct?: number;
  source: string;
}

export interface ActionItem {
  id: string;
  kind: ActionKind;
  severity: ActionSeverity;
  /** Short action title — what the user should do */
  title: string;
  /** One-line "why we said this" — the evidence */
  reason?: string;
  /** Revenue impact if acted on (₹). Drives prioritization. */
  impact_amount?: number;
  /** Currency symbol; defaults to ₹ */
  currency?: string;
  /** Primary CTA label */
  cta_label?: string;
  /** Primary CTA target (route or anchor) */
  cta_href?: string;
  evidence?: ActionEvidence;
  on_dismiss?: (id: string) => void;
  on_snooze?: (id: string, hours: number) => void;
  on_resolve?: (id: string) => void;
}

interface ActionStackProps {
  items: ActionItem[];
  loading?: boolean;
  className?: string;
}

const KIND_ICON: Record<ActionKind, LucideIcon> = {
  renewal_at_risk: UserCheck,
  renewal_imminent: UserCheck,
  payment_failed: CreditCard,
  dues_overdue: AlertTriangle,
  trainer_no_show: UserMinus,
  class_overfill: Users,
  lead_cold: Sparkles,
  inactive_member: UserMinus,
  branch_underperform: AlertTriangle,
  anomaly_check_ins_low: TrendingDown,
  anomaly_check_ins_high: TrendingUp,
  anomaly_revenue_low: TrendingDown,
  anomaly_revenue_high: TrendingUp,
  info: Sparkles,
};

const SEVERITY_BAR: Record<ActionSeverity, string> = {
  high: "bg-destructive",
  medium: "bg-amber-500",
  low: "bg-primary",
};

/**
 * Action Stack — the dashboard's "do this now" queue. Revenue-weighted
 * prioritization. Every item has a primary CTA; dismissal is intentional.
 *
 * This is the Wave-1 scaffolding; the rules engine that feeds it lives in
 * dashboard/action-queue.service.ts (Wave 2).
 */
export function ActionStack({ items, loading, className }: ActionStackProps) {
  const sorted = useMemo(() => sortByImpact(items), [items]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Action Stack
        </h2>
        {sorted.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {sorted.length} item{sorted.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-muted/20 animate-pulse"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyActionStack />
      ) : (
        <ul className="space-y-2">
          {sorted.map((item) => (
            <ActionRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const Icon = KIND_ICON[item.kind] ?? Sparkles;
  const severityBar = SEVERITY_BAR[item.severity];
  const [showWhy, setShowWhy] = useState(false);
  const hasEvidence = !!item.evidence;

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-background/40 transition-colors hover:border-primary/40">
      <div className="flex items-stretch">
      <span className={cn("w-1 shrink-0", severityBar)} aria-hidden />
      <div className="flex flex-1 items-center gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">
            {item.title}
          </p>
          {item.reason && (
            <p className="truncate text-[12px] text-muted-foreground">
              {item.reason}
            </p>
          )}
        </div>

        {item.impact_amount !== undefined && item.impact_amount > 0 && (
          <span className="shrink-0 text-right">
            <span className="block text-[11px] text-muted-foreground">
              at stake
            </span>
            <span className="block text-[13px] font-semibold tabular-nums text-foreground">
              {item.currency ?? "₹"}
              {item.impact_amount.toLocaleString()}
            </span>
          </span>
        )}

        {item.cta_href && (
          <a
            href={item.cta_href}
            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            {item.cta_label ?? "Resolve"}
            <ChevronRight className="h-3 w-3" />
          </a>
        )}

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {hasEvidence && (
            <button
              type="button"
              aria-label="Why we said this"
              title="Why we said this"
              onClick={() => setShowWhy((v) => !v)}
              className={cn(
                "rounded-md p-1 hover:bg-muted/50",
                showWhy
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
          {item.on_resolve && (
            <button
              type="button"
              aria-label="Mark resolved"
              title="Mark resolved"
              onClick={() => item.on_resolve?.(item.id)}
              className="rounded-md p-1 text-muted-foreground hover:bg-success/20 hover:text-success"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          {item.on_snooze && (
            <button
              type="button"
              aria-label="Snooze 24 hours"
              title="Snooze 24h"
              onClick={() => item.on_snooze?.(item.id, 24)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          )}
          {item.on_dismiss && (
            <button
              type="button"
              aria-label="Dismiss"
              title="Dismiss"
              onClick={() => item.on_dismiss?.(item.id)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      </div>
      {showWhy && item.evidence && <WhyPanel evidence={item.evidence} />}
    </li>
  );
}

function WhyPanel({ evidence }: { evidence: ActionEvidence }) {
  return (
    <div className="border-t border-border/40 bg-primary/5 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <LineChart className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-foreground">Why we said this</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
            {evidence.summary}
          </p>
          {(evidence.value !== undefined ||
            evidence.baseline !== undefined ||
            evidence.z_score !== undefined) && (
            <dl className="mt-1.5 grid grid-cols-3 gap-2 text-[10px]">
              {evidence.value !== undefined && (
                <Stat label="Now" value={evidence.value.toLocaleString()} />
              )}
              {evidence.baseline !== undefined && (
                <Stat label="Baseline" value={evidence.baseline.toLocaleString()} />
              )}
              {evidence.delta_pct !== undefined && (
                <Stat
                  label="Δ"
                  value={`${evidence.delta_pct >= 0 ? "+" : ""}${evidence.delta_pct.toFixed(1)}%`}
                />
              )}
              {evidence.z_score !== undefined && (
                <Stat label="z-score" value={evidence.z_score.toFixed(2)} />
              )}
              {evidence.stdev !== undefined && (
                <Stat label="σ" value={evidence.stdev.toLocaleString()} />
              )}
            </dl>
          )}
          <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            source: {evidence.source}
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[12px] font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

function EmptyActionStack() {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-background/20 p-6 text-center">
      <p className="text-[13px] font-medium text-foreground">
        Nothing demands your attention right now.
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        New actions appear here as renewals approach, payments fail, or
        members go quiet.
      </p>
    </div>
  );
}

/**
 * Sort by severity then by ₹ impact descending. Severity outranks impact
 * because a single high-severity item (e.g., trainer no-show in 30 min)
 * should still surface above a stack of low-severity ₹-heavy items.
 */
function sortByImpact(items: ActionItem[]): ActionItem[] {
  const severityRank: Record<ActionSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return [...items].sort((a, b) => {
    const sev = severityRank[a.severity] - severityRank[b.severity];
    if (sev !== 0) return sev;
    return (b.impact_amount ?? 0) - (a.impact_amount ?? 0);
  });
}
