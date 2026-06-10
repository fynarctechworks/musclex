'use client';

import { useState } from 'react';
import {
  Copy, Check, Share2, Gift, Users, Clock,
  TrendingUp, ChevronRight, CalendarClock, Zap, Info,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { AccessDenied } from '@/components/shared/access-denied';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { useMyReferralStats } from '@/features/gym-referrals';
import { ApplyCodeDialog } from './components/ApplyCodeDialog';
import { HowItWorksDialog } from './components/HowItWorksDialog';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────

function fmtRewardValue(type: string, value: Record<string, unknown>): string {
  switch (type) {
    case 'extend_subscription':
      return `+${value.days} days subscription`;
    case 'account_credit':
      return `${value.currency || 'INR'} ${value.amount} credit`;
    case 'trial_extension':
      return `+${value.days} days trial`;
    default:
      return JSON.stringify(value);
  }
}

function expiryColor(expiry: string | null): string {
  if (!expiry) return 'text-muted-foreground';
  const daysLeft = Math.ceil(
    (new Date(expiry).getTime() - Date.now()) / 86_400_000,
  );
  if (daysLeft < 0) return 'text-destructive';
  if (daysLeft < 14) return 'text-warning';
  return 'text-success';
}

// ── Sub-components ────────────────────────────────────────────────

function ReferralCodeCard({
  code,
  expiresAt,
}: {
  code: string;
  expiresAt: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const text = `Join MuscleX with my referral code ${code} and manage your gym better! 💪`;
    if (navigator.share) {
      await navigator.share({ title: 'MuscleX Referral', text });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Share text copied to clipboard');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Your Referral Code</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Share this code with other gym owners
          </p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
          <Gift className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Code display */}
      <div className="flex items-center gap-3 bg-canvas-soft rounded-lg px-4 py-3 mb-4">
        <span className="font-mono text-2xl font-semibold tracking-[0.3em] text-foreground flex-1">
          {code}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          {copied
            ? <Check className="h-4 w-4 text-success" />
            : <Copy className="h-4 w-4" />
          }
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Subscription expiry */}
      {expiresAt && (
        <div className="flex items-center gap-2 text-[12px]">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Subscription expires:</span>
          <span className={cn('font-medium', expiryColor(expiresAt))}>
            {format(new Date(expiresAt), 'MMM d, yyyy')}
            {' '}
            <span className="font-normal text-muted-foreground">
              ({formatDistanceToNow(new Date(expiresAt), { addSuffix: true })})
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function StatsGrid({
  total,
  pending,
  rewarded,
}: {
  total: number;
  pending: number;
  rewarded: number;
}) {
  const conversionRate = total > 0 ? Math.round((rewarded / total) * 100) : 0;

  const stats = [
    {
      label: 'Total Referrals',
      value: total,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-canvas-soft-2',
    },
    {
      label: 'Pending',
      value: pending,
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      label: 'Rewarded',
      value: rewarded,
      icon: Gift,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Conversion',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-canvas-soft-2',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className={cn('h-8 w-8 rounded-md flex items-center justify-center mb-3', s.bg)}>
            <s.icon className={cn('h-4 w-4', s.color)} />
          </div>
          <p className="text-[11px] text-muted-foreground">{s.label}</p>
          <p className="text-xl font-semibold text-foreground mt-0.5">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      n: '01',
      title: 'Share Your Code',
      desc: 'Copy your unique referral code and share it with other gym owners.',
    },
    {
      n: '02',
      title: 'They Sign Up',
      desc: 'The referred gym enters your code during onboarding.',
    },
    {
      n: '03',
      title: 'They Subscribe',
      desc: 'When they activate a paid plan, rewards are automatically calculated.',
    },
    {
      n: '04',
      title: 'You Get Rewarded',
      desc: 'Your subscription is extended based on the dynamic reward rules.',
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        How It Works
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, i) => (
          <div key={step.n} className="flex gap-3">
            <div className="flex-none">
              <div className="h-7 w-7 rounded-full bg-canvas-soft-2 flex items-center justify-center">
                <span className="text-[10px] font-semibold text-primary">{step.n}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden xl:flex justify-center mt-1">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <p className="text-[12px] font-semibold text-foreground">{step.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentRewardsTab({
  rewards,
}: {
  rewards: Array<{
    reward_type: string;
    reward_value: Record<string, unknown>;
    applied_at: string;
    subscription_extended_to?: string | null;
    referred_gym?: string;
  }>;
}) {
  if (rewards.length === 0) {
    return (
      <EmptyState
        icon={Gift}
        title="No rewards yet"
        description="Rewards appear here once referred gyms activate their subscriptions."
      />
    );
  }

  return (
    <div className="space-y-2">
      {rewards.map((r, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-success/10 flex items-center justify-center shrink-0">
              <Gift className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">
                {fmtRewardValue(r.reward_type, r.reward_value)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {r.referred_gym ? `Referred: ${r.referred_gym}` : 'Reward earned'}
              </p>
            </div>
          </div>
          <div className="text-right">
            {r.subscription_extended_to && (
              <p className="text-[11px] text-success font-medium">
                Until {format(new Date(r.subscription_extended_to), 'MMM d, yyyy')}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(r.applied_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function GymReferralsPage() {
  const { allowed, checked } = useRequirePermission('marketing', 'view', 'deny');
  const [applyOpen, setApplyOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const { data: stats, isLoading } = useMyReferralStats();

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="marketing" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Referral Program"
          description="Earn subscription extensions by referring other gyms to MuscleX"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setHowItWorksOpen(true)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="How the referral program works"
              >
                <Info className="mr-2 h-4 w-4" />
                How it works
              </Button>
              <Button
                variant="outline"
                onClick={() => setApplyOpen(true)}
                className="border-border"
              >
                <Gift className="mr-2 h-4 w-4" />
                Apply a Referral Code
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="space-y-4">
            {[80, 40, 120, 80].map((h, i) => (
              <div
                key={i}
                style={{ height: h }}
                className="animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : stats ? (
          <div className="space-y-5">
            {/* Referral code card */}
            <ReferralCodeCard
              code={stats.referral_code ?? '------'}
              expiresAt={stats.subscription_expires_at}
            />

            {/* Stats grid */}
            <StatsGrid
              total={stats.stats.total}
              pending={stats.stats.pending}
              rewarded={stats.stats.rewarded}
            />

            {/* How it works */}
            <HowItWorksSection />

            {/* Rewards history */}
            <Tabs defaultValue="rewards">
              <TabsList className="bg-muted h-9">
                <TabsTrigger value="rewards" className="text-xs h-7">
                  Recent Rewards
                  {stats.recent_rewards.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                      {stats.recent_rewards.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rewards" className="mt-4">
                <RecentRewardsTab rewards={stats.recent_rewards} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <EmptyState
            icon={Gift}
            title="Referral data unavailable"
            description="Could not load your referral stats. Please refresh."
          />
        )}
      </div>

      <ApplyCodeDialog open={applyOpen} onOpenChange={setApplyOpen} />
      <HowItWorksDialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen} />
    </AppLayout>
  );
}
