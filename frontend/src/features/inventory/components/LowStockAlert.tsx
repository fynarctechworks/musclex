'use client';

import { AlertTriangle } from 'lucide-react';
import { useLowStock } from '../hooks';
import type { InventoryRecord } from '../types';

export function LowStockAlert({ branchId }: { branchId?: string }) {
  const { data: items } = useLowStock(branchId);

  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h3 className="text-sm font-semibold text-warning">
          Low Stock Alerts ({items.length})
        </h3>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((item: InventoryRecord) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <span className="text-foreground">
              {item.product?.product_name}
              {item.product?.sku ? ` (${item.product.sku})` : ''}
            </span>
            <span className="text-warning">
              {item.stock_quantity} left · reorder at {item.reorder_level}
            </span>
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-xs text-muted-foreground">
            +{items.length - 5} more items below reorder level
          </p>
        )}
      </div>
    </div>
  );
}
