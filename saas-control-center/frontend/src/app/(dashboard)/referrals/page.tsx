'use client';

import Link from 'next/link';
import {
  Gift, Users, TrendingUp, DollarSign, Clock, Shield, ArrowRight, AlertTriangle, Settings2,
  Megaphone, Wallet,
} from 'lucide-react';
import {
  useReferralOverview,
  useReferralFunnel,
  useReferralTopReferrers,
  useReferralAttributedRevenue,
  useReferralTimeToReward,
} from '@/hooks/use-referrals';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PageHeader } from '@/components/layout/page-header';
import { CardSkeleton } from '@/components/shared/loading-skeleton';
import { Badge } from '@/components/ui/badge';

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  registered: 'Registered',
  trial_started: 'Trial',
  subscribed: 'Subscribed',
  payment_verified: 'Payment verified',
  reward_pending: 'Reward pending',
  rewarded: 'Rewarded',
  reversed: 'Reversed',
  fraud: 'Fraud',
  expired: 'Expired',
};

export default function ReferralsPage() {
  const overview = useReferralOverview();
  const funnel = useReferralFunnel();
  const topReferrers = useReferralTopReferrers({ limit: 10 });
  const revenue = useReferralAttributedRevenue();
  const ttr = useReferralTimeToReward();

  const pendingFraud =
    overview.data?.fraud
      ?.filter((f) => f.review_status === 'pending')
      .reduce((a, f) => a + f.count, 0) ?? 0;

  // Referral data is proxied from the main app; surface outages instead of
  // silently showing empty sections.
  const serviceDown =
    overview.isError || funnel.isError || topReferrers.isError || revenue.isError || ttr.isError;

  return (
    <div>
      <PageHeader
        title="Referral Program"
        description="Gym-to-gym referral growth across the platform"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/referrals/rules"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Reward Rules
            </Link>
            <Link
              href="/referrals/campaigns"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Megaphone className="h-3.5 w-3.5" />
              Campaigns
            </Link>
            <Link
              href="/referrals/wallets"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Wallet className="h-3.5 w-3.5" />
              Wallets
            </Link>
            <Link
              href="/referrals/fraud"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Shield className="h-3.5 w-3.5" />
              Fraud Queue
              {pendingFraud > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">
                  {pendingFraud}
                </Badge>
              )}
            </Link>
          </div>
        }
      />

      {/* Referral service outage banner */}
      {serviceDown && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          <div>
            <p className="text-[13px] font-medium text-foreground">Referral service unavailable</p>
            <p className="text-[12px] text-muted-foreground">
              Referral data is served by the main MuscleX app and could not be reached. The figures below are not "zero" — they failed to load. Confirm the main backend is running, then refresh.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {funnel.isLoading ? (
          <>
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="Total Referrals"
              value={funnel.data?.total ?? 0}
              icon={Users}
            />
            <KpiCard
              title="Conversion Rate"
              value={`${funnel.data?.conversion_pct ?? 0}%`}
              subtitle={`${funnel.data?.rewarded ?? 0} rewarded`}
              icon={TrendingUp}
              trend="up"
            />
            <KpiCard
              title="Attributed Revenue"
              value={fmtCurrency(Number(revenue.data?.total_revenue ?? 0))}
              subtitle={`${revenue.data?.count ?? 0} rewards`}
              icon={DollarSign}
            />
            <KpiCard
              title="Avg Time to Reward"
              value={`${ttr.data?.avg_hours ?? 0}h`}
              subtitle={`median ${ttr.data?.median_hours ?? 0}h`}
              icon={Clock}
            />
          </>
        )}
      </div>

      {/* Pending fraud banner */}
      {pendingFraud > 0 && (
        <Link
          href="/referrals/fraud"
          className="mt-6 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 transition-colors hover:bg-destructive/10"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-[13px] font-medium text-foreground">
              {pendingFraud} fraud signal{pendingFraud === 1 ? '' : 's'} pending review
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-[15px] font-semibold text-foreground">Lifecycle Funnel</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Referrals by current state
          </p>
          <div className="mt-4 space-y-2">
            {funnel.data?.by_status?.length ? (
              funnel.data.by_status.map((s) => {
                const pct = funnel.data!.total
                  ? Math.round((s.count / funnel.data!.total) * 100)
                  : 0;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-foreground">{STATUS_LABEL[s.status] ?? s.status}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.count} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[13px] text-muted-foreground">No referrals yet.</p>
            )}
          </div>
        </div>

        {/* Top referrers */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-[15px] font-semibold text-foreground">Top Referring Gyms</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Ranked by rewarded referrals
          </p>
          <div className="mt-4 space-y-1">
            {topReferrers.data?.length ? (
              topReferrers.data.map((r, i) => (
                <div
                  key={r.studio?.id ?? i}
                  className="flex items-center justify-between border-b border-border py-2 text-[13px] last:border-0"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 tabular-nums text-muted-foreground">#{i + 1}</span>
                    <span className="font-medium text-foreground">
                      {r.studio?.name ?? 'Unknown'}
                    </span>
                    {r.studio?.country && (
                      <span className="text-[11px] text-muted-foreground">
                        {r.studio.country}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {r.rewarded_count} rewarded
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-muted-foreground">No data yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Top-risk referrals */}
      {overview.data?.top_risk_referrals?.length ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            <h3 className="text-[15px] font-semibold text-foreground">Highest-Risk Referrals</h3>
          </div>
          <div className="mt-4 space-y-1">
            {overview.data.top_risk_referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border-b border-border py-2 text-[13px] last:border-0"
              >
                <span className="text-foreground">
                  <strong>{r.referrer_studio?.name}</strong>
                  <span className="text-muted-foreground"> → </span>
                  <strong>{r.referred_studio?.name}</strong>
                </span>
                <span className="flex items-center gap-3">
                  <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                  <span className="tabular-nums text-amber-600">risk {r.risk_score}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
