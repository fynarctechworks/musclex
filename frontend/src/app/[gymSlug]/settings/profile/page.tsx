"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import {
  Building2,
  ChevronRight,
  Upload,
  X,
  Globe,
  Phone,
  MapPin,
  Briefcase,
  Receipt,
  Check,
  Crown,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import {
  getCityOptions,
  getCountryCodeByName,
  getCountryName,
  getCountryOptions,
  getStateCodeByName,
  getStateName,
  getStateOptions,
} from "@/lib/location";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { AccessDenied } from "@/components/shared";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────
interface StudioResponse {
  id: string;
  name: string;
  tagline?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  business_name?: string;
  business_type?: string;
  timezone: string;
  currency: string;
  logo_url?: string;
  billing_name?: string;
  billing_email?: string;
  billing_address?: string;
  tax_id?: string;
}

const BUSINESS_TYPES = [
  { value: "gym", label: "Gym" },
  { value: "yoga", label: "Yoga Studio" },
  { value: "crossfit", label: "CrossFit Box" },
  { value: "fitness_studio", label: "Fitness Studio" },
  { value: "martial_arts", label: "Martial Arts" },
  { value: "pilates", label: "Pilates Studio" },
  { value: "other", label: "Other" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Chicago", label: "US Central" },
  { value: "America/Denver", label: "US Mountain" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "Europe/London", label: "UK (GMT)" },
  { value: "Europe/Berlin", label: "Europe Central" },
  { value: "Asia/Dubai", label: "UAE (GST)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Australia Eastern" },
];

const CURRENCIES = [
  { value: "INR", label: "₹ INR" },
  { value: "USD", label: "$ USD" },
  { value: "EUR", label: "€ EUR" },
  { value: "GBP", label: "£ GBP" },
  { value: "AED", label: "د.إ AED" },
  { value: "SGD", label: "S$ SGD" },
  { value: "AUD", label: "A$ AUD" },
];

// ── Schema ─────────────────────────────────────────────────────
const schema = z.object({
  studio_name: z.string().min(1, "Studio name is required").max(100),
  tagline: z.string().max(200).optional().default(""),
  phone: z.string().max(20).optional().default(""),
  email: z
    .string()
    .optional()
    .default("")
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"),
  website: z
    .string()
    .optional()
    .default("")
    .refine((v) => !v || /^https?:\/\//.test(v), "Must start with http://"),
  address: z.string().max(500).optional().default(""),
  city: z.string().max(100).optional().default(""),
  state: z.string().max(100).optional().default(""),
  country: z.string().max(100).optional().default(""),
  postal_code: z.string().max(20).optional().default(""),
  business_name: z.string().max(200).optional().default(""),
  business_type: z.string().max(100).optional().default(""),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required").max(3),
  billing_name: z.string().max(200).optional().default(""),
  billing_email: z
    .string()
    .optional()
    .default("")
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid billing email"),
  billing_address: z.string().max(500).optional().default(""),
  tax_id: z.string().max(50).optional().default(""),
});

type FormValues = z.output<typeof schema>;

// ── Inline styled primitives (semantic tokens — light theme) ───
function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const inputClass = (error?: string) =>
  `w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    error ? "border-destructive" : "border-input"
  }`;

const Inp = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(function Inp({ error, ...props }, ref) {
  return <input ref={ref} className={inputClass(error)} {...props} />;
});

const Sel = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }
>(function Sel({ error, children, ...props }, ref) {
  return (
    <select ref={ref} className={inputClass(error)} {...props}>
      {children}
    </select>
  );
});

const Tex = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string; rows?: number }
>(function Tex({ error, rows = 2, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={`${inputClass(error)} resize-none`} {...props} />;
});

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-card border border-border p-6 space-y-4 shadow-level-2">
      <div className="flex items-center gap-2.5 pb-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-canvas-soft-2">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────
export default function StudioProfilePage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const { gymPath } = useGymSlug();
  const { updateStudio, studio: authStudio } = useAuthStore();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>("");

  const { data: studio, isLoading } = useQuery<StudioResponse>({
    queryKey: ["studio-settings"],
    queryFn: () => apiClient.get("/settings/studio"),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues>({ resolver: zodResolver(schema) as any });

  const selectedCountry = watch("country") || "";
  const selectedState = watch("state") || "";

  const countryOptions = useMemo(
    () => getCountryOptions().map((c) => ({ label: c.name, value: c.code })),
    []
  );
  const stateOptions = useMemo(
    () => getStateOptions(selectedCountry).map((s) => ({ label: s.name, value: s.code })),
    [selectedCountry]
  );
  const cityOptions = useMemo(
    () => getCityOptions(selectedCountry, selectedState).map((c) => ({ label: c.name, value: c.name })),
    [selectedCountry, selectedState]
  );

  useEffect(() => {
    if (studio) {
      const countryCode = getCountryCodeByName(studio.country || "") || "";
      const stateCode = getStateCodeByName(countryCode, studio.state || "") || "";
      reset({
        studio_name: studio.name || "",
        tagline: studio.tagline || "",
        phone: studio.phone || "",
        email: studio.email || "",
        website: studio.website || "",
        address: studio.address || "",
        city: studio.city || "",
        state: stateCode,
        country: countryCode,
        postal_code: studio.postal_code || "",
        business_name: studio.business_name || "",
        business_type: studio.business_type || "gym",
        timezone: studio.timezone || "Asia/Kolkata",
        currency: studio.currency || "INR",
        billing_name: studio.billing_name || "",
        billing_email: studio.billing_email || "",
        billing_address: studio.billing_address || "",
        tax_id: studio.tax_id || "",
      });
      if (studio.logo_url) {
        setLogoPreview(studio.logo_url);
        setLogoUrl(studio.logo_url);
      }
    }
  }, [studio, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiClient.patch<StudioResponse>("/settings/studio", {
        ...data,
        country: getCountryName(data.country || "") || data.country,
        state: getStateName(data.country || "", data.state || "") || data.state,
        logo_url: logoUrl || undefined,
      }),
    onSuccess: (updated) => {
      toast.success("Studio profile saved");
      queryClient.invalidateQueries({ queryKey: ["studio-settings"] });
      queryClient.invalidateQueries({ queryKey: ["account-overview"] });
      if (authStudio) {
        updateStudio({
          ...authStudio,
          name: updated.name,
          tagline: updated.tagline,
          phone: updated.phone,
          email: updated.email,
          website: updated.website,
          timezone: updated.timezone,
          currency: updated.currency,
          logo_url: updated.logo_url || null,
        });
      }
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save"),
  });

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }

    // Show local preview immediately while uploading.
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to Supabase Storage so we save a real URL (not a base64 blob).
    try {
      await supabase.storage.createBucket("studio-assets", { public: true }).catch(() => {});
      const ext = file.name.split(".").pop() ?? "png";
      const path = `logos/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("studio-assets")
        .upload(path, file, { upsert: true });
      if (uploadError) {
        toast.error("Logo upload failed");
        return;
      }
      const { data } = supabase.storage.from("studio-assets").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      setLogoPreview(data.publicUrl);
    } catch {
      toast.error("Logo upload failed");
    }
  };


  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-3">
        <Link href={gymPath("/settings")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-primary" />
            Studio Profile
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            Edit your gym details — changes apply to invoices, emails, and member-facing screens
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="max-w-2xl space-y-6 pb-12"
        >
          {/* ── Identity & Branding ──────────────────────────── */}
          <SectionCard icon={Crown} title="Identity & Branding">
            {/* Logo upload */}
            <div className="flex items-center gap-5">
              <div
                className="relative w-20 h-20 rounded-lg overflow-hidden cursor-pointer group shrink-0 border-2 border-dashed border-border hover:border-primary/50 transition-colors"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/40">
                  <Upload className="w-5 h-5 text-background" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                    {logoPreview ? "Change logo" : "Upload logo"}
                  </button>
                  {logoPreview && (
                    <button type="button" onClick={() => { setLogoPreview(null); setLogoUrl(""); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>
                <p className="text-xs mt-1 text-muted-foreground">PNG, JPG or SVG · max 2MB · used in invoices &amp; emails</p>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            <Field label="Studio Name *" error={errors.studio_name?.message}>
              <Inp placeholder="e.g. PowerFit Gym" error={errors.studio_name?.message} {...register("studio_name")} />
            </Field>
            <Field label="Tagline" hint="Short description shown in welcome emails">
              <Inp placeholder="e.g. Where Champions Are Made" {...register("tagline")} />
            </Field>
          </SectionCard>

          {/* ── Contact Information ──────────────────────────── */}
          <SectionCard icon={Phone} title="Contact Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone" error={errors.phone?.message}>
                <Inp type="tel" placeholder="+91 98765 43210" {...register("phone")} />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <Inp type="email" placeholder="hello@yourgym.com" error={errors.email?.message} {...register("email")} />
              </Field>
            </div>
            <Field label="Website" error={errors.website?.message}>
              <Inp placeholder="https://yourgym.com" error={errors.website?.message} {...register("website")} />
            </Field>
          </SectionCard>

          {/* ── Location ─────────────────────────────────────── */}
          <SectionCard icon={MapPin} title="Location">
            <Field label="Address">
              <Tex placeholder="Street address" {...register("address")} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Country">
                <Sel
                  value={selectedCountry}
                  onChange={(e) => {
                    setValue("country", e.target.value, { shouldDirty: true });
                    setValue("state", "", { shouldDirty: true });
                    setValue("city", "", { shouldDirty: true });
                  }}
                >
                  <option value="">Select country</option>
                  {countryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Sel>
              </Field>
              <Field label="State / Province">
                <Sel
                  value={selectedState}
                  onChange={(e) => {
                    setValue("state", e.target.value, { shouldDirty: true });
                    setValue("city", "", { shouldDirty: true });
                  }}
                >
                  <option value="">Select state</option>
                  {stateOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Sel>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="City">
                <Sel
                  value={watch("city") || ""}
                  onChange={(e) => setValue("city", e.target.value, { shouldDirty: true })}
                >
                  <option value="">Select city</option>
                  {cityOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Sel>
              </Field>
              <Field label="Postal Code">
                <Inp placeholder="400001" {...register("postal_code")} />
              </Field>
            </div>
          </SectionCard>

          {/* ── Regional Settings ─────────────────────────────── */}
          <SectionCard icon={Globe} title="Regional Settings">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Timezone" error={errors.timezone?.message}>
                <Sel {...register("timezone")}>
                  <option value="">Select timezone</option>
                  {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Sel>
              </Field>
              <Field label="Currency" error={errors.currency?.message}>
                <Sel {...register("currency")}>
                  <option value="">Select currency</option>
                  {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Sel>
              </Field>
            </div>
          </SectionCard>

          {/* ── Business Information ──────────────────────────── */}
          <SectionCard icon={Briefcase} title="Business Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Registered Business Name">
                <Inp placeholder="e.g. PowerFit Pvt Ltd" {...register("business_name")} />
              </Field>
              <Field label="Business Type">
                <Sel {...register("business_type")}>
                  {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Sel>
              </Field>
            </div>
          </SectionCard>

          {/* ── Billing & Tax ─────────────────────────────────── */}
          <SectionCard icon={Receipt} title="Billing &amp; Tax">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Billing Name">
                <Inp placeholder="Name on invoices" {...register("billing_name")} />
              </Field>
              <Field label="Billing Email" error={errors.billing_email?.message}>
                <Inp type="email" placeholder="billing@yourgym.com" error={errors.billing_email?.message} {...register("billing_email")} />
              </Field>
            </div>
            <Field label="Billing Address">
              <Tex placeholder="Full billing address" {...register("billing_address")} />
            </Field>
            <Field label="Tax ID / GST Number" hint="e.g. GSTIN, VAT, EIN — printed on member invoices">
              <Inp placeholder="22AAAAA0000A1Z5" {...register("tax_id")} />
            </Field>
          </SectionCard>

          {/* ── Save button ────────────────────────────────────── */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg px-7 py-3 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 shadow-level-2"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </button>
            {isDirty && !mutation.isPending && (
              <p className="text-xs text-warning">You have unsaved changes</p>
            )}
            {mutation.isSuccess && !isDirty && (
              <p className="text-xs flex items-center gap-1 text-success">
                <Check className="w-3 h-3" /> Saved
              </p>
            )}
          </div>
        </form>
      )}
    </AppLayout>
  );
}
