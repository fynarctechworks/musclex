'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeftRight, ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTransfers, useReceiveTransfer, useCancelTransfer } from '../hooks';
import { CreateTransferDialog } from './CreateTransferDialog';
import { useAuthStore } from '@/stores/auth-store';
import type { StockTransfer, TransferStatus } from '../types';

function statusBadge(status: TransferStatus) {
  switch (status) {
    case 'in_transit':
      return <Badge className="bg-warning/20 text-warning hover:bg-warning/30 text-xs">In Transit</Badge>;
    case 'received':
      return <Badge className="bg-success/20 text-success hover:bg-success/30 text-xs">Received</Badge>;
    case 'cancelled':
      return <Badge variant="destructive" className="text-xs">Cancelled</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  }
}

export function TransfersTable() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useTransfers({ limit: 100 });
  const receive = useReceiveTransfer();
  const cancel = useCancelTransfer();
  const [createOpen, setCreateOpen] = useState(false);

  const transfers = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Transfer
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading transfers…</p>
      ) : transfers.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <ArrowLeftRight className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No transfers yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Move stock between branches — dispatched stock leaves the source immediately and lands on receive.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-canvas-soft">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Transfer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Route</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Items</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t: StockTransfer) => (
                <tr key={t.id} className="border-b border-border hover:bg-canvas-soft transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{t.transfer_number}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-foreground">
                      {t.from_branch?.name ?? '—'}
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {t.to_branch?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {t._count?.items ?? t.items?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(t.created_at), 'dd MMM yyyy, HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-center">{statusBadge(t.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {t.status === 'in_transit' ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={receive.isPending}
                          className="text-xs text-success hover:text-success"
                          onClick={() => receive.mutate({ id: t.id, received_by: user?.id })}
                        >
                          Receive
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={cancel.isPending}
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => cancel.mutate(t.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTransferDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
