'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { MapPin, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { createEmptyBranchDraft, useOnboardingStore } from '@/stores/onboarding-store';
import { apiClient } from '@/lib/api';
import {
  formatPhoneForStorage,
  getCityOptions,
  getCountryName,
  getCountryOptions,
  getPhoneMetadata,
  getStateName,
  getStateOptions,
  lookupIndianPostalCode,
  sanitizePhoneDigits,
} from '@/lib/location';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';

interface BranchForm {
  branches: {
    name: string;
    address: string;
    country: string;
    city: string;
    state: string;
    postal_code: string;
    phone: string;
  }[];
}

export default function OnboardingBranchesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [loading, setLoading] = useState(false);
  const savedBranches = useOnboardingStore((s) => s.branches);
  const setBranchesDraft = useOnboardingStore((s) => s.setBranches);
  const studioDraft = useOnboardingStore((s) => s.studioInfo);
  const [postalHints, setPostalHints] = useState<Record<number, string>>({});
  const [postalLoading, setPostalLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!user) return;
    const step = user.onboarding_step;
    if (step === 'studio_info') router.push('/onboarding/studio-info');
    else if (step === 'setup_plans') router.push('/onboarding/memberships');
    else if (step === 'setup_staff') router.push('/onboarding/staff');
    else if (step === 'select_subscription') router.push('/onboarding/subscription');
    else if (step === 'complete' || !step) {
      const slug = useAuthStore.getState().studio?.slug;
      router.push(slug ? `/${slug}/dashboard` : '/login');
    }
  }, [user, isAuthenticated, hasHydrated, router]);

  const { register, control, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<BranchForm>({
    defaultValues: {
      branches: savedBranches.length
        ? savedBranches
        : [createEmptyBranchDraft({ country: studioDraft.country })],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'branches' });
  const watchedBranches = watch('branches');
  const countryOptions = useMemo(() => getCountryOptions(), []);

  useEffect(() => {
    setBranchesDraft(
      (watchedBranches || []).map((branch) => ({
        name: branch?.name || '',
        address: branch?.address || '',
        country: branch?.country || '',
        city: branch?.city || '',
        state: branch?.state || '',
        postal_code: branch?.postal_code || '',
        phone: branch?.phone || '',
      })),
    );
  }, [setBranchesDraft, watchedBranches]);

  const handlePostalLookup = async (index: number) => {
    const country = getValues(`branches.${index}.country`);
    const postalCode = getValues(`branches.${index}.postal_code`);

    if (country !== 'IN' || !/^\d{6}$/.test(postalCode)) return;

    setPostalLoading((state) => ({ ...state, [index]: true }));
    try {
      const result = await lookupIndianPostalCode(postalCode);
      if (!result) return;

      if (!getValues(`branches.${index}.city`)) {
        setValue(`branches.${index}.city`, result.city, { shouldDirty: true });
      }
      if (!getValues(`branches.${index}.state`)) {
        const states = getStateOptions('IN');
        const matchedState = states.find((state) => state.name.toLowerCase() === result.state.toLowerCase());
        if (matchedState) {
          setValue(`branches.${index}.state`, matchedState.code, { shouldDirty: true });
        }
      }

      setPostalHints((state) => ({
        ...state,
        [index]: `Detected area: ${result.area}`,
      }));
    } finally {
      setPostalLoading((state) => ({ ...state, [index]: false }));
    }
  };

  const onSubmit = async (data: BranchForm) => {
    const validBranches = data.branches.filter((b) => b.name.trim());
    if (validBranches.length === 0) {
      toast.error('Add at least one branch');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post<{ branch_ids: string[]; onboarding_step: string }>(
        '/auth/onboarding/branches',
        {
          branches: validBranches.map((branch) => ({
            ...branch,
            country: getCountryName(branch.country) || branch.country,
            state: getStateName(branch.country, branch.state) || branch.state,
            phone: branch.phone ? formatPhoneForStorage(branch.country, branch.phone) : '',
          })),
        }
      );
      updateUser({ onboarding_step: res.onboarding_step, branch_ids: res.branch_ids });
      toast.success('Branches added!');
      router.push('/onboarding/memberships');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save branches');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<{ onboarding_step: string }>('/auth/onboarding/skip', {
        current_step: 'setup_branches',
      });
      updateUser({ onboarding_step: res.onboarding_step });
      router.push('/onboarding/memberships');
    } catch {
      router.push('/onboarding/memberships');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout currentStep={3}>
      <div className="mb-7">
        <span className="text-primary text-4xl font-black leading-none">*</span>
        <h1 className="mt-2 text-[22px] font-bold text-foreground tracking-tight">
          Add your locations
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Step 4 of 7 — Add branches. A default branch was already created.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border border-border p-4 space-y-3 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" />
                <span className="text-[13px] font-semibold">Branch {index + 1}</span>
              </div>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">Branch Name *</label>
              <Input
                placeholder="e.g. Downtown Branch"
                className="h-10 text-[13px]"
                {...register(`branches.${index}.name`, { required: 'Name is required' })}
              />
              {errors.branches?.[index]?.name && (
                <p className="text-xs text-destructive">{errors.branches[index]?.name?.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">Address</label>
              <Input placeholder="Street address" className="h-10 text-[13px]" {...register(`branches.${index}.address`)} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Country</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register(`branches.${index}.country`)}
                >
                  <option value="">Select country</option>
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">State</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register(`branches.${index}.state`, {
                    onChange: () => {
                      setValue(`branches.${index}.city`, '', { shouldDirty: true });
                    },
                  })}
                >
                  <option value="">Select state</option>
                  {getStateOptions(watchedBranches?.[index]?.country || '').map((state) => (
                    <option key={state.code} value={state.code}>{state.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">City</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register(`branches.${index}.city`)}
                >
                  <option value="">Select city</option>
                  {getCityOptions(
                    watchedBranches?.[index]?.country || '',
                    watchedBranches?.[index]?.state || '',
                  ).map((city) => (
                    <option key={city.name} value={city.name}>{city.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Zip / Postal</label>
                <Input
                  placeholder="Postal code"
                  className="h-10 text-[13px]"
                  inputMode="numeric"
                  {...register(`branches.${index}.postal_code`, {
                    onBlur: () => {
                      void handlePostalLookup(index);
                    },
                  })}
                />
                <p className="text-[11px] text-muted-foreground">
                  {postalLoading[index]
                    ? 'Looking up postal code...'
                    : postalHints[index] || 'Selecting country/state helps narrow city options.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Phone</label>
                <div className="flex h-10 items-center overflow-hidden rounded-md border border-border bg-background">
                  <div className="flex h-full min-w-[72px] items-center justify-center border-r border-border px-3 text-[13px] text-muted-foreground">
                    {getPhoneMetadata(watchedBranches?.[index]?.country || '').dialCode || '--'}
                  </div>
                  <Input
                    placeholder="Phone"
                    className="h-full border-0 text-[13px] focus-visible:ring-0"
                    inputMode="numeric"
                    maxLength={getPhoneMetadata(watchedBranches?.[index]?.country || '').maxDigits}
                    {...register(`branches.${index}.phone`, {
                      onChange: (event) => {
                        const maxDigits = getPhoneMetadata(watchedBranches?.[index]?.country || '').maxDigits;
                        event.target.value = sanitizePhoneDigits(event.target.value, maxDigits);
                      },
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full h-9 text-[13px]"
          onClick={() => append(createEmptyBranchDraft({ country: studioDraft.country }))}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Another Branch
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
