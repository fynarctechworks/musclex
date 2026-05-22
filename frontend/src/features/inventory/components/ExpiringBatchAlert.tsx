'use client';

import { Clock, AlertTriangle } from 'lucide-react';
import { useExpiringBatches } from '../hooks';
import type { ProductBatch } from '../types';

export function ExpiringBatchAlert({ branchId }: { branchId?: string }) {
  const { data: batches } = useExpiringBatches({ branch_id: branchId, days_ahead: 30 });

  if (!batches || batches.length === 0) return null;

  const expired = batches.filter((b) => b.is_expired);
  const expiringSoon = batches.filter((b) => !b.is_expired);

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-warning" />
        <h3 className="text-sm font-semibold text-warning">
          Expiring &amp; Expired Batches ({batches.length})
        </h3>
      </div>
      <div className="space-y-1.5">
        {expired.slice(0, 5).map((b: ProductBatch) => (
          <div key={b.id} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-foreground">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              {b.product?.product_name} · batch {b.batch_number}
            </span>
            <span className="text-destructive font-medium">
              Expired ({b.quantity} units blocked)
            </span>
          </div>
        ))}
        {expiringSoon.slice(0, 5).map((b: ProductBatch) => (
          <div key={b.id} className="flex items-center justify-between text-xs">
            <span className="text-foreground">
              {b.product?.product_name} · batch {b.batch_number}
            </span>
            <span className="text-warning">
              {b.days_until_expiry}d left · {b.quantity} units
            </span>
          </div>
        ))}
        {batches.length > 10 && (
          <p className="text-xs text-muted-foreground">
            +{batches.length - 10} more batches expiring within 30 days
          </p>
        )}
      </div>
    </div>
  );
}
