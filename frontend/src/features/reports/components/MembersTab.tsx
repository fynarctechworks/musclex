'use client';

import { Users, UserPlus, UserMinus, AlertTriangle } from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { KPICard } from '@/components/shared';
import { LoadingSkeleton } from '@/components/shared';
import type {
  MembershipAnalyticsResponse,
  ChurnRiskEntry,
  TrendDataPoint,
} from '../types';

interface MembersTabProps {
  memberships: MembershipAnalyticsResponse | undefined;
  churnRisk: ChurnRiskEntry[] | undefined;
  trend: TrendDataPoint[] | undefined;
  isLoading: boolean;
}

const CHURN_COLORS: Record<string, string> = {
  low: '#34C77A',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#991B1B',
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

export function MembersTab({ memberships, churnRisk, trend, isLoading }: MembersTabProps) {
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

  const summary = memberships?.summary;
  const records = memberships?.records ?? [];
  const totalActive = Number(summary?._sum?.total_active ?? 0);
  const totalSignups = Number(summary?._sum?.new_signups ?? 0);
  const totalCancellations = Number(summary?._sum?.cancellations ?? 0);
  const avgChurn = Number(summary?._avg?.churn_rate ?? 0);

  // Membership records sorted by period for bar chart
  const periodData = records
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .map((r) => ({
      period: r.period_start,
      new_signups: r.new_signups,
      renewals: r.renewals,
      cancellations: r.cancellations,
      plan: r.plan?.name ?? 'All Plans',
    }));

  // Churn risk pie data
  const churnPie = (churnRisk ?? []).map((c) => ({
    name: c.churn_risk,
    value: c._count,
    avgScore: Number(c._avg?.engagement_score ?? 0).toFixed(0),
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Active Members" value={totalActive.toLocaleString()} icon={Users} />
        <KPICard label="New Signups" value={totalSignups.toLocaleString()} icon={UserPlus} />
        <KPICard label="Cancellations" value={totalCancellations.toLocaleString()} icon={UserMinus} />
        <KPICard label="Avg Churn Rate" value={`${avgChurn.toFixed(1)}%`} icon={AlertTriangle} />
      </div>

      {/* Member Growth Trend */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Member Growth Trend</h3>
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
              <Legend />
              <Line
                type="monotone"
                dataKey="active_members"
                name="Active Members"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="new_members"
                name="New Members"
                stroke="#34C77A"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row: Signups/Cancellations + Churn Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signups vs Cancellations */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Signups vs Cancellations</h3>
          {periodData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodData}>
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
                  <Bar dataKey="new_signups" name="Signups" fill="#34C77A" />
                  <Bar dataKey="renewals" name="Renewals" fill="hsl(var(--primary))" />
                  <Bar dataKey="cancellations" name="Cancellations" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No membership period data</p>
          )}
        </div>

        {/* Churn Risk Distribution */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Churn Risk Distribution</h3>
          {churnPie.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-52 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={churnPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {churnPie.map((entry) => (
                        <Cell key={entry.name} fill={CHURN_COLORS[entry.name] ?? '#8884d8'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {churnPie.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: CHURN_COLORS[entry.name] ?? '#8884d8' }}
                    />
                    <span className="capitalize text-foreground">{entry.name}</span>
                    <span className="text-muted-foreground">({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No churn data yet</p>
          )}
        </div>
      </div>

      {/* Plan Breakdown Table */}
      {records.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Membership by Plan</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-medium">Plan</th>
                  <th className="text-right py-2 font-medium">Active</th>
                  <th className="text-right py-2 font-medium">Signups</th>
                  <th className="text-right py-2 font-medium">Renewals</th>
                  <th className="text-right py-2 font-medium">Cancellations</th>
                  <th className="text-right py-2 font-medium">Churn %</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 20).map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{r.plan?.name ?? 'Unknown'}</td>
                    <td className="py-2 text-right text-foreground">{r.total_active}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.new_signups}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.renewals}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.cancellations}</td>
                    <td className="py-2 text-right text-muted-foreground">{Number(r.churn_rate).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
