"use client";

import { AppLayout } from "@/components/layout/app-layout";
import Image from "next/image";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared";
import { LoadingSkeleton, PageHeader, AccessDenied } from "@/components/shared";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import {
  Settings,
  CreditCard,
  Link as LinkIcon,
  Shield,
  ShieldCheck,
  Building2,
  Crown,
  ArrowRight,
  Zap,
  TrendingUp,
  Phone,
  Briefcase,
  Receipt,
  AlertCircle,
  BarChart3,
  MessageSquare,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
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

// ── Types ──────────────────────────────────────────────────────
interface AccountOverview {
  studio: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    owner_user_id: string;
    tagline: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;
    business_name: string | null;
    business_type: string | null;
    timezone: string;
    currency: string;
    email_verified: boolean;
    phone_verified: boolean;
    two_factor_enabled: boolean;
    created_at: string;
    last_login_at: string | null;
  };
  subscription: {
    plan: string;
    plan_description: string;
    status: string;
    billing_cycle: string;
    monthly_price: number;
    annual_price: number;
    price: number;
    subscription_start: string | null;
    next_billing_date: string | null;
    trial_ends_at: string | null;
  };
  usage: {
    branches: { current: number; max: number };
    members: { current: number; max: number };
    staff: { current: number; max: number };
  };
  features: Record<string, boolean>;
  billing: {
    billing_name: string | null;
    billing_email: string | null;
    billing_address: string | null;
    tax_id: string | null;
    currency: string;
  };
}

const settingsSchema = z.object({
  studio_name: z.string().min(1, "Studio name is required").max(100),
  tagline: z.string().max(200),
  phone: z.string().max(20),
  email: z.string().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"),
  website: z.string().refine((v) => !v || /^https?:\/\//.test(v), "Must start with http:// or https://"),
  address: z.string().max(500),
  city: z.string().max(100),
  state: z.string().max(100),
  country: z.string().max(100),
  postal_code: z.string().max(20),
  business_name: z.string().max(200),
  business_type: z.string().max(100),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required").max(3),
  billing_name: z.string().max(200),
  billing_email: z.string().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid billing email"),
  billing_address: z.string().max(500),
  tax_id: z.string().max(50),
});

type StudioSettingsForm = z.infer<typeof settingsSchema>;

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
  billing_name?: string;
  billing_email?: string;
  billing_address?: string;
  tax_id?: string;
}

// ── Helpers ────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-success/10 text-success ring-success/20"
      : status === "trial"
        ? "bg-link/10 text-link ring-blue-500/20"
        : status === "past_due"
          ? "bg-warning/10 text-warning ring-amber-500/20"
          : "bg-error/10 text-error ring-red-500/20";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ring-1 ${color}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}



