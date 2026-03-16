'use client';

import React from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { useAdjustStock } from '../hooks';
import type { InventoryRecord } from '../types';

const schema = z.object({
  quantity: z.string().min(1, 'Quantity is required'),
  transaction_type: z.enum(['adjustment', 'damage', 'return']),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryItem: InventoryRecord | null;
}

export function AdjustStockDialog({ open, onOpenChange, inventoryItem }: AdjustStockDialogProps) {
  const adjustStock = useAdjustStock();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: '', transaction_type: 'adjustment', notes: '' },
  });

  const onSubmit = (values: FormValues) => {
    if (!inventoryItem) return;
    adjustStock.mutate(
      {
        product_id: inventoryItem.product_id,
        branch_id: inventoryItem.branch_id,
        quantity: Number(values.quantity),
        transaction_type: values.transaction_type,
        notes: values.notes || undefined,
      },
      {
        onSuccess: () => { reset(); onOpenChange(false); },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Adjust Stock</DialogTitle>
        </DialogHeader>
        {inventoryItem && (
          <p className="text-sm text-muted-foreground">
            {inventoryItem.product?.product_name} — Current stock: {inventoryItem.stock_quantity}
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Quantity (+/-)</Label>
            <Input
              {...register('quantity')}
              type="number"
              placeholder="e.g. 10 or -5"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.quantity && (
              <p className="text-xs text-destructive">{errors.quantity.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Positive to add stock, negative to remove
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Reason</Label>
            <Select
              value={watch('transaction_type')}
              onValueChange={(v) => setValue('transaction_type', v as 'adjustment' | 'damage' | 'return')}
            >
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="adjustment">Stock Adjustment</SelectItem>
                <SelectItem value="damage">Damaged / Expired</SelectItem>
                <SelectItem value="return">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Notes</Label>
            <Textarea
              {...register('notes')}
              placeholder="Optional notes..."
              rows={2}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
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
              disabled={adjustStock.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {adjustStock.isPending ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
