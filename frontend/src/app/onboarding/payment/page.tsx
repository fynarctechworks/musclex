'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CreditCard, Lock, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';

interface PendingPlan {
  plan_id: string;
  plan_display_name: string;
  amount: number;
  currency: string;
}

function formatCardNumber(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

function detectBrand(num: string): string {
  const d = num.replace(/\D/g, '');
  if (d.startsWith('4')) return 'Visa';
  if (d.startsWith('5')) return 'Mastercard';
  if (d.startsWith('3')) return 'Amex';
  if (d.startsWith('6')) return 'RuPay';
  return 'Card';
}

function fmtPrice(amount: number, currency = 'INR') {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function OnboardingPaymentPage() {
  const router = useRouter();
  const updateUser = useAuthStore((s) => s.updateUser);
  const studio = useAuthStore((s) => s.studio);

  // mounted = we're in the browser (avoids SSR sessionStorage access)
  const [mounted, setMounted] = useState(false);
  const [plan, setPlan] = useState<PendingPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [billingName, setBillingName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [showCvv, setShowCvv] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    const raw = sessionStorage.getItem('pending_payment_plan');
    if (!raw) {
      // No plan data — go back to subscription step
      router.replace('/onboarding/subscription');
      return;
    }
    try {
      setPlan(JSON.parse(raw));
    } catch {
      router.replace('/onboarding/subscription');
    }
  }, []); // run once on mount — intentionally no deps

  const validate = () => {
    const e: Record<string, string> = {};
    if (!billingName.trim()) e.billingName = 'Cardholder name is required';
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length !== 16) e.cardNumber = 'Enter a valid 16-digit card number';
    const expiryMatch = expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!expiryMatch) {
      e.expiry = 'Enter expiry as MM/YY';
    } else {
      const [, mm, yy] = expiryMatch;
      const expDate = new Date(2000 + parseInt(yy), parseInt(mm) - 1, 1);
      if (expDate < new Date()) e.expiry = 'Card has expired';
    }
    if (cvv.length < 3) e.cvv = 'Enter a valid CVV';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !validate()) return;

    setSubmitting(true);
    try {
      const rawCard = cardNumber.replace(/\s/g, '');
      const res = await apiClient.post<{
        invoice_id: string;
        invoice_number: string;
        amount: number;
        status: string;
        onboarding_step: string;
      }>('/auth/onboarding/payment', {
        plan_id: plan.plan_id,
        card_last4: rawCard.slice(-4),
        card_brand: detectBrand(rawCard),
        billing_name: billingName,
        amount: plan.amount,
        currency: plan.currency,
      });

      updateUser({ onboarding_step: res.onboarding_step });
      sessionStorage.removeItem('pending_payment_plan');
      setSuccess(true);

      setTimeout(() => {
        router.push('/onboarding/complete');
      }, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Before mount (SSR) — render nothing to avoid hydration mismatch
  if (!mounted) return null;

  if (success) {
    return (
      <OnboardingLayout currentStep={6} maxWidth="480px" hideSidebar>
        <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Payment Successful!</h2>
          <p className="text-[13px] text-muted-foreground">
            Your <strong>{plan?.plan_display_name}</strong> plan is now active.
            <br />Setting up your studio…
          </p>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </OnboardingLayout>
    );
  }

  // Plan not yet loaded (redirect pending)
  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rawCard = cardNumber.replace(/\s/g, '');

  return (
    <OnboardingLayout currentStep={6} maxWidth="480px" hideSidebar>
      <div className="mb-6">
        <span className="text-primary text-4xl font-black leading-none">*</span>
        <h1 className="mt-2 text-[22px] font-bold text-foreground tracking-tight">
          Complete your payment
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Enter your card details to activate the <strong>{plan.plan_display_name}</strong> plan.
        </p>
      </div>

      {/* Test mode banner */}
      <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3.5 py-2.5">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">Test Mode</p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
            Use <span className="font-mono font-bold">4242 4242 4242 4242</span>, any future expiry, any CVV.
          </p>
        </div>
      </div>

      {/* Plan summary */}
      <div className="mb-5 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">{plan.plan_display_name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Monthly subscription</p>
        </div>
        <p className="text-lg font-bold text-foreground">
          {fmtPrice(plan.amount, plan.currency)}
          <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cardholder name */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Cardholder Name</label>
          <input
            type="text"
            placeholder="Name on card"
            value={billingName}
            onChange={(e) => setBillingName(e.target.value)}
            className={`w-full h-10 rounded-lg border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.billingName ? 'border-destructive' : 'border-border'}`}
          />
          {errors.billingName && (
            <p className="text-[11px] text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />{errors.billingName}
            </p>
          )}
        </div>

        {/* Card number */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Card Number</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              maxLength={19}
              className={`w-full h-10 rounded-lg border bg-background pl-3 pr-24 text-[13px] font-mono text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.cardNumber ? 'border-destructive' : 'border-border'}`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {rawCard.length > 0 && (
                <span className="text-[11px] text-muted-foreground font-medium">{detectBrand(rawCard)}</span>
              )}
            </div>
          </div>
          {errors.cardNumber && (
            <p className="text-[11px] text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />{errors.cardNumber}
            </p>
          )}
        </div>

        {/* Expiry + CVV */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">Expiry Date</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              maxLength={5}
              className={`w-full h-10 rounded-lg border bg-background px-3 text-[13px] font-mono text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.expiry ? 'border-destructive' : 'border-border'}`}
            />
            {errors.expiry && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{errors.expiry}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">CVV</label>
            <div className="relative">
              <input
                type={showCvv ? 'text' : 'password'}
                inputMode="numeric"
                placeholder="•••"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                className={`w-full h-10 rounded-lg border bg-background pl-3 pr-9 text-[13px] font-mono text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.cvv ? 'border-destructive' : 'border-border'}`}
              />
              <button
                type="button"
                onClick={() => setShowCvv((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
              </button>
            </div>
            {errors.cvv && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{errors.cvv}
              </p>
            )}
          </div>
        </div>

        {/* Pay button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-[14px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Pay {fmtPrice(plan.amount, plan.currency)} — Activate {plan.plan_display_name}
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3" />
          Secured by 256-bit SSL encryption
        </p>
      </form>
    </OnboardingLayout>
  );
}
