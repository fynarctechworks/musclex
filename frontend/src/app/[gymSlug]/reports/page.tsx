'use client';

import { useMemo, useState, lazy, Suspense } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader, LoadingSkeleton, AccessDenied } from '@/components/shared';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  useBranchComparison,
} from '@/features/reports';
import type { ReportTab } from '@/features/reports';
import { useSubscriptionMetrics } from '@/features/memberships';
import { useBranches } from '@/features/branches';
import { useAuthStore } from '@/stores/auth-store';
import { exportReport, type ExportFormat, type ReportColumn } from '@/features/reports/utils/export';
import { toast } from 'sonner';

// Lazy-loaded chart-heavy tab components
const OverviewTab = lazy(() =>
  import('@/features/reports/components/OverviewTab').then((m) => ({ default: m.OverviewTab })),
);
const RevenueTab = lazy(() =>
  import('@/features/reports/components/RevenueTab').then((m) => ({ default: m.RevenueTab })),
);
const MembersTab = lazy(() =>
  import('@/features/reports/components/MembersTab').then((m) => ({ default: m.MembersTab })),
);
const AttendanceTab = lazy(() =>
  import('@/features/reports/components/AttendanceTab').then((m) => ({ default: m.AttendanceTab })),
);
const MarketingTab = lazy(() =>
  import('@/features/reports/components/MarketingTab').then((m) => ({ default: m.MarketingTab })),
);
const TrainersTab = lazy(() =>
  import('@/features/reports/components/TrainersTab').then((m) => ({ default: m.TrainersTab })),
);
const SubscriptionsTab = lazy(() =>
  import('@/features/reports/components/SubscriptionsTab').then((m) => ({ default: m.SubscriptionsTab })),
);
const BranchesTab = lazy(() =>
  import('@/features/reports/components/BranchesTab').then((m) => ({ default: m.BranchesTab })),
);

interface BuiltExport {
  title: string;
  filename: string;
  columns: ReportColumn<Record<string, unknown>>[];
  rows: Record<string, unknown>[];
  totals?: Record<string, string | number>;
}

