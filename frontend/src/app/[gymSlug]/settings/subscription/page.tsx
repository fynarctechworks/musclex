"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { LoadingSkeleton } from "@/components/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
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
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
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
  const color =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
      : status === "trial"
        ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
        : status === "past_due"
          ? "bg-amber-500/10 text-amber-500 ring-amber-500/20"
          : "bg-red-500/10 text-red-500 ring-red-500/20";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ring-1 ${color}`}>
      {status.replace("_", " ")}
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
            isFull ? "text-red-500" : isHigh ? "text-amber-500" : "text-foreground"
          }`}
        >
          {current.toLocaleString()}{" "}
          <span className="text-muted-foreground font-normal">
            / {max >= 99999 ? "Unlimited" : max.toLocaleString()}
          </span>
        </span>
      </div>
      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFull ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────
export default function SubscriptionPage() {
  const { gymPath } = useGymSlug();
  const { user } = useAuthStore();

  const {
    data: account,
    isLoading,
    error,
  } = useQuery<AccountOverview>({
    queryKey: ["account-overview"],
    queryFn: () => apiClient.get("/settings/account"),
  });

  return (
    <AppLayout>
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="mb-8">
        <Link
          href={gymPath("/settings")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
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
        <div className="bg-card border border-red-500/20 rounded-xl p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Unable to load subscription</p>
            <p className="text-xs text-muted-foreground mt-1">Please check your connection and try again.</p>
          </div>
        </div>
      ) : account ? (
        <div className="space-y-6">
          {/* ── Plan Hero Banner ──────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-black/5">
            <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/20">
                    <Crown className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-bold text-foreground capitalize">
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
                    <p className="text-2xl font-bold text-foreground">
                      {fmtCurrency(account.subscription.price, account.billing.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      per {account.subscription.billing_cycle === "annual" ? "year" : "month"}
                    </p>
                  </div>
                  {account.subscription.plan !== "enterprise" && (
                    <Link
                      href={gymPath("/settings/plans")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Upgrade
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Two-Column: Subscription Details + Usage ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subscription Details */}
            <div className="bg-card border border-border rounded-2xl shadow-sm shadow-black/5 overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
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
                  <span className="font-bold text-primary">
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
                {account.subscription.trial_ends_at && (
                  <DetailRow icon={AlertCircle} label="Trial Ends">
                    <span className="text-amber-500 font-semibold">
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
            <div className="bg-card border border-border rounded-2xl shadow-sm shadow-black/5 overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
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
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
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

          {/* ── Plan Features ─────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl shadow-sm shadow-black/5 overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
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
                                  ? "bg-emerald-500/5 text-foreground"
                                  : "bg-muted/30 text-muted-foreground"
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

            {/* Upgrade banner */}
            {account.subscription.plan !== "enterprise" && (
              <div className="border-t border-border bg-primary/5 px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Need more features?
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upgrade your plan to unlock additional capabilities
                  </p>
                </div>
                <Link
                  href={gymPath("/settings/subscription")}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20"
                >
                  <TrendingUp className="w-4 h-4" />
                  View Plans
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
