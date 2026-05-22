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
import { Switch } from '@/components/ui/switch';
import { useCreateProduct, useUpdateProduct, useCategories } from '../hooks';
import { ProductImageGallery } from './ProductImageGallery';
import type { Product, ProductType } from '../types';

const schema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.string().min(1, 'Price is required'),
  cost_price: z.string().optional(),
  tax_rate: z.string().optional(),
  initial_stock: z.string().optional(),
  image_url: z.string().optional(),
  category_id: z.string().optional(),
  status: z.string().optional(),
  product_type: z.string().optional(),
  brand: z.string().optional(),
  unit_type: z.string().optional(),
  track_batches: z.boolean().optional(),
});

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'physical', label: 'Physical' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'service', label: 'Service' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'digital', label: 'Digital' },
];

// Stock + batch tracking only make sense for tangible goods.
const STOCKED_TYPES: ProductType[] = ['physical', 'consumable'];

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
      initial_stock: '0',
      image_url: '',
      category_id: '',
      status: 'active',
      product_type: 'physical',
      brand: '',
      unit_type: '',
      track_batches: false,
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
        product_type: product.product_type || 'physical',
        brand: product.brand || '',
        unit_type: product.unit_type || '',
        track_batches: product.track_batches ?? false,
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
        initial_stock: '0',
        image_url: '',
        category_id: '',
        status: 'active',
        product_type: 'physical',
        brand: '',
        unit_type: '',
        track_batches: false,
      });
    }
  }, [product, reset]);

  const onSubmit = (values: FormValues) => {
    const productType = (values.product_type || 'physical') as ProductType;
    const isStocked = STOCKED_TYPES.includes(productType);
    const tracksBatches = isStocked && !!values.track_batches;

    const payload = {
      product_name: values.product_name,
      description: values.description || undefined,
      sku: values.sku || undefined,
      barcode: values.barcode || undefined,
      price: Number(values.price),
      cost_price: values.cost_price ? Number(values.cost_price) : undefined,
      tax_rate: values.tax_rate ? Number(values.tax_rate) : undefined,
      // Batch-tracked products get their stock from batches, not an initial figure.
      initial_stock: tracksBatches ? 0 : values.initial_stock ? Number(values.initial_stock) : 0,
      image_url: values.image_url || undefined,
      category_id: values.category_id || undefined,
      branch_id: branchId,
      product_type: productType,
      brand: values.brand || undefined,
      unit_type: values.unit_type || undefined,
      track_batches: tracksBatches,
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
              <Label className="text-foreground">Product Type</Label>
              <Select
                value={watch('product_type') || 'physical'}
                onValueChange={(v) => setValue('product_type', v)}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {PRODUCT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Brand</Label>
              <Input
                {...register('brand')}
                placeholder="e.g. Optimum Nutrition"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
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

          {STOCKED_TYPES.includes((watch('product_type') || 'physical') as ProductType) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-foreground">Unit Type</Label>
                  <Input
                    {...register('unit_type')}
                    placeholder="e.g. piece, kg, ml"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {!isEdit && !watch('track_batches') && (
                  <div className="space-y-2">
                    <Label className="text-foreground">Initial Stock</Label>
                    <Input
                      {...register('initial_stock')}
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <div className="space-y-0.5 pr-3">
                  <Label className="text-foreground">Track batches &amp; expiry</Label>
                  <p className="text-xs text-muted-foreground">
                    Sell FIFO from dated batches and block expired stock. Recommended for
                    supplements and perishables. Stock is then sourced from batches, not a fixed count.
                  </p>
                </div>
                <Switch
                  checked={!!watch('track_batches')}
                  onCheckedChange={(v) => setValue('track_batches', v)}
                />
              </div>
            </>
          )}

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

          {isEdit && product ? (
            <ProductImageGallery productId={product.id} />
          ) : (
            <div className="space-y-2">
              <Label className="text-foreground">Image URL</Label>
              <Input
                {...register('image_url')}
                placeholder="https://..."
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Save the product to upload a multi-image gallery.
              </p>
            </div>
          )}

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
