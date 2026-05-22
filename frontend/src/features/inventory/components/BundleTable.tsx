'use client';

import React, { useState } from 'react';
import { Package2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBundles, useDeleteBundle } from '../hooks';
import { BundleDialog } from './BundleDialog';
import type { Bundle } from '../types';

function statusBadge(status: Bundle['status']) {
  if (status === 'discontinued') return <Badge variant="destructive" className="text-xs">Discontinued</Badge>;
  if (status === 'inactive') return <Badge variant="secondary" className="text-xs">Inactive</Badge>;
  return <Badge className="bg-success/20 text-success hover:bg-success/30 text-xs">Active</Badge>;
}

export function BundleTable({ branchId }: { branchId?: string }) {
  const { data, isLoading } = useBundles({ branch_id: branchId, limit: 100 });
  const deleteBundle = useDeleteBundle();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Bundle | null>(null);

  const bundles = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Bundle
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading bundles…</p>
      ) : bundles.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Package2 className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No bundles yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Group products into a combo with its own price. Component stock is deducted automatically when sold.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-canvas-soft">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bundle</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Components</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Branch</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => (
                <tr key={b.id} className="border-b border-border hover:bg-canvas-soft transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{b.name}</div>
                    {b.sku && <div className="text-xs font-mono text-muted-foreground">{b.sku}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.items.map((i, idx) => (
                      <span key={i.id}>
                        {idx > 0 && <span className="text-border"> · </span>}
                        <span>{i.quantity}× {i.product?.product_name ?? '—'}</span>
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">₹{Number(b.price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.branch?.name ?? 'All branches'}</td>
                  <td className="px-4 py-3 text-center">{statusBadge(b.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditing(b)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Discontinue"
                        disabled={b.status === 'discontinued' || deleteBundle.isPending}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteBundle.mutate(b.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BundleDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
      <BundleDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        bundle={editing}
        branchId={branchId}
      />
    </div>
  );
}
