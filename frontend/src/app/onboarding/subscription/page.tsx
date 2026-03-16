'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Zap, Building2, Users, UserCog, HardDrive } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';

interface Plan {
  id: string;
  name: string;
  description: string;
  monthly_price: string;
  annual_price: string;
  max_branches: number;
  max_members: number;
  max_staff: number;
  storage_limit_gb: number;
  api_access: boolean;
  features: Record<string, boolean>;
  sort_order: number;
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
    else if (step === 'complete' || !step) {
      const slug = studio?.slug;
      router.push(slug ? `/${slug}/dashboard` : '/login');
    }
  }, [user, isAuthenticated, hasHydrated, router, studio?.slug]);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ['onboarding-plans'],
    queryFn: () => apiClient.get('/auth/plans'),
  });

  const handleSelectPlan = async (planName: string) => {
    setSelecting(planName);
    try {
      const res = await apiClient.post<{ plan: string; onboarding_step: string }>(
        '/auth/onboarding/subscription',
        { plan_id: planName }
      );
      updateUser({ onboarding_step: res.onboarding_step });
      toast.success('Plan selected! Your studio is ready.');
      router.push('/onboarding/complete');
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans?.map((plan) => {
          const price = parseFloat(plan.monthly_price as string);
          const enabledFeatures = Object.entries(plan.features || {}).filter(([, v]) => v);
          const isRecommended = plan.name === 'pro';
          const isSelecting = selecting === plan.name;

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

              <div className="flex items-center gap-2 mb-2">
                <Zap className={`h-4 w-4 ${isRecommended ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="text-sm font-bold text-foreground capitalize">{plan.name}</h3>
              </div>

              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">{fmtPrice(plan.monthly_price)}</span>
                {price > 0 && <span className="text-xs text-muted-foreground">/mo</span>}
              </div>

              <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">{plan.description}</p>

              <div className="space-y-1.5 mb-4 text-[11px]">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span>{plan.max_branches >= 999 ? 'Unlimited' : plan.max_branches} {plan.max_branches === 1 ? 'branch' : 'branches'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3 w-3 shrink-0" />
                  <span>{plan.max_members >= 99999 ? 'Unlimited' : plan.max_members.toLocaleString()} members</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserCog className="h-3 w-3 shrink-0" />
                  <span>{plan.max_staff >= 999 ? 'Unlimited' : plan.max_staff} staff</span>
                </div>
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
                onClick={() => handleSelectPlan(plan.name)}
                disabled={selecting !== null}
                className={`w-full py-2 rounded-lg text-[13px] font-semibold transition-all ${
                  isRecommended
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-foreground text-background hover:bg-foreground/90'
                } disabled:opacity-50`}
              >
                {isSelecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : price === 0 ? (
                  'Start Free'
                ) : (
                  'Start 14-Day Trial'
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