// ── Component ──────────────────────────────────────────────────
export default function SettingsPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const { gymPath } = useGymSlug();
  const { updateStudio, studio: authStudio, user } = useAuthStore();
  const queryClient = useQueryClient();

  const {
    data: account,
    isLoading: accountLoading,
    error: accountError,
  } = useQuery<AccountOverview>({
    queryKey: ["account-overview"],
    queryFn: () => apiClient.get("/settings/account"),
  });

  const { data: studio } = useQuery<StudioResponse>({
    queryKey: ["studio-settings"],
    queryFn: () => apiClient.get("/settings/studio"),
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<StudioSettingsForm>({
    resolver: zodResolver(settingsSchema),
  });

  const selectedCountry = watch("country");
  const selectedState = watch("state");
  const countryOptions = useMemo(() => getCountryOptions().map((country) => ({ label: country.name, value: country.code })), []);
  const stateOptions = useMemo(
    () => getStateOptions(selectedCountry).map((state) => ({ label: state.name, value: state.code })),
    [selectedCountry],
  );
  const cityOptions = useMemo(
    () => getCityOptions(selectedCountry, selectedState).map((city) => ({ label: city.name, value: city.name })),
    [selectedCountry, selectedState],
  );

  useEffect(() => {
    if (studio) {
      reset({
        studio_name: studio.name || "",
        tagline: studio.tagline || "",
        phone: studio.phone || "",
        email: studio.email || "",
        website: studio.website || "",
        address: studio.address || "",
        city: studio.city || "",
        state: getStateCodeByName(getCountryCodeByName(studio.country || ""), studio.state || "") || "",
        country: getCountryCodeByName(studio.country || "") || "",
        postal_code: studio.postal_code || "",
        business_name: studio.business_name || "",
        business_type: studio.business_type || "",
        timezone: studio.timezone || "Asia/Kolkata",
        currency: studio.currency || "INR",
        billing_name: studio.billing_name || "",
        billing_email: studio.billing_email || "",
        billing_address: studio.billing_address || "",
        tax_id: studio.tax_id || "",
      });
    }
  }, [studio, reset]);

  const mutation = useMutation({
    mutationFn: (data: StudioSettingsForm) =>
      apiClient.patch<StudioResponse>("/settings/studio", {
        ...data,
        country: getCountryName(data.country) || data.country,
        state: getStateName(data.country, data.state) || data.state,
      }),
    onSuccess: (updated) => {
      toast.success("Settings saved");
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
          address: updated.address,
          timezone: updated.timezone,
          currency: updated.currency,
        });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });


  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* ── Page Header ───────────────────────────────────── */}
      <PageHeader
        title="Settings"
        description="Manage your studio configuration, subscription, and account preferences"
        className="mb-8"
      />

      {/* ── Account Overview ──────────────────────────────── */}
      {accountLoading ? (
        <div className="space-y-6 mb-8">
          <LoadingSkeleton className="h-36" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <LoadingSkeleton className="h-64" />
            <LoadingSkeleton className="h-64" />
            <LoadingSkeleton className="h-64" />
          </div>
        </div>
      ) : accountError ? (
        <div className="bg-card border border-error/30 rounded-lg p-6 mb-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-error" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Unable to load studio profile
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Please check your connection and refresh the page.
            </p>
          </div>
        </div>
      ) : account ? (
        <div className="space-y-6 mb-8">
          {/* ── Section 1: 50/50 Hero + Navigation ─────────── */}
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-black/5">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left 50%: Gym Info */}
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 flex flex-col justify-between">
                <div className="flex items-center gap-5">
                  {account.studio.logo_url ? (
                    <Image
                      src={account.studio.logo_url}
                      alt=""
                      width={72}
                      height={72}
                      className="w-[72px] h-[72px] rounded-lg object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-[72px] h-[72px] rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border-2 border-primary/20 shadow-level-3">
                      <Crown className="w-9 h-9 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold text-foreground truncate">
                      {account.studio.name}
                    </h2>
                    {account.studio.tagline && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {account.studio.tagline}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="font-mono bg-canvas-soft px-2 py-0.5 rounded">
                        ID: {account.studio.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span>&middot;</span>
                      <span>Owner: {user?.full_name || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-canvas-soft-2 text-primary text-sm font-semibold capitalize ring-1 ring-primary/20">
                    <Zap className="w-4 h-4" />
                    {account.subscription.plan} Plan
                  </span>
                  <StatusPill status={account.subscription.status} />
                  {account.subscription.plan !== "enterprise" && (
                    <Link
                      href={gymPath("/settings/subscription")}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all hover:shadow-level-4 hover:shadow-primary/20 ml-auto"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Upgrade
                    </Link>
                  )}
                </div>
              </div>

              {/* Right 50%: Navigation List */}
              <div className="border-t lg:border-t-0 lg:border-l border-border divide-y divide-border">
                <Link
                  href={gymPath("/settings/subscription")}
                  className="flex items-center gap-4 px-6 py-5 hover:bg-canvas-soft transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-foreground">Subscription</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {account.subscription.plan} plan &middot; {fmtCurrency(account.subscription.price, account.billing.currency)}/{account.subscription.billing_cycle === "annual" ? "yr" : "mo"}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  href={gymPath("/settings/profile")}
                  className="flex items-center gap-4 px-6 py-5 hover:bg-canvas-soft transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-foreground">Studio Profile</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {account.studio.email || account.studio.phone || "Edit gym details, logo & contact info"}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  href={gymPath("/branches")}
                  className="flex items-center gap-4 px-6 py-5 hover:bg-canvas-soft transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-foreground">Usage & Limits</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {account.usage.branches.current}/{account.usage.branches.max} branches &middot; {account.usage.members.current}/{account.usage.members.max} members
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              </div>
            </div>
          </div>

          {/* ── Section 3: Account Actions Grid ───────────── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href={gymPath("/settings/plans")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Membership Plans
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Manage pricing tiers and plan configurations
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/settings/integrations")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <LinkIcon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Integrations
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Payment gateways, messaging, and AI services
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/settings/roles")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Roles & Permissions
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Manage access control for your team
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/settings/permissions")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Staff Permissions
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Per-staff overrides and branch access
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/settings/security")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Security
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Two-factor authentication and account security
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/branches")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Branches
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Manage your studio locations and branches
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/settings/invoices")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <Receipt className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Invoice Templates
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choose and preview invoice templates sent to members
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/settings/tax-invoice")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <Receipt className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Tax Invoice (GST)
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configure GSTIN, place of supply, HSN/SAC and tax-invoice terms
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/settings/loyalty")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <Star className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Loyalty Program
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configure points earning and redemption for member wallets
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/settings/templates")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Message Templates
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Manage WhatsApp, SMS &amp; email templates — enable or create new
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href={gymPath("/settings/profile")}
                className="group bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-level-3 hover:shadow-primary/5 transition-all duration-fast"
              >
                <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center mb-3 group-hover:bg-canvas-soft-2 transition-colors">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Studio Profile
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Edit gym details, logo, contact info &amp; billing
                </p>
                <ArrowRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Studio Settings Form ──────────────────────────── */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
          Studio Configuration
        </h3>
      </div>

      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="max-w-3xl space-y-6 pb-8"
      >
        {/* Studio Details */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 shadow-level-2 shadow-black/5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> Studio Details
          </h2>

          <FormInput
            label="Studio Name"
            error={errors.studio_name?.message}
            {...register("studio_name")}
          />

          <FormInput label="Tagline" {...register("tagline")} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Phone" {...register("phone")} />
            <FormInput
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register("email")}
            />
          </div>

          <FormInput label="Website" {...register("website")} />

          <FormTextarea label="Address" {...register("address")} rows={2} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="City"
              value={watch("city")}
              onValueChange={(value) => setValue("city", value, { shouldDirty: true })}
              options={cityOptions}
              placeholder="Select city"
            />
            <FormSelect
              label="State"
              value={selectedState}
              onValueChange={(value) => {
                setValue("state", value, { shouldDirty: true });
                setValue("city", "", { shouldDirty: true });
              }}
              options={stateOptions}
              placeholder="Select state"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Country"
              value={selectedCountry}
              onValueChange={(value) => {
                setValue("country", value, { shouldDirty: true });
                setValue("state", "", { shouldDirty: true });
                setValue("city", "", { shouldDirty: true });
              }}
              options={countryOptions}
              placeholder="Select country"
            />
            <FormInput label="Postal Code" {...register("postal_code")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Timezone" {...register("timezone")} />
            <FormInput label="Currency" {...register("currency")} />
          </div>
        </div>

        {/* Business Information */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 shadow-level-2 shadow-black/5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> Business Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Business Name"
              {...register("business_name")}
            />
            <FormInput
              label="Business Type"
              {...register("business_type")}
              placeholder="e.g. Gym, Yoga Studio, CrossFit"
            />
          </div>
        </div>

        {/* Billing Information */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 shadow-level-2 shadow-black/5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" /> Billing Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Billing Name"
              {...register("billing_name")}
            />
            <FormInput
              label="Billing Email"
              type="email"
              error={errors.billing_email?.message}
              {...register("billing_email")}
            />
          </div>

          <FormTextarea
            label="Billing Address"
            {...register("billing_address")}
            rows={2}
          />

          <FormInput
            label="Tax ID / GST Number"
            {...register("tax_id")}
            placeholder="e.g. GSTIN, VAT, EIN"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-primary text-primary-foreground px-8 py-3 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all hover:shadow-level-4 hover:shadow-primary/20 disabled:opacity-50 disabled:hover:shadow-none"
        >
          {mutation.isPending ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </AppLayout>
  );
}
