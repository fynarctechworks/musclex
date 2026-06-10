'use client';

import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Clock, Filter, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  useReferralFraudQueue,
  useReviewReferralSignal,
  type ReferralFraudSignal,
} from '@/hooks/use-referrals';
import { PageHeader } from '@/components/layout/page-header';
import { CardSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const SEVERITY_CFG: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
  high:     { label: 'High',     cls: 'bg-red-500/10 text-red-600 border-red-500/20' },
  medium:   { label: 'Medium',   cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  low:      { label: 'Low',      cls: 'bg-muted text-muted-foreground border-border' },
};

const SIGNAL_LABELS: Record<string, string> = {
  self_referral:    'Self-referral',
  duplicate_gst:    'Duplicate GST',
  duplicate_phone:  'Duplicate phone',
  duplicate_email:  'Duplicate email',
  duplicate_device: 'Duplicate device',
  duplicate_ip:     'Duplicate IP',
  velocity:         'High velocity',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ReviewDialog({
  signal,
  open,
  onOpenChange,
}: {
  signal: ReferralFraudSignal | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [decision, setDecision] = useState<'reviewed_ok' | 'confirmed_fraud'>('reviewed_ok');
  const [notes, setNotes] = useState('');
  const review = useReviewReferralSignal();

  if (!signal) return null;

  function submit() {
    if (!signal) return;
    review.mutate(
      { signalId: signal.id, decision, notes: notes || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          setNotes('');
          setDecision('reviewed_ok');
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> Review fraud signal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-[13px]">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(SEVERITY_CFG[signal.severity]?.cls)}>
              {SEVERITY_CFG[signal.severity]?.label ?? signal.severity}
            </Badge>
            <span className="font-medium text-foreground">
              {SIGNAL_LABELS[signal.signal_type] ?? signal.signal_type}
            </span>
          </div>

          {signal.referral && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Referral</div>
              <div className="text-foreground">
                <strong>{signal.referral.referrer_studio?.name}</strong>
                <span className="text-muted-foreground"> referred </span>
                <strong>{signal.referral.referred_studio?.name}</strong>
              </div>
              <div className="text-[12px] text-muted-foreground">
                Risk {signal.referral.risk_score} · {signal.referral.status}
              </div>
            </div>
          )}

          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Evidence</div>
            <pre className="mt-1 whitespace-pre-wrap break-all text-[12px] text-foreground">
              {JSON.stringify(signal.evidence, null, 2)}
            </pre>
          </div>

          <div>
            <label className="text-[13px] font-medium text-foreground">Decision</label>
            <Select value={decision} onValueChange={(v) => setDecision(v as typeof decision)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reviewed_ok">Reviewed — OK (dismiss)</SelectItem>
                <SelectItem value="confirmed_fraud">
                  Confirm fraud (referral → terminal fraud)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[13px] font-medium text-foreground">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Context for the audit log"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={decision === 'confirmed_fraud' ? 'destructive' : 'default'}
            onClick={submit}
            disabled={review.isPending}
          >
            {decision === 'confirmed_fraud' ? 'Confirm fraud' : 'Mark reviewed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReferralFraudPage() {
  const [severity, setSeverity] = useState<string>('');
  const [active, setActive] = useState<ReferralFraudSignal | null>(null);

  const queue = useReferralFraudQueue({
    severity: severity || undefined,
    review_status: 'pending',
    limit: 100,
  });

  const items = queue.data?.items ?? [];
  const total = queue.data?.total ?? 0;

  return (
    <div>
      <Link
        href="/referrals"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to referrals
      </Link>

      <PageHeader
        title="Fraud Review Queue"
        description={`${total} pending signal${total === 1 ? '' : 's'}. Confirming transitions the referral to terminal fraud status.`}
        action={
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={severity || 'all'} onValueChange={(v) => setSeverity(!v || v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[160px] text-[13px]">
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Severity tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
          const count = items.filter((s) => s.severity === sev).length;
          const cfg = SEVERITY_CFG[sev];
          return (
            <div key={sev} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-foreground">{count}</div>
                  <div className="text-[12px] text-muted-foreground">{cfg.label}</div>
                </div>
                <AlertTriangle className={cn('h-5 w-5', cfg.cls.split(' ').find((c) => c.startsWith('text-')))} />
              </div>
            </div>
          );
        })}
      </div>

      {/* List */}
      <div className="mt-6">
        {queue.isLoading ? (
          <div className="space-y-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
        ) : !items.length ? (
          <div className="rounded-lg border border-border bg-card py-16 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-medium text-foreground">Queue is clear</p>
            <p className="text-[13px] text-muted-foreground">No pending fraud signals.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((s) => {
              const cfg = SEVERITY_CFG[s.severity] ?? SEVERITY_CFG.low;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn(cfg.cls)}>{cfg.label}</Badge>
                    <div>
                      <div className="text-[13px] font-medium text-foreground">
                        {SIGNAL_LABELS[s.signal_type] ?? s.signal_type}
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {s.referral ? (
                          <>
                            <strong>{s.referral.referrer_studio?.name}</strong>
                            {' → '}
                            <strong>{s.referral.referred_studio?.name}</strong>
                            {' · risk '}{s.referral.risk_score}
                          </>
                        ) : s.subject ? (
                          <>Subject: {s.subject.name}</>
                        ) : 'No bound referral'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {relativeTime(s.created_at)}
                    </span>
                    <Button size="sm" onClick={() => setActive(s)}>Review</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReviewDialog
        signal={active}
        open={!!active}
        onOpenChange={(v) => !v && setActive(null)}
      />
    </div>
  );
}
