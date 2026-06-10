'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBranches } from '@/features/branches/hooks';
import { useProducts, useCreateTransfer } from '../hooks';
import { useAuthStore } from '@/stores/auth-store';
import type { Product } from '../types';

interface BranchLite {
  id: string;
  name: string;
  is_active?: boolean;
}

interface Line {
  product_id: string;
  quantity: string;
}

interface CreateTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function stockAt(product: Product, branchId: string): number {
  const inv = Array.isArray(product.inventory) ? product.inventory : product.inventory ? [product.inventory] : [];
  const row = inv.find((r) => r.branch_id === branchId);
  return row?.stock_quantity ?? 0;
}

export function CreateTransferDialog({ open, onOpenChange }: CreateTransferDialogProps) {
  const user = useAuthStore((s) => s.user);
  const { data: branches } = useBranches();
  const createTransfer = useCreateTransfer();

  const [fromBranch, setFromBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: '' }]);

  // Products carrying stock at the source branch.
  const { data: products } = useProducts(
    fromBranch ? { branch_id: fromBranch, status: 'active', limit: 500 } : undefined,
  );

  const branchList = ((branches as BranchLite[] | undefined) ?? []).filter(
    (b) => b.is_active !== false,
  );
  const sourceProducts = useMemo(() => products?.data ?? [], [products]);

  const reset = () => {
    setFromBranch('');
    setToBranch('');
    setNotes('');
    setLines([{ product_id: '', quantity: '' }]);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, { product_id: '', quantity: '' }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const validLines = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
  const canSubmit =
    fromBranch && toBranch && fromBranch !== toBranch && validLines.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    createTransfer.mutate(
      {
        from_branch_id: fromBranch,
        to_branch_id: toBranch,
        notes: notes || undefined,
        initiated_by: user?.id,
        items: validLines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) })),
      },
      { onSuccess: close },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="bg-card border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Stock Transfer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label className="text-foreground">From Branch *</Label>
              <Select value={fromBranch} onValueChange={(v) => { setFromBranch(v); setLines([{ product_id: '', quantity: '' }]); }}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {branchList.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="h-4 w-4 mb-3 text-muted-foreground shrink-0" />
            <div className="flex-1 space-y-2">
              <Label className="text-foreground">To Branch *</Label>
              <Select value={toBranch} onValueChange={setToBranch}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Destination" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {branchList
                    .filter((b) => b.id !== fromBranch)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {fromBranch === toBranch && fromBranch && (
            <p className="text-xs text-destructive">Source and destination must differ.</p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Items</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addLine}
                disabled={!fromBranch}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add item
              </Button>
            </div>

            {!fromBranch ? (
              <p className="text-xs text-muted-foreground">Select a source branch to choose products.</p>
            ) : (
              lines.map((line, i) => {
                const selected = sourceProducts.find((p) => p.id === line.product_id);
                const available = selected ? stockAt(selected, fromBranch) : 0;
                return (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1">
                      <Select
                        value={line.product_id}
                        onValueChange={(v) => updateLine(i, { product_id: v })}
                      >
                        <SelectTrigger className="bg-muted border-border text-foreground">
                          <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {sourceProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.product_name}{p.sku ? ` (${p.sku})` : ''} · {stockAt(p, fromBranch)} in stock
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="1"
                        max={available || undefined}
                        value={line.quantity}
                        onChange={(e) => updateLine(i, { quantity: e.target.value })}
                        placeholder="Qty"
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(i)}
                      disabled={lines.length === 1}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this transfer..."
              rows={2}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} className="text-muted-foreground hover:text-foreground">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || createTransfer.isPending}
            onClick={submit}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {createTransfer.isPending ? 'Dispatching…' : 'Dispatch Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
