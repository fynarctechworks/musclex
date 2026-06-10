'use client';

import { useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Clock, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useFraudQueue, useReviewSignal,
  type FraudSignal,
} from '@/features/gym-referrals';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// ── Severity styling ──────────────────────────────────────────────

const SEVERITY_CFG: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  high:     { label: 'High',     cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  medium:   { label: 'Medium',   cls: 'bg-warning/10 text-warning border-warning/20' },
  low:      { label: 'Low',      cls: 'bg-canvas-soft text-muted-foreground border-border' },
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

// ── Review dialog ────────────────────────────────────────────────

function ReviewDialog({
  signal,
  open,
  onOpenChange,
}: {
  signal: FraudSignal | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [decision, setDecision] = useState<'reviewed_ok' | 'confirmed_fraud'>('reviewed_ok');
  const [notes, setNotes] = useState('');
  const review = useReviewSignal();

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

  if (!signal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Review fraud signal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(SEVERITY_CFG[signal.severity]?.cls)}>
              {SEVERITY_CFG[signal.severity]?.label ?? signal.severity}
            </Badge>
            <span className="font-medium">
              {SIGNAL_LABELS[signal.signal_type] ?? signal.signal_type}
            </span>
          </div>
          {signal.referral && (
            <div className="space-y-1 rounded-md border border-border bg-canvas-soft/30 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Referral
              </div>
              <div>
                <strong>{signal.referral.referrer_studio?.name}</strong>
                <span className="text-muted-foreground"> referred </span>
                <strong>{signal.referral.referred_studio?.name}</strong>
              </div>
              <div className="text-xs text-muted-foreground">
                Risk score: {signal.referral.risk_score} · Status: {signal.referral.status}
              </div>
            </div>
          )}
          <div className="space-y-1 rounded-md border border-border bg-canvas-soft/20 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Evidence
            </div>
            <pre className="text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(signal.evidence, null, 2)}
            </pre>
          </div>

          <div>
            <label className="text-sm font-medium">Decision</label>
            <Select value={decision} onValueChange={(v: any) => setDecision(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reviewed_ok">Reviewed — OK (dismiss signal)</SelectItem>
                <SelectItem value="confirmed_fraud">
                  Confirm fraud (will transition referral to terminal &apos;fraud&apos;)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this decision? Add context for the audit log."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={review.isPending}
            variant={decision === 'confirmed_fraud' ? 'destructive' : 'default'}
          >
            {decision === 'confirmed_fraud' ? 'Confirm fraud' : 'Mark reviewed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Row ──────────────────────────────────────────────────────────

function SignalRow({
  signal,
  onReview,
}: {
  signal: FraudSignal;
  onReview: (s: FraudSignal) => void;
}) {
  const cfg = SEVERITY_CFG[signal.severity] ?? SEVERITY_CFG.low;
  return (
    <Card className="hover:bg-canvas-soft/30 transition-colors">
      <CardContent className="py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn(cfg.cls)}>{cfg.label}</Badge>
          <div>
            <div className="text-sm font-medium">
              {SIGNAL_LABELS[signal.signal_type] ?? signal.signal_type}
            </div>
            <div className="text-xs text-muted-foreground">
              {signal.referral ? (
                <>
                  <strong>{signal.referral.referrer_studio?.name}</strong>
                  {' → '}
                  <strong>{signal.referral.referred_studio?.name}</strong>
                  {' · risk '}
                  {signal.referral.risk_score}
                </>
              ) : signal.subject ? (
                <>Subject: {signal.subject.name}</>
              ) : (
                'No bound referral'
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
          </span>
          <Button size="sm" onClick={() => onReview(signal)}>
            Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function FraudQueuePage() {
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [reviewSignal, setReviewSignal] = useState<FraudSignal | null>(null);

  const queue = useFraudQueue({
    severity:      severityFilter || undefined,
    review_status: 'pending',
    limit:         100,
  });

  const items = queue.data?.items ?? [];
  const total = queue.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-warning" />
            Fraud Review Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} pending signal{total === 1 ? '' : 's'}.
            Confirming a signal transitions the referral to terminal <code>fraud</code> status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[180px]">
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
      </header>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
          const count = items.filter((s) => s.severity === sev).length;
          const cfg = SEVERITY_CFG[sev];
          return (
            <Card key={sev}>
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{count}</div>
                  <div className="text-xs text-muted-foreground">{cfg.label}</div>
                </div>
                <AlertTriangle className={cn('h-5 w-5', cfg.cls)} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* List */}
      {queue.isLoading ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading queue…</CardContent></Card>
      ) : !items.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-success mb-3" />
            <p className="font-medium">Queue is clear</p>
            <p className="text-sm text-muted-foreground">No pending fraud signals.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <SignalRow key={s.id} signal={s} onReview={setReviewSignal} />
          ))}
        </div>
      )}

      <ReviewDialog
        signal={reviewSignal}
        open={!!reviewSignal}
        onOpenChange={(v) => !v && setReviewSignal(null)}
      />
    </div>
  );
}
