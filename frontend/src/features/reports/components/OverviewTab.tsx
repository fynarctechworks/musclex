'use client';

import {
  DollarSign,
  TrendingUp,
  Users,
  CalendarCheck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { KPICard } from '@/components/shared';
import { LoadingSkeleton } from '@/components/shared';
import type { DashboardSummary, TrendDataPoint } from '../types';

interface OverviewTabProps {
  dashboard: DashboardSummary | undefined;
  trend: TrendDataPoint[] | undefined;
  isLoading: boolean;
}

const REVENUE_COLORS = ['hsl(var(--primary))', '#34C77A', '#F59E0B', '#EF4444', '#6BBFE8'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

export function OverviewTab({ dashboard, trend, isLoading }: OverviewTabProps) {
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

  const today = dashboard?.today;
  const revBreakdown = dashboard?.revenue_breakdown ?? [];
  const memberSummary = dashboard?.membership_summary;
  const topClasses = dashboard?.top_classes ?? [];

  // Compute previous day comparison from trend
  const prevDay = trend && trend.length >= 2 ? trend[trend.length - 2] : null;
  const revTrend = today && prevDay && prevDay.total_revenue > 0
    ? { value: Math.round(((today.total_revenue - prevDay.total_revenue) / prevDay.total_revenue) * 100), isPositive: today.total_revenue >= prevDay.total_revenue }
    : undefined;
  const visitTrend = today && prevDay && prevDay.total_visits > 0
    ? { value: Math.round(((today.total_visits - prevDay.total_visits) / prevDay.total_visits) * 100), isPositive: today.total_visits >= prevDay.total_visits }
    : undefined;

  const pieData = revBreakdown.map((r) => ({
    name: r.revenue_type.replace(/_/g, ' '),
    value: Number(r._sum?.amount ?? 0),
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Today's Revenue"
          value={`₹${(today?.total_revenue ?? 0).toLocaleString()}`}
          icon={DollarSign}
          trend={revTrend}
        />
        <KPICard
          label="Active Members"
          value={memberSummary?._sum?.total_active ?? today?.active_members ?? 0}
          icon={Users}
        />
        <KPICard
          label="Today's Visits"
          value={today?.total_visits ?? 0}
          icon={CalendarCheck}
          trend={visitTrend}
        />
        <KPICard
          label="New Signups"
          value={memberSummary?._sum?.new_signups ?? today?.new_members ?? 0}
          icon={TrendingUp}
        />
      </div>

      {/* Trend Chart */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Revenue & Visits Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  try { return format(parseISO(v), 'MMM d'); } catch { return v; }
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="total_revenue"
                name="Revenue (₹)"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.15}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="total_visits"
                name="Visits"
                stroke="#34C77A"
                fill="#34C77A"
                fillOpacity={0.1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row: Revenue Mix + Top Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Pie */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Revenue Breakdown</h3>
          {pieData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={REVENUE_COLORS[i % REVENUE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No revenue data yet</p>
          )}
        </div>

        {/* Top Classes */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Top Classes by Bookings</h3>
          {topClasses.length > 0 ? (
            <div className="space-y-3">
              {topClasses.slice(0, 8).map((cls, i) => {
                const name = cls.class_template?.name ?? 'Unknown';
                const bookings = cls._sum?.total_bookings ?? 0;
                const maxBookings = topClasses[0]?._sum?.total_bookings ?? 1;
                return (
                  <div key={cls.class_template_id ?? i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{name}</span>
                      <span className="text-muted-foreground">{bookings}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(bookings / maxBookings) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No class data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
