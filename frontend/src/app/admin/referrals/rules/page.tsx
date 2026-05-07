'use client';

import { useState } from 'react';
import {
  Plus, Pencil, Trash2, ChevronLeft, Settings2, Zap,
  CheckCircle2, XCircle, AlertTriangle, Info, X, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  useAdminReferralRules,
  useAdminCampaigns,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleCampaign,
  type RewardRule,
  type CreateRulePayload,
  type RuleConditions,
  type RewardAction,
} from '@/features/gym-referrals';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ── Default templates ────────────────────────────────────────────

const RULE_TEMPLATES: { label: string; conditions: RuleConditions; rewards: RewardAction[] }[] = [
  {
    label: '30 Days — Any Paid Plan',
    conditions: { min_subscription_amount: 1 },
    rewards: [{ type: 'extend_subscription', days: 30 }],
  },
  {
    label: '60 Days — Annual Plan',
    conditions: { billing_cycles: ['annual'], min_subscription_amount: 1000 },
    rewards: [{ type: 'extend_subscription', days: 60 }],
  },
  {
    label: '7-Day Trial Extension',
    conditions: {},
    rewards: [{ type: 'trial_extension', days: 7 }],
  },
];

// ── Rule status indicator ────────────────────────────────────────

function RuleStatus({ rule }: { rule: RewardRule }) {
  const now = new Date();
  const expired = rule.valid_until && new Date(rule.valid_until) < now;
  const notStarted = rule.valid_from && new Date(rule.valid_from) > now;
  const hitCap = rule.max_uses !== null && rule.uses_count >= rule.max_uses;

  if (!rule.is_active)  return <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><XCircle className="h-3 w-3" />Inactive</span>;
  if (hitCap)           return <span className="flex items-center gap-1 text-[11px] text-warning"><AlertTriangle className="h-3 w-3" />Cap reached</span>;
  if (expired)          return <span className="flex items-center gap-1 text-[11px] text-destructive"><XCircle className="h-3 w-3" />Expired</span>;
  if (notStarted)       return <span className="flex items-center gap-1 text-[11px] text-primary"><Info className="h-3 w-3" />Scheduled</span>;
  return <span className="flex items-center gap-1 text-[11px] text-success"><CheckCircle2 className="h-3 w-3" />Live</span>;
}

// ── Condition summary for rule card ──────────────────────────────

function ConditionPills({ conditions }: { conditions: RuleConditions }) {
  const pills: { label: string; color: string }[] = [];

  if (conditions.plan_ids?.length)
    pills.push({ label: `${conditions.plan_ids.length} plan(s)`, color: 'bg-primary/10 text-primary' });
  if (conditions.billing_cycles?.length)
    pills.push({ label: conditions.billing_cycles.join(', '), color: 'bg-primary/10 text-primary' });
  if (conditions.min_subscription_amount)
    pills.push({ label: `≥ ${conditions.min_subscription_amount}`, color: 'bg-muted text-muted-foreground' });
  if (conditions.max_referrals_per_referrer)
    pills.push({ label: `max ${conditions.max_referrals_per_referrer}/referrer`, color: 'bg-muted text-muted-foreground' });
  if (conditions.studio_countries?.length)
    pills.push({ label: conditions.studio_countries.join(', '), color: 'bg-muted text-muted-foreground' });
  if (pills.length === 0)
    pills.push({ label: 'Any plan', color: 'bg-muted text-muted-foreground' });

  return (
    <div className="flex flex-wrap gap-1">
      {pills.map((p, i) => (
        <span key={i} className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', p.color)}>
          {p.label}
        </span>
      ))}
    </div>
  );
}

// ── Reward summary ────────────────────────────────────────────────

function RewardSummary({ rewards }: { rewards: RewardAction[] }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {rewards.map((r, i) => (
        <span
          key={i}
          className="text-[10px] px-1.5 py-0.5 rounded-md bg-success/10 text-success font-medium"
        >
          {r.type === 'extend_subscription' && `+${r.days}d subscription`}
          {r.type === 'trial_extension' && `+${r.days}d trial`}
          {r.type === 'account_credit' && `${r.currency ?? 'INR'} ${r.amount} credit`}
        </span>
      ))}
    </div>
  );
}

