'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Building2, Loader2, Globe, Clock, DollarSign, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api';
import { useAutoLocation } from '@/hooks';
import { useOnboardingStore } from '@/stores/onboarding-store';
import {
  formatPhoneForStorage,
  getCountryMetadata,
  getCountryName,
  getCountryOptions,
  getPhoneMetadata,
  sanitizePhoneDigits,
} from '@/lib/location';
import { toast } from 'sonner';
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout';
import { supabase } from '@/lib/supabase';

const GYM_BUSINESS_TYPES = [
  { value: 'gym', label: 'Gym' },
  { value: 'yoga', label: 'Yoga Studio' },
  { value: 'crossfit', label: 'CrossFit Box' },
  { value: 'fitness_studio', label: 'Fitness Studio' },
  { value: 'martial_arts', label: 'Martial Arts' },
  { value: 'pilates', label: 'Pilates Studio' },
  { value: 'other', label: 'Other' },
];

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'America/Chicago', label: 'US Central' },
  { value: 'America/Denver', label: 'US Mountain' },
  { value: 'America/Los_Angeles', label: 'US Pacific' },
  { value: 'Europe/London', label: 'UK (GMT)' },
  { value: 'Europe/Berlin', label: 'Europe Central' },
  { value: 'Asia/Dubai', label: 'UAE (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Australia/Sydney', label: 'Australia Eastern' },
];

const CURRENCIES = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
  { value: 'AED', label: 'د.إ AED' },
  { value: 'SGD', label: 'S$ SGD' },
  { value: 'AUD', label: 'A$ AUD' },
];

interface StudioInfoForm {
  studio_name: string;
  account_type: 'gym';
  business_type: string;
  phone: string;
  country: string;
  timezone: string;
  currency: string;
  website: string;
  logo_url?: string;
}

