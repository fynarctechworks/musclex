'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ErrorFiltersBar } from '@/components/monitoring/error-filters';
import { ErrorTable } from '@/components/monitoring/error-table';
import {
  useSystemErrors,
  useBulkResolve,
  type ErrorFilters,
} from '@/hooks/use-system-errors';
import { useMonitoringSocket } from '@/hooks/use-monitoring-socket';

function ErrorsListInner() {
  const searchParams = useSearchParams();
  const initial = useMemo<ErrorFilters>(
    () => ({
      severity: searchParams.get('severity') ?? '',
      status: searchParams.get('status') ?? '',
      source: searchParams.get('source') ?? '',
      environment: searchParams.get('environment') ?? '',
      tenant_id: searchParams.get('tenant_id') ?? '',
    }),
    [searchParams],
  );

  const [filters, setFilters] = useState<ErrorFilters>(initial);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useSystemErrors({ ...filters, page });
  const bulkResolve = useBulkResolve();
  useMonitoringSocket(); // live cache invalidation

  const onChange = (partial: Partial<ErrorFilters>) => {
    setFilters((f) => ({ ...f, ...partial }));
    setPage(1);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    const rows = data?.data ?? [];
    setSelected((prev) =>
      rows.every((r) => prev.has(r.id))
        ? new Set()
        : new Set(rows.map((r) => r.id)),
    );
  };

  const handleBulkResolve = async () => {
    await bulkResolve.mutateAsync({ ids: Array.from(selected) });
    setSelected(new Set());
  };

  return (
    <div>
      <PageHeader
        title="Errors"
        description="Grouped issues across all gyms and the platform"
        action={
          selected.size > 0 ? (
            <Button
              size="sm"
              onClick={handleBulkResolve}
              disabled={bulkResolve.isPending}
            >
              {bulkResolve.isPending
                ? 'Resolving…'
                : `Resolve ${selected.size} selected`}
            </Button>
          ) : undefined
        }
      />

      <ErrorFiltersBar filters={filters} onChange={onChange} />

      {isLoading ? (
        <LoadingSkeleton rows={10} />
      ) : isError ? (
        <ErrorState
          title="Could not load errors"
          description="The request failed — not the same as having no errors. Check the backend and retry."
          onRetry={() => refetch()}
        />
      ) : !data?.data.length ? (
        <EmptyState />
      ) : (
        <>
          <ErrorTable
            data={data.data}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
          />
          <div className="flex items-center justify-between mt-4">
            <p className="text-[13px] text-muted-foreground">
              Page {data.meta.page} of {data.meta.total_pages} · {data.meta.total} total
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

export default function ErrorsListPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={10} />}>
      <ErrorsListInner />
    </Suspense>
  );
}
