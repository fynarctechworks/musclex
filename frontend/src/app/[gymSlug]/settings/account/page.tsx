"use client";

import { AppLayout } from "@/components/layout/app-layout";
import Image from "next/image";
import { LoadingSkeleton, StatusBadge } from "@/components/shared";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useForm } from "react-hook-form";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  UserCog,
  Check,
  X,
  Crown,
  Zap,
  Shield,
  CreditCard,
  Download,
  Phone,
  Mail,
  Lock,
  Smartphone,
  MonitorSmartphone,
} from "lucide-react";
import {
  getCityOptions,
  getCountryCodeByName,
  getCountryName,
  getCountryOptions,
  getStateCodeByName,
  getStateName,
  getStateOptions,
} from "@/lib/location";

// ── Types ──────────────────────────────────────────────────────
interface AccountOverview {
  studio: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    owner_user_id: string;
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
    email_verified: boolean;
    phone_verified: boolean;
    two_factor_enabled: boolean;
    created_at: string;
    last_login_at?: string;
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
    storage_limit_gb: number;
    api_access: boolean;
  };
  features: Record<string, boolean>;
  billing: {
    billing_name?: string;
    billing_email?: string;
    billing_address?: string;
    tax_id?: string;
    currency: string;
  };
}

interface InvoiceItem {
  id: string;
  invoice_number: string;
  amount: string;
  currency: string;
  status: string;
  billing_period_start: string;
  billing_period_end: string;
  paid_at: string | null;
  invoice_url: string | null;
  created_at: string;
}

