'use client';

import React, { useState } from 'react';
import { Package, Pencil, Search, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StockBadge } from './StockBadge';
import { BranchPriceDialog } from './BranchPriceDialog';
import { useProducts, useCategories } from '../hooks';
import type { Product, ProductFilters } from '../types';

interface ProductTableProps {
  branchId?: string;
  onEdit: (product: Product) => void;
}

export function ProductTable({ branchId, onEdit }: ProductTableProps) {
  const [priceProduct, setPriceProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState<ProductFilters>({
    branch_id: branchId,
    page: 1,
    limit: 20,
  });
  const [search, setSearch] = useState('');

  const { data, isLoading } = useProducts({ ...filters, search: search || undefined });
  const { data: categories } = useCategories();

  const products = data?.data || [];
  const total = data?.total || 0;
  const page = data?.page || 1;
  const limit = data?.limit || 20;
  const totalPages = Math.ceil(total / limit);

  const getStockInfo = (product: Product) => {
    const inv = Array.isArray(product.inventory)
      ? product.inventory[0]
      : product.inventory;
    return {
      stock: inv?.stock_quantity ?? 0,
      reorder: inv?.reorder_level ?? 5,
    };
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/20 text-success';
      case 'inactive': return 'bg-gray-500/20 text-muted-foreground';
      case 'discontinued': return 'bg-error/20 text-error';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Select
          value={filters.category_id || 'all'}
          onValueChange={(v) => setFilters((f) => ({ ...f, category_id: v === 'all' ? undefined : v, page: 1 }))}
        >
          <SelectTrigger className="w-[160px] bg-muted border-border text-foreground">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status || 'all'}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : v, page: 1 }))}
        >
          <SelectTrigger className="w-[140px] bg-muted border-border text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="discontinued">Discontinued</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-canvas-soft">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Stock</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No products found</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const { stock, reorder } = getStockInfo(product);
                  return (
                    <tr key={product.id} className="border-b border-border hover:bg-canvas-soft transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{product.product_name}</span>
                          {product.track_batches && (
                            <Badge className="bg-primary/15 text-primary text-[10px] px-1.5 py-0">
                              Batch
                            </Badge>
                          )}
                          {product.product_type && product.product_type !== 'physical' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                              {product.product_type}
                            </Badge>
                          )}
                        </div>
                        {product.brand && (
                          <div className="text-xs text-muted-foreground">{product.brand}</div>
                        )}
                        {product.barcode && (
                          <div className="text-xs text-muted-foreground font-mono">{product.barcode}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {product.sku || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        ₹{Number(product.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.product_type === 'service' ||
                        product.product_type === 'subscription' ||
                        product.product_type === 'digital' ? (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        ) : (
                          <StockBadge stockQuantity={stock} reorderLevel={reorder} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-xs ${statusColor(product.status)}`}>
                          {product.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {product.category?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Branch pricing"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setPriceProduct(product)}
                          >
                            <Tag className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit product"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => onEdit(product)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}
              className="border-border"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
              className="border-border"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <BranchPriceDialog
        open={!!priceProduct}
        onOpenChange={(o) => !o && setPriceProduct(null)}
        product={priceProduct}
      />
    </div>
  );
}
