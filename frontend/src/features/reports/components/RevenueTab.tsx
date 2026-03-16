'use client';

import { DollarSign, TrendingUp, Receipt, ArrowUpRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { KPICard } from '@/components/shared';
import { LoadingSkeleton } from '@/components/shared';
import type { RevenueAnalyticsResponse, TrendDataPoint } from '../types';

interface RevenueTabProps {
  revenue: RevenueAnalyticsResponse | undefined;
  trend: TrendDataPoint[] | undefined;
  isLoading: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  membership: 'hsl(var(--primary))',
  personal_training: '#34C77A',
  classes: '#F59E0B',
  retail: '#6BBFE8',
  other: '#A78BFA',
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

export function RevenueTab({ revenue, trend, isLoading }: RevenueTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <LoadingSkeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  const totals = revenue?.totals ?? [];
  const records = revenue?.records ?? [];
  const totalRevenue = totals.reduce((sum, t) => sum + Number(t._sum?.amount ?? 0), 0);
  const totalTransactions = totals.reduce((sum, t) => sum + Number(t._sum?.transaction_count ?? 0), 0);
  const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const topType = totals.length > 0
    ? totals.reduce((a, b) => (Number(a._sum?.amount ?? 0) > Number(b._sum?.amount ?? 0) ? a : b))
    : null;

  // Group records by period for stacked bar
  const periodMap = new Map<string, Record<string, string | number>>();
  for (const r of records) {
    const key = r.period_start;
    const existing = periodMap.get(key) ?? { period: key };
    existing[r.revenue_type] = Number(r.amount);
    periodMap.set(key, existing);
  }
  const barData = Array.from(periodMap.values()).sort((a, b) =>
    String(a.period).localeCompare(String(b.period))
  );

  const revenueTypes = Array.from(new Set(records.map((r) => r.revenue_type)));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} icon={DollarSign} />
        <KPICard label="Transactions" value={totalTransactions.toLocaleString()} icon={Receipt} />
        <KPICard label="Avg Transaction" value={`₹${avgTransaction.toFixed(0)}`} icon={TrendingUp} />
        <KPICard
          label="Top Source"
          value={topType ? topType.revenue_type.replace(/_/g, ' ') : '—'}
          icon={ArrowUpRight}
        />
      </div>

      {/* Revenue Trend */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Revenue Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  try { return format(parseISO(v), 'MMM d'); } catch { return v; }
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="total_revenue"
                name="Revenue (₹)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue by Type (stacked bar) */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Revenue by Type</h3>
        {barData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="period"
                  tickFormatter={(v) => {
                    try { return format(parseISO(v), 'MMM d'); } catch { return v; }
                  }}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {revenueTypes.map((type) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    name={type.replace(/_/g, ' ')}
                    stackId="revenue"
                    fill={TYPE_COLORS[type] ?? '#8884d8'}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No revenue breakdown data</p>
        )}
      </div>

      {/* Revenue Totals Table */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Revenue Summary by Type</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 font-medium">Type</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-right py-2 font-medium">Transactions</th>
                <th className="text-right py-2 font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t) => {
                const amt = Number(t._sum?.amount ?? 0);
                const pct = totalRevenue > 0 ? ((amt / totalRevenue) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={t.revenue_type} className="border-b border-border/50">
                    <td className="py-2 capitalize text-foreground">{t.revenue_type.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-right text-foreground">₹{amt.toLocaleString()}</td>
                    <td className="py-2 text-right text-muted-foreground">{t._sum?.transaction_count ?? 0}</td>
                    <td className="py-2 text-right text-muted-foreground">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
