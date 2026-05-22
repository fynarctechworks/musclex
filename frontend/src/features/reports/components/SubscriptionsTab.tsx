'use client';

import { KPICard } from '@/components/shared';
import {
  CreditCard,
  TrendingUp,
  UserMinus,
  Users,
  BarChart3,
  Clock,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { SubscriptionMetrics } from '@/features/memberships';

interface SubscriptionsTabProps {
  metrics: SubscriptionMetrics | undefined;
  isLoading: boolean;
}

const PLAN_COLORS = [
  'hsl(var(--primary))',
  '#34C77A',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
];

export function SubscriptionsTab({ metrics, isLoading }: SubscriptionsTabProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No subscription data available for the selected period.
      </div>
    );
  }

  const planDistribution = metrics.plan_distribution ?? [];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          label="Active Subscriptions"
          value={metrics.active_subscriptions}
          icon={CreditCard}
        />
        <KPICard
          label="Monthly Recurring Revenue"
          value={`₹${(metrics.mrr ?? 0).toLocaleString()}`}
          icon={BarChart3}
        />
        <KPICard
          label="Expiring This Month"
          value={metrics.expiring_this_month}
          icon={Clock}
        />
        <KPICard
          label="Cancelled This Month"
          value={metrics.cancelled_this_month}
          icon={UserMinus}
        />
        <KPICard
          label="Trial Members"
          value={metrics.trial_members}
          icon={Users}
        />
        <KPICard
          label="Churn Rate"
          value={`${(metrics.churn_rate ?? 0).toFixed(1)}%`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution Pie */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">
            Plan Distribution
          </h3>
          {planDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planDistribution}
                    dataKey="count"
                    nameKey="plan_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(props: { name?: string; percent?: number }) =>
                      `${props.name ?? ''} (${(((props.percent ?? 0)) * 100).toFixed(0)}%)`
                    }
                  >
                    {planDistribution.map((_, index) => (
                      <Cell
                        key={index}
                        fill={PLAN_COLORS[index % PLAN_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No plan distribution data
            </p>
          )}
        </div>

        {/* Plan Revenue Bar Chart */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">
            Members by Plan
          </h3>
          {planDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planDistribution}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="plan_name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No plan data
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
