'use client';

import React, { useState, useMemo } from 'react';
import { Plus, UserPlus, Gift, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemberReferralDashboard } from '@/features/member-referrals';
import { useMemberReferrals } from '../hooks';
import { ReferralTable } from './ReferralTable';
import { CreateReferralDialog } from './CreateReferralDialog';

interface MemberReferralsTabProps {
  memberId: string;
}

export function MemberReferralsTab({ memberId }: MemberReferralsTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: referrals, isLoading } = useMemberReferrals(memberId);
  const { data: dashboard } = useMemberReferralDashboard(memberId);

  const given = useMemo(
    () => (referrals ?? []).filter((r) => r.referrer_member_id === memberId),
    [referrals, memberId],
  );

  const received = useMemo(
    () => (referrals ?? []).filter((r) => r.referred_member_id === memberId),
    [referrals, memberId],
  );

  const pendingCount = given.filter((r) => r.reward_status === 'pending').length;
  const awardedCount = given.filter((r) => r.reward_status === 'awarded').length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Leaderboard rank banner (from authoritative server dashboard) */}
      {dashboard?.rank ? (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <Trophy className="h-5 w-5 text-warning" />
          <div className="text-sm">
            <span className="font-semibold text-foreground">
              Ranked #{dashboard.rank}
            </span>
            <span className="text-muted-foreground">
              {' '}on the gym referral leaderboard
              {dashboard.referral_code ? ` · code ${dashboard.referral_code}` : ''}
            </span>
          </div>
        </div>
      ) : null}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5" />
            Friends Referred
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">{given.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Gift className="h-3.5 w-3.5 text-success" />
            Rewards Earned
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">{awardedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Gift className="h-3.5 w-3.5 text-warning" />
            Pending Rewards
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">{pendingCount}</p>
        </div>
      </div>

      {/* Action button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          Record Referral
        </Button>
      </div>

      {/* Tabs for given/received */}
      <Tabs defaultValue="given">
        <TabsList className="bg-muted border border-border p-1">
          <TabsTrigger
            value="given"
            className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
          >
            Referred ({given.length})
          </TabsTrigger>
          <TabsTrigger
            value="received"
            className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
          >
            Referred By ({received.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="given" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <ReferralTable referrals={given} memberId={memberId} perspective="given" />
          </div>
        </TabsContent>

        <TabsContent value="received" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <ReferralTable referrals={received} memberId={memberId} perspective="received" />
          </div>
        </TabsContent>
      </Tabs>

      <CreateReferralDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        referrerMemberId={memberId}
      />
    </div>
  );
}
