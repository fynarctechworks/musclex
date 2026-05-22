'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StockBadgeProps {
  stockQuantity: number;
  reorderLevel: number;
  className?: string;
}

export function StockBadge({ stockQuantity, reorderLevel, className }: StockBadgeProps) {
  if (stockQuantity <= 0) {
    return (
      <Badge variant="destructive" className={cn('text-xs', className)}>
        Out of Stock
      </Badge>
    );
  }
  if (stockQuantity <= reorderLevel) {
    return (
      <Badge className={cn('bg-warning/20 text-warning hover:bg-warning/30 text-xs', className)}>
        Low Stock ({stockQuantity})
      </Badge>
    );
  }
  return (
    <Badge className={cn('bg-success/20 text-success hover:bg-success/30 text-xs', className)}>
      In Stock ({stockQuantity})
    </Badge>
  );
}
