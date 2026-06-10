'use client';

import { useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { Switch } from '@/components/ui/switch';
import {
  useMemberAppCampaignAudiences,
  useMemberAppCampaigns,
  useCreateCampaign,
  useSendCampaign,
  useAutomations,
  useUpdateAutomation,
  useRunAutomation,
} from '@/hooks/use-member-app';

const SEGMENTS = [
  { value: 'public', label: 'Public' },
  { value: 'lead', label: 'Leads' },
  { value: 'expired', label: 'Expired Members' },
  { value: 'active', label: 'Active Members' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'incomplete_onboarding', label: 'Incomplete Onboarding' },
];

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  sending: 'bg-amber-50 text-amber-700 border-amber-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

export default function CampaignAnalyticsPage() {
  const audiences = useMemberAppCampaignAudiences();
  const campaigns = useMemberAppCampaigns();
  const createCampaign = useCreateCampaign();
  const sendCampaign = useSendCampaign();
  const automations = useAutomations();
  const updateAutomation = useUpdateAutomation();
  const runAutomation = useRunAutomation();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState('public');

  const canCreate = title.trim().length >= 2 && body.trim().length >= 2;

  const submit = () => {
    if (!canCreate) return;
    createCampaign.mutate(
      { title: title.trim(), body: body.trim(), targetSegment: segment },
      {
        onSuccess: () => {
          setTitle('');
          setBody('');
        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Notification Campaigns"
        description="Create + send segment-targeted push to the member app"
      />

      {/* Addressable audiences */}
      {audiences.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-lg" />
          ))}
        </div>
      ) : audiences.data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {audiences.data.audiences.map((a) => (
            <KpiCard key={a.segment} title={a.label} value={a.size} icon={Megaphone} />
          ))}
        </div>
      ) : null}

      {/* Create campaign */}
      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 text-base font-semibold text-foreground">New campaign</h3>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <Label htmlFor="c-title">Title</Label>
            <Input
              id="c-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Join Now — 20% off first month"
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="c-seg">Target segment</Label>
            <select
              id="c-seg"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {SEGMENTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="c-body">Message</Label>
            <Input
              id="c-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Festival offer, trial membership, renewal reminder…"
              maxLength={500}
            />
          </div>
        </div>
        <div className="mt-3">
          <Button onClick={submit} disabled={!canCreate || createCampaign.isPending}>
            {createCampaign.isPending ? 'Creating…' : 'Create draft'}
          </Button>
        </div>
      </div>

      {/* Campaign list */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <h3 className="text-base font-semibold text-foreground">Campaigns</h3>
        </div>
        {campaigns.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </div>
        ) : campaigns.isError ? (
          <div className="p-6">
            <ErrorState title="Could not load campaigns" onRetry={() => campaigns.refetch()} />
          </div>
        ) : !campaigns.data || campaigns.data.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">
            No campaigns yet. Create one above.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Clicked</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">{c.title}</TableCell>
                  <TableCell className="capitalize">{c.target_segment}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[c.status] ?? ''}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{c.recipients}</TableCell>
                  <TableCell className="text-right">{c.sent_count}</TableCell>
                  <TableCell className="text-right">{c.opened}</TableCell>
                  <TableCell className="text-right">{c.clicked}</TableCell>
                  <TableCell className="text-right">{c.failed_count}</TableCell>
                  <TableCell className="text-right">
                    {c.status === 'draft' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sendCampaign.isPending}
                        onClick={() => sendCampaign.mutate(c.id)}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Send
                      </Button>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Automated campaigns (Phase 7.6) */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <h3 className="text-base font-semibold text-foreground">Automations</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Triggered campaigns sent hourly to a segment, deduped per user by cooldown.
          </p>
        </div>
        {automations.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </div>
        ) : automations.isError ? (
          <div className="p-6">
            <ErrorState title="Could not load automations" onRetry={() => automations.refetch()} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automation</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Cooldown</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Clicked</TableHead>
                <TableHead className="text-center">Enabled</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(automations.data ?? []).map((a) => (
                <TableRow key={a.key}>
                  <TableCell>
                    <div className="font-medium text-foreground">{a.title}</div>
                    <div className="text-[12px] text-muted-foreground">{a.key}</div>
                  </TableCell>
                  <TableCell className="capitalize">{a.target_segment.replace(/_/g, ' ')}</TableCell>
                  <TableCell className="text-right">{a.cooldown_days}d</TableCell>
                  <TableCell className="text-right">{a.sent}</TableCell>
                  <TableCell className="text-right">{a.opened}</TableCell>
                  <TableCell className="text-right">{a.clicked}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={a.enabled}
                      onCheckedChange={(v) =>
                        updateAutomation.mutate({ key: a.key, patch: { enabled: v } })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={runAutomation.isPending}
                      onClick={() => runAutomation.mutate(a.key)}
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Run now
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