export default function ReportsPage() {
  const { allowed, checked } = useRequirePermission('reports', 'view', 'deny');
  const { activeBranchId, user } = useAuthStore();
  const organizationId = user?.organization_id;
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const filters = { start_date: startDate, end_date: endDate, branch_id: activeBranchId || undefined };

  // ── Queries ─────────────────────────────────────────────
  const dashboard = useAnalyticsDashboard(filters);
  const trend = useDailyMetricsTrend(filters);
  const revenue = useRevenueAnalytics(filters);
  const memberships = useMembershipAnalytics(filters);
  const churnRisk = useChurnRisk({ branch_id: activeBranchId || undefined });
  const classes = useClassAnalytics(filters);
  const campaigns = useCampaignAnalytics({ start_date: startDate, end_date: endDate });
  const trainers = useTrainerAnalytics(filters);
  const leaderboard = useTrainerLeaderboard(filters);
  const subscriptionMetrics = useSubscriptionMetrics(activeBranchId || undefined);
  // Branch comparison: do not pass branch_id (we want all branches in the org)
  const branchComparison = useBranchComparison({
    start_date: startDate,
    end_date: endDate,
    organization_id: organizationId,
  });
  const branches = useBranches();

  const branchNames = useMemo(() => {
    const map: Record<string, string> = {};
    const list = (branches.data ?? []) as Array<{ id: string; name: string }>;
    for (const b of list) map[b.id] = b.name;
    return map;
  }, [branches.data]);

  // ── Build the active tab's exportable dataset client-side ─
  const buildExport = (tab: ReportTab): BuiltExport | null => {
    const period = `${startDate} to ${endDate}`;

    if (tab === 'overview') {
      const today = dashboard.data?.today;
      const revBreakdown = dashboard.data?.revenue_breakdown ?? [];
      const totalRev = revBreakdown.reduce((s, r) => s + Number(r._sum?.amount ?? 0), 0);
      return {
        title: 'Operations Overview',
        filename: `overview-report-${startDate}-to-${endDate}`,
        columns: [
          { key: 'metric', label: 'Metric' },
          { key: 'value', label: 'Value', numeric: true },
        ],
        rows: [
          { metric: "Today's Revenue", value: `₹${(today?.total_revenue ?? 0).toLocaleString()}` },
          { metric: "Today's Visits", value: today?.total_visits ?? 0 },
          { metric: 'New Signups Today', value: today?.new_members ?? 0 },
          { metric: 'Active Members', value: today?.active_members ?? 0 },
          { metric: 'Classes Held Today', value: today?.classes_held ?? 0 },
          { metric: 'Products Sold Today', value: today?.products_sold ?? 0 },
          ...revBreakdown.map((r) => ({
            metric: `Revenue — ${r.revenue_type.replace(/_/g, ' ')}`,
            value: `₹${Number(r._sum?.amount ?? 0).toLocaleString()}`,
          })),
          { metric: 'Total Revenue (period)', value: `₹${totalRev.toLocaleString()}` },
        ] as Record<string, unknown>[],
      };
    }

    if (tab === 'revenue') {
      const totals = revenue.data?.totals ?? [];
      const totalRev = totals.reduce((s, t) => s + Number(t._sum?.amount ?? 0), 0);
      const totalTx = totals.reduce((s, t) => s + Number(t._sum?.transaction_count ?? 0), 0);
      return {
        title: `Revenue Report — ${period}`,
        filename: `revenue-report-${startDate}-to-${endDate}`,
        columns: [
          { key: 'revenue_type', label: 'Type', format: (r) => String((r as { revenue_type: string }).revenue_type).replace(/_/g, ' ') },
          { key: 'amount', label: 'Amount (₹)', numeric: true, format: (r) => `₹${Number((r as { amount: number }).amount).toLocaleString()}` },
          { key: 'transactions', label: 'Transactions', numeric: true },
          { key: 'share', label: '% of Total', numeric: true, format: (r) => `${Number((r as { share: number }).share).toFixed(1)}%` },
        ],
        rows: totals.map((t) => {
          const amt = Number(t._sum?.amount ?? 0);
          return {
            revenue_type: t.revenue_type,
            amount: amt,
            transactions: Number(t._sum?.transaction_count ?? 0),
            share: totalRev > 0 ? (amt / totalRev) * 100 : 0,
          };
        }) as Record<string, unknown>[],
        totals: {
          revenue_type: 'Total',
          amount: `₹${totalRev.toLocaleString()}`,
          transactions: totalTx.toLocaleString(),
          share: '100.0%',
        },
      };
    }

    if (tab === 'members') {
      const records = memberships.data?.records ?? [];
      return {
        title: `Membership Report — ${period}`,
        filename: `membership-report-${startDate}-to-${endDate}`,
        columns: [
          { key: 'plan', label: 'Plan', format: (r) => (r as { plan?: { name: string } }).plan?.name ?? 'Unknown' },
          { key: 'total_active', label: 'Active', numeric: true },
          { key: 'new_signups', label: 'Signups', numeric: true },
          { key: 'renewals', label: 'Renewals', numeric: true },
          { key: 'cancellations', label: 'Cancellations', numeric: true },
          { key: 'churn_rate', label: 'Churn %', numeric: true, format: (r) => `${Number((r as { churn_rate: number }).churn_rate).toFixed(1)}%` },
          { key: 'period_start', label: 'Period Start' },
          { key: 'period_end', label: 'Period End' },
        ],
        rows: records as unknown as Record<string, unknown>[],
      };
    }

    if (tab === 'attendance') {
      const trendRows = trend.data ?? [];
      return {
        title: `Attendance Report — ${period}`,
        filename: `attendance-report-${startDate}-to-${endDate}`,
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'total_visits', label: 'Visits', numeric: true },
          { key: 'classes_held', label: 'Classes Held', numeric: true },
          { key: 'active_members', label: 'Active Members', numeric: true },
          { key: 'new_members', label: 'New Members', numeric: true },
        ],
        rows: trendRows as unknown as Record<string, unknown>[],
        totals: {
          date: 'Total',
          total_visits: trendRows.reduce((s, r) => s + r.total_visits, 0).toLocaleString(),
          classes_held: trendRows.reduce((s, r) => s + r.classes_held, 0).toLocaleString(),
          active_members: '',
          new_members: trendRows.reduce((s, r) => s + r.new_members, 0).toLocaleString(),
        },
      };
    }

    if (tab === 'marketing') {
      const records = campaigns.data?.records ?? [];
      const summary = campaigns.data?.summary;
      return {
        title: `Marketing Campaign Report — ${period}`,
        filename: `marketing-report-${startDate}-to-${endDate}`,
        columns: [
          { key: 'campaign', label: 'Campaign', format: (r) => (r as { campaign?: { name: string } }).campaign?.name ?? '—' },
          { key: 'sent', label: 'Sent', numeric: true },
          { key: 'opened', label: 'Opened', numeric: true },
          { key: 'clicked', label: 'Clicked', numeric: true },
          { key: 'converted', label: 'Converted', numeric: true },
          { key: 'bounced', label: 'Bounced', numeric: true },
          { key: 'revenue_generated', label: 'Revenue (₹)', numeric: true, format: (r) => `₹${Number((r as { revenue_generated: number }).revenue_generated).toLocaleString()}` },
        ],
        rows: records as unknown as Record<string, unknown>[],
        totals: summary
          ? {
              campaign: 'Total',
              sent: summary.sent.toLocaleString(),
              opened: summary.opened.toLocaleString(),
              clicked: summary.clicked.toLocaleString(),
              converted: summary.converted.toLocaleString(),
              bounced: summary.bounced.toLocaleString(),
              revenue_generated: `₹${summary.revenue_generated.toLocaleString()}`,
            }
          : undefined,
      };
    }

    if (tab === 'trainers') {
      const records = leaderboard.data ?? [];
      return {
        title: `Trainers Report — ${period}`,
        filename: `trainers-report-${startDate}-to-${endDate}`,
        columns: [
          { key: 'trainer', label: 'Trainer', format: (r) => {
            const t = r as { trainer?: { first_name: string; last_name: string } };
            return t.trainer ? `${t.trainer.first_name} ${t.trainer.last_name}` : '—';
          } },
          { key: 'sessions_conducted', label: 'Sessions', numeric: true },
          { key: 'members_trained', label: 'Members', numeric: true },
          { key: 'average_rating', label: 'Rating', numeric: true, format: (r) => Number((r as { average_rating: number }).average_rating).toFixed(1) },
          { key: 'no_show_rate', label: 'No-Show %', numeric: true, format: (r) => `${Number((r as { no_show_rate: number }).no_show_rate).toFixed(1)}%` },
          { key: 'revenue_generated', label: 'Revenue (₹)', numeric: true, format: (r) => `₹${Number((r as { revenue_generated: number }).revenue_generated).toLocaleString()}` },
        ],
        rows: records as unknown as Record<string, unknown>[],
      };
    }

    if (tab === 'subscriptions') {
      const m = subscriptionMetrics.data;
      if (!m) return null;
      const dist = m.plan_distribution ?? [];
      return {
        title: 'Subscription Report',
        filename: `subscriptions-report-${startDate}-to-${endDate}`,
        columns: [
          { key: 'plan_name', label: 'Plan' },
          { key: 'count', label: 'Members', numeric: true },
          { key: 'share', label: 'Share', numeric: true, format: (r) => `${Number((r as { share: number }).share).toFixed(1)}%` },
        ],
        rows: (() => {
          const total = dist.reduce((s, p) => s + Number(p.count ?? 0), 0);
          return dist.map((p) => ({
            plan_name: p.plan_name,
            count: p.count,
            share: total > 0 ? (Number(p.count) / total) * 100 : 0,
          })) as Record<string, unknown>[];
        })(),
      };
    }

    if (tab === 'branches') {
      const list = branchComparison.data ?? [];
      const totalRev = list.reduce((s, b) => s + Number(b._sum?.total_revenue ?? 0), 0);
      const rows = list.map((b) => ({
        branch: b.branch_name ?? (b.branch_id ? branchNames[b.branch_id] : null) ?? 'Unassigned',
        revenue: `₹${Number(b._sum?.total_revenue ?? 0).toLocaleString()}`,
        share: totalRev > 0 ? `${((Number(b._sum?.total_revenue ?? 0) / totalRev) * 100).toFixed(1)}%` : '0.0%',
        active_members: Math.round(Number(b._avg?.active_members ?? 0)),
        new_members: Number(b._sum?.new_members ?? 0),
        total_visits: Number(b._sum?.total_visits ?? 0),
      }));
      return {
        title: `Branch Comparison — ${period}`,
        filename: `branches-report-${startDate}-to-${endDate}`,
        columns: [
          { key: 'branch', label: 'Branch' },
          { key: 'revenue', label: 'Revenue', numeric: true },
          { key: 'share', label: '% Share', numeric: true },
          { key: 'active_members', label: 'Active', numeric: true },
          { key: 'new_members', label: 'New', numeric: true },
          { key: 'total_visits', label: 'Visits', numeric: true },
        ],
        rows: rows as unknown as Record<string, unknown>[],
        totals: {
          branch: 'Total',
          revenue: `₹${totalRev.toLocaleString()}`,
          share: '100.0%',
          active_members: rows.reduce((s, r) => s + Number(r.active_members), 0).toLocaleString(),
          new_members: rows.reduce((s, r) => s + Number(r.new_members), 0).toLocaleString(),
          total_visits: rows.reduce((s, r) => s + Number(r.total_visits), 0).toLocaleString(),
        },
      };
    }

    return null;
  };

  const handleExport = (fmt: ExportFormat) => {
    const built = buildExport(activeTab);
    if (!built || built.rows.length === 0) {
      toast.error('No data to export for the selected period');
      return;
    }
    try {
      exportReport(fmt, {
        title: built.title,
        filename: built.filename,
        subtitle: `Generated ${format(new Date(), 'PPpp')}`,
        columns: built.columns,
        rows: built.rows,
        totals: built.totals,
      });
      if (fmt !== 'print') toast.success(`Exported as ${fmt.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="reports" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Reports & Analytics"
          description="Comprehensive business intelligence — financial, operational, and people insights"
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
                  aria-label="Start date"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-36 h-9"
                  aria-label="End date"
                />
              </div>

              {/* Export menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => handleExport('xls')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" />
                    Excel (.xls)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <FileText className="h-4 w-4 mr-2 text-blue-500" />
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('print')}>
                    <Printer className="h-4 w-4 mr-2 text-muted-foreground" />
                    Print
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTab)}>
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="trainers">Trainers</TabsTrigger>
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
            <TabsTrigger value="branches">Branches</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Suspense fallback={<LoadingSkeleton />}>
              <OverviewTab
                dashboard={dashboard.data}
                trend={trend.data}
                isLoading={dashboard.isLoading || trend.isLoading}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="revenue">
            <Suspense fallback={<LoadingSkeleton />}>
              <RevenueTab
                revenue={revenue.data}
                trend={trend.data}
                isLoading={revenue.isLoading || trend.isLoading}
                isError={revenue.isError || trend.isError}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="members">
            <Suspense fallback={<LoadingSkeleton />}>
              <MembersTab
                memberships={memberships.data}
                churnRisk={churnRisk.data}
                trend={trend.data}
                isLoading={memberships.isLoading || churnRisk.isLoading}
                isError={memberships.isError || churnRisk.isError}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="attendance">
            <Suspense fallback={<LoadingSkeleton />}>
              <AttendanceTab
                trend={trend.data}
                classes={classes.data}
                isLoading={trend.isLoading || classes.isLoading}
                isError={trend.isError || classes.isError}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="marketing">
            <Suspense fallback={<LoadingSkeleton />}>
              <MarketingTab
                campaigns={campaigns.data}
                isLoading={campaigns.isLoading}
                isError={campaigns.isError}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="trainers">
            <Suspense fallback={<LoadingSkeleton />}>
              <TrainersTab
                trainers={trainers.data}
                leaderboard={leaderboard.data}
                isLoading={trainers.isLoading || leaderboard.isLoading}
                isError={trainers.isError || leaderboard.isError}
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

          <TabsContent value="branches">
            <Suspense fallback={<LoadingSkeleton />}>
              <BranchesTab
                branches={branchComparison.data}
                branchNames={branchNames}
                isLoading={branchComparison.isLoading || branches.isLoading}
                isError={branchComparison.isError}
              />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
