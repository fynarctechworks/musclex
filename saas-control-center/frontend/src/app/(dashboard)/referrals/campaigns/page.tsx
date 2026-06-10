'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Megaphone, CalendarRange } from 'lucide-react';
import {
  useReferralCampaigns,
  useCreateCampaign,
  type CreateCampaignPayload,
} from '@/hooks/use-referrals';
import { PageHeader } from '@/components/layout/page-header';
import { CardSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CampaignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateCampaign();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');

  function submit() {
    if (!name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    const payload: CreateCampaignPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      is_active: isActive,
      ...(from ? { valid_from: new Date(from).toISOString() } : {}),
      ...(until ? { valid_until: new Date(until).toISOString() } : {}),
    };
    create.mutate(payload, {
      onSuccess: () => {
        toast.success('Campaign created');
        onOpenChange(false);
        setName(''); setDescription(''); setFrom(''); setUntil('');
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cn">Campaign name</Label>
            <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer 2026 Growth Push" />
          </div>
          <div>
            <Label htmlFor="cd">Description</Label>
            <Input id="cd" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this campaign is for" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cf">Valid from</Label>
              <Input id="cf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cu">Valid until</Label>
              <Input id="cu" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-[13px] text-foreground">{isActive ? 'Active' : 'Inactive'}</span>
          </div>
          <p className="text-[12px] text-muted-foreground">
            After creating, attach reward rules to this campaign from the Reward Rules screen
            (set the campaign on a rule).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>Create campaign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReferralCampaignsPage() {
  const campaigns = useReferralCampaigns();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Link
        href="/referrals"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to referrals
      </Link>

      <PageHeader
        title="Campaigns"
        description="Time-bounded reward campaigns. Attach reward rules to a campaign to scope them to a date window."
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New campaign
          </Button>
        }
      />

      {campaigns.isLoading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
      ) : !campaigns.data?.length ? (
        <div className="rounded-lg border border-dashed border-border bg-card py-16 text-center">
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No campaigns yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
            Create a campaign to run limited-time reward boosts (e.g. double rewards for a festival period).
          </p>
          <Button size="sm" className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Create campaign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {campaigns.data.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">{c.name}</h3>
                  {c.description && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{c.description}</p>
                  )}
                </div>
                <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">
                  {c.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" />
                {fmtDate(c.valid_from)} → {fmtDate(c.valid_until)}
              </div>
              {c.rules?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.rules.map((r) => (
                    <Badge key={r.id} variant="outline" className="text-[10px]">{r.name}</Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-muted-foreground">No rules attached.</p>
              )}
            </div>
          ))}
        </div>
      )}

      <CampaignDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