export default function StudioInfoPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const autoLocation = useAutoLocation();
  const studioDraft = useOnboardingStore((s) => s.studioInfo);
  const setStudioDraft = useOnboardingStore((s) => s.setStudioInfo);
  const replaceStudioDraft = useOnboardingStore((s) => s.replaceStudioInfo);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=/onboarding/studio-info');
      return;
    }
    if (!user) return;
    const step = user.onboarding_step;
    if (step === 'verify_email') router.push('/verify-email');
    else if (step === 'setup_branches') router.push('/onboarding/branches');
    else if (step === 'setup_plans') router.push('/onboarding/memberships');
    else if (step === 'setup_staff') router.push('/onboarding/staff');
    else if (step === 'select_subscription') router.push('/onboarding/subscription');
    else if (step === 'complete' || !step) {
      const slug = useAuthStore.getState().studio?.slug;
      router.push(slug ? `/${slug}/dashboard` : '/login');
    }
  }, [user, isAuthenticated, hasHydrated, router]);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<StudioInfoForm>({
    defaultValues: {
      studio_name: studioDraft.studio_name || useAuthStore.getState().studio?.name || '',
      account_type: studioDraft.account_type || 'gym',
      business_type: studioDraft.business_type || 'gym',
      phone: studioDraft.phone || '',
      country: studioDraft.country || '',
      timezone: studioDraft.timezone || useAuthStore.getState().studio?.timezone || '',
      currency: studioDraft.currency || useAuthStore.getState().studio?.currency || '',
      website: studioDraft.website || useAuthStore.getState().studio?.website || '',
      logo_url: useAuthStore.getState().studio?.logo_url || '',
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const watchAccountType = 'gym' as const;
  const businessTypes = GYM_BUSINESS_TYPES;

  const countryOptions = useMemo(() => getCountryOptions(), []);
  const selectedCountry = watch('country');
  const phoneValue = watch('phone');
  const phoneMetadata = useMemo(() => getPhoneMetadata(selectedCountry), [selectedCountry]);

  const currencyOptions = useMemo(() => {
    const map = new Map(CURRENCIES.map((item) => [item.value, item.label]));
    const options = new Set(CURRENCIES.map((item) => item.value));

    if (autoLocation.currency) options.add(autoLocation.currency);

    const countryCurrency = getCountryMetadata(selectedCountry).currency;
    if (countryCurrency) options.add(countryCurrency);

    return Array.from(options).map((value) => ({
      value,
      label: map.get(value) || value,
    }));
  }, [autoLocation.currency, selectedCountry]);

  const timezoneOptions = useMemo(() => {
    const options = new Set(TIMEZONES.map((item) => item.value));

    if (autoLocation.timezone) options.add(autoLocation.timezone);

    const countryTimezone = getCountryMetadata(selectedCountry).timezone;
    if (countryTimezone) options.add(countryTimezone);

    return Array.from(options)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }));
  }, [autoLocation.timezone, selectedCountry]);

  useEffect(() => {
    if (autoLocation.loading) return;

    if (!getValues('country') && autoLocation.country) {
      setValue('country', autoLocation.country);
    }

    if (!getValues('timezone') && autoLocation.timezone) {
      setValue('timezone', autoLocation.timezone);
    }

    if (!getValues('currency')) {
      const detectedCurrency = autoLocation.currency || getCountryMetadata(autoLocation.country).currency;
      if (detectedCurrency) {
        setValue('currency', detectedCurrency);
      }
    }
  }, [autoLocation, getValues, setValue]);

  useEffect(() => {
    if (!selectedCountry) return;

    const metadata = getCountryMetadata(selectedCountry);
    if (metadata.currency) {
      setValue('currency', metadata.currency, { shouldDirty: true });
    }
    if (metadata.timezone) {
      setValue('timezone', metadata.timezone, { shouldDirty: true });
    }
  }, [selectedCountry, setValue]);

  useEffect(() => {
    const subscription = watch((value) => {
      replaceStudioDraft({
        studio_name: value.studio_name || '',
        account_type: 'gym',
        business_type: value.business_type || 'gym',
        phone: value.phone || '',
        country: value.country || '',
        timezone: value.timezone || '',
        currency: value.currency || '',
        website: value.website || '',
      });
    });

    return () => subscription.unsubscribe();
  }, [replaceStudioDraft, watch]);

  useEffect(() => {
    if (!phoneValue) return;

    const sanitized = sanitizePhoneDigits(phoneValue, phoneMetadata.maxDigits);
    if (sanitized !== phoneValue) {
      setValue('phone', sanitized, { shouldDirty: true });
    }
  }, [phoneMetadata.maxDigits, phoneValue, setValue]);

  const onSubmit = async (data: StudioInfoForm) => {
    setLoading(true);
    try {
      // Upload logo to Supabase Storage if a new file was selected
      let logoUrl: string | undefined = undefined;
      if (logoFile) {
        setLogoUploading(true);
        try {
          // Ensure bucket exists (no-op if already created)
          await supabase.storage.createBucket('studio-assets', { public: true }).catch(() => {});
          const ext = logoFile.name.split('.').pop() ?? 'png';
          const path = `logos/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('studio-assets')
            .upload(path, logoFile, { upsert: true });
          if (uploadError) {
            toast.error('Logo upload failed. Continuing without logo.');
          } else {
            const { data: urlData } = supabase.storage.from('studio-assets').getPublicUrl(path);
            logoUrl = urlData.publicUrl;
          }
        } finally {
          setLogoUploading(false);
        }
      }
      const res = await apiClient.post<{
        user: {
          id: string;
          email: string;
          full_name: string;
          role: string;
          studio_id: string;
          branch_ids: string[];
          onboarding_step: string;
          account_type?: string;
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
        business_type: data.business_type,
        phone: data.phone ? formatPhoneForStorage(data.country, data.phone) : undefined,
        country: getCountryName(data.country) || data.country || undefined,
        timezone: data.timezone,
        currency: data.currency,
        website: data.website || undefined,
        logo_url: logoUrl,
      });

      setStudioDraft({
        studio_name: data.studio_name,
        account_type: data.account_type,
        business_type: data.business_type,
        phone: data.phone,
        country: data.country,
        timezone: data.timezone,
        currency: data.currency,
        website: data.website,
      });

      setAuth({
        access_token: accessToken || '',
        refresh_token: refreshToken || '',
        user: {
          id: res.user.id,
          email: res.user.email,
          full_name: res.user.full_name,
          role: res.user.role,
          studio_id: res.user.studio_id,
          organization_id: (res.user as any).organization_id,
          branch_ids: res.user.branch_ids,
          onboarding_step: res.user.onboarding_step,
          account_type: 'gym',
        },
        studio: res.studio,
      });

      toast.success('Studio created!');
      router.push('/onboarding/branches');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create studio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout currentStep={2}>
      <div className="mb-7">
        <span className="text-primary text-4xl font-black leading-none">*</span>
        <h1 className="mt-2 text-[22px] font-bold text-foreground tracking-tight">
          Tell us about your gym
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Step 3 of 7 — Basic information about your fitness business.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        <div className="rounded-md border border-border bg-muted/20 p-3 text-[12px] text-muted-foreground">
          {autoLocation.loading && 'Detecting your location...'}
          {!autoLocation.loading && autoLocation.countryName && (
            <span>
              Detected your location as {autoLocation.countryName}.
              {autoLocation.city ? ` ${autoLocation.city}.` : ''} You can change this if incorrect.
            </span>
          )}
          {!autoLocation.loading && autoLocation.error && autoLocation.error}
        </div>

        {/* Logo Upload */}
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
            onClick={() => logoInputRef.current?.click()}
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="text-[13px] text-primary hover:text-primary/80 font-medium"
            >
              {logoPreview ? 'Change logo' : 'Upload logo'}
            </button>
            {logoPreview && (
              <button
                type="button"
                onClick={() => { setLogoPreview(null); setLogoFile(null); setValue('logo_url', ''); }}
                className="ml-3 text-[12px] text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3 inline" /> Remove
              </button>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG up to 2MB</p>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        <div className="flex items-center gap-2 text-primary mb-2">
          <Building2 className="h-4 w-4" />
          <span className="text-[13px] font-semibold">Studio Details</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Gym Name *</label>
          <Input
            placeholder="e.g. PowerFit Gym"
            className="h-10 text-[13px]"
            {...register('studio_name', { required: 'Gym name is required' })}
          />
          {errors.studio_name && (
            <p className="text-xs text-destructive">{errors.studio_name.message}</p>
          )}
          {watch('studio_name') && (
            <p className="text-[11px] text-muted-foreground">
              Your URL: <span className="font-mono text-foreground">
                /{watch('studio_name').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}/dashboard
              </span>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Business Type</label>
          <select
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...register('business_type')}
          >
            {businessTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-foreground">Phone</label>
          <div className="flex rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring overflow-hidden">
            <span className="flex shrink-0 items-center justify-center border-r border-border bg-muted/40 px-3 text-[13px] text-muted-foreground whitespace-nowrap">
              {phoneMetadata.dialCode || '--'}
            </span>
            <input
              type="text"
              placeholder={selectedCountry === 'IN' ? '10-digit mobile number' : 'Contact phone'}
              inputMode="numeric"
              maxLength={phoneMetadata.maxDigits}
              className="h-10 w-full bg-transparent px-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
              {...register('phone', {
                onChange: (event) => {
                  event.target.value = sanitizePhoneDigits(event.target.value, phoneMetadata.maxDigits);
                },
                validate: (value) => {
                  if (!value) return true;
                  if (selectedCountry === 'IN' && value.length !== 10) {
                    return 'Indian mobile numbers must be 10 digits';
                  }
                  if (value.length > phoneMetadata.maxDigits) {
                    return `Phone number must be ${phoneMetadata.maxDigits} digits or less`;
                  }
                  return true;
                },
              })}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Country code is set from your selected country. Enter only the local number.
          </p>
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">
              <Globe className="inline h-3 w-3 mr-1" />Country
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...register('country', { required: 'Country is required' })}
            >
              <option value="">Select country</option>
              {countryOptions.map((country) => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
            {errors.country && (
              <p className="text-xs text-destructive">{errors.country.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">
              <Clock className="inline h-3 w-3 mr-1" />Timezone
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...register('timezone', { required: 'Timezone is required' })}
            >
              <option value="">Select timezone</option>
              {timezoneOptions.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.timezone && (
              <p className="text-xs text-destructive">{errors.timezone.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">
              <DollarSign className="inline h-3 w-3 mr-1" />Currency
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...register('currency', { required: 'Currency is required' })}
            >
              <option value="">Select currency</option>
              {currencyOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.currency && (
              <p className="text-xs text-destructive">{errors.currency.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">Website</label>
            <Input placeholder="https://..." className="h-10 text-[13px]" {...register('website')} />
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[13px]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
          </Button>
        </div>
      </form>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        You can update all details later from Settings.
      </p>
    </OnboardingLayout>
  );
}
