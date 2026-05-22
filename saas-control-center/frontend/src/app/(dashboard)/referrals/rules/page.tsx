'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, CalendarClock, Gift, Wallet, Clock, Coins,
  Pencil, Trash2, Power, AlertCircle,
} from 'lucide-react';
import {
  useReferralRules,
  useSubscriptionPlans,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  type RewardRule,
  type RewardAction,
  type RewardActionType,
  type CreateRulePayload,
} from '@/hooks/use-referrals';
import { PageHeader } from '@/components/layout/page-header';
import { CardSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ── Reward type metadata ─────────────────────────────────────────

const REWARD_TYPES: Record<RewardActionType, { label: string; icon: typeof Gift; hint: string }> = {
  extend_subscription: {
    label: 'Extend subscription',
    icon: CalendarClock,
    hint: "Adds days to the referrer gym's subscription expiry date.",
  },
  trial_extension: {
    label: 'Extend trial',
    icon: Clock,
    hint: "Adds days to the referrer gym's trial end date.",
  },
  wallet_credit: {
    label: 'Wallet credit',
    icon: Wallet,
    hint: 'Adds spendable referral wallet credit (usable on renewals/add-ons).',
  },
  account_credit: {
    label: 'Account credit',
    icon: Coins,
    hint: 'Logs a flat account credit for the billing team to reconcile.',
  },
};

function rewardSummary(r: RewardAction): string {
  switch (r.type) {
    case 'extend_subscription': return `+${r.days ?? 0} days subscription`;
    case 'trial_extension':     return `+${r.days ?? 0} days trial`;
    case 'wallet_credit':       return `${r.currency ?? 'INR'} ${r.amount ?? 0} wallet${r.expires_in_days ? ` (expires ${r.expires_in_days}d)` : ''}`;
    case 'account_credit':      return `${r.currency ?? 'INR'} ${r.amount ?? 0} credit`;
    default:                    return JSON.stringify(r);
  }
}

// ── Rule create/edit dialog ──────────────────────────────────────

function RuleDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule?: RewardRule;
}) {
  const isEdit = !!rule;
  const plans = useSubscriptionPlans();
  const create = useCreateRule();
  const update = useUpdateRule();

  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [priority, setPriority] = useState(rule?.priority ?? 0);

  // Reward (single action — covers the common case; backend supports many)
  const initialReward = rule?.rewards?.[0];
  const [rewardType, setRewardType] = useState<RewardActionType>(
    initialReward?.type ?? 'extend_subscription',
  );
  const [days, setDays] = useState(initialReward?.days ?? 15);
  const [amount, setAmount] = useState(initialReward?.amount ?? 500);
  const [currency, setCurrency] = useState(initialReward?.currency ?? 'INR');
  const [expiresInDays, setExpiresInDays] = useState(initialReward?.expires_in_days ?? '');

  // Conditions
  const [billingCycle, setBillingCycle] = useState<'any' | 'monthly' | 'annual'>(
    rule?.conditions?.billing_cycles?.[0] ?? 'any',
  );
  const [planIds, setPlanIds] = useState<string[]>(rule?.conditions?.plan_ids ?? []);
  const [minAmount, setMinAmount] = useState(rule?.conditions?.min_subscription_amount ?? '');
  const [maxPerReferrer, setMaxPerReferrer] = useState(
    rule?.conditions?.max_referrals_per_referrer ?? '',
  );

  // Validity window
  const [validFrom, setValidFrom] = useState(rule?.valid_from?.slice(0, 10) ?? '');
  const [validUntil, setValidUntil] = useState(rule?.valid_until?.slice(0, 10) ?? '');
  const [maxUses, setMaxUses] = useState(rule?.max_uses ?? '');

  const needsDays = rewardType === 'extend_subscription' || rewardType === 'trial_extension';
  const needsAmount = rewardType === 'wallet_credit' || rewardType === 'account_credit';

  function buildReward(): RewardAction {
    if (needsDays) return { type: rewardType, days: Number(days) };
    const r: RewardAction = { type: rewardType, amount: Number(amount), currency };
    if (rewardType === 'wallet_credit' && expiresInDays) {
      r.expires_in_days = Number(expiresInDays);
    }
    return r;
  }

  function submit() {
    if (!name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    if (needsDays && (!days || Number(days) < 1)) {
      toast.error('Days must be at least 1');
      return;
    }
    if (needsAmount && (!amount || Number(amount) < 1)) {
      toast.error('Amount must be at least 1');
      return;
    }

    const payload: CreateRulePayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      is_active: isActive,
      priority: Number(priority) || 0,
      conditions: {
        ...(planIds.length ? { plan_ids: planIds } : {}),
        ...(billingCycle !== 'any' ? { billing_cycles: [billingCycle] } : {}),
        ...(minAmount ? { min_subscription_amount: Number(minAmount) } : {}),
        ...(maxPerReferrer ? { max_referrals_per_referrer: Number(maxPerReferrer) } : {}),
      },
      rewards: [buildReward()],
      ...(maxUses ? { max_uses: Number(maxUses) } : {}),
      ...(validFrom ? { valid_from: new Date(validFrom).toISOString() } : {}),
      ...(validUntil ? { valid_until: new Date(validUntil).toISOString() } : {}),
    };

    const onDone = () => {
      toast.success(isEdit ? 'Rule updated' : 'Rule created');
      onOpenChange(false);
    };
    const onErr = (e: Error) => toast.error(e.message);

    if (isEdit && rule) {
      update.mutate({ id: rule.id, data: payload }, { onSuccess: onDone, onError: onErr });
    } else {
      create.mutate(payload, { onSuccess: onDone, onError: onErr });
    }
  }

  const RewardIcon = REWARD_TYPES[rewardType].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit reward rule' : 'New reward rule'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basics */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Rule name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Refer a gym → +15 days"
              />
            </div>
            <div>
              <Label htmlFor="desc">Description (optional)</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Internal note about what this rule does"
              />
            </div>
          </div>

          {/* Reward */}
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <RewardIcon className="h-4 w-4 text-primary" />
              <span className="text-[13px] font-semibold text-foreground">Reward</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>What does the referrer gym get?</Label>
                <Select value={rewardType} onValueChange={(v) => setRewardType(v as RewardActionType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REWARD_TYPES) as RewardActionType[]).map((t) => (
                      <SelectItem key={t} value={t}>{REWARD_TYPES[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {REWARD_TYPES[rewardType].hint}
                </p>
              </div>

              {needsDays && (
                <div>
                  <Label htmlFor="days">Days to add</Label>
                  <Input
                    id="days" type="number" min={1}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  />
                </div>
              )}

              {needsAmount && (
                <>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount" type="number" min={1}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      maxLength={3}
                    />
                  </div>
                  {rewardType === 'wallet_credit' && (
                    <div className="col-span-2">
                      <Label htmlFor="exp">Credit expires after (days, optional)</Label>
                      <Input
                        id="exp" type="number" min={1}
                        value={expiresInDays}
                        onChange={(e) => setExpiresInDays(e.target.value)}
                        placeholder="never"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="mb-3 text-[13px] font-semibold text-foreground">
              When does it trigger?
            </div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              The reward is granted when a <strong>referred gym subscribes</strong> and all
              conditions below match. Leave a condition blank to match anything.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Billing cycle</Label>
                <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as typeof billingCycle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any cycle</SelectItem>
                    <SelectItem value="monthly">Monthly only</SelectItem>
                    <SelectItem value="annual">Annual only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="minamt">Min subscription amount</Label>
                <Input
                  id="minamt" type="number" min={0}
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="any"
                />
              </div>
              <div className="col-span-2">
                <Label>Restrict to plans (optional)</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {plans.data?.length ? plans.data.map((p) => {
                    const selected = planIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setPlanIds((cur) =>
                            selected ? cur.filter((x) => x !== p.id) : [...cur, p.id],
                          )
                        }
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                          selected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {p.display_name}
                      </button>
                    );
                  }) : (
                    <span className="text-[12px] text-muted-foreground">No plans found.</span>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="maxref">Max rewards per referrer</Label>
                <Input
                  id="maxref" type="number" min={1}
                  value={maxPerReferrer}
                  onChange={(e) => setMaxPerReferrer(e.target.value)}
                  placeholder="unlimited"
                />
              </div>
            </div>
          </div>

          {/* Validity + limits */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="vf">Valid from</Label>
              <Input id="vf" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="vu">Valid until</Label>
              <Input id="vu" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="mu">Global max uses</Label>
              <Input
                id="mu" type="number" min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="unlimited"
              />
            </div>
          </div>

          {/* Priority + active */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="prio" className="text-[13px]">Priority</Label>
                <Input
                  id="prio" type="number" className="w-20"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-[13px] text-foreground">{isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending}>
            {isEdit ? 'Save changes' : 'Create rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Rule card ────────────────────────────────────────────────────

function RuleCard({ rule, onEdit }: { rule: RewardRule; onEdit: (r: RewardRule) => void }) {
  const del = useDeleteRule();
  const update = useUpdateRule();

  const cond = rule.conditions ?? {};
  const conditionChips: string[] = [];
  if (cond.billing_cycles?.length) conditionChips.push(`${cond.billing_cycles.join('/')} only`);
  if (cond.min_subscription_amount) conditionChips.push(`min ${cond.min_subscription_amount}`);
  if (cond.plan_ids?.length) conditionChips.push(`${cond.plan_ids.length} plan(s)`);
  if (cond.max_referrals_per_referrer) conditionChips.push(`max ${cond.max_referrals_per_referrer}/referrer`);

  function toggleActive() {
    update.mutate(
      { id: rule.id, data: { is_active: !rule.is_active } },
      {
        onSuccess: () => toast.success(rule.is_active ? 'Rule deactivated' : 'Rule activated'),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  function remove() {
    if (!confirm(`Delete rule "${rule.name}"? Rules with reward history are deactivated instead.`)) return;
    del.mutate(rule.id, {
      onSuccess: () => toast.success('Rule removed'),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold text-foreground">{rule.name}</h3>
            <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-[10px]">
              {rule.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {rule.priority !== 0 && (
              <span className="text-[11px] text-muted-foreground">prio {rule.priority}</span>
            )}
          </div>
          {rule.description && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{rule.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleActive} title="Toggle active">
            <Power className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(rule)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={remove} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Rewards */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {rule.rewards?.map((r, i) => (
          <Badge key={i} variant="outline" className="gap-1 text-[11px]">
            <Gift className="h-3 w-3" />
            {rewardSummary(r)}
          </Badge>
        ))}
      </div>

      {/* Conditions + usage */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {conditionChips.length
          ? conditionChips.map((c, i) => <span key={i}>· {c}</span>)
          : <span>· any subscription</span>}
        <span className="ml-auto tabular-nums">
          used {rule.uses_count}{rule.max_uses ? ` / ${rule.max_uses}` : ''}
        </span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function ReferralRulesPage() {
  const rules = useReferralRules();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<RewardRule | null>(null);

  return (
    <div>
      <Link
        href="/referrals"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to referrals
      </Link>

      <PageHeader
        title="Reward Rules"
        description="Define what referrer gyms earn when a referred gym subscribes. New rules apply to future referrals; past rewards stay immutable."
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New rule
          </Button>
        }
      />

      {rules.isLoading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : !rules.data?.length ? (
        <div className="rounded-lg border border-dashed border-border bg-card py-16 text-center">
          <Gift className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No reward rules yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
            Create your first rule — e.g. &ldquo;when a referred gym subscribes annually, give the
            referrer +30 days subscription.&rdquo;
          </p>
          <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Create rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            All matching active rules fire — a referral can earn multiple rewards. Use priority to
            order evaluation and <code>max uses</code> / <code>max per referrer</code> to cap payouts.
          </div>
          {rules.data.map((r) => (
            <RuleCard key={r.id} rule={r} onEdit={setEditRule} />
          ))}
        </div>
      )}

      <RuleDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editRule && (
        <RuleDialog
          open={!!editRule}
          onOpenChange={(v) => !v && setEditRule(null)}
          rule={editRule}
        />
      )}
    </div>
  );
}
