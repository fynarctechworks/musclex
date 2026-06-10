'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SeverityBadge } from '@/components/monitoring/severity-badge';
import { useSystemAlerts, useAckAlert } from '@/hooks/use-system-alerts';
import { useMonitoringSocket } from '@/hooks/use-monitoring-socket';

function fmt(date?: string | null) {
  return date ? new Date(date).toLocaleString('en-IN') : '—';
}

export default function AlertsPage() {
  const [ackFilter, setAckFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useSystemAlerts({
    page,
    acknowledged: ackFilter === '' ? undefined : ackFilter === 'true',
  });
  const ack = useAckAlert();
  useMonitoringSocket();

  return (
    <div>
      <Link
        href="/monitoring"
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <PageHeader title="System Alerts" description="Critical alerts and their delivery status" />

      <div className="flex items-center gap-3 mb-4">
        <Select
          value={ackFilter || 'ALL'}
          onValueChange={(v) => {
            setAckFilter(v === 'ALL' || !v ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Alerts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Alerts</SelectItem>
            <SelectItem value="false">Unacknowledged</SelectItem>
            <SelectItem value="true">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={10} />
      ) : isError ? (
        <ErrorState
          title="Could not load alerts"
          description="The request failed. Check the backend and retry."
          onRetry={() => refetch()}
        />
      ) : !data?.data.length ? (
        <EmptyState />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[13px]">Severity</TableHead>
                  <TableHead className="text-[13px]">Channel</TableHead>
                  <TableHead className="text-[13px]">Title</TableHead>
                  <TableHead className="text-[13px]">Delivered</TableHead>
                  <TableHead className="text-[13px]">Created</TableHead>
                  <TableHead className="text-[13px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <SeverityBadge value={a.severity} />
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {a.channel}
                    </TableCell>
                    <TableCell className="max-w-md">
                      {a.error_id ? (
                        <Link
                          href={`/monitoring/errors/${a.error_id}`}
                          className="block truncate text-[13px] font-medium text-foreground hover:text-primary"
                        >
                          {a.title}
                        </Link>
                      ) : (
                        <span className="block truncate text-[13px] text-foreground">
                          {a.title}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {a.delivered ? fmt(a.delivered_at) : 'Pending'}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {fmt(a.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.acknowledged ? (
                        <span className="text-[12px] text-emerald-600">Acknowledged</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={ack.isPending}
                          onClick={() => ack.mutate(a.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-[13px] text-muted-foreground">
              Page {data.meta.page} of {data.meta.total_pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.total_pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
