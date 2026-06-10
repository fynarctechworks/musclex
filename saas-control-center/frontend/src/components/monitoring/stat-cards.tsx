'use client';

import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bug,
  Activity,
  ServerCrash,
  MonitorX,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ErrorStats } from '@/types/monitoring';

interface Props {
  stats?: ErrorStats;
  isLoading: boolean;
}

export function StatCards({ stats, isLoading }: Props) {
  const router = useRouter();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-lg" />
        ))}
      </div>
    );
  }

  const c = stats.cards;
  const go = (qs: string) => () => router.push(`/monitoring/errors?${qs}`);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
      <KpiCard title="Total Errors" value={c.total_errors} icon={Bug} onClick={go('')} />
      <KpiCard
        title="Critical"
        value={c.critical_errors}
        icon={AlertTriangle}
        trend={c.critical_errors > 0 ? 'down' : 'neutral'}
        onClick={go('severity=CRITICAL')}
      />
      <KpiCard
        title="Active Issues"
        value={c.active_issues}
        icon={Activity}
        onClick={go('status=OPEN')}
      />
      <KpiCard
        title="API Failures"
        value={c.api_failures}
        icon={ServerCrash}
        onClick={go('source=API')}
      />
      <KpiCard
        title="Frontend Crashes"
        value={c.frontend_crashes}
        icon={MonitorX}
        onClick={go('source=FRONTEND')}
      />
      <KpiCard
        title="Database Errors"
        value={c.database_errors}
        icon={Database}
        onClick={go('source=DATABASE')}
      />
      <KpiCard
        title="Resolved"
        value={c.resolved_issues}
        icon={CheckCircle2}
        trend="up"
        onClick={go('status=RESOLVED')}
      />
    </div>
  );
}
