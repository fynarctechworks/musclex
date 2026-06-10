'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { subscriptionApi } from './api';

/**
 * Cancel Plan confirmation flow.
 *
 * Honest disclosure UX:
 *   - We do NOT immediately revoke access. The customer keeps service
 *     through the end of the paid period (industry-standard SaaS behavior).
 *   - We capture an optional reason for the cancellation log.
 *   - We acknowledge over email + in the UI.
 *
 * Behind the scenes: POST /subscription/cancel writes a `cancel_requested`
 * ledger event. The exact "what happens at period end" behavior is wired in
 * a follow-up — for now the cron will lock them naturally at expiry+grace.
 */
export function CancelPlanDialog({
  open,
  onOpenChange,
  accessUntil,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessUntil?: string | null;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      subscriptionApi.cancel({ reason: reason.trim() || undefined }),
    onSuccess: async (data) => {
      toast.success(data.message, { duration: 6000 });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription'] }),
        queryClient.invalidateQueries({ queryKey: ['account-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
      ]);
      onOpenChange(false);
      setReason('');
      setConfirmed(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Could not record the cancellation. Try again.');
    },
  });

  const accessUntilLabel = accessUntil
    ? format(new Date(accessUntil), 'd MMMM yyyy')
    : 'the end of your current billing period';

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="mt-1 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <DialogTitle>Cancel your subscription?</DialogTitle>
              <DialogDescription className="mt-2">
                You'll keep full access until <strong>{accessUntilLabel}</strong>.
                After that, your account becomes read-only — your data,
                members, payments, and history remain intact and you can
                reactivate any time.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 rounded-lg border bg-warning-soft border-warning/30 p-3 text-xs text-warning-deep leading-relaxed">
          <strong className="block mb-1">What stays the same:</strong>
          You keep all features until {accessUntilLabel}. No refunds for the
          remaining days. After expiry, mutations are blocked but reads still
          work so you can export data or reactivate.
        </div>

        <div className="mt-4">
          <Label htmlFor="cancel-reason" className="text-xs uppercase tracking-wide text-muted-foreground">
            Why are you cancelling? <span className="opacity-60">(optional, helps us improve)</span>
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Too expensive / switched tools / not using it / other…"
            rows={3}
            className="mt-1 resize-none"
            disabled={mutation.isPending}
          />
        </div>

        <div className="mt-3 flex items-start gap-2 text-xs">
          <input
            id="confirm-cancel"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={mutation.isPending}
            className="mt-0.5"
          />
          <label htmlFor="confirm-cancel" className="text-muted-foreground leading-snug cursor-pointer">
            I understand my account becomes read-only after {accessUntilLabel}
            and that there are no refunds for unused days.
          </label>
        </div>

        <DialogFooter className="mt-5 sm:justify-between sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Keep my plan
          </Button>
          <Button
            variant="destructive"
            disabled={!confirmed || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Submitting…' : 'Confirm cancellation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
