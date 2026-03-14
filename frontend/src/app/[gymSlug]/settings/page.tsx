"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { FormInput, FormTextarea } from "@/components/shared";
import { LoadingSkeleton } from "@/components/shared";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import {
  Settings,
  CreditCard,
  Link as LinkIcon,
  Shield,
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
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";


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

interface StudioSettingsForm {
  studio_name: string;
  tagline: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  business_name: string;
  business_type: string;
  timezone: string;
  currency: string;
  billing_name: string;
  billing_email: string;
  billing_address: string;
  tax_id: string;
}

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
      ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
      : status === "trial"
        ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
        : status === "past_due"
          ? "bg-amber-500/10 text-amber-500 ring-amber-500/20"
          : "bg-red-500/10 text-red-500 ring-red-500/20";
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

  const { register, handleSubmit, reset } = useForm<StudioSettingsForm>();

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
        state: studio.state || "",
        country: studio.country || "",
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
      apiClient.patch<StudioResponse>("/settings/studio", data),
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

  return (
    <AppLayout>
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Manage your studio configuration, subscription, and account preferences
        </p>
      </div>

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
        <div className="bg-card border border-red-500/20 rounded-xl p-6 mb-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500" />
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
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-black/5">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left 50%: Gym Info */}
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 flex flex-col justify-between">
                <div className="flex items-center gap-5">
                  {account.studio.logo_url ? (
                    <img
                      src={account.studio.logo_url}
                      alt=""
                      className="w-[72px] h-[72px] rounded-2xl object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border-2 border-primary/20 shadow-md">
                      <Crown className="w-9 h-9 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-foreground truncate">
                      {account.studio.name}
                    </h2>
                    {account.studio.tagline && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {account.studio.tagline}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="font-mono bg-muted/50 px-2 py-0.5 rounded">
                        ID: {account.studio.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span>&middot;</span>
                      <span>Owner: {user?.full_name || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-bold capitalize ring-1 ring-primary/20">
                    <Zap className="w-4 h-4" />
                    {account.subscription.plan} Plan
                  </span>
                  <StatusPill status={account.subscription.status} />
                  {account.subscription.plan !== "enterprise" && (
                    <Link
                      href={gymPath("/settings/subscription")}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20 ml-auto"
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
                  className="flex items-center gap-4 px-6 py-5 hover:bg-muted/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
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
                  href={gymPath("/settings/account")}
                  className="flex items-center gap-4 px-6 py-5 hover:bg-muted/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-foreground">Contact Information</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {account.studio.email || account.studio.phone || "Manage contact details"}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  href={gymPath("/branches")}
                  className="flex items-center gap-4 px-6 py-5 hover:bg-muted/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
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
                className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
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
                className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
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
                className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
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
                href={gymPath("/branches")}
                className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
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
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm shadow-black/5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> Studio Details
          </h2>

          <FormInput
            label="Studio Name"
            {...register("studio_name", { required: "Required" })}
          />

          <FormInput label="Tagline" {...register("tagline")} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Phone" {...register("phone")} />
            <FormInput
              label="Email"
              type="email"
              {...register("email")}
            />
          </div>

          <FormInput label="Website" {...register("website")} />

          <FormTextarea label="Address" {...register("address")} rows={2} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="City" {...register("city")} />
            <FormInput label="State" {...register("state")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Country" {...register("country")} />
            <FormInput label="Postal Code" {...register("postal_code")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Timezone" {...register("timezone")} />
            <FormInput label="Currency" {...register("currency")} />
          </div>
        </div>

        {/* Business Information */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm shadow-black/5">
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
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm shadow-black/5">
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
          className="bg-primary text-primary-foreground px-8 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:hover:shadow-none"
        >
          {mutation.isPending ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </AppLayout>
  );
}
