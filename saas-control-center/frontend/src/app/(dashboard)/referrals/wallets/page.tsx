'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Wallet, Search, Snowflake, Sun, Plus, Minus, Lock,
} from 'lucide-react';
import {
  useReferralWallet,
  useFreezeWallet,
  useUnfreezeWallet,
  useManualWalletAdjustment,
  type WalletEntry,
} from '@/hooks/use-referrals';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENTRY_CFG: Record<string, { label: string; cls: string }> = {
  credit:   { label: 'Credit',   cls: 'text-emerald-600' },
  debit:    { label: 'Debit',    cls: 'text-red-600' },
  reversal: { label: 'Reversal', cls: 'text-amber-600' },
  expiry:   { label: 'Expiry',   cls: 'text-muted-foreground' },
};

function AdjustDialog({
  studioId,
  open,
  onOpenChange,
}: {
  studioId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const adjust = useManualWalletAdjustment();
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState(100);
  const [currency, setCurrency] = useState('INR');
  const [reason, setReason] = useState('');

  function submit() {
    if (reason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters');
      return;
    }
    if (!amount || amount < 1) {
      toast.error('Amount must be at least 1');
      return;
    }
    adjust.mutate(
      {
        studio_id: studioId,
        amount: direction === 'credit' ? Math.abs(amount) : -Math.abs(amount),
        currency,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast.success('Wallet adjusted');
          onOpenChange(false);
          setReason('');
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manual wallet adjustment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={direction === 'credit' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setDirection('credit')}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Credit
            </Button>
            <Button
              type="button"
              variant={direction === 'debit' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setDirection('debit')}
            >
              <Minus className="mr-1.5 h-3.5 w-3.5" /> Debit
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amt">Amount</Label>
              <Input id="amt" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="cur">Currency</Label>
              <Input id="cur" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </div>
          </div>
          <div>
            <Label htmlFor="rsn">Reason (audit log)</Label>
            <Input id="rsn" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this adjustment? (min 5 chars)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={adjust.isPending}>Apply adjustment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReferralWalletsPage() {
  const [input, setInput] = useState('');
  const [studioId, setStudioId] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const wallet = useReferralWallet(studioId);
  const freeze = useFreezeWallet();
  const unfreeze = useUnfreezeWallet();

  function lookup() {
    const id = input.trim();
    if (!UUID_RE.test(id)) {
      toast.error('Enter a valid studio UUID');
      return;
    }
    setStudioId(id);
  }

  const entries: WalletEntry[] = wallet.data?.entries ?? [];

  return (
    <div>
      <Link
        href="/referrals"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to referrals
      </Link>

      <PageHeader
        title="Referral Wallets"
        description="Look up a gym's referral wallet by studio ID to view its ledger, freeze it, or make a manual adjustment."
      />

      {/* Lookup */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            placeholder="Studio UUID"
            className="pl-9"
          />
        </div>
        <Button onClick={lookup}>Look up</Button>
      </div>

      {studioId && (
        <div className="mt-6">
          {wallet.isLoading ? (
            <p className="text-[13px] text-muted-foreground">Loading wallet…</p>
          ) : (
            <>
              {/* Balance card */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold tracking-tight text-foreground">
                      {wallet.data?.currency} {wallet.data?.balance}
                    </div>
                    <div className="text-[12px] text-muted-foreground">Spendable balance</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
                    Adjust
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const reason = prompt('Reason to freeze (min 5 chars):') ?? '';
                      if (reason.trim().length < 5) { toast.error('Reason too short'); return; }
                      freeze.mutate(
                        { studioId, reason: reason.trim() },
                        { onSuccess: () => toast.success('Wallet frozen'), onError: (e: Error) => toast.error(e.message) },
                      );
                    }}
                  >
                    <Snowflake className="mr-1.5 h-3.5 w-3.5" /> Freeze
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      unfreeze.mutate(studioId, {
                        onSuccess: () => toast.success('Wallet unfrozen'),
                        onError: (e: Error) => toast.error(e.message),
                      })
                    }
                  >
                    <Sun className="mr-1.5 h-3.5 w-3.5" /> Unfreeze
                  </Button>
                </div>
              </div>

              {/* Ledger */}
              <div className="mt-6 rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3 text-[13px] font-semibold text-foreground">
                  Ledger ({entries.length})
                </div>
                {!entries.length ? (
                  <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                    No wallet entries.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {entries.map((e) => {
                      const cfg = ENTRY_CFG[e.entry_type] ?? ENTRY_CFG.credit;
                      const isNeg = e.amount.trim().startsWith('-');
                      return (
                        <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn('text-[10px]', cfg.cls)}>
                              {cfg.label}
                            </Badge>
                            <span className="text-foreground">{e.description ?? e.source_type}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn('tabular-nums font-medium', isNeg ? 'text-red-600' : 'text-emerald-600')}>
                              {e.currency} {e.amount}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(e.created_at).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <AdjustDialog studioId={studioId} open={adjustOpen} onOpenChange={setAdjustOpen} />
            </>
          )}
        </div>
      )}

      {!studioId && (
        <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Lock className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">Enter a studio ID to view its referral wallet.</p>
        </div>
      )}
    </div>
  );
}
