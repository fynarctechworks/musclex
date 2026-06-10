'use client';

import { useRouter } from 'next/navigation';
import { useDashboardMetrics } from '@/hooks/use-dashboard';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { PageHeader } from '@/components/layout/page-header';
import { CardSkeleton } from '@/components/shared/loading-skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { useRefreshDashboard } from '@/hooks/use-dashboard';
import {
  Building2,
  Users,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  Clock,
  BarChart2,
  RefreshCw,
} from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: metrics, isLoading, isFetching, isError, refetch } = useDashboardMetrics();
  const refresh = useRefreshDashboard();

  const goToTenants = (status?: string) => {
    const params = status ? `?status=${status}` : '';
    router.push(`/tenants${params}`);
  };

  const goToSubscriptions = (filter?: string) => {
    const params = filter ? `?filter=${filter}` : '';
    router.push(`/subscriptions${params}`);
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your SaaS platform"
        action={
          <Button
            size="sm"
            variant="outline"
            className="text-[13px]"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refresh.isPending || isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load dashboard metrics"
          description="The metrics request failed. Confirm the backend is running, then retry."
          onRetry={() => refetch()}
        />
      ) : metrics ? (
        <>
          {metrics.subscriptions.past_due > 0 && (
            <button
              type="button"
              onClick={() => goToSubscriptions('past_due')}
              className="mb-4 flex w-full items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-left text-[13px] text-amber-900 transition hover:bg-amber-100"
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">
                <strong>{metrics.subscriptions.past_due}</strong>
                {' '}
                subscription{metrics.subscriptions.past_due === 1 ? ' is' : 's are'} past due — auto-renewal payment failed and needs manual review.
              </span>
              <span className="text-amber-700 underline">Review</span>
            </button>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              title="Total Tenants"
              value={metrics.tenants.total}
              subtitle={`+${metrics.tenants.new_last_30d} this month`}
              icon={Building2}
              trend={metrics.tenants.new_last_30d > 0 ? 'up' : 'neutral'}
              onClick={() => goToTenants()}
            />
            <KpiCard
              title="Active Tenants"
              value={metrics.tenants.active}
              icon={Users}
              onClick={() => goToTenants('ACTIVE')}
            />
            <KpiCard
              title="Trial Tenants"
              value={metrics.tenants.trial}
              icon={Clock}
              onClick={() => goToTenants('TRIAL')}
            />
            <KpiCard
              title="MRR"
              value={formatCurrency(metrics.revenue.mrr)}
              subtitle={`ARR: ${formatCurrency(metrics.revenue.arr)}`}
              icon={DollarSign}
            />
            <KpiCard
              title="Active Subscriptions"
              value={metrics.subscriptions.active}
              icon={Activity}
              onClick={() => goToSubscriptions('active')}
            />
            <KpiCard
              title="Expiring Soon"
              value={metrics.subscriptions.expiring_soon}
              icon={AlertTriangle}
              onClick={() => goToSubscriptions('expiring')}
            />
            <KpiCard
              title="Churn Rate"
              value={`${metrics.churn_rate}%`}
              subtitle={`${metrics.subscriptions.churned_last_30d} churned`}
              icon={TrendingUp}
              trend={metrics.churn_rate > 5 ? 'down' : 'up'}
              onClick={() => goToSubscriptions('churned')}
            />
            <KpiCard
              title="30-Day Revenue"
              value={formatCurrency(metrics.revenue.last_30d)}
              icon={BarChart2}
            />
          </div>
          <RevenueChart />
        </>
      ) : null}
    </div>
  );
}
