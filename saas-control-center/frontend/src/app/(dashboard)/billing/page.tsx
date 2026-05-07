'use client';

import { useState } from 'react';
import {
  usePayments,
  useRetryPayment,
  useRefundPayment,
} from '@/hooks/use-billing';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, RefreshCw, Undo2 } from 'lucide-react';

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BillingPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, isLoading } = usePayments({
    page,
    status: status || undefined,
  });
  const retry = useRetryPayment();
  const refund = useRefundPayment();

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Payment transactions and history"
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
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
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
                  <TableHead className="text-[13px]">Amount</TableHead>
                  <TableHead className="text-[13px]">Status</TableHead>
                  <TableHead className="text-[13px]">Gateway</TableHead>
                  <TableHead className="text-[13px]">Date</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-[13px] font-semibold text-foreground">
                      {payment.tenant?.name || payment.tenant_id}
                    </TableCell>
                    <TableCell className="text-[13px] font-mono text-foreground">
                      {formatCurrency(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {payment.gateway || '\u2014'}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {formatDateTime(payment.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors outline-none">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {payment.status === 'FAILED' && (
                            <DropdownMenuItem
                              onClick={() => retry.mutate(payment.id)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Retry
                            </DropdownMenuItem>
                          )}
                          {payment.status === 'PAID' && (
                            <DropdownMenuItem
                              onClick={() => refund.mutate(payment.id)}
                              className="text-destructive"
                            >
                              <Undo2 className="mr-2 h-4 w-4" />
                              Refund
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