interface BranchSummaryItem {
  id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

interface PlanOption {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  max_branches: number;
  max_members: number;
  max_staff: number;
  storage_limit_gb: number;
  api_access: boolean;
  features: Record<string, boolean>;
}

interface OrgForm {
  studio_name: string;
  tagline: string;
  business_name: string;
  business_type: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  timezone: string;
  currency: string;
}

interface BillingForm {
  billing_name: string;
  billing_email: string;
  billing_address: string;
  tax_id: string;
}

// ── Feature labels & categories ────────────────────────────────
const FEATURE_CATEGORIES: {
  label: string;
  keys: { key: string; label: string }[];
}[] = [
  {
    label: "Core Management",
    keys: [
      { key: "member_management", label: "Member Management" },
      { key: "check_in", label: "Check-in System" },
      { key: "basic_reports", label: "Basic Reports" },
    ],
  },
  {
    label: "Branch Management",
    keys: [
      { key: "multi_branch", label: "Multi-Branch Support" },
      { key: "staff_management", label: "Staff Management" },
      { key: "trainer_management", label: "Trainer Management" },
      { key: "custom_roles", label: "Custom Roles & Permissions" },
    ],
  },
  {
    label: "Financial & Payments",
    keys: [
      { key: "manual_payments", label: "Payment Recording" },
      { key: "payment_gateway", label: "Online Payment Gateway" },
    ],
  },
  {
    label: "Operations & Scheduling",
    keys: [
      { key: "class_scheduling", label: "Class Scheduling" },
      { key: "audit_logs", label: "Audit Logs" },
    ],
  },
  {
    label: "Integrations & Advanced",
    keys: [
      { key: "marketing_campaigns", label: "Marketing Campaigns" },
      { key: "email_campaigns", label: "Email Campaigns" },
      { key: "whatsapp_notifications", label: "WhatsApp Notifications" },
      { key: "ai_advisor", label: "AI Advisor" },
      { key: "api_access", label: "API Access" },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────
function UsageBar({
  label,
  current,
  max,
  icon: Icon,
}: {
  label: string;
  current: number;
  max: number;
  icon: React.ElementType;
}) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isHigh = pct >= 80;
  const isFull = pct >= 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-4 h-4" />
          {label}
        </span>
        <span
          className={
            isFull
              ? "text-red-500 font-semibold"
              : isHigh
                ? "text-amber-500 font-semibold"
                : "text-foreground font-medium"
          }
        >
          {current.toLocaleString()} /{" "}
          {max >= 99999 ? "Unlimited" : max.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isFull
              ? "bg-red-500"
              : isHigh
                ? "bg-amber-500"
                : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "trial"
        ? "bg-blue-500/10 text-blue-600"
        : status === "past_due"
          ? "bg-amber-500/10 text-amber-600"
          : status === "paid"
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-red-500/10 text-red-500";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${color}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function VerificationDot({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="flex items-center gap-1 text-xs text-emerald-600">
      <Check className="w-3.5 h-3.5" /> Verified
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <X className="w-3.5 h-3.5" /> Not verified
    </span>
  );
}

function SectionCard({
  id,
  title,
  icon: Icon,
  children,
}: {
  id?: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="bg-card border border-border rounded-xl p-6 scroll-mt-20"
    >
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-5">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground sm:w-48 shrink-0">
        {label}
      </span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Page Component ─────────────────────────────────────────────
export default function AccountDetailsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: account, isLoading } = useQuery<AccountOverview>({
    queryKey: ["account-overview"],
    queryFn: () => apiClient.get("/settings/account"),
  });

  const { data: invoices } = useQuery<InvoiceItem[]>({
    queryKey: ["account-invoices"],
    queryFn: () => apiClient.get("/settings/invoices"),
    enabled: user?.role === "owner",
  });

  const { data: branches } = useQuery<BranchSummaryItem[]>({
    queryKey: ["account-branches"],
    queryFn: () => apiClient.get("/settings/branches-summary"),
  });

  const { data: plans } = useQuery<PlanOption[]>({
    queryKey: ["subscription-plans"],
    queryFn: () => apiClient.get("/settings/plans"),
  });

  // ── Org form ──
  const orgForm = useForm<OrgForm>();
  const orgCountry = orgForm.watch("country");
  const orgState = orgForm.watch("state");
  const countryOptions = useMemo(
    () => getCountryOptions().map((country) => ({ label: country.name, value: country.code })),
    [],
  );
  const stateOptions = useMemo(
    () => getStateOptions(orgCountry).map((state) => ({ label: state.name, value: state.code })),
    [orgCountry],
  );
  const cityOptions = useMemo(
    () => getCityOptions(orgCountry, orgState).map((city) => ({ label: city.name, value: city.name })),
    [orgCountry, orgState],
  );
  useEffect(() => {
    if (account) {
      orgForm.reset({
        studio_name: account.studio.name || "",
        tagline: account.studio.tagline || "",
        business_name: account.studio.business_name || "",
        business_type: account.studio.business_type || "",
        phone: account.studio.phone || "",
        email: account.studio.email || "",
        website: account.studio.website || "",
        address: account.studio.address || "",
        city: account.studio.city || "",
        state:
          getStateCodeByName(
            getCountryCodeByName(account.studio.country || ""),
            account.studio.state || "",
          ) || "",
        country: getCountryCodeByName(account.studio.country || "") || "",
        postal_code: account.studio.postal_code || "",
        timezone: account.studio.timezone || "Asia/Kolkata",
        currency: account.studio.currency || "INR",
      });
    }
  }, [account, orgForm]);

  const orgMutation = useMutation({
    mutationFn: (data: OrgForm) =>
      apiClient.patch("/settings/studio", {
        ...data,
        country: getCountryName(data.country) || data.country,
        state: getStateName(data.country, data.state) || data.state,
      }),
    onSuccess: () => {
      toast.success("Organization details saved");
      queryClient.invalidateQueries({ queryKey: ["account-overview"] });
      queryClient.invalidateQueries({ queryKey: ["studio-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Billing form ──
  const billingForm = useForm<BillingForm>();
  useEffect(() => {
    if (account) {
      billingForm.reset({
        billing_name: account.billing.billing_name || "",
        billing_email: account.billing.billing_email || "",
        billing_address: account.billing.billing_address || "",
        tax_id: account.billing.tax_id || "",
      });
    }
  }, [account, billingForm]);

  const billingMutation = useMutation({
    mutationFn: (data: BillingForm) =>
      apiClient.patch("/settings/studio", data),
    onSuccess: () => {
      toast.success("Billing information saved");
      queryClient.invalidateQueries({ queryKey: ["account-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <LoadingSkeleton className="h-10 w-48" />
          <LoadingSkeleton className="h-64" />
          <LoadingSkeleton className="h-48" />
        </div>
      </AppLayout>
    );
  }

  if (!account) return null;

  const s = account.studio;
  const sub = account.subscription;
  const usage = account.usage;

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          {s.logo_url ? (
            <Image
              src={s.logo_url}
              alt=""
              width={48}
              height={48}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {s.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              Account ID: {s.id.slice(0, 8).toUpperCase()} &middot; Created{" "}
              {fmtDate(s.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ─── SECTION 1: Organization Information ────────── */}
        <SectionCard title="Organization Information" icon={Building2}>
          <form
            onSubmit={orgForm.handleSubmit((d) => orgMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Organization Name"
                {...orgForm.register("studio_name", { required: true })}
              />
              <FormInput
                label="Tagline"
                {...orgForm.register("tagline")}
              />
              <FormInput
                label="Business Registration Name"
                {...orgForm.register("business_name")}
              />
              <FormInput
                label="Business Type"
                {...orgForm.register("business_type")}
              />
              <FormInput
                label="Contact Email"
                type="email"
                {...orgForm.register("email")}
              />
              <FormInput
                label="Contact Phone"
                {...orgForm.register("phone")}
              />
              <div className="md:col-span-2">
                <FormInput
                  label="Website"
                  {...orgForm.register("website")}
                />
              </div>
              <div className="md:col-span-2">
                <FormTextarea
                  label="Address"
                  {...orgForm.register("address")}
                  rows={2}
                />
              </div>
              <FormSelect
                label="City"
                value={orgForm.watch("city")}
                onValueChange={(value) =>
                  orgForm.setValue("city", value, { shouldDirty: true })
                }
                options={cityOptions}
                placeholder="Select city"
              />
              <FormSelect
                label="State / Region"
                value={orgState}
                onValueChange={(value) => {
                  orgForm.setValue("state", value, { shouldDirty: true });
                  orgForm.setValue("city", "", { shouldDirty: true });
                }}
                options={stateOptions}
                placeholder="Select state"
              />
              <FormSelect
                label="Country"
                value={orgCountry}
                onValueChange={(value) => {
                  orgForm.setValue("country", value, { shouldDirty: true });
                  orgForm.setValue("state", "", { shouldDirty: true });
                  orgForm.setValue("city", "", { shouldDirty: true });
                }}
                options={countryOptions}
                placeholder="Select country"
              />
              <FormInput
                label="Postal Code"
                {...orgForm.register("postal_code")}
              />
              <FormInput
                label="Timezone"
                {...orgForm.register("timezone")}
              />
              <FormInput
                label="Currency"
                {...orgForm.register("currency")}
              />
            </div>

            {/* System fields (read-only) */}
            <div className="border-t border-border pt-4 mt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                System Information
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">
                    Account ID
                  </span>
                  <p className="font-mono text-foreground text-xs mt-0.5">
                    {s.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">
                    Created
                  </span>
                  <p className="text-foreground text-xs mt-0.5">
                    {fmtDate(s.created_at)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">
                    Last Login
                  </span>
                  <p className="text-foreground text-xs mt-0.5">
                    {fmtDate(s.last_login_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={orgMutation.isPending}
                className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {orgMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </SectionCard>

        {/* ─── SECTION 2: Subscription Details ────────────── */}
        <SectionCard id="plans" title="Subscription Details" icon={Zap}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-0">
              <InfoRow
                label="Current Plan"
                value={
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold capitalize">
                      <Zap className="w-3 h-3" />
                      {sub.plan}
                    </span>
                  </span>
                }
              />
              <InfoRow label="Description" value={sub.plan_description} />
              <InfoRow
                label="Price"
                value={
                  sub.price > 0
                    ? `${fmtCurrency(sub.price, account.billing.currency)} / ${sub.billing_cycle === "annual" ? "year" : "month"}`
                    : "Free"
                }
              />
              <InfoRow
                label="Billing Cycle"
                value={
                  <span className="capitalize">{sub.billing_cycle}</span>
                }
              />
              <InfoRow
                label="Status"
                value={<StatusPill status={sub.status} />}
              />
            </div>
            <div className="space-y-0">
              <InfoRow
                label="Start Date"
                value={fmtDate(sub.subscription_start)}
              />
              <InfoRow
                label="Next Billing"
                value={fmtDate(sub.next_billing_date)}
              />
              {sub.trial_ends_at && (
                <InfoRow
                  label="Trial Ends"
                  value={fmtDate(sub.trial_ends_at)}
                />
              )}
            </div>
          </div>

          {/* Plan limits */}
          <div className="border-t border-border pt-5 mb-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Plan Limits & Usage
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <UsageBar
                label="Branches"
                current={usage.branches.current}
                max={usage.branches.max}
                icon={Building2}
              />
              <UsageBar
                label="Members"
                current={usage.members.current}
                max={usage.members.max}
                icon={Users}
              />
              <UsageBar
                label="Staff"
                current={usage.staff.current}
                max={usage.staff.max}
                icon={UserCog}
              />
            </div>
            <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
              <span>
                Storage:{" "}
                <span className="text-foreground font-medium">
                  {usage.storage_limit_gb} GB
                </span>
              </span>
              <span>
                API Access:{" "}
                <span className="text-foreground font-medium">
                  {usage.api_access ? "Enabled" : "Disabled"}
                </span>
              </span>
            </div>
          </div>

          {/* Available plans */}
          {plans && plans.length > 0 && (
            <div className="border-t border-border pt-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Available Plans
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {plans.map((plan) => {
                  const isCurrent = plan.id === sub.plan;
                  return (
                    <div
                      key={plan.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        isCurrent
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-foreground capitalize">
                          {plan.name}
                        </h4>
                        {isCurrent && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-bold text-foreground">
                        {plan.monthly_price > 0
                          ? fmtCurrency(
                              plan.monthly_price,
                              account.billing.currency
                            )
                          : "Free"}
                        {plan.monthly_price > 0 && (
                          <span className="text-xs font-normal text-muted-foreground">
                            /mo
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 mb-3">
                        {plan.description}
                      </p>
                      <div className="text-[11px] text-muted-foreground space-y-0.5">
                        <p>
                          {plan.max_branches >= 999
                            ? "Unlimited"
                            : plan.max_branches}{" "}
                          branches
                        </p>
                        <p>
                          {plan.max_members >= 99999
                            ? "Unlimited"
                            : plan.max_members.toLocaleString()}{" "}
                          members
                        </p>
                        <p>
                          {plan.max_staff >= 999
                            ? "Unlimited"
                            : plan.max_staff}{" "}
                          staff
                        </p>
                      </div>
                      {!isCurrent && (
                        <button className="mt-3 w-full text-xs font-medium py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/90 hover:text-primary-foreground transition-colors">
                          {plans.indexOf(plan) >
                          plans.findIndex((p) => p.id === sub.plan)
                            ? "Upgrade"
                            : "Downgrade"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ─── SECTION 3: Billing Information ─────────────── */}
        <SectionCard id="billing" title="Billing Information" icon={CreditCard}>
          <form
            onSubmit={billingForm.handleSubmit((d) =>
              billingMutation.mutate(d)
            )}
            className="space-y-4 mb-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Billing Name"
                {...billingForm.register("billing_name")}
              />
              <FormInput
                label="Billing Email"
                type="email"
                {...billingForm.register("billing_email")}
              />
              <div className="md:col-span-2">
                <FormTextarea
                  label="Billing Address"
                  {...billingForm.register("billing_address")}
                  rows={2}
                />
              </div>
              <FormInput
                label="Tax / GST ID"
                {...billingForm.register("tax_id")}
              />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Currency
                </label>
                <p className="text-sm text-foreground bg-muted/30 border border-border px-3 py-2 rounded-lg">
                  {account.billing.currency}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={billingMutation.isPending}
                className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {billingMutation.isPending
                  ? "Saving..."
                  : "Save Billing Info"}
              </button>
            </div>
          </form>

          {/* Invoice history */}
          {invoices && invoices.length > 0 && (
            <div className="border-t border-border pt-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Billing History
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 text-xs font-medium text-muted-foreground">
                        Invoice
                      </th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground" />
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2.5 font-mono text-xs">
                          {inv.invoice_number}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {fmtDate(inv.created_at)}
                        </td>
                        <td className="py-2.5">
                          {fmtCurrency(
                            parseFloat(inv.amount),
                            inv.currency
                          )}
                        </td>
                        <td className="py-2.5">
                          <StatusPill status={inv.status} />
                        </td>
                        <td className="py-2.5 text-right">
                          {inv.invoice_url && (
                            <a
                              href={inv.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(!invoices || invoices.length === 0) && (
            <div className="border-t border-border pt-5">
              <p className="text-sm text-muted-foreground text-center py-6">
                No invoices yet
              </p>
            </div>
          )}
        </SectionCard>

        {/* ─── SECTION 4: Feature Access ──────────────────── */}
        <SectionCard title="Feature Access" icon={Shield}>
          <p className="text-xs text-muted-foreground mb-4">
            Features enabled by your{" "}
            <span className="capitalize font-medium text-foreground">
              {sub.plan}
            </span>{" "}
            plan
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURE_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {cat.label}
                </p>
                <div className="space-y-1.5">
                  {cat.keys.map(({ key, label }) => {
                    const enabled = account.features[key] ?? false;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between py-1"
                      >
                        <span
                          className={`text-sm ${enabled ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {label}
                        </span>
                        {enabled ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ─── SECTION 5: Branch Summary ──────────────────── */}
        <SectionCard title="Branch Summary" icon={Building2}>
          <div className="flex items-center gap-6 mb-4 text-sm">
            <span className="text-muted-foreground">
              Total:{" "}
              <span className="text-foreground font-medium">
                {branches?.length ?? 0}
              </span>
            </span>
            <span className="text-muted-foreground">
              Max:{" "}
              <span className="text-foreground font-medium">
                {usage.branches.max >= 999
                  ? "Unlimited"
                  : usage.branches.max}
              </span>
            </span>
            <span className="text-muted-foreground">
              Active:{" "}
              <span className="text-foreground font-medium">
                {branches?.filter((b) => b.is_active).length ?? 0}
              </span>
            </span>
          </div>

          {branches && branches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 text-xs font-medium text-muted-foreground">
                      ID
                    </th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">
                      Branch Name
                    </th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">
                      Location
                    </th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">
                      Members
                    </th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">
                        {b.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-2.5 font-medium">{b.name}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {[b.city, b.address].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td className="py-2.5">{b.member_count}</td>
                      <td className="py-2.5">
                        <StatusBadge
                          status={b.is_active ? "active" : "inactive"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No branches found
            </p>
          )}
        </SectionCard>

        {/* ─── SECTION 6: Account Security ────────────────── */}
        <SectionCard title="Account Security" icon={Lock}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Email Verification</span>
                </div>
                <VerificationDot verified={s.email_verified} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Phone Verification</span>
                </div>
                <VerificationDot verified={s.phone_verified} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Two-Factor Authentication</span>
                </div>
                {s.two_factor_enabled ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <Check className="w-3.5 h-3.5" /> Enabled
                  </span>
                ) : (
                  <button className="text-xs text-primary hover:text-primary/80 font-medium">
                    Enable
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </p>
              <button className="w-full text-left text-sm text-foreground hover:text-primary transition-colors py-1.5 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                {s.two_factor_enabled
                  ? "Disable Two-Factor Authentication"
                  : "Enable Two-Factor Authentication"}
              </button>
              <button className="w-full text-left text-sm text-foreground hover:text-primary transition-colors py-1.5 flex items-center gap-2">
                <MonitorSmartphone className="w-4 h-4" />
                Logout All Sessions
              </button>
              <button className="w-full text-left text-sm text-foreground hover:text-primary transition-colors py-1.5 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Reset Password
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
