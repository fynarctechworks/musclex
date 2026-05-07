'use client';

import { useState } from 'react';
import { useAuditLogs } from '@/hooks/use-audit-logs';
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

const ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'SUSPEND',
  'ACTIVATE',
  'IMPERSONATE',
  'LOGIN',
  'PLAN_CHANGE',
  'PAYMENT_RETRY',
  'REFUND',
  'FEATURE_TOGGLE',
];

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, isLoading } = useAuditLogs({
    page,
    action: action || undefined,
  });

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Track all admin actions"
      />

      <div className="flex items-center gap-3 mb-4">
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v === 'ALL' ? '' : v ?? '');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={10} />
      ) : !data?.data.length ? (
        <EmptyState />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[13px]">Action</TableHead>
                  <TableHead className="text-[13px]">Entity</TableHead>
                  <TableHead className="text-[13px]">Admin</TableHead>
                  <TableHead className="text-[13px]">IP Address</TableHead>
                  <TableHead className="text-[13px]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <StatusBadge status={log.action} />
                    </TableCell>
                    <TableCell>
                      <span className="text-[13px] text-foreground">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="text-[11px] text-muted-foreground ml-1">
                          ({log.entity_id.slice(0, 8)}...)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-foreground">
                      {log.admin?.name || '\u2014'}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground font-mono">
                      {log.ip_address || '\u2014'}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {formatDateTime(log.created_at)}
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
