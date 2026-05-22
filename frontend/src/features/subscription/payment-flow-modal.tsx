'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { subscriptionApi, PAYMENT_METHODS, type PaymentMethod } from './api';
import { useSubscription } from './subscription-provider';

type Step = 'method' | 'processing' | 'success';

/**
 * Plan-aware payment modal.
 *
 * Used from the subscription page where the user has ALREADY picked a plan
 * (same as current or different). The modal collects payment method and
 * reference, calls POST /subscription/renew with { plan, billing_cycle,
 * payment_method, payment_reference }, and on success shows the new period
 * + invoice number.
 *
 * Amount is computed server-side from the (plan, billing_cycle) pair so the
 * UI cannot tamper with pricing. We fetch the preview to display the right
 * amount and continuity-strict math.
 */
export function PaymentFlowModal({
  open,
  onOpenChange,
  plan,
  billingCycle,
  planDisplayName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: string;
  billingCycle: 'monthly' | 'annual';
  planDisplayName: string;
}) {
  const queryClient = useQueryClient();
  const { refresh } = useSubscription();

  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [reference, setReference] = useState('');
  const [refError, setRefError] = useState('');
  const [success, setSuccess] = useState<{
    invoice_number: string;
    period_start: string;
    period_end: string;
    amount: number;
    plan_changed: boolean;
  } | null>(null);

  // Reset state whenever the modal closes.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('method');
        setMethod(null);
        setReference('');
        setRefError('');
        setSuccess(null);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Authoritative pricing + continuity math for THIS plan/cycle combination.
  const { data: preview } = useQuery({
    queryKey: ['subscription', 'renewal-preview', plan, billingCycle],
    queryFn: () => subscriptionApi.getRenewalPreview({ plan, billing_cycle: billingCycle }),
    enabled: open,
    staleTime: 30_000,
  });

  const renewMutation = useMutation({
    mutationFn: (payload: {
      method: PaymentMethod;
      reference: string;
    }) =>
      subscriptionApi.renew({
        plan,
        billing_cycle: billingCycle,
        currency: preview?.currency ?? 'INR',
        payment_method: payload.method,
        payment_reference: payload.reference,
      }),
    onSuccess: async (data) => {
      setSuccess({
        invoice_number: data.invoice_number,
        period_start: data.period_start,
        period_end: data.period_end,
        amount: data.amount,
        plan_changed: data.plan_changed,
      });
      setStep('success');
      // Invalidate every query family touching billing / subscription / plan
      // so the page (and any sibling tab) refreshes without a reload.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription'] }),
        queryClient.invalidateQueries({ queryKey: ['account-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
        queryClient.invalidateQueries({ queryKey: ['settings', 'invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }),
        refresh(),
      ]);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Renewal failed. Please try again.');
      setStep('method');
    },
  });

  const isProcessing = step === 'processing';
  const isDismissible = !isProcessing;

  const headerText = useMemo(() => {
    if (step === 'success') return 'Payment confirmed';
    if (step === 'processing') return 'Processing payment…';
    const verb = preview?.plan_changed
      ? `Switch to ${planDisplayName}`
      : `Renew ${planDisplayName}`;
    const cycle = billingCycle === 'annual' ? 'Annual' : 'Monthly';
    return `${verb} · ${cycle}`;
  }, [step, preview?.plan_changed, planDisplayName, billingCycle]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && isDismissible) onOpenChange(false);
      }}
    >
      <DialogContent
        className="sm:max-w-[520px]"
        onPointerDownOutside={(e) => {
          if (!isDismissible) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!isDismissible) e.preventDefault();
        }}
      >
        {step !== 'success' && (
          <DialogHeader>
            <DialogTitle>{headerText}</DialogTitle>
          </DialogHeader>
        )}

        {/* ── METHOD ─────────────────────────────────────── */}
        {step === 'method' && (
          <>
            {/* Amount + continuity summary */}
            {preview && (
              <div className="mt-2 rounded-lg border bg-canvas-soft p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold">
                    {planDisplayName}
                    {preview.plan_changed && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-link-soft px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-link-deep">
                        Plan change
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Billing cycle</span>
                  <span>{billingCycle === 'annual' ? 'Annual' : 'Monthly'}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-2 text-base">
                  <span>Amount due</span>
                  <span className="font-semibold">
                    ₹{preview.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  New period:{' '}
                  <strong>
                    {format(new Date(preview.period_start), 'd MMM')} —{' '}
                    {format(new Date(preview.period_end), 'd MMM yyyy')}
                  </strong>
                </div>
                {preview.days_lost_to_continuity > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded border border-warning/30 bg-warning-soft p-2 text-xs text-warning-deep">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <div>
                      Late renewal means {preview.days_lost_to_continuity} day
                      {preview.days_lost_to_continuity === 1 ? '' : 's'} of
                      paid time will not roll forward (continuity-strict).
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Choose payment method
              </Label>
              <div className="mt-2 space-y-2">
                {PAYMENT_METHODS.map((pm) => {
                  const disabled = pm.comingSoon;
                  const active = method === pm.value;
                  return (
                    <button
                      key={pm.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setMethod(pm.value)}
                      className={[
                        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition',
                        active
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:bg-canvas-soft',
                        disabled ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      <div
                        className={`mt-0.5 h-4 w-4 rounded-full border ${
                          active
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/30'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {pm.label}
                          {pm.comingSoon && (
                            <span className="text-[10px] uppercase tracking-wide rounded bg-warning-soft px-1.5 py-0.5 text-warning-deep">
                              Coming soon
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {pm.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {method && !PAYMENT_METHODS.find((m) => m.value === method)?.comingSoon && (
                <div className="mt-4">
                  <Label
                    htmlFor="payment-reference"
                    className="text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    Transaction reference
                  </Label>
                  <Input
                    id="payment-reference"
                    value={reference}
                    onChange={(e) => {
                      setReference(e.target.value);
                      if (refError) setRefError('');
                    }}
                    placeholder={
                      method === 'upi'
                        ? 'UPI ref / UTR (e.g. 412345678901)'
                        : method === 'card'
                          ? 'Auth code / last 4 digits'
                          : method === 'cash'
                            ? 'Receipt # / cheque #'
                            : 'UTR / transaction ID'
                    }
                    className="mt-1"
                  />
                  {refError && (
                    <p className="mt-1 text-xs text-error">{refError}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Recorded on your invoice for reconciliation.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 sm:justify-between sm:gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={
                  !method ||
                  !!PAYMENT_METHODS.find((m) => m.value === method)?.comingSoon ||
                  reference.trim().length < 3 ||
                  !preview
                }
                onClick={() => {
                  if (!method) return;
                  if (reference.trim().length < 3) {
                    setRefError('Enter at least 3 characters of a real reference.');
                    return;
                  }
                  setStep('processing');
                  renewMutation.mutate({
                    method,
                    reference: reference.trim(),
                  });
                }}
              >
                Confirm payment
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── PROCESSING ─────────────────────────────────── */}
        {step === 'processing' && (
          <div className="flex flex-col items-center py-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="mt-4 text-base font-semibold">
              Confirming your payment…
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Recording the invoice and updating your plan.
            </div>
          </div>
        )}

        {/* ── SUCCESS ────────────────────────────────────── */}
        {step === 'success' && success && (
          <>
            <div className="flex flex-col items-center pt-2 pb-4 text-center">
              <div className="rounded-full bg-success/12 p-3">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div className="mt-3 text-lg font-semibold">Payment confirmed</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {success.plan_changed
                  ? `Your plan changed to ${planDisplayName}. Your account is active.`
                  : 'Your subscription has been renewed. Your account is active.'}
              </div>
            </div>

            <div className="rounded-lg border bg-canvas-soft p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-mono font-semibold">
                  {success.invoice_number}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span>
                  {planDisplayName} · {billingCycle === 'annual' ? 'Annual' : 'Monthly'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span>₹{success.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">New period</span>
                <span>
                  {format(new Date(success.period_start), 'd MMM yyyy')} —{' '}
                  {format(new Date(success.period_end), 'd MMM yyyy')}
                </span>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
