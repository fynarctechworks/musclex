'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import {
  useProducts,
  useCreateBundle,
  useUpdateBundle,
} from '../hooks';
import type { Bundle, Product } from '../types';

interface BranchLite { id: string; name: string; is_active?: boolean }
interface Line { product_id: string; quantity: string }

interface BundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle?: Bundle | null;
  branchId?: string;
}

export function BundleDialog({ open, onOpenChange, bundle, branchId }: BundleDialogProps) {
  const isEdit = !!bundle;
  const { data: branches } = useBranches();
  const { data: products } = useProducts({ status: 'active', limit: 500 });
  const createBundle = useCreateBundle();
  const updateBundle = useUpdateBundle();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [description, setDescription] = useState('');
  const [bundleBranch, setBundleBranch] = useState<string>(''); // '' = all branches
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: '1' }]);
  const [status, setStatus] = useState<'active' | 'inactive' | 'discontinued'>('active');

  useEffect(() => {
    if (!open) return;
    if (bundle) {
      setName(bundle.name);
      setSku(bundle.sku ?? '');
      setPrice(String(bundle.price));
      setTaxRate(String(bundle.tax_rate));
      setDescription(bundle.description ?? '');
      setBundleBranch(bundle.branch_id ?? '');
      setLines(bundle.items.map((i) => ({ product_id: i.product_id, quantity: String(i.quantity) })));
      setStatus(bundle.status);
    } else {
      setName('');
      setSku('');
      setPrice('');
      setTaxRate('0');
      setDescription('');
      setBundleBranch(branchId ?? '');
      setLines([{ product_id: '', quantity: '1' }]);
      setStatus('active');
    }
  }, [open, bundle, branchId]);

  const branchList = ((branches as BranchLite[] | undefined) ?? []).filter((b) => b.is_active !== false);
  const productList: Product[] = products?.data ?? [];

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { product_id: '', quantity: '1' }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  // Live preview: sum of component list prices for context against the bundle price.
  const componentSum = lines.reduce((s, l) => {
    const p = productList.find((x) => x.id === l.product_id);
    return s + (p ? Number(p.price) * (Number(l.quantity) || 0) : 0);
  }, 0);
  const priceNum = Number(price) || 0;
  const savings = componentSum > 0 && priceNum < componentSum ? componentSum - priceNum : 0;

  const validLines = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
  const distinctProducts = new Set(validLines.map((l) => l.product_id)).size === validLines.length;
  const canSubmit =
    !!name.trim() && priceNum >= 0 && validLines.length > 0 && distinctProducts;

  const submit = () => {
    if (!canSubmit) return;
    const payload = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      description: description.trim() || undefined,
      price: priceNum,
      tax_rate: Number(taxRate) || 0,
      branch_id: bundleBranch || undefined,
      items: validLines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) })),
    };
    if (isEdit && bundle) {
      updateBundle.mutate(
        { id: bundle.id, data: { ...payload, status } },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createBundle.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  const isPending = createBundle.isPending || updateBundle.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? 'Edit Bundle' : 'New Bundle'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gym Starter Kit"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground">SKU</Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="GSK-001"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Branch</Label>
              <Select value={bundleBranch || 'all'} onValueChange={(v) => setBundleBranch(v === 'all' ? '' : v)}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All branches</SelectItem>
                  {branchList.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground">Bundle Price (₹) *</Label>
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
            <div className="space-y-2">
              <Label className="text-foreground">Tax %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>
          </div>

          {/* Components */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Components *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addLine}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add component
              </Button>
            </div>
            {lines.map((line, i) => (
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
                      {productList
                        .filter((p) => p.id === line.product_id || !lines.some((other, idx) => idx !== i && other.product_id === p.id))
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.product_name}{p.sku ? ` (${p.sku})` : ''} · ₹{Number(p.price).toFixed(2)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    min="1"
                    step="1"
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
            ))}
            {!distinctProducts && (
              <p className="text-xs text-destructive">A product can only appear once per bundle.</p>
            )}
          </div>

          {/* Price preview */}
          {componentSum > 0 && (
            <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-0.5">
              <div className="flex justify-between">
                <span>Component list price total</span>
                <span className="text-foreground">₹{componentSum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Bundle price</span>
                <span className="text-foreground">₹{priceNum.toFixed(2)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between">
                  <span>Customer saves</span>
                  <span className="text-success">₹{savings.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {isEdit && (
            <div className="space-y-2">
              <Label className="text-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details about this bundle..."
              rows={2}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || isPending}
            onClick={submit}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create bundle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
