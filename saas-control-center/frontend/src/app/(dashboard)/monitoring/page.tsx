'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { StatCards } from '@/components/monitoring/stat-cards';
import { ErrorTrendChart } from '@/components/monitoring/error-trend-chart';
import { ActivityFeed } from '@/components/monitoring/activity-feed';
import { useErrorStats } from '@/hooks/use-error-stats';
import { useMonitoringSocket } from '@/hooks/use-monitoring-socket';

export default function MonitoringDashboardPage() {
  const { data: stats, isLoading, isError, refetch } = useErrorStats();
  const { connected, events } = useMonitoringSocket();

  return (
    <div>
      <PageHeader
        title="System Monitoring"
        description="Centralized error tracking across all gyms and the SaaS platform"
        action={
          <div className="flex gap-2">
            <Link
              href="/monitoring/alerts"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Alerts
            </Link>
            <Link
              href="/monitoring/errors"
              className={buttonVariants({ size: 'sm' })}
            >
              All Errors
            </Link>
          </div>
        }
      />

      {isError ? (
        <ErrorState
          title="Could not load monitoring stats"
          description="The request failed. Check that the SCC backend is running and try again."
          onRetry={() => refetch()}
        />
      ) : (
        <div className="space-y-4">
          <StatCards stats={stats} isLoading={isLoading} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {stats && <ErrorTrendChart trend={stats.trend} />}
            </div>
            <div>
              <ActivityFeed events={events} connected={connected} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
