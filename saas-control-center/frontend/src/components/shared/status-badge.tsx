'use client';

import { STATUS_COLORS } from '@/lib/constants';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colorClass =
    STATUS_COLORS[status] || 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${colorClass}`}
    >
      {status}
    </span>
  );
}
