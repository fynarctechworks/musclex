'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader, AccessDenied } from '@/components/shared';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api';
import {
  OverviewTab,
  RevenueTab,
  MembersTab,
  AttendanceTab,
  TrainersTab,
  MarketingTab,
  SubscriptionsTab,
  BranchesTab,
} from '@/features/reports/components';
import {
  useAnalyticsDashboard,
  useDailyMetricsTrend,
  useRevenueAnalytics,
  useMembershipAnalytics,
  useChurnRisk,
  useClassAnalytics,
  useTrainerAnalytics,
  useTrainerLeaderboard,
  useCampaignAnalytics,
  useBranchComparison,
} from '@/features/reports';
import { useSubscriptionMetrics } from '@/features/memberships';
import type { Branch } from '@/types';

export default function GymReportsPage() {
  // Gym-wide reporting exposes revenue — gate on analytics, matching the
  // backend @Permissions({ module: 'analytics' }) on /api/v1/analytics/*.
  const { allowed, checked } = useRequirePermission('analytics', 'view', 'deny');
  const { activeBranchId } = useAuthStore();

  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  );
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const enabled = checked && allowed;
  const range = useMemo(
    () => ({
      start_date: startDate,
      end_date: endDate,
      ...(activeBranchId ? { branch_id: activeBranchId } : {}),
    }),
    [startDate, endDate, activeBranchId],
  );

  const dashboard = useAnalyticsDashboard(range);
  const trend = useDailyMetricsTrend(range);
  const revenue = useRevenueAnalytics(range);
  const memberships = useMembershipAnalytics(range);
  const churn = useChurnRisk({ branch_id: activeBranchId || undefined });
  const classes = useClassAnalytics(range);
  const trainers = useTrainerAnalytics(range);
  const leaderboard = useTrainerLeaderboard(
    { branch_id: activeBranchId || undefined },
  );
  const campaigns = useCampaignAnalytics(range);
  const branchComparison = useBranchComparison(range);
  const subscriptions = useSubscriptionMetrics(activeBranchId || undefined);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient.get<Branch[]>('/branches'),
    enabled,
  });

  const branchNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of branches ?? []) map[b.id] = b.name;
    return map;
  }, [branches]);

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="analytics" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Reports"
        description="Revenue, membership, attendance, and performance analytics"
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-auto bg-background border-border text-foreground"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-auto bg-background border-border text-foreground"
            />
          </div>
        }
      />

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="trainers">Trainers</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab
            dashboard={dashboard.data}
            trend={trend.data}
            isLoading={dashboard.isLoading || trend.isLoading}
          />
        </TabsContent>

        <TabsContent value="revenue" className="mt-6">
          <RevenueTab
            revenue={revenue.data}
            trend={trend.data}
            isLoading={revenue.isLoading}
            isError={revenue.isError}
          />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MembersTab
            memberships={memberships.data}
            churnRisk={churn.data}
            trend={trend.data}
            isLoading={memberships.isLoading}
            isError={memberships.isError}
          />
        </TabsContent>

        <TabsContent value="attendance" className="mt-6">
          <AttendanceTab
            trend={trend.data}
            classes={classes.data}
            isLoading={trend.isLoading || classes.isLoading}
            isError={classes.isError}
          />
        </TabsContent>

        <TabsContent value="trainers" className="mt-6">
          <TrainersTab
            trainers={trainers.data}
            leaderboard={leaderboard.data}
            isLoading={trainers.isLoading || leaderboard.isLoading}
            isError={trainers.isError}
          />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-6">
          <SubscriptionsTab
            metrics={subscriptions.data}
            isLoading={subscriptions.isLoading}
          />
        </TabsContent>

        <TabsContent value="marketing" className="mt-6">
          <MarketingTab
            campaigns={campaigns.data}
            isLoading={campaigns.isLoading}
            isError={campaigns.isError}
          />
        </TabsContent>

        <TabsContent value="branches" className="mt-6">
          <BranchesTab
            branches={branchComparison.data}
            branchNames={branchNames}
            isLoading={branchComparison.isLoading}
            isError={branchComparison.isError}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
