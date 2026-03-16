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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateProduct, useUpdateProduct, useCategories } from '../hooks';
import type { Product } from '../types';

const schema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.string().min(1, 'Price is required'),
  cost_price: z.string().optional(),
  tax_rate: z.string().optional(),
  image_url: z.string().optional(),
  category_id: z.string().optional(),
  status: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  branchId?: string;
}

export function ProductDialog({ open, onOpenChange, product, branchId }: ProductDialogProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: categories } = useCategories();

  const isEdit = !!product;

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
      product_name: '',
      description: '',
      sku: '',
      barcode: '',
      price: '',
      cost_price: '',
      tax_rate: '0',
      image_url: '',
      category_id: '',
      status: 'active',
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        product_name: product.product_name,
        description: product.description || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        price: String(product.price),
        cost_price: String(product.cost_price || ''),
        tax_rate: String(product.tax_rate || '0'),
        image_url: product.image_url || '',
        category_id: product.category_id || '',
        status: product.status,
      });
    } else {
      reset({
        product_name: '',
        description: '',
        sku: '',
        barcode: '',
        price: '',
        cost_price: '',
        tax_rate: '0',
        image_url: '',
        category_id: '',
        status: 'active',
      });
    }
  }, [product, reset]);

  const onSubmit = (values: FormValues) => {
    const payload = {
      product_name: values.product_name,
      description: values.description || undefined,
      sku: values.sku || undefined,
      barcode: values.barcode || undefined,
      price: Number(values.price),
      cost_price: values.cost_price ? Number(values.cost_price) : undefined,
      tax_rate: values.tax_rate ? Number(values.tax_rate) : undefined,
      image_url: values.image_url || undefined,
      category_id: values.category_id || undefined,
      branch_id: branchId,
    };

    if (isEdit && product) {
      updateProduct.mutate(
        { id: product.id, data: { ...payload, status: values.status as 'active' | 'inactive' | 'discontinued' } },
        { onSuccess: () => { reset(); onOpenChange(false); } },
      );
    } else {
      createProduct.mutate(payload, {
        onSuccess: () => { reset(); onOpenChange(false); },
      });
    }
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Product Name *</Label>
            <Input
              {...register('product_name')}
              placeholder="e.g. Protein Shake"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.product_name && (
              <p className="text-xs text-destructive">{errors.product_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground">SKU</Label>
              <Input
                {...register('sku')}
                placeholder="SKU-001"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Barcode</Label>
              <Input
                {...register('barcode')}
                placeholder="1234567890"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground">Price *</Label>
              <Input
                {...register('price')}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
              {errors.price && (
                <p className="text-xs text-destructive">{errors.price.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Cost Price</Label>
              <Input
                {...register('cost_price')}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Tax %</Label>
              <Input
                {...register('tax_rate')}
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Category</Label>
            <Select
              value={watch('category_id') || ''}
              onValueChange={(v) => setValue('category_id', v)}
            >
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label className="text-foreground">Status</Label>
              <Select
                value={watch('status') || 'active'}
                onValueChange={(v) => setValue('status', v)}
              >
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
            <Label className="text-foreground">Image URL</Label>
            <Input
              {...register('image_url')}
              placeholder="https://..."
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Description</Label>
            <Textarea
              {...register('description')}
              placeholder="Product description..."
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
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
