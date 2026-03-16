'use client';

import { CalendarCheck, TrendingUp, Clock, BarChart3 } from 'lucide-react';
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
import type { TrendDataPoint, ClassAnalyticsRecord } from '../types';

interface AttendanceTabProps {
  trend: TrendDataPoint[] | undefined;
  classes: ClassAnalyticsRecord[] | undefined;
  isLoading: boolean;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

export function AttendanceTab({ trend, classes, isLoading }: AttendanceTabProps) {
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

  const trendData = trend ?? [];
  const totalVisits = trendData.reduce((sum, d) => sum + d.total_visits, 0);
  const totalClassesHeld = trendData.reduce((sum, d) => sum + d.classes_held, 0);
  const avgDailyVisits = trendData.length > 0 ? Math.round(totalVisits / trendData.length) : 0;
  const peakDay = trendData.length > 0
    ? trendData.reduce((a, b) => (a.total_visits > b.total_visits ? a : b))
    : null;

  // Class analytics sorted by bookings
  const classRecords = (classes ?? [])
    .sort((a, b) => b.total_bookings - a.total_bookings);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Visits" value={totalVisits.toLocaleString()} icon={CalendarCheck} />
        <KPICard label="Avg Daily Visits" value={avgDailyVisits} icon={TrendingUp} />
        <KPICard label="Classes Held" value={totalClassesHeld.toLocaleString()} icon={BarChart3} />
        <KPICard
          label="Peak Day"
          value={peakDay ? (() => { try { return format(parseISO(peakDay.date), 'MMM d'); } catch { return peakDay.date; } })() : '—'}
          icon={Clock}
        />
      </div>

      {/* Visit Trend */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Daily Visits & Classes</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
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
              <Legend />
              <Line
                type="monotone"
                dataKey="total_visits"
                name="Visits"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="classes_held"
                name="Classes Held"
                stroke="#34C77A"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Class Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Classes by Bookings Bar */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Top Classes by Bookings</h3>
          {classRecords.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={classRecords.slice(0, 10).map((c) => ({
                    name: c.class_template?.name ?? 'Unknown',
                    bookings: c.total_bookings,
                    sessions: c.total_sessions,
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={100} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="bookings" name="Bookings" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No class data</p>
          )}
        </div>

        {/* Class Stats Table */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Class Performance</h3>
          {classRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 font-medium">Class</th>
                    <th className="text-right py-2 font-medium">Occupancy</th>
                    <th className="text-right py-2 font-medium">No-Show</th>
                    <th className="text-right py-2 font-medium">Avg Attend</th>
                  </tr>
                </thead>
                <tbody>
                  {classRecords.slice(0, 12).map((c) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-2 text-foreground truncate max-w-[140px]">
                        {c.class_template?.name ?? 'Unknown'}
                      </td>
                      <td className="py-2 text-right text-foreground">
                        {Number(c.occupancy_rate).toFixed(0)}%
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {Number(c.no_show_rate).toFixed(0)}%
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {Number(c.average_attendance).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No class data</p>
          )}
        </div>
      </div>
    </div>
  );
}
