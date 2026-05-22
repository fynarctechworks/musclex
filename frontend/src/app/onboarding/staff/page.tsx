'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { Users, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';

const STAFF_ROLES = [
  { value: 'trainer', label: 'Trainer' },
  { value: 'front_desk', label: 'Front Desk' },
  { value: 'branch_manager', label: 'Branch Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'marketing_manager', label: 'Marketing Manager' },
];

interface StaffForm {
  staff: {
    full_name: string;
    role: string;
    email: string;
    phone: string;
  }[];
}

export default function OnboardingStaffPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const savedStaff = useOnboardingStore((s) => s.staff);
  const setStaffDraft = useOnboardingStore((s) => s.setStaff);
  const [loading, setLoading] = useState(false);

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
    else if (step === 'select_subscription') router.push('/onboarding/subscription');
    else if (step === 'complete' || !step) {
      const slug = useAuthStore.getState().studio?.slug;
      router.push(slug ? `/${slug}/dashboard` : '/login');
    }
  }, [user, isAuthenticated, hasHydrated, router]);

  const { register, control, handleSubmit, watch } = useForm<StaffForm>({
    defaultValues: {
      staff: savedStaff,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'staff' });
  const watchedStaff = watch('staff');

  useEffect(() => {
    setStaffDraft(
      (watchedStaff || []).map((member) => ({
        full_name: member?.full_name || '',
        role: member?.role || 'trainer',
        email: member?.email || '',
        phone: member?.phone || '',
      })),
    );
  }, [setStaffDraft, watchedStaff]);

  const onSubmit = async (data: StaffForm) => {
    const validStaff = data.staff.filter((s) => s.full_name.trim());
    if (validStaff.length === 0) {
      toast.error('Add at least one staff member or skip');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<{ staff_ids: string[]; onboarding_step: string }>(
        '/auth/onboarding/staff',
        { staff: validStaff }
      );
      updateUser({ onboarding_step: res.onboarding_step });
      toast.success('Staff added!');
      router.push('/onboarding/subscription');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save staff');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<{ onboarding_step: string }>('/auth/onboarding/skip', {
        current_step: 'setup_staff',
      });
      updateUser({ onboarding_step: res.onboarding_step });
      router.push('/onboarding/subscription');
    } catch {
      router.push('/onboarding/subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout currentStep={5}>
      <div className="mb-7">
        <span className="text-primary text-4xl font-semibold leading-none">*</span>
        <h1 className="mt-2 text-[22px] font-semibold text-foreground tracking-tight">
          Add your team
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Step 6 of 7 — Optional. Add trainers and staff members.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" />
                <span className="text-[13px] font-semibold">Staff {index + 1}</span>
              </div>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Full Name *</label>
                <Input placeholder="Staff name" className="h-10 text-[13px]" {...register(`staff.${index}.full_name`)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Role</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register(`staff.${index}.role`)}
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Email</label>
                <Input type="email" placeholder="email@example.com" className="h-10 text-[13px]" {...register(`staff.${index}.email`)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Phone</label>
                <Input placeholder="Phone number" className="h-10 text-[13px]" {...register(`staff.${index}.phone`)} />
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full h-9 text-[13px]"
          onClick={() => append({ full_name: '', role: 'trainer', email: '', phone: '' })}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Another
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
