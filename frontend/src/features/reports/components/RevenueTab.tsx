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
import { ReportTable } from './ReportTable';
import { formatCurrency, formatNumber, formatPercent, formatLabel } from '../utils/format';
import type { ReportColumn } from '../utils/export';
import type { RevenueAnalyticsResponse, TrendDataPoint } from '../types';

interface RevenueTabProps {
  revenue: RevenueAnalyticsResponse | undefined;
  trend: TrendDataPoint[] | undefined;
  isLoading: boolean;
  isError?: boolean;
}

interface RevenueRow {
  revenue_type: string;
  amount: number;
  transactions: number;
  share: number;
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

export function RevenueTab({ revenue, trend, isLoading, isError }: RevenueTabProps) {
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
        <KPICard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} />
        <KPICard label="Transactions" value={formatNumber(totalTransactions)} icon={Receipt} />
        <KPICard label="Avg Transaction" value={formatCurrency(avgTransaction)} icon={TrendingUp} />
        <KPICard
          label="Top Source"
          value={topType ? formatLabel(topType.revenue_type) : '—'}
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
      {(() => {
        const tableRows: RevenueRow[] = totals.map((t) => {
          const amt = Number(t._sum?.amount ?? 0);
          return {
            revenue_type: t.revenue_type,
            amount: amt,
            transactions: Number(t._sum?.transaction_count ?? 0),
            share: totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0,
          };
        });
        const cols: ReportColumn<RevenueRow>[] = [
          { key: 'revenue_type', label: 'Type', format: (r) => formatLabel(r.revenue_type) },
          { key: 'amount', label: 'Amount', numeric: true, format: (r) => formatCurrency(r.amount) },
          { key: 'transactions', label: 'Transactions', numeric: true, format: (r) => formatNumber(r.transactions) },
          { key: 'share', label: '% of Total', numeric: true, format: (r) => formatPercent(r.share) },
        ];
        return (
          <ReportTable
            title="Revenue Summary by Type"
            description="Aggregated by revenue source for the selected period"
            columns={cols}
            rows={tableRows}
            isLoading={isLoading}
            isError={isError}
            paginated={false}
            rowKey={(r) => r.revenue_type}
            emptyText="No revenue records yet"
            totals={{
              revenue_type: 'Total',
              amount: formatCurrency(totalRevenue),
              transactions: formatNumber(totalTransactions),
              share: '100.0%',
            }}
          />
        );
      })()}
    </div>
  );
}
