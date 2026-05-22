"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { LoadingSkeleton , AccessDenied } from "@/components/shared";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { InvoicesSection } from "@/features/subscription/invoices-section";
import {
  ArrowLeft,
  Crown,
  CreditCard,
  Zap,
  TrendingUp,
  Calendar,
  CalendarCheck,
  Clock,
  IndianRupee,
  BarChart3,
  Building2,
  Users,
  UserCog,
  Check,
  X,
  AlertCircle,
  Dumbbell,
  Wallet,
  Bot,
  Rocket,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { CancelPlanDialog } from "@/features/subscription";

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
    grace_until?: string | null;
    locked_at?: string | null;
    days_until_expiry?: number | null;
    grace_days_remaining?: number | null;
    can_mutate?: boolean;
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

// ── Helpers ────────────────────────────────────────────────────
const FEATURE_GROUPS: Record<string, { label: string; icon: React.ElementType; keys: string[] }> = {
  core: {
    label: "Core Management",
    icon: Users,
    keys: ["member_management", "check_in", "basic_reports"],
  },
  operations: {
    label: "Operations",
    icon: Dumbbell,
    keys: ["multi_branch", "staff_management", "trainer_management", "class_scheduling"],
  },
  payments: {
    label: "Payments",
    icon: Wallet,
    keys: ["manual_payments", "payment_gateway"],
  },
  advanced: {
    label: "Advanced",
    icon: Bot,
    keys: ["marketing_campaigns", "ai_advisor", "api_access", "whatsapp_notifications", "email_campaigns", "custom_roles", "audit_logs"],
  },
};

const FEATURE_LABELS: Record<string, string> = {
  member_management: "Member Management",
  check_in: "Check-in System",
  manual_payments: "Payment Recording",
  basic_reports: "Basic Reports",
  multi_branch: "Multi-Branch",
  staff_management: "Staff Management",
  trainer_management: "Trainer Management",
  class_scheduling: "Class Scheduling",
  payment_gateway: "Payment Gateway",
  marketing_campaigns: "Marketing Campaigns",
  ai_advisor: "AI Advisor",
  api_access: "API Access",
  whatsapp_notifications: "WhatsApp Notifications",
  email_campaigns: "Email Campaigns",
  custom_roles: "Custom Roles",
  audit_logs: "Audit Logs",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd MMM yyyy");
  } catch {
    return "—";
  }
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusPill({ status }: { status: string }) {
  // Status now comes from the live-computed lifecycle:
  // active | grace_period | locked | suspended | trial | past_due
  const color =
    status === "active"
      ? "bg-success/10 text-success ring-success/20"
      : status === "trial"
        ? "bg-link/10 text-link ring-blue-500/20"
        : status === "grace_period" || status === "past_due"
          ? "bg-warning/10 text-warning ring-amber-500/20"
          : "bg-error/10 text-error ring-red-500/20"; // locked | suspended | expired
  const label = status === "grace_period" ? "Grace period" : status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ring-1 ${color}`}>
      {label}
    </span>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 px-4">
      <span className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary/70" />
        </div>
        {label}
      </span>
      <span className="text-sm text-foreground font-medium">{children}</span>
    </div>
  );
}

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary/70" />
          </div>
          {label}
        </span>
        <span
          className={`text-sm font-medium ${
            isFull ? "text-error" : isHigh ? "text-warning" : "text-foreground"
          }`}
        >
          {current.toLocaleString()}{" "}
          <span className="text-muted-foreground font-normal">
            / {max >= 99999 ? "Unlimited" : max.toLocaleString()}
          </span>
        </span>
      </div>
      <div className="h-2 bg-canvas-soft rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-slow ${
            isFull ? "bg-error" : isHigh ? "bg-warning" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Plan tiers for upgrade dialog ─────────────────────────────
const GYM_PLAN_TIERS = [
  { key: "free", name: "Free", monthly: 0, annual: 0, branches: 1, members: 50, staff: 3 },
  { key: "starter", name: "Starter", monthly: 999, annual: 9990, branches: 1, members: 200, staff: 10 },
  { key: "pro", name: "Pro", monthly: 2499, annual: 24990, branches: 5, members: 1000, staff: 50 },
  { key: "enterprise", name: "Enterprise", monthly: 4999, annual: 49990, branches: 999, members: 99999, staff: 999 },
];

// ── Component ──────────────────────────────────────────────────
export default function SubscriptionPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const { gymPath } = useGymSlug();
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const PLAN_TIERS = GYM_PLAN_TIERS;
  const canUpgrade = true;
  const [cancelOpen, setCancelOpen] = useState(false);
  // Renewal window — show plan-change UI only when the user actually needs to act.
  // Threshold: within this many days of next_billing_date, OR any non-active
  // status (past_due, expired, canceled). Must stay well below the shortest
  // billing cycle (monthly = 30 days) — otherwise a brand-new monthly plan lands
  // inside the window on day one and shows "renew" for its entire first month.
  const RENEWAL_WINDOW_DAYS = 7;
  // After a successful checkout we redirect here with ?invoice=ID so the
  // InvoicesSection can deep-link the freshly-paid receipt in the viewer.
  const focusInvoiceId = searchParams.get("invoice");

  const {
    data: account,
    isLoading,
    error,
  } = useQuery<AccountOverview>({
    queryKey: ["account-overview"],
    queryFn: () => apiClient.get("/settings/account"),
  });

  // Renew (same plan) and Switch (different plan) both navigate to the
  // dedicated checkout page so there's exactly ONE payment path — no
  // modal trap, no parallel "instant-upgrade" shortcut that drifts.
  function openPaymentFor(planKey: string, _planName: string, cycle: "monthly" | "annual") {
    router.push(
      gymPath(`/settings/subscription/checkout?plan=${encodeURIComponent(planKey)}&cycle=${cycle}`),
    );
  }


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
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2.5">
          <CreditCard className="w-7 h-7 text-primary" /> Subscription & Plan
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          View your subscription details, usage limits, and plan features
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <LoadingSkeleton className="h-36" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LoadingSkeleton className="h-80" />
            <LoadingSkeleton className="h-80" />
          </div>
          <LoadingSkeleton className="h-48" />
        </div>
      ) : error ? (
        <div className="bg-card border border-error/30 rounded-lg p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-error" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Unable to load subscription</p>
            <p className="text-xs text-muted-foreground mt-1">Please check your connection and try again.</p>
          </div>
        </div>
      ) : account ? (() => {
        // Compute whether to expose renewal / plan-change controls.
        // Owners on an active plan with > 30 days remaining don't see it —
        // the surface only appears when a renewal decision is actually due.
        const status = account.subscription.status;
        const nextBilling = account.subscription.next_billing_date
          ? new Date(account.subscription.next_billing_date)
          : null;
        const daysUntilRenewal = nextBilling
          ? Math.ceil((nextBilling.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;
        // An active subscription with no billing date is NOT "renewal due" —
        // that's a free tier or a brand-new paid gym whose period hasn't lapsed.
        // This mirrors the backend SubscriptionPolicyService, which treats
        // "no next_billing_date" as active-with-no-expiry. Only surface the
        // renewal UI when the status is non-active, OR an active plan is within
        // RENEWAL_WINDOW_DAYS of its actual billing date.
        const inRenewalWindow =
          status !== "active" ||
          (daysUntilRenewal !== null && daysUntilRenewal <= RENEWAL_WINDOW_DAYS);
        const showRenewalUI = inRenewalWindow;
        return (
        <div className="space-y-6">
          {/* ── Plan Hero Banner ──────────────────────────── */}
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-black/5">
            <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/20">
                    <Crown className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-semibold text-foreground capitalize">
                        {account.subscription.plan} Plan
                      </h2>
                      <StatusPill status={account.subscription.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account.subscription.plan_description || `Your current ${account.subscription.plan} subscription`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {account.studio.name} &middot; {user?.full_name || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-foreground">
                      {fmtCurrency(account.subscription.price, account.billing.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      per {account.subscription.billing_cycle === "annual" ? "year" : "month"}
                    </p>
                    {!showRenewalUI && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {daysUntilRenewal !== null
                          ? `Renews in ${daysUntilRenewal} days`
                          : "Active — no renewal due"}
                      </p>
                    )}
                  </div>
                  {showRenewalUI && (
                    <button
                      onClick={() => {
                        const grid = document.getElementById('plans-grid');
                        grid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all hover:shadow-level-4 hover:shadow-primary/20"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Renew or change plan
                    </button>
                  )}
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-border bg-background text-muted-foreground rounded-lg text-sm font-medium hover:bg-error-soft hover:text-error hover:border-error/30 transition-all"
                  >
                    <X className="w-4 h-4" />
                    Cancel Plan
                  </button>
                  <CancelPlanDialog
                    open={cancelOpen}
                    onOpenChange={setCancelOpen}
                    accessUntil={account.subscription.next_billing_date}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Plans Grid — only when a renewal decision is due ──── */}
          {showRenewalUI && (
          <div
            id="plans-grid"
            className="bg-card border border-border rounded-lg shadow-level-2 shadow-black/5 overflow-hidden scroll-mt-20"
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Renew or change plan
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pick the plan you want — same one to renew, or switch to a different tier
                  </p>
                </div>
              </div>
              {/* Billing toggle */}
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs ${billingCycle === "monthly" ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                >
                  Monthly
                </span>
                <button
                  type="button"
                  onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    billingCycle === "annual" ? "bg-primary" : "bg-border"
                  }`}
                  aria-label="Toggle billing cycle"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-canvas transition-transform ${
                      billingCycle === "annual" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span
                  className={`text-xs ${billingCycle === "annual" ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                >
                  Annual <span className="text-primary">(save ~17%)</span>
                </span>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PLAN_TIERS.map((tier) => {
                const isCurrent =
                  account.subscription.plan === tier.key &&
                  account.subscription.billing_cycle === billingCycle;
                const isCurrentPlanDifferentCycle =
                  account.subscription.plan === tier.key &&
                  account.subscription.billing_cycle !== billingCycle;
                const price = billingCycle === "annual" ? tier.annual : tier.monthly;
                const currentIdx = PLAN_TIERS.findIndex((t) => t.key === account.subscription.plan);
                const tierIdx = PLAN_TIERS.findIndex((t) => t.key === tier.key);
                const direction =
                  tierIdx > currentIdx ? "upgrade" : tierIdx < currentIdx ? "downgrade" : "same";

                const cta = isCurrent
                  ? "Renew this plan"
                  : direction === "upgrade"
                    ? `Switch to ${tier.name}`
                    : direction === "downgrade"
                      ? `Downgrade to ${tier.name}`
                      : `Switch to ${billingCycle === "annual" ? "Annual" : "Monthly"}`;

                const free = price === 0;

                return (
                  <div
                    key={tier.key}
                    className={`rounded-lg border p-5 flex flex-col ${
                      isCurrent
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-background hover:border-primary/40 transition-colors"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-foreground">{tier.name}</h3>
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wide rounded bg-canvas-soft-2 px-1.5 py-0.5 text-primary font-semibold">
                          Current
                        </span>
                      )}
                      {direction === "upgrade" && !isCurrent && (
                        <span className="text-[10px] uppercase tracking-wide rounded bg-success/12 px-1.5 py-0.5 text-emerald-800 font-semibold">
                          Upgrade
                        </span>
                      )}
                      {direction === "downgrade" && !isCurrent && (
                        <span className="text-[10px] uppercase tracking-wide rounded bg-warning-soft px-1.5 py-0.5 text-warning-deep font-semibold">
                          Downgrade
                        </span>
                      )}
                    </div>

                    <p className="text-2xl font-semibold text-foreground mt-2">
                      {free ? "Free" : `₹${price.toLocaleString("en-IN")}`}
                      {!free && (
                        <span className="text-xs text-muted-foreground font-normal">
                          /{billingCycle === "annual" ? "yr" : "mo"}
                        </span>
                      )}
                    </p>

                    <div className="mt-4 space-y-2 text-xs text-muted-foreground flex-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {tier.branches >= 999 ? "Unlimited" : tier.branches} branch{tier.branches !== 1 ? "es" : ""}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {tier.members >= 99999 ? "Unlimited" : tier.members.toLocaleString()} members
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UserCog className="w-3.5 h-3.5" />
                        {tier.staff >= 999 ? "Unlimited" : tier.staff} staff
                      </div>
                    </div>

                    <div className="mt-4">
                      {free ? (
                        <p className="text-[11px] text-center text-muted-foreground py-2 italic">
                          Free tier — no renewal needed
                        </p>
                      ) : (
                        <Button
                          size="sm"
                          variant={isCurrent ? "default" : direction === "downgrade" ? "outline" : "default"}
                          className="w-full text-xs"
                          onClick={() => openPaymentFor(tier.key, tier.name, billingCycle)}
                        >
                          {cta}
                        </Button>
                      )}
                      {isCurrentPlanDifferentCycle && (
                        <p className="text-[10px] text-center text-muted-foreground mt-1.5">
                          You're on {account.subscription.billing_cycle} — switch cycle?
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 pb-5 text-[11px] text-muted-foreground border-t border-border/50 pt-3 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Payment is recorded manually with a transaction reference (UPI / Card / Bank / Cash). Razorpay & Stripe gateway integration is coming soon.
            </div>
          </div>
          )}

          {/* ── Two-Column: Subscription Details + Usage ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subscription Details */}
            <div className="bg-card border border-border rounded-lg shadow-level-2 shadow-black/5 overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Subscription Details
                </h3>
              </div>
              <div className="divide-y divide-border/50">
                <DetailRow icon={Crown} label="Plan">
                  <span className="capitalize">{account.subscription.plan}</span>
                </DetailRow>
                <DetailRow icon={BarChart3} label="Status">
                  <StatusPill status={account.subscription.status} />
                </DetailRow>
                <DetailRow icon={Clock} label="Billing Cycle">
                  <span className="capitalize">{account.subscription.billing_cycle}</span>
                </DetailRow>
                <DetailRow icon={IndianRupee} label="Monthly Price">
                  {fmtCurrency(account.subscription.monthly_price, account.billing.currency)}
                </DetailRow>
                <DetailRow icon={IndianRupee} label="Annual Price">
                  {fmtCurrency(account.subscription.annual_price, account.billing.currency)}
                </DetailRow>
                <DetailRow icon={IndianRupee} label="Current Price">
                  <span className="font-semibold text-primary">
                    {fmtCurrency(account.subscription.price, account.billing.currency)}
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      /{account.subscription.billing_cycle === "annual" ? "yr" : "mo"}
                    </span>
                  </span>
                </DetailRow>
                <DetailRow icon={Calendar} label="Start Date">
                  {fmtDate(account.subscription.subscription_start)}
                </DetailRow>
                <DetailRow icon={CalendarCheck} label="Next Billing">
                  {fmtDate(account.subscription.next_billing_date)}
                </DetailRow>
                {account.subscription.trial_ends_at &&
                  new Date(account.subscription.trial_ends_at).getTime() > Date.now() && (
                    <DetailRow icon={AlertCircle} label="Trial Ends">
                      <span className="text-warning font-semibold">
                        {fmtDate(account.subscription.trial_ends_at)}
                      </span>
                    </DetailRow>
                  )}
                <DetailRow icon={Calendar} label="Studio Created">
                  {fmtDate(account.studio.created_at)}
                </DetailRow>
              </div>
            </div>

            {/* Usage & Limits */}
            <div className="bg-card border border-border rounded-lg shadow-level-2 shadow-black/5 overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Usage & Limits
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <UsageBar
                  label="Branches"
                  current={account.usage.branches.current}
                  max={account.usage.branches.max}
                  icon={Building2}
                />
                <UsageBar
                  label="Members"
                  current={account.usage.members.current}
                  max={account.usage.members.max}
                  icon={Users}
                />
                <UsageBar
                  label="Staff"
                  current={account.usage.staff.current}
                  max={account.usage.staff.max}
                  icon={UserCog}
                />
              </div>

              {/* Billing Info */}
              <div className="border-t border-border">
                <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border/50">
                  <div className="w-9 h-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Billing Info
                  </h3>
                </div>
                <div className="px-6 py-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing Name</span>
                    <span className="text-foreground">{account.billing.billing_name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing Email</span>
                    <span className="text-foreground">{account.billing.billing_email || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ID</span>
                    <span className="text-foreground">{account.billing.tax_id || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="text-foreground font-medium">{account.billing.currency}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Invoices ──────────────────────────────────── */}
          <InvoicesSection focusInvoiceId={focusInvoiceId} />

          {/* ── Plan Features ─────────────────────────────── */}
          <div className="bg-card border border-border rounded-lg shadow-level-2 shadow-black/5 overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
              <div className="w-9 h-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Plan Features
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Features included in your {account.subscription.plan} plan
                </p>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(FEATURE_GROUPS).map(([groupKey, group]) => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={groupKey}>
                      <div className="flex items-center gap-2 mb-3">
                        <GroupIcon className="w-4 h-4 text-muted-foreground" />
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {group.label}
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {group.keys.map((key) => {
                          const enabled = account.features[key];
                          return (
                            <div
                              key={key}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                                enabled
                                  ? "bg-success/5 text-foreground"
                                  : "bg-canvas-soft text-muted-foreground"
                              }`}
                            >
                              {enabled ? (
                                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                              ) : (
                                <X className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                              )}
                              <span>{FEATURE_LABELS[key] || key}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
        );
      })() : null}

    </AppLayout>
  );
}
