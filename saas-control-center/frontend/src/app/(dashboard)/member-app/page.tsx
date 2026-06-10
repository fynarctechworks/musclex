'use client';

import {
  Users,
  UserPlus,
  Activity,
  CheckCircle2,
  Building2,
  UserX,
  CalendarDays,
  Smartphone,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { useMemberAppOverview, useMemberAppGrowth } from '@/hooks/use-member-app';

export default function MemberAppAnalyticsPage() {
  const { data: o, isLoading, isError, refetch } = useMemberAppOverview();
  const { data: growth } = useMemberAppGrowth(30);

  return (
    <div>
      <PageHeader
        title="Member App Analytics"
        description="Growth & engagement across the public fitness app"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-lg" />
          ))}
        </div>
      ) : isError || !o ? (
        <ErrorState title="Could not load analytics" onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard title="Total Registrations" value={o.totalRegistrations} icon={Users} />
            <KpiCard title="App Opens (proxy for installs)" value={o.firstOpens} icon={Smartphone} />
            <KpiCard title="Daily Active" value={o.dau} icon={Activity} />
            <KpiCard title="Monthly Active" value={o.mau} icon={Activity} />
            <KpiCard
              title="Onboarding Completion"
              value={`${o.completionPct}%`}
              subtitle={`${o.onboardingCompleted}/${o.onboardingStarted} completed`}
              icon={CheckCircle2}
            />
            <KpiCard title="Gym Members" value={o.withMembership} icon={Building2} />
            <KpiCard title="Without Membership" value={o.withoutMembership} icon={UserPlus} />
            <KpiCard title="Expired Members" value={o.expired} icon={UserX} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard title="Weekly Active" value={o.wau} icon={Activity} />
            <KpiCard title="New Today" value={o.newToday} icon={CalendarDays} />
            <KpiCard title="New This Week" value={o.newThisWeek} icon={CalendarDays} />
            <KpiCard title="New This Month" value={o.newThisMonth} icon={CalendarDays} />
          </div>

          {/* Executive rates (Phase 7.10) */}
          <h3 className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conversion & retention
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard
              title="Onboarding Completion"
              value={`${o.onboardingCompletionRate}%`}
              subtitle="of all registrations"
              icon={CheckCircle2}
            />
            <KpiCard
              title="Membership Conversion"
              value={`${o.membershipConversionRate}%`}
              subtitle="registered → member"
              icon={Building2}
            />
            <KpiCard
              title="Stickiness (DAU/MAU)"
              value={`${o.stickiness}%`}
              icon={Activity}
            />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-card p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">
              Registrations — last 30 days
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="registrations"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
