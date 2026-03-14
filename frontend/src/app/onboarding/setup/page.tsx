'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';

interface SetupForm {
  studio_name: string;
  branch_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  timezone: string;
  currency: string;
}

export default function SetupStudioPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const studio = useAuthStore((s) => s.studio);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [loading, setLoading] = useState(false);

  // Redirect if at wrong step
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/onboarding/setup');
      return;
    }
    if (!user) return;
    const step = user.onboarding_step;
    if (step === 'verify_email') router.push('/onboarding/verify');
    else if (step === 'select_plan') router.push('/onboarding/plans');
    else if (step === 'complete' || !step) router.push(`/${studio?.slug || ''}/dashboard`);
  }, [user, isAuthenticated, router, studio?.slug]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupForm>({
    defaultValues: {
      email: user?.email || '',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    },
  });

  const onSubmit = async (data: SetupForm) => {
    setLoading(true);
    try {
      const res = await apiClient.post<{
        user: {
          id: string;
          email: string;
          full_name: string;
          role: string;
          studio_id: string;
          branch_ids: string[];
          onboarding_step: string;
        };
        studio: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          currency: string;
          logo_url: string | null;
        };
      }>('/auth/setup-studio', {
        studio_name: data.studio_name,
        branch_name: data.branch_name || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        timezone: data.timezone,
        currency: data.currency,
      });

      // Update auth store with complete user + studio data
      setAuth({
        access_token: accessToken || '',
        refresh_token: refreshToken || '',
        user: {
          id: res.user.id,
          email: res.user.email,
          full_name: res.user.full_name,
          role: res.user.role,
          studio_id: res.user.studio_id,
          branch_ids: res.user.branch_ids,
        },
        studio: res.studio,
      });

      toast.success('Studio created! Welcome to FitSync Pro.');
      router.push(`/${res.studio.slug}/dashboard`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create studio'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout currentStep={3}>
      <div className="mb-7">
        <span className="text-primary text-4xl font-black leading-none">
          *
        </span>
        <h1 className="mt-2 text-[22px] font-bold text-foreground tracking-tight">
          Set up your studio
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Step 4 of 4 — Final step! Tell us about your gym.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Building2 className="h-4 w-4" />
          <span className="text-[13px] font-semibold">Studio Details</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">
            Studio Name *
          </label>
          <Input
            placeholder="e.g. PowerFit Gym"
            className="h-10 bg-background border-border text-foreground text-[13px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
            {...register('studio_name', {
              required: 'Studio name is required',
            })}
          />
          {errors.studio_name && (
            <p className="text-xs text-destructive">
              {errors.studio_name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">
            First Branch Name
          </label>
          <Input
            placeholder="e.g. Main Branch (defaults to 'Main Branch')"
            className="h-10 bg-background border-border text-foreground text-[13px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
            {...register('branch_name')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">
              Contact Email
            </label>
            <Input
              type="email"
              placeholder="gym@example.com"
              className="h-10 bg-background border-border text-foreground text-[13px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
              {...register('email')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">
              Phone
            </label>
            <Input
              placeholder="Contact phone"
              className="h-10 bg-background border-border text-foreground text-[13px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
              {...register('phone')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">
            Address
          </label>
          <Input
            placeholder="Street address"
            className="h-10 bg-background border-border text-foreground text-[13px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
            {...register('address')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">
              City
            </label>
            <Input
              placeholder="City"
              className="h-10 bg-background border-border text-foreground text-[13px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
              {...register('city')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">
              Timezone
            </label>
            <Input
              placeholder="Asia/Kolkata"
              className="h-10 bg-background border-border text-foreground text-[13px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
              {...register('timezone')}
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-foreground hover:bg-foreground/90 text-background font-semibold text-[13px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Launch Studio'
            )}
          </Button>
        </div>
      </form>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        You can update all details later from Settings.
      </p>
    </OnboardingLayout>
  );
}
