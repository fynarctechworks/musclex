"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Repeat,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useExpenseIntelligence } from "@/features/payments";
import { useCurrency } from "@/lib/hooks/use-currency";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

interface IntelligencePanelProps {
  branchId: string;
}

export function IntelligencePanel({ branchId }: IntelligencePanelProps) {
  const CURRENCY = useCurrency();
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useExpenseIntelligence(branchId);
  const bundle = data as any;

  if (isError) return null;

  const fmt = (n: number) =>
    `${CURRENCY}${Math.abs(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <div className="mb-6 rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Financial Intelligence
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-border p-4 md:grid-cols-3">
          {isLoading || !bundle ? (
            <>
              <LoadingSkeleton className="h-40" />
              <LoadingSkeleton className="h-40" />
              <LoadingSkeleton className="h-40" />
            </>
          ) : (
            <>
              <ProfitLossCard bundle={bundle} fmt={fmt} />
              <CashflowCard bundle={bundle} fmt={fmt} />
              <RecurringCard bundle={bundle} fmt={fmt} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProfitLossCard({
  bundle,
  fmt,
}: {
  bundle: any;
  fmt: (n: number) => string;
}) {
  const pl = bundle.profit_loss ?? {};
  const net = Number(pl.net_profit ?? 0);
  const topCats = [...(pl.expenses_by_category ?? [])]
    .sort((a: any, b: any) => Number(b.total) - Number(a.total))
    .slice(0, 5);
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Profit & Loss
        </p>
        {net >= 0 ? (
          <TrendingUp className="h-4 w-4 text-success" />
        ) : (
          <TrendingDown className="h-4 w-4 text-error" />
        )}
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Revenue</dt>
          <dd className="text-foreground">{fmt(pl.revenue ?? 0)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Refunds</dt>
          <dd className="text-foreground">-{fmt(pl.refunds ?? 0)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Expenses</dt>
          <dd className="text-foreground">-{fmt(pl.expenses ?? 0)}</dd>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2">
          <dt className="font-semibold text-foreground">Net</dt>
          <dd
            className={`font-semibold ${net >= 0 ? "text-success" : "text-error"}`}
          >
            {net < 0 ? "-" : ""}
            {fmt(net)}
          </dd>
        </div>
      </dl>

      {topCats.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Top categories
          </p>
          <ul className="space-y-1 text-xs">
            {topCats.map((c: any) => (
              <li
                key={c.category_id ?? c.category ?? c.name}
                className="flex justify-between text-muted-foreground"
              >
                <span>{c.name ?? c.category}</span>
                <span className="text-foreground">{fmt(c.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CashflowCard({
  bundle,
  fmt,
}: {
  bundle: any;
  fmt: (n: number) => string;
}) {
  const cf = bundle.cashflow ?? {};
  const trend: any[] = cf.history ?? cf.trend ?? [];
  const max = Math.max(...trend.map((t: any) => Math.abs(Number(t.total))), 1);
  const w = 120;
  const h = 36;
  const points = trend
    .map((t: any, i: number) => {
      const x = trend.length <= 1 ? 0 : (i / (trend.length - 1)) * w;
      const y = h - (Math.abs(Number(t.total)) / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const confMap: Record<string, number> = { high: 90, medium: 60, low: 30 };
  const confidencePct =
    typeof cf.confidence === "number"
      ? Math.round(cf.confidence * 100)
      : confMap[cf.confidence as string] ?? 0;

  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Cashflow forecast
      </p>
      {trend.length > 0 && (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="mb-3 h-10 w-full"
          preserveAspectRatio="none"
        >
          <polyline
            fill="none"
            stroke="#4A9FD4"
            strokeWidth="1.5"
            points={points}
          />
        </svg>
      )}
      <p className="text-sm text-muted-foreground">Est. next month</p>
      <p className="text-lg font-semibold text-foreground">
        {fmt(cf.predicted_next_month ?? 0)}
      </p>
      <div className="mt-2">
        <p className="mb-1 text-[10px] uppercase text-muted-foreground">
          Confidence {confidencePct}%
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-primary"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>
      {cf.anomalies && cf.anomalies.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[10px] uppercase text-muted-foreground">
            Anomalies
          </p>
          {cf.anomalies.slice(0, 3).map((a: any) => (
            <div
              key={a.month ?? a.period}
              className="flex items-center gap-1 text-[11px] text-error"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>
                {a.month ?? a.period} — {fmt(a.total)} (z-score:{" "}
                {Number(a.z_score ?? 0).toFixed(1)})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecurringCard({
  bundle,
  fmt,
}: {
  bundle: any;
  fmt: (n: number) => string;
}) {
  const raw = bundle.recurring;
  const rec: any[] = Array.isArray(raw) ? raw : raw?.recurring ?? [];
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Repeat className="h-4 w-4 text-primary" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recurring expenses
        </p>
      </div>
      {rec.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No recurring patterns detected yet.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rec.slice(0, 6).map((r: any, i: number) => (
            <li
              key={r.key ?? r.last_expense_id ?? i}
              className="flex items-start justify-between gap-2 border-b border-border pb-1 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-foreground">
                  {r.vendor || r.category_name || r.category || r.description}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {r.category_name ?? r.category} · {r.months_observed} months
                </p>
              </div>
              <span className="whitespace-nowrap text-foreground">
                {fmt(r.average_amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
