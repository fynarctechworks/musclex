'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Zap, Building2, Users, UserCog, HardDrive, Gift, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';
import { gymReferralsApi } from '@/features/gym-referrals';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  max_branches: number;
  max_members: number;
  max_staff: number;
  storage_limit_gb: number;
  api_access: boolean;
  features: Record<string, boolean>;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  discount_percent: number | null;
  discount_label: string | null;
  discount_expires_at: string | null;
  effective_monthly_price: number;
  effective_annual_price: number;
  is_discount_active: boolean;
  plan_type: string;
}

const FEATURE_LABELS: Record<string, string> = {
  member_management: 'Member Management',
  check_in: 'Check-in System',
  manual_payments: 'Payment Recording',
  basic_reports: 'Basic Reports',
  multi_branch: 'Multi-Branch',
  staff_management: 'Staff Management',
  trainer_management: 'Trainer Management',
  class_scheduling: 'Class Scheduling',
  payment_gateway: 'Online Payments',
  marketing_campaigns: 'Marketing',
  ai_advisor: 'AI Advisor',
  api_access: 'API Access',
  whatsapp_notifications: 'WhatsApp',
  email_campaigns: 'Email Campaigns',
  custom_roles: 'Custom Roles',
  audit_logs: 'Audit Logs',
  service_catalog: 'Service Catalog',
  booking_management: 'Booking Management',
  availability_slots: 'Availability Slots',
  chat: 'Client Chat',
  reviews: 'Reviews & Ratings',
  provider_dashboard: 'Provider Dashboard',
  analytics: 'Analytics',
  notifications: 'Notifications',
};

