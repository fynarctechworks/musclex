"use client";

import { useQuery } from "@tanstack/react-query";
import { X, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { track } from "@/hooks/use-telemetry";

export type InspectableMetric =
  | "active_members"
  | "today_revenue"
  | "mrr"
  | "check_ins_today"
  | "renewals_at_risk_7d"
  | "outstanding_dues";

interface KpiInspection {
  metric: InspectableMetric;
  formula: string;
  source_tables: string[];
  query: string;
  value: number;
  as_of: string;
  sample_rows: Array<Record<string, unknown>>;
  notes?: string;
}

interface KpiInspectorProps {
  metric: InspectableMetric;
  branchId?: string;
  onClose: () => void;
}

const TITLES: Record<InspectableMetric, string> = {
  active_members: "Active Members",
  today_revenue: "Today's Revenue",
  mrr: "MRR",
  check_ins_today: "Check-ins Today",
  renewals_at_risk_7d: "Renewals at Risk (7d)",
  outstanding_dues: "Outstanding Dues",
};

/**
 * "Show your work" panel — Wave 7. Renders the formula, source tables,
 * query, and a representative sample of rows that compose a KPI. Clicking
 * the magnifying glass on a Pulse card opens this.
 *
 * Trust principle: if a user disputes a number, they should see exactly
 * what produced it — without filing a support ticket.
 */
export function KpiInspector({ metric, branchId, onClose }: KpiInspectorProps) {
  useEffect(() => {
    track("dashboard.kpi.inspect_open", { metric, branch_id: branchId });
  }, [metric, branchId]);

  const params = branchId ? { branch_id: branchId } : undefined;
  const { data, isLoading } = useQuery<KpiInspection>({
    queryKey: ["dashboard", "inspect", metric, branchId],
    queryFn: () =>
      apiClient.get(`/dashboard/inspect/${metric}`, { params }),
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] bg-card border border-border rounded-t-xl sm:rounded-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">
              {TITLES[metric]} — show your work
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading || !data ? (
            <div className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted/40 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-muted/40 animate-pulse" />
              <div className="h-24 w-full rounded bg-muted/30 animate-pulse" />
            </div>
          ) : (
            <>
              <Section label="Value">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {data.value.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    as of {new Date(data.as_of).toLocaleString()}
                  </span>
                </div>
              </Section>

              <Section label="Formula">
                <p className="text-[13px] text-foreground leading-relaxed">
                  {data.formula}
                </p>
              </Section>

              <Section label="Source tables">
                <div className="flex flex-wrap gap-1.5">
                  {data.source_tables.map((t) => (
                    <code
                      key={t}
                      className="px-1.5 py-0.5 rounded bg-muted/40 text-[11px] font-mono text-foreground"
                    >
                      {t}
                    </code>
                  ))}
                </div>
              </Section>

              <Section label="Query (illustrative)">
                <pre className="rounded-md bg-muted/30 p-2 text-[11px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                  {data.query}
                </pre>
              </Section>

              {data.notes && (
                <Section label="Notes">
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {data.notes}
                  </p>
                </Section>
              )}

              {data.sample_rows.length > 0 && (
                <Section label={`Sample rows (${data.sample_rows.length})`}>
                  <div className="rounded-md border border-border/50 overflow-hidden">
                    <SampleTable rows={data.sample_rows} />
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
      </p>
      {children}
    </section>
  );
}

function SampleTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) return null;
  const cols = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-background/40">
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                className="px-2 py-1.5 text-left font-mono uppercase tracking-wide text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={cn(
                "border-t border-border/40",
                i % 2 === 0 ? "bg-card" : "bg-background/20",
              )}
            >
              {cols.map((c) => (
                <td
                  key={c}
                  className="px-2 py-1.5 font-mono text-foreground tabular-nums truncate max-w-[160px]"
                >
                  {formatCell(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") return v.toLocaleString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