// ── Rule Form ─────────────────────────────────────────────────────

interface RuleFormState {
  name: string;
  description: string;
  priority: number;
  max_uses: string;
  valid_from: string;
  valid_until: string;
  conditionsJson: string;
  rewardsJson: string;
  jsonError: string;
}

function defaultForm(rule?: RewardRule): RuleFormState {
  return {
    name:          rule?.name ?? '',
    description:   rule?.description ?? '',
    priority:      rule?.priority ?? 0,
    max_uses:      rule?.max_uses != null ? String(rule.max_uses) : '',
    valid_from:    rule?.valid_from ? rule.valid_from.slice(0, 10) : '',
    valid_until:   rule?.valid_until ? rule.valid_until.slice(0, 10) : '',
    conditionsJson: JSON.stringify(rule?.conditions ?? {}, null, 2),
    rewardsJson:   JSON.stringify(rule?.rewards ?? [{ type: 'extend_subscription', days: 30 }], null, 2),
    jsonError:     '',
  };
}

function RuleFormDialog({
  open,
  rule,
  onClose,
}: {
  open: boolean;
  rule?: RewardRule;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RuleFormState>(() => defaultForm(rule));
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');

  const createRule = useCreateRule();
  const updateRule = useUpdateRule(rule?.id ?? '');

  const setField = (k: keyof RuleFormState, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v, jsonError: '' }));

  const applyTemplate = (t: typeof RULE_TEMPLATES[0]) => {
    setForm((f) => ({
      ...f,
      name:          f.name || t.label,
      conditionsJson: JSON.stringify(t.conditions, null, 2),
      rewardsJson:   JSON.stringify(t.rewards, null, 2),
      jsonError:     '',
    }));
  };

  const validateAndBuild = (): CreateRulePayload | null => {
    let conditions: RuleConditions;
    let rewards: RewardAction[];

    try {
      conditions = JSON.parse(form.conditionsJson);
    } catch {
      setField('jsonError', 'Conditions JSON is invalid');
      return null;
    }

    try {
      rewards = JSON.parse(form.rewardsJson);
    } catch {
      setField('jsonError', 'Rewards JSON is invalid');
      return null;
    }

    if (!Array.isArray(rewards) || rewards.length === 0) {
      setField('jsonError', 'Rewards must be a non-empty array');
      return null;
    }

    return {
      name:        form.name.trim(),
      description: form.description.trim() || undefined,
      priority:    Number(form.priority),
      conditions,
      rewards,
      max_uses:    form.max_uses ? parseInt(form.max_uses, 10) : undefined,
      valid_from:  form.valid_from || undefined,
      valid_until: form.valid_until || undefined,
    };
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    const payload = validateAndBuild();
    if (!payload) return;

    if (rule) {
      await updateRule.mutateAsync(payload);
    } else {
      await createRule.mutateAsync(payload);
    }
    onClose();
  };

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Settings2 className="h-4 w-4 text-primary" />
            {rule ? 'Edit Rule' : 'Create Reward Rule'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Templates (only on create) */}
          {!rule && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-2">Quick Templates</p>
              <div className="flex flex-wrap gap-2">
                {RULE_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t)}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-border bg-muted/60 hover:bg-muted text-foreground transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Basic fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[12px] font-medium text-foreground block mb-1">
                Rule Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. 30 Days Extension — Any Paid Plan"
                className="h-9 text-sm"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-foreground block mb-1">Priority</label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setField('priority', parseInt(e.target.value, 10) || 0)}
                className="h-9 text-sm"
                min={0}
                max={1000}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Higher = evaluated first</p>
            </div>

            <div>
              <label className="text-[12px] font-medium text-foreground block mb-1">
                Max Uses <span className="text-muted-foreground">(blank = unlimited)</span>
              </label>
              <Input
                type="number"
                value={form.max_uses}
                onChange={(e) => setField('max_uses', e.target.value)}
                placeholder="Unlimited"
                className="h-9 text-sm"
                min={1}
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-foreground block mb-1">Valid From</label>
              <Input
                type="date"
                value={form.valid_from}
                onChange={(e) => setField('valid_from', e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-foreground block mb-1">Valid Until</label>
              <Input
                type="date"
                value={form.valid_until}
                onChange={(e) => setField('valid_until', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* JSON Editors */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'form' | 'json')}>
            <TabsList className="bg-muted h-8 text-xs">
              <TabsTrigger value="form" className="h-6 text-xs">Visual Editor</TabsTrigger>
              <TabsTrigger value="json" className="h-6 text-xs">Raw JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="mt-3 space-y-4">
              {/* Conditions visual */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-[12px] font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-sm bg-primary/10 flex items-center justify-center text-[9px] text-primary font-bold">IF</span>
                  Trigger Conditions
                  <span className="text-[10px] font-normal text-muted-foreground">(ALL must match)</span>
                </h3>
                <ConditionEditor
                  value={form.conditionsJson}
                  onChange={(v) => setField('conditionsJson', v)}
                />
              </div>

              {/* Rewards visual */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-[12px] font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-sm bg-success/10 flex items-center justify-center text-[9px] text-success font-bold">DO</span>
                  Reward Actions
                </h3>
                <RewardEditor
                  value={form.rewardsJson}
                  onChange={(v) => setField('rewardsJson', v)}
                />
              </div>
            </TabsContent>

            <TabsContent value="json" className="mt-3 space-y-3">
              <div>
                <label className="text-[12px] font-medium text-foreground block mb-1">
                  Conditions JSON
                </label>
                <Textarea
                  value={form.conditionsJson}
                  onChange={(e) => setField('conditionsJson', e.target.value)}
                  rows={6}
                  className="font-mono text-xs bg-muted/60"
                  placeholder='{"min_subscription_amount": 1}'
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground block mb-1">
                  Rewards JSON
                </label>
                <Textarea
                  value={form.rewardsJson}
                  onChange={(e) => setField('rewardsJson', e.target.value)}
                  rows={6}
                  className="font-mono text-xs bg-muted/60"
                  placeholder='[{"type": "extend_subscription", "days": 30}]'
                />
              </div>

              {/* Schema reference */}
              <div className="rounded-lg border border-border bg-card p-3 text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground mb-1.5">Conditions schema reference:</p>
                <p><span className="text-primary font-mono">plan_ids</span>: string[] — specific plan DB IDs (empty = any)</p>
                <p><span className="text-primary font-mono">billing_cycles</span>: ("monthly"|"annual")[] — filter by billing cycle</p>
                <p><span className="text-primary font-mono">min_subscription_amount</span>: number — minimum amount paid</p>
                <p><span className="text-primary font-mono">studio_countries</span>: string[] — ISO codes e.g. ["IN","US"]</p>
                <p><span className="text-primary font-mono">max_referrals_per_referrer</span>: number — per-referrer cap</p>
                <p className="font-semibold text-foreground mt-2 mb-1.5">Reward types:</p>
                <p><span className="text-success font-mono">extend_subscription</span>: {`{ days: N }`}</p>
                <p><span className="text-success font-mono">trial_extension</span>: {`{ days: N }`}</p>
                <p><span className="text-success font-mono">account_credit</span>: {`{ amount: N, currency: "INR" }`}</p>
              </div>
            </TabsContent>
          </Tabs>

          {form.jsonError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <p className="text-[12px] text-destructive">{form.jsonError}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {rule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Condition Editor (visual) ─────────────────────────────────────

function ConditionEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  let parsed: RuleConditions = {};
  try { parsed = JSON.parse(value); } catch { /* keep empty */ }

  const update = (partial: Partial<RuleConditions>) => {
    onChange(JSON.stringify({ ...parsed, ...partial }, null, 2));
  };

  return (
    <div className="space-y-3 text-[12px]">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Min Amount Paid</label>
          <Input
            type="number"
            value={parsed.min_subscription_amount ?? ''}
            onChange={(e) => update({ min_subscription_amount: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="0 = any amount"
            className="h-8 text-xs mt-1"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Max Uses Per Referrer</label>
          <Input
            type="number"
            value={parsed.max_referrals_per_referrer ?? ''}
            onChange={(e) => update({ max_referrals_per_referrer: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Unlimited"
            className="h-8 text-xs mt-1"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-muted-foreground block mb-1">Billing Cycles</label>
        <div className="flex gap-2">
          {(['monthly', 'annual'] as const).map((cycle) => {
            const active = parsed.billing_cycles?.includes(cycle);
            return (
              <button
                key={cycle}
                onClick={() => {
                  const current = parsed.billing_cycles ?? [];
                  update({
                    billing_cycles: active
                      ? current.filter((c) => c !== cycle)
                      : [...current, cycle],
                  });
                }}
                className={cn(
                  'px-3 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted',
                )}
              >
                {cycle}
              </button>
            );
          })}
          {(parsed.billing_cycles?.length ?? 0) > 0 && (
            <button
              onClick={() => update({ billing_cycles: [] })}
              className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              clear
            </button>
          )}
        </div>
        {!(parsed.billing_cycles?.length) && (
          <p className="text-[10px] text-muted-foreground mt-1">Any billing cycle</p>
        )}
      </div>

      <div>
        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
          Country Codes <span className="font-normal">(comma-separated, e.g. IN,US)</span>
        </label>
        <Input
          value={parsed.studio_countries?.join(',') ?? ''}
          onChange={(e) => update({
            studio_countries: e.target.value
              ? e.target.value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
              : [],
          })}
          placeholder="Any country"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

// ── Reward Editor (visual) ────────────────────────────────────────

function RewardEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  let rewards: RewardAction[] = [];
  try {
    const p = JSON.parse(value);
    rewards = Array.isArray(p) ? p : [];
  } catch { /* keep empty */ }

  const updateReward = (index: number, partial: Partial<RewardAction>) => {
    const next = [...rewards];
    next[index] = { ...next[index], ...partial };
    onChange(JSON.stringify(next, null, 2));
  };

  const addReward = () => {
    onChange(JSON.stringify(
      [...rewards, { type: 'extend_subscription', days: 30 }],
      null,
      2,
    ));
  };

  const removeReward = (i: number) => {
    onChange(JSON.stringify(rewards.filter((_, idx) => idx !== i), null, 2));
  };

  return (
    <div className="space-y-2">
      {rewards.map((r, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Type</label>
              <select
                value={r.type}
                onChange={(e) => updateReward(i, { type: e.target.value as RewardAction['type'] })}
                className="w-full h-8 rounded-lg border border-border bg-muted/60 text-xs text-foreground px-2 mt-1"
              >
                <option value="extend_subscription">Extend Subscription</option>
                <option value="trial_extension">Extend Trial</option>
                <option value="account_credit">Account Credit</option>
              </select>
            </div>

            {(r.type === 'extend_subscription' || r.type === 'trial_extension') && (
              <div>
                <label className="text-[10px] text-muted-foreground">Days</label>
                <Input
                  type="number"
                  value={r.days ?? ''}
                  onChange={(e) => updateReward(i, { days: parseInt(e.target.value, 10) || 1 })}
                  className="h-8 text-xs mt-1"
                  min={1}
                  max={365}
                />
              </div>
            )}

            {r.type === 'account_credit' && (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground">Amount</label>
                  <Input
                    type="number"
                    value={r.amount ?? ''}
                    onChange={(e) => updateReward(i, { amount: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-xs mt-1"
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Currency</label>
                  <Input
                    value={r.currency ?? 'INR'}
                    onChange={(e) => updateReward(i, { currency: e.target.value.toUpperCase() })}
                    className="h-8 text-xs mt-1"
                    maxLength={3}
                  />
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => removeReward(i)}
            className="mt-5 h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={addReward}
        className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 mt-2"
      >
        <Plus className="h-3 w-3" /> Add reward action
      </button>
    </div>
  );
}

// ── Main Rules Page ───────────────────────────────────────────────

export default function AdminRulesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<RewardRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: rules, isLoading } = useAdminReferralRules();
  const { data: campaigns } = useAdminCampaigns();
  const deleteRule = useDeleteRule();
  const toggleCampaign = useToggleCampaign();
  const updateRule = useUpdateRule(editRule?.id ?? '');

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/referrals">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8">
              <ChevronLeft className="h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Reward Rules
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Dynamic rules evaluated by the rule engine — zero code changes needed
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 h-8">
          <Plus className="h-4 w-4" />
          New Rule
        </Button>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Campaigns */}
        {(campaigns?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-[12px] font-semibold text-foreground mb-3">Campaigns</h2>
            <div className="flex flex-wrap gap-3">
              {campaigns!.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
                >
                  <div>
                    <p className="text-[12px] font-medium text-foreground">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.rules?.length ?? 0} rule(s)
                      {c.referrals_count > 0 && ` · ${c.referrals_count} referrals`}
                    </p>
                  </div>
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) =>
                      toggleCampaign.mutate({ id: c.id, is_active: v })
                    }
                    className="data-[state=checked]:bg-success"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules list */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : rules?.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
            <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No rules configured</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Create a rule to define when and how referrers get rewarded.
            </p>
            <Button className="mt-4 h-8 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create First Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules!.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-border bg-card p-5 hover:border-border/80 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Priority badge */}
                  <div className="shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-primary">{rule.priority}</span>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className="text-[13px] font-semibold text-foreground">{rule.name}</h3>
                      <RuleStatus rule={rule} />
                      {rule.campaign && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-border text-muted-foreground">
                          {rule.campaign.name}
                        </Badge>
                      )}
                    </div>

                    {rule.description && (
                      <p className="text-[11px] text-muted-foreground mb-2">{rule.description}</p>
                    )}

                    <div className="flex items-center gap-4 flex-wrap text-[11px]">
                      <div>
                        <span className="text-muted-foreground mr-1.5">When:</span>
                        <ConditionPills conditions={rule.conditions} />
                      </div>
                      <div>
                        <span className="text-muted-foreground mr-1.5">Then:</span>
                        <RewardSummary rewards={rule.rewards} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>Used {rule.uses_count}{rule.max_uses ? `/${rule.max_uses}` : ''} times</span>
                      {rule.valid_until && (
                        <span>Expires {format(new Date(rule.valid_until), 'MMM d, yyyy')}</span>
                      )}
                      <span>Created {format(new Date(rule.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(v) =>
                        updateRule.mutate({ is_active: v })
                      }
                      className="data-[state=checked]:bg-success"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditRule(rule)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Explanation box */}
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <h3 className="text-[12px] font-semibold text-foreground mb-2 flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-primary" />
            How the Rule Engine Works
          </h3>
          <ul className="space-y-1.5 text-[11px] text-muted-foreground">
            <li>• Rules are evaluated in <strong className="text-foreground">priority order</strong> (highest first) when a subscription is activated</li>
            <li>• All conditions use <strong className="text-foreground">AND logic</strong> — every condition must match for a rule to fire</li>
            <li>• <strong className="text-foreground">ALL matching rules</strong> are applied — a referrer can earn multiple rewards</li>
            <li>• <strong className="text-foreground">Idempotency</strong> — the same event can never apply the same rule twice</li>
            <li>• Subscription extension uses <code className="text-primary bg-muted/60 px-1 rounded">max(current_expiry, now) + days</code> to handle expired subscriptions</li>
            <li>• Changes take effect <strong className="text-foreground">immediately</strong> with zero deployment</li>
          </ul>
        </div>
      </div>

      {/* Dialogs */}
      {createOpen && (
        <RuleFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
      {editRule && (
        <RuleFormDialog open={!!editRule} rule={editRule} onClose={() => setEditRule(null)} />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete Rule
            </DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground py-2">
            This will permanently delete the rule (or deactivate it if it has existing reward history).
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-border" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteRule.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                await deleteRule.mutateAsync(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              {deleteRule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