function fmtPrice(price: string | number) {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (n === 0) return 'Free';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function OnboardingSubscriptionPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const studio = useAuthStore((s) => s.studio);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [referralCode, setReferralCode] = useState('');
  const [referralValidation, setReferralValidation] = useState<{
    valid: boolean; referrer_name?: string; message?: string;
  } | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);

  const normalizedCode = referralCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  const validateCode = useCallback(async (code: string) => {
    if (code.length !== 6) { setReferralValidation(null); return; }
    setValidatingCode(true);
    try {
      const result = await gymReferralsApi.validateCode(code);
      setReferralValidation(result);
    } catch {
      setReferralValidation({ valid: false, message: 'Could not validate code' });
    } finally {
      setValidatingCode(false);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!user) return;
    const step = user.onboarding_step;
    if (step === 'studio_info') router.push('/onboarding/studio-info');
    else if (step === 'setup_branches') router.push('/onboarding/branches');
    else if (step === 'setup_plans') router.push('/onboarding/memberships');
    else if (step === 'setup_staff') router.push('/onboarding/staff');
    else if (step === 'payment') router.push('/onboarding/payment');
    else if (step === 'complete' || !step) {
      const slug = studio?.slug;
      router.push(slug ? `/${slug}/dashboard` : '/login');
    }
  }, [user, isAuthenticated, hasHydrated, router, studio?.slug]);

  const { data: plans, isLoading, error: plansError } = useQuery<Plan[]>({
    queryKey: ['onboarding-plans', 'regular'],
    queryFn: () => apiClient.get(`/onboarding/plans?type=regular`),
    staleTime: 0,        // Always refetch plans on this page (they may have been seeded)
    refetchOnMount: true, // Override global default — plans must load fresh during onboarding
    retry: 2,
  });

  const handleSelectPlan = async (selectedPlan: Plan) => {
    setSelecting(selectedPlan.name);
    try {
      const res = await apiClient.post<{ plan: string; billing_cycle: string; onboarding_step: string }>(
        '/auth/onboarding/subscription',
        { plan_id: selectedPlan.name, billing_cycle: billingCycle }
      );
      updateUser({ onboarding_step: res.onboarding_step });

      // Apply referral code if provided and valid (non-blocking)
      if (normalizedCode.length === 6 && referralValidation?.valid) {
        gymReferralsApi.applyCode({ referral_code: normalizedCode }).catch(() => {});
      }

      if (res.onboarding_step === 'payment') {
        const price = billingCycle === 'annual'
          ? (selectedPlan.effective_annual_price ?? selectedPlan.annual_price)
          : (selectedPlan.effective_monthly_price ?? selectedPlan.monthly_price);
        sessionStorage.setItem('pending_payment_plan', JSON.stringify({
          plan_id: selectedPlan.name,
          plan_display_name: selectedPlan.display_name,
          billing_cycle: billingCycle,
          amount: price,
          currency: 'INR',
        }));
        router.push('/onboarding/payment');
      } else {
        toast.success('Plan selected! Your studio is ready.');
        router.push('/onboarding/complete');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to select plan');
    } finally {
      setSelecting(null);
    }
  };

  if (isLoading) {
    return (
      <OnboardingLayout currentStep={6} maxWidth="1180px" hideSidebar>
        <div className="text-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-[13px] text-muted-foreground mt-3">Loading plans...</p>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout currentStep={6} maxWidth="1180px" hideSidebar>
      <div className="mb-7">
        <span className="text-primary text-4xl font-black leading-none">*</span>
        <h1 className="mt-2 text-[22px] font-bold text-foreground tracking-tight">
          Choose your subscription
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Step 7 of 7 — Final step! Pick a plan. You can change anytime.
        </p>
      </div>

      {/* Error state */}
      {plansError && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-sm text-destructive font-medium">Failed to load plans</p>
          <p className="text-xs text-muted-foreground mt-1">
            {plansError instanceof Error ? plansError.message : 'Please refresh the page'}
          </p>
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/60 p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
              billingCycle === 'annual'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Yearly
            <span className="bg-success/20 text-success text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Referral Code Input */}
      {<div className="mb-6 rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="h-4 w-4 text-primary" />
          <p className="text-[13px] font-medium text-foreground">
            Have a referral code? <span className="text-muted-foreground font-normal">(Optional)</span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-[200px]">
            <input
              value={referralCode}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                setReferralCode(val);
                validateCode(val);
              }}
              placeholder="e.g. ABC123"
              maxLength={6}
              className={`w-full h-9 rounded-lg border bg-muted/60 px-3 font-mono text-sm tracking-[0.3em] text-foreground placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                referralValidation?.valid ? 'border-success' : referralValidation?.valid === false ? 'border-destructive' : 'border-border'
              }`}
            />
          </div>
          <div className="flex items-center gap-1.5 h-9">
            {validatingCode && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!validatingCode && referralValidation?.valid && (
              <span className="flex items-center gap-1 text-[12px] text-success font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {referralValidation.referrer_name}
              </span>
            )}
            {!validatingCode && referralValidation?.valid === false && (
              <span className="flex items-center gap-1 text-[12px] text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Invalid code
              </span>
            )}
          </div>
        </div>
        {referralValidation?.valid && (
          <p className="text-[11px] text-success mt-2">
            ✓ Referral code will be applied when you select a plan below
          </p>
        )}
      </div>}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {plans?.map((plan) => {
          const isAnnual = billingCycle === 'annual';
          const displayPrice = isAnnual
            ? (plan.effective_annual_price ?? plan.annual_price)
            : (plan.effective_monthly_price ?? plan.monthly_price);
          const originalPrice = isAnnual ? plan.annual_price : plan.monthly_price;
          const enabledFeatures = Object.entries(plan.features || {}).filter(([, v]) => v);
          const isRecommended = plan.is_featured;
          const isSelecting = selecting === plan.name;
          const hasDiscount = plan.is_discount_active && plan.discount_percent;

          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-5 flex flex-col transition-all ${
                isRecommended
                  ? 'border-primary shadow-lg shadow-primary/10'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Recommended
                  </span>
                </div>
              )}

              {hasDiscount && plan.discount_label && (
                <div className="absolute -top-2.5 right-4">
                  <span className="bg-green-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    {plan.discount_label}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <Zap className={`h-4 w-4 ${isRecommended ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="text-sm font-bold text-foreground">{plan.display_name}</h3>
              </div>

              <div className="mb-1">
                {hasDiscount ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground line-through">{fmtPrice(originalPrice)}</span>
                    <span className="text-2xl font-bold text-foreground">{fmtPrice(displayPrice)}</span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-foreground">{fmtPrice(displayPrice)}</span>
                )}
                {displayPrice > 0 && (
                  <span className="text-xs text-muted-foreground">{isAnnual ? '/yr' : '/mo'}</span>
                )}
              </div>
              <div className="mb-3">
                {isAnnual ? (
                  <span className="text-[11px] text-success font-medium">
                    ≈ {fmtPrice(Math.round(displayPrice / 12))}/mo — billed annually
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {plan.annual_price > 0 ? `${fmtPrice(plan.effective_annual_price ?? plan.annual_price)}/yr if billed annually` : ''}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">{plan.description}</p>

              <div className="space-y-1.5 mb-4 text-[11px]">
                {plan.max_branches > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span>{plan.max_branches >= 999 ? 'Unlimited' : plan.max_branches} {plan.max_branches === 1 ? 'branch' : 'branches'}</span>
                  </div>
                )}
                {plan.max_members > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-3 w-3 shrink-0" />
                    <span>{plan.max_members >= 99999 ? 'Unlimited' : plan.max_members.toLocaleString()} members</span>
                  </div>
                )}
                {plan.max_staff > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserCog className="h-3 w-3 shrink-0" />
                    <span>{plan.max_staff >= 999 ? 'Unlimited' : plan.max_staff} staff</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="h-3 w-3 shrink-0" />
                  <span>{plan.storage_limit_gb} GB storage</span>
                </div>
              </div>

              <div className="flex-1 space-y-1 mb-5">
                {enabledFeatures.slice(0, 8).map(([key]) => (
                  <div key={key} className="flex items-center gap-1.5 text-[11px]">
                    <Check className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-foreground">{FEATURE_LABELS[key] || key}</span>
                  </div>
                ))}
                {enabledFeatures.length > 8 && (
                  <p className="text-[10px] text-muted-foreground pl-4">+{enabledFeatures.length - 8} more</p>
                )}
              </div>

              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={selecting !== null}
                className={`w-full py-2 rounded-lg text-[13px] font-semibold transition-all ${
                  isRecommended
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-foreground text-background hover:bg-foreground/90'
                } disabled:opacity-50`}
              >
                {isSelecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : displayPrice === 0 ? (
                  'Start Free'
                ) : (
                  'Continue to Payment'
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-muted-foreground mt-6">
        All paid plans include a 14-day free trial. No payment required to get started.
      </p>
    </OnboardingLayout>
  );
}
