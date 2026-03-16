'use client';

import { useState, lazy, Suspense } from 'react';
import { Download, Calendar } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader, LoadingSkeleton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  useAnalyticsDashboard,
  useDailyMetricsTrend,
  useRevenueAnalytics,
  useMembershipAnalytics,
  useChurnRisk,
  useClassAnalytics,
  useCampaignAnalytics,
  useTrainerAnalytics,
  useTrainerLeaderboard,
} from '@/features/reports';
import { reportsApi } from '@/features/reports';
import type { ReportTab } from '@/features/reports';
import { useSubscriptionMetrics } from '@/features/memberships';
import { toast } from 'sonner';

// Lazy load chart-heavy tab components
const OverviewTab = lazy(() => import('@/features/reports/components/OverviewTab').then(m => ({ default: m.OverviewTab })));
const RevenueTab = lazy(() => import('@/features/reports/components/RevenueTab').then(m => ({ default: m.RevenueTab })));
const MembersTab = lazy(() => import('@/features/reports/components/MembersTab').then(m => ({ default: m.MembersTab })));
const AttendanceTab = lazy(() => import('@/features/reports/components/AttendanceTab').then(m => ({ default: m.AttendanceTab })));
const MarketingTab = lazy(() => import('@/features/reports/components/MarketingTab').then(m => ({ default: m.MarketingTab })));
const TrainersTab = lazy(() => import('@/features/reports/components/TrainersTab').then(m => ({ default: m.TrainersTab })));
const SubscriptionsTab = lazy(() => import('@/features/reports/components/SubscriptionsTab').then(m => ({ default: m.SubscriptionsTab })));

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  const filters = { start_date: startDate, end_date: endDate };

  // ── Queries ─────────────────────────────────────────────
  const dashboard = useAnalyticsDashboard(filters);
  const trend = useDailyMetricsTrend(filters);
  const revenue = useRevenueAnalytics(filters);
  const memberships = useMembershipAnalytics(filters);
  const churnRisk = useChurnRisk();
  const classes = useClassAnalytics(filters);
  const campaigns = useCampaignAnalytics({ start_date: startDate, end_date: endDate });
  const trainers = useTrainerAnalytics(filters);
  const leaderboard = useTrainerLeaderboard(filters);
  const subscriptionMetrics = useSubscriptionMetrics();

  // ── Export Handler ──────────────────────────────────────
  type ExportableReport = 'revenue' | 'membership' | 'attendance' | 'trainers' | 'inventory';

  const handleExport = async (type: ExportableReport) => {
    setExporting(true);
    try {
      const exportFn = reportsApi[type];
      const response = await exportFn({
        start_date: startDate,
        end_date: endDate,
        format: 'csv',
      });
      // Backend returns CSV as string
      const csvContent = typeof response === 'string' ? response : JSON.stringify(response);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${startDate}-to-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const exportTypeMap: Record<ReportTab, ExportableReport | null> = {
    overview: null,
    revenue: 'revenue',
    members: 'membership',
    attendance: 'attendance',
    marketing: null,
    trainers: 'trainers',
    subscriptions: 'membership',
  };

  const exportType = exportTypeMap[activeTab];

  return (
    <AppLayout>
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive business intelligence dashboards"
        actions={
          <div className="flex items-center gap-3">
            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36 h-9"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36 h-9"
              />
            </div>
            {/* Export */}
            {exportType && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(exportType)}
                disabled={exporting}
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTab)}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="trainers">Trainers</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Suspense fallback={<LoadingSkeleton />}>
          <OverviewTab
            dashboard={dashboard.data as ReturnType<typeof useAnalyticsDashboard>['data']}
            trend={trend.data as ReturnType<typeof useDailyMetricsTrend>['data']}
            isLoading={dashboard.isLoading || trend.isLoading}
          />
          </Suspense>
        </TabsContent>

        <TabsContent value="revenue">
          <Suspense fallback={<LoadingSkeleton />}>
          <RevenueTab
            revenue={revenue.data as ReturnType<typeof useRevenueAnalytics>['data']}
            trend={trend.data as ReturnType<typeof useDailyMetricsTrend>['data']}
            isLoading={revenue.isLoading || trend.isLoading}
          />
          </Suspense>
        </TabsContent>

        <TabsContent value="members">
          <Suspense fallback={<LoadingSkeleton />}>
          <MembersTab
            memberships={memberships.data as ReturnType<typeof useMembershipAnalytics>['data']}
            churnRisk={churnRisk.data as ReturnType<typeof useChurnRisk>['data']}
            trend={trend.data as ReturnType<typeof useDailyMetricsTrend>['data']}
            isLoading={memberships.isLoading || churnRisk.isLoading}
          />
          </Suspense>
        </TabsContent>

        <TabsContent value="attendance">
          <Suspense fallback={<LoadingSkeleton />}>
          <AttendanceTab
            trend={trend.data as ReturnType<typeof useDailyMetricsTrend>['data']}
            classes={classes.data as ReturnType<typeof useClassAnalytics>['data']}
            isLoading={trend.isLoading || classes.isLoading}
          />
          </Suspense>
        </TabsContent>

        <TabsContent value="marketing">
          <Suspense fallback={<LoadingSkeleton />}>
          <MarketingTab
            campaigns={campaigns.data as ReturnType<typeof useCampaignAnalytics>['data']}
            isLoading={campaigns.isLoading}
          />
          </Suspense>
        </TabsContent>

        <TabsContent value="trainers">
          <Suspense fallback={<LoadingSkeleton />}>
          <TrainersTab
            trainers={trainers.data as ReturnType<typeof useTrainerAnalytics>['data']}
            leaderboard={leaderboard.data as ReturnType<typeof useTrainerLeaderboard>['data']}
            isLoading={trainers.isLoading || leaderboard.isLoading}
          />
          </Suspense>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Suspense fallback={<LoadingSkeleton />}>
            <SubscriptionsTab
              metrics={subscriptionMetrics.data}
              isLoading={subscriptionMetrics.isLoading}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
    </AppLayout>
  );
}
