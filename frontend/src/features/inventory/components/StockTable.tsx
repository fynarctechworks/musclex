'use client';

import React, { useState } from 'react';
import { Package, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { StockBadge } from './StockBadge';
import { AdjustStockDialog } from './AdjustStockDialog';
import { useInventory } from '../hooks';
import type { InventoryRecord, InventoryFilters } from '../types';

interface StockTableProps {
  branchId?: string;
}

export function StockTable({ branchId }: StockTableProps) {
  const [filters, setFilters] = useState<InventoryFilters>({
    branch_id: branchId,
    page: 1,
    limit: 20,
  });
  const [adjustItem, setAdjustItem] = useState<InventoryRecord | null>(null);

  const { data, isLoading } = useInventory(filters);

  const items = data?.data || [];
  const total = data?.total || 0;
  const page = data?.page || 1;
  const limit = data?.limit || 20;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">On Hand</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Reserved</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Reorder Level</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
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
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No inventory records</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{item.product?.product_name}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {item.product?.sku || '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-foreground">
                      {item.stock_quantity}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {item.reserved_quantity}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {item.reorder_level}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StockBadge
                        stockQuantity={item.stock_quantity}
                        reorderLevel={item.reorder_level}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setAdjustItem(item)}
                      >
                        <ArrowUpDown className="h-3 w-3 mr-1" />
                        Adjust
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      <AdjustStockDialog
        open={!!adjustItem}
        onOpenChange={(open) => !open && setAdjustItem(null)}
        inventoryItem={adjustItem}
      />
    </div>
  );
}
