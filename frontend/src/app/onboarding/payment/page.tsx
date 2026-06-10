'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { Spinner } from '@/components/shared';
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
  const user = useAuthStore((s) => s.user);

  // mounted = we're in the browser (avoids SSR sessionStorage access)
  const [mounted, setMounted] = useState(false);
  const [plan, setPlan] = useState<PendingPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Billing information (mandatory — feeds the GST tax invoice on the studio)
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    // Pre-fill billing contact from the account/studio; user can override.
    setBillingName(studio?.name || '');
    setBillingEmail(studio?.email || user?.email || '');
    setBillingAddress(studio?.address || '');
    const raw = sessionStorage.getItem('pending_payment_plan');
    if (!raw) {
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
    if (!billingName.trim()) e.billingName = 'Billing name is required';
    if (!billingEmail.trim()) {
      e.billingEmail = 'Billing email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim())) {
      e.billingEmail = 'Enter a valid email address';
    }
    if (!billingAddress.trim()) e.billingAddress = 'Billing address is required';
    const gst = gstin.trim().toUpperCase();
    if (gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gst)) {
      e.gstin = 'Enter a valid 15-character GSTIN, or leave it blank';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !validate()) return;
    setSubmitting(true);
    try {
      // Load Razorpay checkout.js on demand.
      if (!(window as { Razorpay?: unknown }).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load Razorpay'));
          document.body.appendChild(s);
        });
      }

      // Create a real order for the studio's selected plan (amount is computed
      // server-side from the plan, never from the client).
      const order = await apiClient.post<{
        order_id: string;
        key_id: string;
        amount: number;
        currency: string;
        plan_display_name: string;
      }>('/subscription/create-order', {});

      await new Promise<void>((resolve, reject) => {
        const RazorpayCtor = (
          window as unknown as {
            Razorpay: new (o: Record<string, unknown>) => { open(): void };
          }
        ).Razorpay;
        const rzp = new RazorpayCtor({
          key: order.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: order.amount * 100, // paise
          currency: order.currency || 'INR',
          name: studio?.name || 'MuscleX',
          description: `${order.plan_display_name} subscription`,
          order_id: order.order_id,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const res = await apiClient.post<{ onboarding_step: string }>(
                '/auth/onboarding/payment',
                {
                  plan_id: plan.plan_id,
                  gateway_order_id: response.razorpay_order_id,
                  gateway_payment_id: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  billing_name: billingName.trim(),
                  billing_email: billingEmail.trim(),
                  billing_address: billingAddress.trim(),
                  gstin: gstin.trim() ? gstin.trim().toUpperCase() : undefined,
                  amount: plan.amount,
                  currency: plan.currency,
                },
              );
              updateUser({ onboarding_step: res.onboarding_step });
              sessionStorage.removeItem('pending_payment_plan');
              setSuccess(true);
              setTimeout(() => router.push('/onboarding/complete'), 1800);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          prefill: {
            name: billingName || studio?.name || '',
            email: billingEmail || '',
          },
          theme: { color: '#4A9FD4' },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        });
        rzp.open();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      if (msg !== 'Payment cancelled') toast.error(msg);
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
          <div className="h-16 w-16 rounded-full bg-success/12 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Payment Successful!</h2>
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
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  return (
    <OnboardingLayout currentStep={6} maxWidth="480px" hideSidebar>
      <div className="mb-6">
        <span className="text-primary text-4xl font-semibold leading-none">*</span>
        <h1 className="mt-2 text-[22px] font-semibold text-foreground tracking-tight">
          Complete your payment
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Pay securely via Razorpay to activate the <strong>{plan.plan_display_name}</strong> plan.
        </p>
      </div>

      {/* Test mode banner */}
      <div className="mb-5 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft dark:border-amber-800 dark:bg-amber-950/40 px-3.5 py-2.5">
        <AlertCircle className="h-4 w-4 text-warning dark:text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-semibold text-warning-deep dark:text-amber-300">Test Mode</p>
          <p className="text-[11px] text-warning dark:text-warning mt-0.5">
            Card <span className="font-mono font-semibold">4111 1111 1111 1111</span>, any future
            expiry &amp; CVV. On the OTP screen click <span className="font-semibold">Success</span>{' '}
            (no real code needed) — or pay by UPI{' '}
            <span className="font-mono font-semibold">success@razorpay</span>.
          </p>
        </div>
      </div>

      {/* Plan summary */}
      <div className="mb-5 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">{plan.plan_display_name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Subscription</p>
        </div>
        <p className="text-lg font-semibold text-foreground">
          {fmtPrice(plan.amount, plan.currency)}
        </p>
      </div>

      <form onSubmit={handlePay} className="space-y-4">
        {/* Billing information — mandatory; used for the GST tax invoice */}
        <div className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Billing Information
          </p>

          {/* Billing name */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">Billing Name</label>
            <input
              type="text"
              placeholder="Business or legal name"
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

          {/* Billing email */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">Billing Email</label>
            <input
              type="email"
              inputMode="email"
              placeholder="billing@yourstudio.com"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              className={`w-full h-10 rounded-lg border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.billingEmail ? 'border-destructive' : 'border-border'}`}
            />
            {errors.billingEmail && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{errors.billingEmail}
              </p>
            )}
          </div>

          {/* Billing address */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">Billing Address</label>
            <textarea
              rows={2}
              placeholder="Street, City, State, PIN"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              className={`w-full rounded-lg border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors resize-none ${errors.billingAddress ? 'border-destructive' : 'border-border'}`}
            />
            {errors.billingAddress && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{errors.billingAddress}
              </p>
            )}
          </div>

          {/* GSTIN (optional) */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">
              GSTIN <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="27ABCDE1234F1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 15))}
              maxLength={15}
              className={`w-full h-10 rounded-lg border bg-background px-3 text-[13px] font-mono text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.gstin ? 'border-destructive' : 'border-border'}`}
            />
            {errors.gstin && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{errors.gstin}
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
              Opening Razorpay…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Pay {fmtPrice(plan.amount, plan.currency)} — Activate {plan.plan_display_name}
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3 w-3" />
          Payments are processed securely by Razorpay.
        </p>
      </form>
    </OnboardingLayout>
  );
}
