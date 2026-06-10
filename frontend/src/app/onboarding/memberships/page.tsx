'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { CreditCard, Plus, Trash2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';

const PLAN_TEMPLATES = [
  { name: 'Basic Monthly', plan_type: 'monthly', duration_days: 30, price: 1500, description: 'Basic gym access' },
  { name: 'Premium Quarterly', plan_type: 'quarterly', duration_days: 90, price: 4000, description: 'Full gym + classes' },
  { name: 'Annual Plan', plan_type: 'yearly', duration_days: 365, price: 12000, description: 'Best value — full access' },
  { name: 'Personal Training', plan_type: 'monthly', duration_days: 30, price: 5000, description: '1-on-1 trainer sessions' },
];

const PLAN_TYPES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'day_pass', label: 'Day Pass' },
  { value: 'class_pack', label: 'Class Pack' },
  { value: 'custom', label: 'Custom' },
];

interface PlanItem {
  name: string;
  plan_type: string;
  duration_days: number;
  price: number;
  description: string;
}

interface MembershipsForm {
  plans: PlanItem[];
}

export default function OnboardingMembershipsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const membershipsDraft = useOnboardingStore((s) => s.memberships);
  const setMembershipsDraft = useOnboardingStore((s) => s.setMemberships);
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(membershipsDraft.showCustom);

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
    else if (step === 'setup_staff') router.push('/onboarding/staff');
    else if (step === 'select_subscription') router.push('/onboarding/subscription');
    else if (step === 'complete' || !step) {
      const slug = useAuthStore.getState().studio?.slug;
      router.push(slug ? `/${slug}/dashboard` : '/login');
    }
  }, [user, isAuthenticated, hasHydrated, router]);

  const { register, control, handleSubmit, watch } = useForm<MembershipsForm>({
    defaultValues: { plans: membershipsDraft.plans },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'plans' });
  const watchedPlans = watch('plans');

  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(
    new Set(membershipsDraft.selectedTemplates),
  );

  useEffect(() => {
    setMembershipsDraft({
      plans: watchedPlans || [],
      selectedTemplates: Array.from(selectedTemplates),
      showCustom,
    });
  }, [selectedTemplates, setMembershipsDraft, showCustom, watchedPlans]);

  const toggleTemplate = (idx: number) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const onSubmit = async (data: MembershipsForm) => {
    // Combine selected templates + custom plans
    const templatePlans = Array.from(selectedTemplates).map((i) => PLAN_TEMPLATES[i]);
    const customPlans = data.plans.filter((p) => p.name.trim());
    const allPlans = [...templatePlans, ...customPlans];

    if (allPlans.length === 0) {
      toast.error('Select at least one template or add a custom plan');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<{ plan_ids: string[]; onboarding_step: string }>(
        '/auth/onboarding/memberships',
        { plans: allPlans }
      );
      setMembershipsDraft({ plans: data.plans, selectedTemplates: Array.from(selectedTemplates), showCustom });
      updateUser({ onboarding_step: res.onboarding_step });
      toast.success('Plans created!');
      router.push('/onboarding/staff');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<{ onboarding_step: string }>('/auth/onboarding/skip', {
        current_step: 'setup_plans',
      });
      updateUser({ onboarding_step: res.onboarding_step });
      router.push('/onboarding/staff');
    } catch {
      router.push('/onboarding/staff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout currentStep={4} maxWidth="480px">
      <div className="mb-7">
        <span className="text-primary text-4xl font-semibold leading-none">*</span>
        <h1 className="mt-2 text-[22px] font-semibold text-foreground tracking-tight">
          Create membership plans
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Step 5 of 7 — Pick from templates or create custom plans.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Quick templates */}
        <div>
          <div className="flex items-center gap-2 text-primary mb-3">
            <Sparkles className="h-4 w-4" />
            <span className="text-[13px] font-semibold">Quick Templates</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PLAN_TEMPLATES.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleTemplate(i)}
                className={`text-left rounded-lg border p-3 transition-all ${
                  selectedTemplates.has(i)
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{t.description}</div>
                <div className="text-[13px] font-semibold text-primary mt-1">
                  ₹{t.price.toLocaleString()}<span className="text-[10px] text-muted-foreground font-normal">/{t.plan_type}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom plans */}
        {showCustom && fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <CreditCard className="h-4 w-4" />
                <span className="text-[13px] font-semibold">Custom Plan {index + 1}</span>
              </div>
              <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">Plan Name *</label>
              <Input placeholder="e.g. Gold Plan" className="h-10 text-[13px]" {...register(`plans.${index}.name`, { required: 'Required' })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Type</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register(`plans.${index}.plan_type`)}
                >
                  {PLAN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Duration (days)</label>
                <Input type="number" placeholder="30" className="h-10 text-[13px]" {...register(`plans.${index}.duration_days`, { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Price *</label>
                <Input type="number" placeholder="1500" className="h-10 text-[13px]" {...register(`plans.${index}.price`, { required: 'Required', valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Description</label>
                <Input placeholder="Short description" className="h-10 text-[13px]" {...register(`plans.${index}.description`)} />
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full h-9 text-[13px]"
          onClick={() => {
            setShowCustom(true);
            append({ name: '', plan_type: 'monthly', duration_days: 30, price: 0, description: '' });
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Custom Plan
        </Button>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={handleSkip}
            className="flex-1 h-10 text-[13px] text-muted-foreground"
          >
            Skip for now
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[13px]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  );
}
