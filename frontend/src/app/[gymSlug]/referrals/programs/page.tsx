'use client';

import { useState } from 'react';
import { Gift, Plus, Play, Pause, X, MoreVertical, Trophy, BarChart3 } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/shared/page-header';
import { AccessDenied } from '@/components/shared/access-denied';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useMemberReferralPrograms,
  useMemberReferralOverview,
  useCreateProgram,
  useUpdateProgram,
  useSetProgramStatus,
  type MemberReferralProgram,
  type MemberReferralProgramStatus,
  type MemberReferralRewardType,
} from '@/features/member-referrals';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ── Status helpers ────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-success/10 text-success border-success/20' },
  paused: { label: 'Paused', cls: 'bg-warning/10 text-warning border-warning/20' },
  ended:  { label: 'Ended',  cls: 'bg-muted text-muted-foreground border-border' },
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  discount:    'Discount %',
  free_days:   'Free days',
  cash:        'Cash reward',
  free_class:  'Free class',
};

function rewardSummary(type: string, value: string | number): string {
  const v = typeof value === 'string' ? value : value.toString();
  switch (type) {
    case 'discount':   return `${v}% off`;
    case 'free_days':  return `${v} free days`;
    case 'cash':       return `₹${v} cash`;
    case 'free_class': return `${v} free class(es)`;
    default:           return `${type}: ${v}`;
  }
}

// ── Create/Edit dialog ────────────────────────────────────────────

function ProgramDialog({
  open,
  onOpenChange,
  program,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  program?: MemberReferralProgram;
}) {
  const isEdit = !!program;
  const [name, setName] = useState(program?.program_name ?? '');
  const [rewardType, setRewardType] =
    useState<MemberReferralRewardType>((program?.reward_type as MemberReferralRewardType) ?? 'free_days');
  const [rewardValue, setRewardValue] =
    useState(program?.reward_value ? Number(program.reward_value) : 7);
  const [minReferrals, setMinReferrals] = useState(program?.min_referrals ?? 1);
  const [maxRewards, setMaxRewards]     = useState(program?.max_rewards ?? '');

  const create = useCreateProgram();
  const update = useUpdateProgram();

  function submit() {
    const payload = {
      program_name: name.trim(),
      reward_type:  rewardType,
      reward_value: Number(rewardValue),
      min_referrals: Number(minReferrals) || 1,
      max_rewards: maxRewards ? Number(maxRewards) : undefined,
    };
    if (!payload.program_name) return;

    if (isEdit && program) {
      update.mutate(
        { id: program.id, data: payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit program' : 'New referral program'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Program name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Member Referral Push"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reward type</Label>
              <Select
                value={rewardType}
                onValueChange={(v) => setRewardType(v as MemberReferralRewardType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REWARD_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rv">Value</Label>
              <Input
                id="rv"
                type="number"
                value={rewardValue}
                onChange={(e) => setRewardValue(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mr">Min referrals to qualify</Label>
              <Input
                id="mr"
                type="number"
                value={minReferrals}
                onChange={(e) => setMinReferrals(Number(e.target.value))}
                min={1}
              />
            </div>
            <div>
              <Label htmlFor="mx">Max rewards (optional)</Label>
              <Input
                id="mx"
                type="number"
                value={maxRewards}
                onChange={(e) => setMaxRewards(e.target.value)}
                placeholder="unlimited"
                min={1}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={create.isPending || update.isPending || !name.trim()}
          >
            {isEdit ? 'Save changes' : 'Create program'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Program row card ─────────────────────────────────────────────

function ProgramCard({ program }: { program: MemberReferralProgram }) {
  const [editOpen, setEditOpen] = useState(false);
  const setStatus = useSetProgramStatus();
  const cfg = STATUS_CFG[program.status] ?? STATUS_CFG.ended;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">{program.program_name}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Badge variant="outline" className={cn(cfg.cls)}>{cfg.label}</Badge>
            <span className="text-sm">
              {rewardSummary(program.reward_type, program.reward_value)}
            </span>
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              Edit
            </DropdownMenuItem>
            {program.status !== 'active' && (
              <DropdownMenuItem
                onClick={() => setStatus.mutate({ id: program.id, status: 'active' })}
              >
                <Play className="h-4 w-4 mr-2" /> Activate
              </DropdownMenuItem>
            )}
            {program.status === 'active' && (
              <DropdownMenuItem
                onClick={() => setStatus.mutate({ id: program.id, status: 'paused' })}
              >
                <Pause className="h-4 w-4 mr-2" /> Pause
              </DropdownMenuItem>
            )}
            {program.status !== 'ended' && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setStatus.mutate({ id: program.id, status: 'ended' })}
              >
                <X className="h-4 w-4 mr-2" /> End
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-1">
        <div>
          Triggers after <strong className="text-foreground">{program.min_referrals}</strong> successful referral(s).
        </div>
        {program.max_rewards && (
          <div>
            Cap: <strong className="text-foreground">{program.max_rewards}</strong> rewards per referrer.
          </div>
        )}
        <div className="text-xs">
          Created {format(new Date(program.created_at), 'd MMM yyyy')}
        </div>
      </CardContent>
      <ProgramDialog open={editOpen} onOpenChange={setEditOpen} program={program} />
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function MemberReferralProgramsPage() {
  const access = useRequirePermission('referrals');
  const programs = useMemberReferralPrograms();
  const overview = useMemberReferralOverview();
  const [createOpen, setCreateOpen] = useState(false);

  if (!access.allowed) return <AccessDenied module="referrals" />;

  const activeCount = programs.data?.filter((p) => p.status === 'active').length ?? 0;

  return (
    <AppLayout>
      <PageHeader
        title="Member Referral Programs"
        description="Reward members who bring in new members. Past rewards are immutable; new rules apply to future referrals only."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New program
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Gift className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-semibold">{programs.data?.length ?? 0}</div>
              <div className="text-sm text-muted-foreground">Total programs</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Play className="h-8 w-8 text-success" />
            <div>
              <div className="text-2xl font-semibold">{activeCount}</div>
              <div className="text-sm text-muted-foreground">Currently active</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-warning" />
            <div>
              <div className="text-2xl font-semibold">
                {overview.data?.leaderboard?.length ?? 0}
              </div>
              <div className="text-sm text-muted-foreground">Top referrers tracked</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Programs list */}
      {programs.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading programs…</div>
      ) : !programs.data?.length ? (
        <EmptyState
          icon={Gift}
          title="No referral programs yet"
          description="Create a program to start rewarding members for successful referrals."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create program
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.data.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </div>
      )}

      {/* Leaderboard preview */}
      {overview.data?.leaderboard?.length ? (
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-warning" /> Top referrers
              </CardTitle>
              <CardDescription>Members earning the most rewards.</CardDescription>
            </div>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {overview.data.leaderboard.slice(0, 5).map((row) => (
                <li
                  key={row.member?.id}
                  className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground tabular-nums w-6">
                      #{row.rank}
                    </span>
                    <span className="font-medium">{row.member?.full_name}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {row.successful_count} successful
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <ProgramDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppLayout>
  );
}
