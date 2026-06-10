'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, Share2, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { useMemberAppReferrals, useReferralChain } from '@/hooks/use-member-app';

export default function ReferralAnalyticsPage() {
  const { data: sources, isLoading, isError, refetch } = useMemberAppReferrals();
  const chain = useReferralChain();

  return (
    <div>
      <PageHeader
        title="Referral Analytics"
        description="Acquisition source → registrations → gym conversions"
      />

      {/* Referral chain (Phase 5c / 7.8) */}
      {chain.data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard title="Code Shares" value={chain.data.shares} icon={Share2} />
          <KpiCard
            title="Referred Registrations"
            value={chain.data.referredRegistrations}
            icon={UserPlus}
          />
          <KpiCard
            title="Referred Conversions"
            value={chain.data.referredConversions}
            icon={Trophy}
          />
          <KpiCard
            title="Conversion Rate"
            value={`${chain.data.referralConversionRate}%`}
            icon={Trophy}
          />
          <KpiCard
            title="Revenue Generated"
            value={`₹${chain.data.revenue.toLocaleString('en-IN')}`}
            icon={Trophy}
          />
        </div>
      ) : null}

      {chain.data && chain.data.topReferrers.length > 0 ? (
        <div className="mb-4 rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h3 className="text-base font-semibold text-foreground">Top referrers</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Referrals</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chain.data.topReferrers.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                  <TableCell className="font-mono text-[12px]">{r.referralCode ?? '—'}</TableCell>
                  <TableCell className="text-right">{r.referrals}</TableCell>
                  <TableCell className="text-right">{r.conversions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-[300px] rounded-lg" />
      ) : isError || !sources ? (
        <ErrorState title="Could not load referral analytics" onRetry={() => refetch()} />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
                <TableHead className="text-right">Conversion %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.source}>
                  <TableCell className="font-medium capitalize text-foreground">
                    {s.source}
                  </TableCell>
                  <TableCell className="text-right">{s.registrations.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{s.conversions.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">{s.conversionPct}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t border-border p-3 text-[12px] text-muted-foreground">
            Source = how the app user was acquired (app_users.referral_source).
            Deeper invite→install→registration referral chains land with the Phase-5
            referral engine.
          </p>
        </div>
      )}
    </div>
  );
}
