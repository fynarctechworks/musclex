'use client';

import React from 'react';
import { Package, Package2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useProducts, useCategories, useBundles } from '@/features/inventory/hooks';
import type { Product, Bundle } from '@/features/inventory/types';
import type { CartItem } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProductGridProps {
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onAddBundleToCart?: (bundle: Bundle) => void;
  branchId?: string;
}

export function ProductGrid({ cart, onAddToCart, onAddBundleToCart, branchId }: ProductGridProps) {
  const [search, setSearch] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<string>('');

  const { data, isLoading } = useProducts({
    branch_id: branchId,
    status: 'active',
    search: search || undefined,
    category_id: categoryId || undefined,
    limit: 100,
  });
  const { data: categories } = useCategories();
  const { data: bundlesData } = useBundles({ branch_id: branchId, status: 'active', limit: 50 });

  const products = data?.data || [];
  const bundles: Bundle[] = bundlesData?.data ?? [];
  const filteredBundles = search
    ? bundles.filter((b) =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.sku ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : bundles;

  const getCartQty = (key: string) =>
    cart.find((c) => c.key === key)?.quantity || 0;

  const getStockQty = (product: Product) => {
    const inv = Array.isArray(product.inventory)
      ? product.inventory[0]
      : product.inventory;
    return inv?.stock_quantity ?? 0;
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground"
        />
        <Select value={categoryId || 'all'} onValueChange={(v) => setCategoryId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px] bg-muted border-border text-foreground">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No products found</p>
        </div>
      ) : (
        <>
          {/* Bundles strip — only when bundles exist and the search/filter matches */}
          {filteredBundles.length > 0 && onAddBundleToCart && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Package2 className="h-3.5 w-3.5" />
                Bundles
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredBundles.map((bundle) => {
                  const key = `bundle:${bundle.id}`;
                  const cartQty = getCartQty(key);
                  return (
                    <button
                      key={bundle.id}
                      onClick={() => onAddBundleToCart(bundle)}
                      className={cn(
                        'relative flex flex-col items-start rounded-lg border p-3 text-left transition-all',
                        'border-primary/40 bg-canvas-soft-2/40 hover:border-primary/70 hover:bg-canvas-soft-2',
                        cartQty > 0 && 'ring-1 ring-primary/40',
                      )}
                    >
                      {cartQty > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                          {cartQty}
                        </span>
                      )}
                      <div className="text-sm font-medium text-foreground line-clamp-2 mb-1">
                        {bundle.name}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {bundle.items.length} item{bundle.items.length === 1 ? '' : 's'}
                      </div>
                      <div className="mt-auto flex w-full items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">
                          ₹{Number(bundle.price).toFixed(0)}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-primary">Bundle</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((product) => {
            const stock = getStockQty(product);
            const cartQty = getCartQty(product.id);
            const outOfStock = stock <= 0;

            return (
              <button
                key={product.id}
                disabled={outOfStock}
                onClick={() => onAddToCart(product)}
                className={cn(
                  'relative flex flex-col items-start rounded-lg border p-3 text-left transition-all',
                  'border-border bg-card hover:border-primary/50 hover:bg-canvas-soft',
                  outOfStock && 'opacity-50 cursor-not-allowed hover:border-border hover:bg-card',
                  cartQty > 0 && 'border-primary/60 ring-1 ring-primary/30',
                )}
              >
                {cartQty > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {cartQty}
                  </span>
                )}
                <div className="text-sm font-medium text-foreground line-clamp-2 mb-1">
                  {product.product_name}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {product.sku || product.barcode || '—'}
                </div>
                <div className="mt-auto flex w-full items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    ₹{Number(product.price).toFixed(0)}
                  </span>
                  <span className={cn(
                    'text-xs',
                    outOfStock ? 'text-destructive' : stock <= 5 ? 'text-warning' : 'text-muted-foreground',
                  )}>
                    {outOfStock ? 'Out' : `${stock} left`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
