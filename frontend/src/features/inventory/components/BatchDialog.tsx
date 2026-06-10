'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useCreateBatch, useProducts } from '../hooks';

const schema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  quantity: z.string().min(1, 'Quantity is required'),
  cost_price: z.string().optional(),
  expiry_date: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface BatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
}

export function BatchDialog({ open, onOpenChange, branchId }: BatchDialogProps) {
  const createBatch = useCreateBatch();
  // Only batch-tracked products can receive batches.
  const { data: products } = useProducts({ branch_id: branchId, status: 'active', limit: 500 });
  const trackable = (products?.data ?? []).filter((p) => p.track_batches);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: '',
      batch_number: '',
      quantity: '',
      cost_price: '',
      expiry_date: '',
    },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const onSubmit = (values: FormValues) => {
    if (!branchId) return;
    createBatch.mutate(
      {
        product_id: values.product_id,
        branch_id: branchId,
        batch_number: values.batch_number,
        quantity: Number(values.quantity),
        cost_price: values.cost_price ? Number(values.cost_price) : undefined,
        expiry_date: values.expiry_date || undefined,
      },
      { onSuccess: () => { reset(); onOpenChange(false); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Receive Batch</DialogTitle>
        </DialogHeader>

        {trackable.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No batch-tracked products yet. Enable “Track batches &amp; expiry” on a product first.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Product *</Label>
              <Select
                value={watch('product_id')}
                onValueChange={(v) => setValue('product_id', v)}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {trackable.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.product_name}{p.sku ? ` (${p.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.product_id && (
                <p className="text-xs text-destructive">{errors.product_id.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">Batch Number *</Label>
                <Input
                  {...register('batch_number')}
                  placeholder="e.g. LOT-2026-04"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                {errors.batch_number && (
                  <p className="text-xs text-destructive">{errors.batch_number.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Quantity *</Label>
                <Input
                  {...register('quantity')}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                {errors.quantity && (
                  <p className="text-xs text-destructive">{errors.quantity.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">Cost Price</Label>
                <Input
                  {...register('cost_price')}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Expiry Date</Label>
                <Input
                  {...register('expiry_date')}
                  type="date"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createBatch.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {createBatch.isPending ? 'Saving...' : 'Receive Batch'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
