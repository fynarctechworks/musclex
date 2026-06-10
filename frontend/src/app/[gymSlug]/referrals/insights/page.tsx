'use client';

import { TrendingUp, Users, Trophy, Coins, Gift } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/shared/page-header';
import { AccessDenied } from '@/components/shared/access-denied';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import {
  useMemberReferralFunnel,
  useMemberReferralRewardCosts,
  useMemberReferralLeaderboardAdmin,
} from '@/features/member-referrals';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  awarded: 'Awarded',
  expired: 'Expired',
};

export default function MemberReferralInsightsPage() {
  const access = useRequirePermission('referrals');
  const funnel = useMemberReferralFunnel();
  const rewardCosts = useMemberReferralRewardCosts();
  const leaderboard = useMemberReferralLeaderboardAdmin({ limit: 10 });

  if (!access.allowed) return <AccessDenied module="referrals" />;

  const total = funnel.data?.total ?? 0;

  return (
    <AppLayout>
      <PageHeader
        title="Member Referral Insights"
        description="Conversion, reward costs, and your top-referring members."
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-semibold">{total}</div>
              <div className="text-sm text-muted-foreground">Total referrals</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <TrendingUp className="h-8 w-8 text-success" />
            <div>
              <div className="text-2xl font-semibold">{funnel.data?.conversion_pct ?? 0}%</div>
              <div className="text-sm text-muted-foreground">
                Conversion · {funnel.data?.awarded ?? 0} awarded
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Trophy className="h-8 w-8 text-warning" />
            <div>
              <div className="text-2xl font-semibold">{leaderboard.data?.length ?? 0}</div>
              <div className="text-sm text-muted-foreground">Active referrers</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referral Funnel</CardTitle>
            <CardDescription>Referrals by reward status</CardDescription>
          </CardHeader>
          <CardContent>
            {funnel.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !funnel.data?.by_status?.length ? (
              <p className="text-sm text-muted-foreground">No referrals yet.</p>
            ) : (
              <div className="space-y-3">
                {funnel.data.by_status.map((s) => {
                  const pct = total ? Math.round((s.count / total) * 100) : 0;
                  return (
                    <div key={s.status}>
                      <div className="flex items-center justify-between text-sm">
                        <span>{STATUS_LABEL[s.status] ?? s.status}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {s.count} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reward costs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4" /> Reward Costs
            </CardTitle>
            <CardDescription>Rewards issued by type and status</CardDescription>
          </CardHeader>
          <CardContent>
            {rewardCosts.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !rewardCosts.data?.length ? (
              <p className="text-sm text-muted-foreground">No rewards issued yet.</p>
            ) : (
              <div className="space-y-1">
                {rewardCosts.data.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
                  >
                    <span className="flex items-center gap-2">
                      <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="capitalize">{r.reward_type.replace('_', ' ')}</span>
                      <span className="text-xs text-muted-foreground">({r.status})</span>
                    </span>
                    <span className="tabular-nums">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-warning" /> Leaderboard
          </CardTitle>
          <CardDescription>Members with the most successful referrals</CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !leaderboard.data?.length ? (
            <EmptyState
              icon={Trophy}
              title="No referrers yet"
              description="Members who successfully refer others will appear here."
            />
          ) : (
            <ol className="space-y-2">
              {leaderboard.data.map((row) => (
                <li
                  key={row.member?.id ?? row.rank}
                  className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                        row.rank === 1 ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {row.rank}
                    </span>
                    <span className="font-medium">{row.member?.full_name ?? 'Unknown'}</span>
                    {row.member?.referral_code && (
                      <code className="text-xs text-muted-foreground">{row.member.referral_code}</code>
                    )}
                  </span>
                  <span className="text-muted-foreground">{row.successful_count} successful</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
