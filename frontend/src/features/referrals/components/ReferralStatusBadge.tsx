'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type ReferralStatus = 'pending' | 'awarded' | 'expired';

const statusConfig: Record<ReferralStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-warning/15 text-warning border-warning/30',
  },
  awarded: {
    label: 'Awarded',
    className: 'bg-success/15 text-success border-success/30',
  },
  expired: {
    label: 'Expired',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
};

interface ReferralStatusBadgeProps {
  status: ReferralStatus;
  className?: string;
}

export function ReferralStatusBadge({ status, className }: ReferralStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
