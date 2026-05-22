'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Layers, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBatches, useAdjustBatch } from '../hooks';
import { BatchDialog } from './BatchDialog';
import type { ProductBatch } from '../types';

function ExpiryCell({ batch }: { batch: ProductBatch }) {
  if (!batch.expiry_date) return <span className="text-muted-foreground">—</span>;
  const exp = new Date(batch.expiry_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
  const label = format(exp, 'dd MMM yyyy');
  if (daysLeft < 0) {
    return <span className="text-destructive font-medium">{label} · expired</span>;
  }
  if (daysLeft <= 30) {
    return <span className="text-warning">{label} · {daysLeft}d</span>;
  }
  return <span className="text-foreground">{label}</span>;
}

function statusBadge(status: ProductBatch['status']) {
  if (status === 'depleted') {
    return <Badge variant="secondary" className="text-xs">Depleted</Badge>;
  }
  if (status === 'expired') {
    return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  }
  return (
    <Badge className="bg-success/20 text-success hover:bg-success/30 text-xs">Active</Badge>
  );
}

export function BatchTable({ branchId }: { branchId?: string }) {
  const { data, isLoading } = useBatches({ branch_id: branchId, limit: 100 });
  const adjustBatch = useAdjustBatch();
  const [createOpen, setCreateOpen] = useState(false);
  const [writeOff, setWriteOff] = useState<ProductBatch | null>(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');

  const batches = data?.data ?? [];

  const submitWriteOff = () => {
    if (!writeOff) return;
    const n = Number(qty);
    if (!n || n <= 0) return;
    adjustBatch.mutate(
      { id: writeOff.id, data: { quantity: -Math.abs(n), reason: reason || 'Write-off' } },
      {
        onSuccess: () => {
          setWriteOff(null);
          setQty('');
          setReason('');
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Receive Batch
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading batches…</p>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Layers className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No batches yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Receive a batch for any batch-tracked product to begin FIFO &amp; expiry tracking.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-canvas-soft">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Batch</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expiry</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-border hover:bg-canvas-soft transition-colors">
                  <td className="px-4 py-3 text-foreground">
                    {b.product?.product_name}
                    {b.product?.sku ? <span className="text-muted-foreground"> ({b.product.sku})</span> : ''}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.batch_number}</td>
                  <td className="px-4 py-3 text-center text-foreground">{b.quantity}</td>
                  <td className="px-4 py-3"><ExpiryCell batch={b} /></td>
                  <td className="px-4 py-3 text-center">{statusBadge(b.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={b.quantity <= 0}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => { setWriteOff(b); setQty(''); setReason(''); }}
                    >
                      Write off
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BatchDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />

      <Dialog open={!!writeOff} onOpenChange={(o) => !o && setWriteOff(null)}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Write off batch stock</DialogTitle>
          </DialogHeader>
          {writeOff && (
            <p className="text-sm text-muted-foreground">
              {writeOff.product?.product_name} · batch {writeOff.batch_number} — {writeOff.quantity} units remaining
            </p>
          )}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground">Quantity to remove</Label>
              <Input
                type="number"
                min="1"
                max={writeOff?.quantity}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="e.g. 5"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. expired, damaged in storage"
                rows={2}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setWriteOff(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={adjustBatch.isPending}
              onClick={submitWriteOff}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {adjustBatch.isPending ? 'Removing…' : 'Write off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
