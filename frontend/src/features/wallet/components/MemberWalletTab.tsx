'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Wallet as WalletIcon, Star, Plus, ArrowDownUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  useWallet,
  useWalletTransactions,
  useTopUpWallet,
} from '../hooks';
import { useAuthStore } from '@/stores/auth-store';
import type { WalletTransaction, WalletTransactionType } from '../types';

const TYPE_LABELS: Record<WalletTransactionType, string> = {
  topup: 'Top-up',
  purchase: 'Purchase',
  refund: 'Refund',
  points_earn: 'Points earned',
  points_redeem: 'Points redeemed',
  cashback: 'Cashback',
  adjustment: 'Adjustment',
};

export function MemberWalletTab({ memberId }: { memberId: string }) {
  const user = useAuthStore((s) => s.user);
  const { data: wallet, isLoading } = useWallet(memberId);
  const { data: txns } = useWalletTransactions(memberId);
  const topUp = useTopUpWallet();

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const submitTopUp = () => {
    const n = Number(amount);
    if (!n || n <= 0) return;
    topUp.mutate(
      { member_id: memberId, amount: n, notes: notes || undefined, created_by: user?.id },
      {
        onSuccess: () => {
          setTopUpOpen(false);
          setAmount('');
          setNotes('');
        },
      },
    );
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading wallet…</p>;
  }

  const transactions = txns?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Balance + points cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1 text-muted-foreground">
            <WalletIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Wallet Balance</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            ₹{Number(wallet?.balance ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1 text-muted-foreground">
            <Star className="h-4 w-4" />
            <span className="text-xs font-medium">Loyalty Points</span>
          </div>
          <p className="text-2xl font-semibold text-foreground">{wallet?.points_balance ?? 0}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setTopUpOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Top up
        </Button>
      </div>

      {/* Ledger */}
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <ArrowDownUp className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No wallet activity yet</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-canvas-soft">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">When</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Points</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t: WalletTransaction) => (
                <tr key={t.id} className="border-b border-border hover:bg-canvas-soft transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">{TYPE_LABELS[t.type] ?? t.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(t.created_at), 'dd MMM yyyy, HH:mm')}
                  </td>
                  <td className={`px-4 py-3 text-right ${Number(t.amount) < 0 ? 'text-destructive' : Number(t.amount) > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                    {Number(t.amount) !== 0 ? `${Number(t.amount) > 0 ? '+' : ''}₹${Number(t.amount).toFixed(2)}` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right ${t.points < 0 ? 'text-destructive' : t.points > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                    {t.points !== 0 ? `${t.points > 0 ? '+' : ''}${t.points}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    ₹{Number(t.balance_after).toFixed(2)} · {t.points_after}pt
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Top up wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground">Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. cash deposit at front desk"
                rows={2}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setTopUpOpen(false)} className="text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!amount || Number(amount) <= 0 || topUp.isPending}
              onClick={submitTopUp}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {topUp.isPending ? 'Saving…' : 'Top up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
