'use client';

import React from 'react';
import { format } from 'date-fns';
import { Gift, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const rewardTypeLabels: Record<string, string> = {
  discount: 'Discount',
  free_days: 'Free Days',
  cash: 'Cash Reward',
  free_class: 'Free Class',
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/15 text-success border-success/30' },
  paused: { label: 'Paused', className: 'bg-warning/15 text-warning border-warning/30' },
  ended: { label: 'Ended', className: 'bg-muted text-muted-foreground border-border' },
};

interface ReferralProgramCardProps {
  program: Record<string, unknown>;
}

export function ReferralProgramCard({ program }: ReferralProgramCardProps) {
  const status = (program.status as string) || 'active';
  const config = statusConfig[status] ?? statusConfig.active;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">
              {program.program_name as string}
            </h3>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                config.className,
              )}
            >
              {config.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5" />
              {rewardTypeLabels[(program.reward_type as string) ?? ''] ?? program.reward_type}
              {': '}
              {program.reward_type === 'cash' && '₹'}
              {String(program.reward_value ?? 0)}
              {program.reward_type === 'free_days' && ' days'}
              {program.reward_type === 'discount' && '% off'}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Min {String(program.min_referrals ?? 1)} referral(s)
            </span>
            {program.start_date ? (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(program.start_date as string), 'dd MMM yyyy')}
                {program.end_date ? ` — ${format(new Date(program.end_date as string), 'dd MMM yyyy')}` : ''}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
