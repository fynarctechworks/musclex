'use client';

import { useState } from 'react';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SubscriptionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, isLoading } = useSubscriptions({
    page,
    status: status || undefined,
  });

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Track all tenant subscriptions"
      />

      <div className="flex items-center gap-3 mb-4">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v === 'ALL' ? '' : v ?? '');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="TRIALING">Trialing</SelectItem>
            <SelectItem value="PAST_DUE">Past Due</SelectItem>
            <SelectItem value="CANCELED">Canceled</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : !data?.data.length ? (
        <EmptyState />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[13px]">Tenant</TableHead>
                  <TableHead className="text-[13px]">Plan</TableHead>
                  <TableHead className="text-[13px]">Status</TableHead>
                  <TableHead className="text-[13px]">Start</TableHead>
                  <TableHead className="text-[13px]">End</TableHead>
                  <TableHead className="text-[13px]">Auto Renew</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="text-[13px] font-semibold text-foreground">
                      {sub.tenant?.name || sub.tenant_id}
                    </TableCell>
                    <TableCell className="text-[13px]">{sub.plan?.name || sub.plan_id}</TableCell>
                    <TableCell>
                      <StatusBadge status={sub.status} />
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {formatDate(sub.start_date)}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {formatDate(sub.end_date)}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {sub.auto_renew ? 'Yes' : 'No'}
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
