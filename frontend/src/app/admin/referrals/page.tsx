'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3, Users, Gift, TrendingUp, ArrowRight,
  Activity, Settings2, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useAdminReferralAnalytics,
  useAdminAllReferrals,
  useAdminRewardLogs,
  type ReferralStatus,
} from '@/features/gym-referrals';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ── Status helpers ────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ReferralStatus,
  { label: string; color: string; bg: string }
> = {
  pending:   { label: 'Pending',   color: 'text-warning',    bg: 'bg-warning/10' },
  completed: { label: 'Completed', color: 'text-primary',    bg: 'bg-primary/10' },
  rewarded:  { label: 'Rewarded',  color: 'text-success',    bg: 'bg-success/10' },
  expired:   { label: 'Expired',   color: 'text-muted-foreground', bg: 'bg-muted/60' },
  fraud:     { label: 'Fraud',     color: 'text-destructive', bg: 'bg-destructive/10' },
  reversed:  { label: 'Reversed',  color: 'text-destructive', bg: 'bg-destructive/10' },
};

function StatusBadge({ status }: { status: ReferralStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.expired;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
        cfg.bg,
        cfg.color,
      )}
    >
      {cfg.label}
    </span>
  );
}

// ── Metric Card ───────────────────────────────────────────────────

function MetricCard({
  label, value, icon: Icon, color, bg, delta,
}: {
  label: string;
  value: string | number;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
  delta?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', bg)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        {delta !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium',
              delta >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            <ChevronUp className={cn('h-3 w-3', delta < 0 && 'rotate-180')} />
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-foreground tracking-tight">{value}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function AdminReferralsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data: analytics, isLoading: analyticsLoading } = useAdminReferralAnalytics();
  const { data: referrals, isLoading: listLoading } = useAdminAllReferrals({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit: 15,
  });
  const { data: rewardLogs } = useAdminRewardLogs({ page: 1 });

  // Conversion rate
  const rewarded = analytics?.by_status?.find((s) => s.status === 'rewarded')?.count ?? 0;
  const convRate =
    analytics?.total_referrals && analytics.total_referrals > 0
      ? Math.round((rewarded / analytics.total_referrals) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card/60 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Referral System</h1>
          <p className="text-[12px] text-muted-foreground">Platform-wide analytics & management</p>
        </div>
        <Link href="/admin/referrals/rules">
          <Button variant="outline" size="sm" className="border-border gap-2">
            <Settings2 className="h-4 w-4" />
            Manage Rules
          </Button>
        </Link>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Metrics */}
        {analyticsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total Referrals"
              value={analytics.total_referrals}
              icon={Users}
              color="text-primary"
              bg="bg-primary/10"
            />
            <MetricCard
              label="Rewards Applied"
              value={analytics.total_rewards_applied}
              icon={Gift}
              color="text-success"
              bg="bg-success/10"
            />
            <MetricCard
              label="Conversion Rate"
              value={`${convRate}%`}
              icon={TrendingUp}
              color="text-primary"
              bg="bg-primary/10"
            />
            <MetricCard
              label="Active Referrals"
              value={
                analytics.by_status.find((s) => s.status === 'pending')?.count ?? 0
              }
              icon={Activity}
              color="text-warning"
              bg="bg-warning/10"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Referral funnel */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Referral Funnel
              </h2>
            </div>
            {analytics ? (
              <div className="space-y-2">
                {analytics.by_status.map((s) => {
                  const pct =
                    analytics.total_referrals > 0
                      ? Math.round((s.count / analytics.total_referrals) * 100)
                      : 0;
                  const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.expired;
                  return (
                    <div key={s.status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] text-muted-foreground capitalize">
                          {s.status}
                        </span>
                        <span className="text-[12px] font-medium text-foreground">
                          {s.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', cfg.bg)}
                          style={{ width: `${pct}%`, backgroundColor: 'var(--primary)' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-32 animate-pulse rounded-lg bg-muted" />
            )}
          </div>

          {/* Top Referrers */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Top Referrers
            </h2>
            {analytics?.top_referrers?.length ? (
              <div className="space-y-3">
                {analytics.top_referrers.slice(0, 5).map((tr, i) => (
                  <div key={tr.studio?.id} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">
                        {tr.studio?.name ?? 'Unknown'}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {tr.studio?.referral_code}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      {tr.rewarded_count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">No referrers yet.</p>
            )}
          </div>
        </div>

        {/* Referrals table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">All Referrals</h2>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-[130px] text-xs border-border bg-muted">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {['all', 'pending', 'completed', 'rewarded', 'expired', 'fraud'].map((s) => (
                  <SelectItem key={s} value={s} className="text-xs text-foreground focus:bg-muted capitalize">
                    {s === 'all' ? 'All Statuses' : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {listLoading ? (
            <div className="p-5 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Referrer', 'Referred Gym', 'Code', 'Status', 'Rewards', 'Date'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {((referrals as { data?: unknown[] })?.data as Array<{
                    id: string;
                    referral_code: string;
                    status: ReferralStatus;
                    created_at: string;
                    referrer_studio?: { name: string };
                    referred_studio?: { name: string } | null;
                    reward_logs?: unknown[];
                  }> ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {r.referrer_studio?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.referred_studio?.name ?? 'Pending signup'}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground tracking-wider">
                        {r.referral_code}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.reward_logs?.length ?? 0} reward{(r.reward_logs?.length ?? 0) !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(r.created_at), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))}
                  {!((referrals as { data?: unknown[] })?.data as unknown[])?.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                        No referrals found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {(referrals as { meta?: { total_pages: number } })?.meta && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <p className="text-[11px] text-muted-foreground">
                Page {page} of {(referrals as { meta?: { total_pages: number } })?.meta?.total_pages ?? 1}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-border"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-border"
                  disabled={page >= ((referrals as { meta?: { total_pages: number } })?.meta?.total_pages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Reward Logs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Gift className="h-4 w-4 text-success" />
              Recent Reward Activity
            </h2>
            <Link href="/admin/referrals/rules" className="text-[12px] text-primary flex items-center gap-1 hover:underline">
              View Rules <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/50">
            {(rewardLogs as Array<{
              id: string;
              reward_type: string;
              reward_value: { days?: number; amount?: number; currency?: string };
              applied_at: string;
              status: string;
              rule?: { name: string };
              referral?: {
                referrer_studio?: { name: string };
                referred_studio?: { name: string };
              };
            }> ?? []).slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-center gap-4 px-5 py-3">
                <div className={cn(
                  'h-7 w-7 rounded-md flex items-center justify-center shrink-0',
                  log.status === 'applied' ? 'bg-success/10' : 'bg-destructive/10',
                )}>
                  <Gift className={cn(
                    'h-3.5 w-3.5',
                    log.status === 'applied' ? 'text-success' : 'text-destructive',
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground">
                    {log.reward_type === 'extend_subscription'
                      ? `+${log.reward_value.days} days subscription`
                      : log.reward_type}
                    {' '}<span className="text-muted-foreground font-normal">→ {log.referral?.referrer_studio?.name ?? '—'}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Rule: {log.rule?.name ?? '—'} · Triggered by: {log.referral?.referred_studio?.name ?? '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(log.applied_at), 'MMM d, HH:mm')}
                  </p>
                  <span className={cn(
                    'text-[10px] font-medium',
                    log.status === 'applied' ? 'text-success' : 'text-destructive',
                  )}>
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
            {!(rewardLogs as unknown[])?.length && (
              <div className="py-8 text-center text-[12px] text-muted-foreground">
                No reward activity yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
