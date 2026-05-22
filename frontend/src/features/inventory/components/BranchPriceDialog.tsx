'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBranches } from '@/features/branches/hooks';
import {
  useBranchPrices,
  useUpsertBranchPrice,
  useDeleteBranchPrice,
} from '../hooks';
import type { Product } from '../types';

interface BranchLite {
  id: string;
  name: string;
  is_active?: boolean;
}

interface BranchPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function BranchPriceDialog({ open, onOpenChange, product }: BranchPriceDialogProps) {
  const { data: branches } = useBranches();
  const { data: prices } = useBranchPrices(product?.id ?? '');
  const upsert = useUpsertBranchPrice();
  const remove = useDeleteBranchPrice();

  const [branchId, setBranchId] = useState('');
  const [price, setPrice] = useState('');
  const [taxRate, setTaxRate] = useState('');

  const branchList = ((branches as BranchLite[] | undefined) ?? []).filter(
    (b) => b.is_active !== false,
  );
  const branchName = (id: string) => branchList.find((b) => b.id === id)?.name ?? id;

  const resetForm = () => {
    setBranchId('');
    setPrice('');
    setTaxRate('');
  };

  const submit = () => {
    if (!product || !branchId || !price) return;
    upsert.mutate(
      {
        product_id: product.id,
        branch_id: branchId,
        price: Number(price),
        tax_rate: taxRate ? Number(taxRate) : undefined,
      },
      { onSuccess: resetForm },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Branch Pricing{product ? ` — ${product.product_name}` : ''}
          </DialogTitle>
        </DialogHeader>

        {product && (
          <p className="text-sm text-muted-foreground">
            Base price ₹{Number(product.price).toFixed(2)} · tax {Number(product.tax_rate)}%.
            Branches without an override sell at the base price.
          </p>
        )}

        {/* Existing overrides */}
        <div className="space-y-2">
          {prices && prices.length > 0 ? (
            <div className="rounded-lg border border-border divide-y divide-border">
              {prices.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-foreground">{p.branch?.name ?? branchName(p.branch_id)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-foreground">
                      ₹{Number(p.price).toFixed(2)}
                      {p.tax_rate != null && (
                        <span className="text-muted-foreground"> · {Number(p.tax_rate)}% tax</span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={remove.isPending}
                      onClick={() =>
                        product && remove.mutate({ productId: product.id, branchId: p.branch_id })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No branch overrides yet.</p>
          )}
        </div>

        {/* Add / update override */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
          <Label className="text-foreground">Add / update override</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="bg-muted border-border text-foreground">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {branchList.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Price *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tax % (optional)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="inherit"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!branchId || !price || upsert.isPending}
            onClick={submit}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {upsert.isPending ? 'Saving…' : 'Save override'}
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
