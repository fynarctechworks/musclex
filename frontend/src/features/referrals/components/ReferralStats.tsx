'use client';

import React from 'react';
import { Users, Gift, Clock, CheckCircle } from 'lucide-react';
import { useReferralStats } from '../hooks';

const statCards = [
  { key: 'total', label: 'Total Referrals', icon: Users, color: 'text-primary' },
  { key: 'pending', label: 'Pending', icon: Clock, color: 'text-warning' },
  { key: 'awarded', label: 'Rewarded', icon: CheckCircle, color: 'text-success' },
  { key: 'expired', label: 'Expired', icon: Gift, color: 'text-destructive' },
] as const;

export function ReferralStats() {
  const { data: stats, isLoading } = useReferralStats();

  const getValue = (key: (typeof statCards)[number]['key']): number => {
    if (!stats) return 0;
    if (key === 'total') return stats.total ?? 0;
    return stats.by_status?.[key] ?? 0;
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {statCards.map(({ key, label, icon: Icon, color }) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          {isLoading ? (
            <div className="mt-2 h-7 w-12 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-foreground">{getValue(key)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
