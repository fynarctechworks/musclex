"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Gift,
  Copy,
  Check,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  Sparkles,
  Building2,
  ChevronRight,
  AlertCircle,
  Settings,
} from "lucide-react";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import Link from "next/link";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { AccessDenied } from "@/components/shared";

// ── Types ──────────────────────────────────────────────────────
interface ReferralStats {
  referral_code: string | null;
  subscription_expires_at: string | null;
  stats: { total: number; pending: number; rewarded: number };
  recent_rewards: Array<{
    reward_type: string;
    reward_value: { days?: number; amount?: number; currency?: string };
    applied_at: string;
    extended_to: string | null;
    referred_gym: string;
  }>;
}

interface RewardRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  conditions: Record<string, unknown>;
  rewards: Array<{ type: string; days?: number; amount?: number; currency?: string }>;
}

// ── Helpers ────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return "—"; }
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy, hh:mm a"); } catch { return "—"; }
}

function rewardLabel(r: ReferralStats["recent_rewards"][0]) {
  if (r.reward_type === "extend_subscription" || r.reward_type === "trial_extension") {
    return `+${r.reward_value?.days ?? "?"} free days`;
  }
  if (r.reward_type === "account_credit") {
    return `₹${r.reward_value?.amount ?? "?"} credit`;
  }
  return r.reward_type.replace(/_/g, " ");
}

// ── Component ──────────────────────────────────────────────────
export default function ReferralSettingsPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const { gymPath } = useGymSlug();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [freeDaysInput, setFreeDaysInput] = useState<string>("0");

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<ReferralStats>({
    queryKey: ["referral-stats"],
    queryFn: () => apiClient.get("/referrals/stats"),
  });

  const { data: rulesData } = useQuery<RewardRule[]>({
    queryKey: ["referral-rules"],
    queryFn: () => apiClient.get("/admin/referrals/rules"),
  });

  const [rewardDaysInput, setRewardDaysInput] = useState<string>("0");

  const { data: referralSettings } = useQuery<{ referral_free_days: number; referral_reward_days: number }>({
    queryKey: ["referral-settings"],
    queryFn: () => apiClient.get("/settings/referral"),
  });

  useEffect(() => {
    if (referralSettings) {
      setFreeDaysInput(String(referralSettings.referral_free_days ?? 0));
      setRewardDaysInput(String(referralSettings.referral_reward_days ?? 0));
    }
  }, [referralSettings]);

  const updateReferralMutation = useMutation({
    mutationFn: (data: { referral_free_days?: number; referral_reward_days?: number }) =>
      apiClient.patch("/settings/referral", data),
    onSuccess: () => {
      toast.success("Referral settings saved");
      queryClient.invalidateQueries({ queryKey: ["referral-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCopy = () => {
    if (!stats?.referral_code) return;
    navigator.clipboard.writeText(stats.referral_code).then(() => {
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const activeRules = (rulesData ?? []).filter((r) => r.is_active);


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
            <Gift className="w-7 h-7 text-primary" /> Referral Program
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Share your code, earn free subscription days when friends sign up
          </p>
        </div>
      </div>

      {statsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : statsError ? (
        <div className="bg-card border border-error/30 rounded-lg p-6 flex items-center gap-4">
          <AlertCircle className="w-5 h-5 text-error shrink-0" />
          <p className="text-sm text-muted-foreground">Unable to load referral data. Please try again.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Referral Code Card ───────────────────────── */}
          <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 rounded-lg p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-lg bg-canvas-soft-2 flex items-center justify-center shrink-0">
                <Gift className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-sm text-muted-foreground mb-2">Your Referral Code</p>
                <div className="flex items-center gap-3 justify-center sm:justify-start">
                  <span className="text-4xl font-semibold text-foreground tracking-widest font-mono">
                    {stats?.referral_code ?? "—"}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2.5 rounded-lg bg-canvas-soft-2 hover:bg-canvas-soft-2 transition-colors text-primary"
                    title="Copy code"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Share this code with other gym owners. When they sign up using your code and activate a plan, you earn free days.
                </p>
              </div>
            </div>
          </div>

          {/* ── Stats Row ────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Total Referred", value: stats?.stats.total ?? 0, icon: Users, color: "text-link", bg: "bg-link/10" },
              { label: "Pending Activation", value: stats?.stats.pending ?? 0, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
              { label: "Rewarded", value: stats?.stats.rewarded ?? 0, icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-lg p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Subscription Extension Status ────────────── */}
          {stats?.subscription_expires_at && (
            <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Subscription Valid Until</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your subscription (including any referral extensions) is active until{" "}
                  <span className="text-primary font-semibold">{fmtDate(stats.subscription_expires_at)}</span>
                </p>
              </div>
            </div>
          )}

          {/* ── Reward Rules (Earn section) ───────────────── */}
          {activeRules.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">What You Earn</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Free days added to your subscription per plan</p>
                </div>
              </div>
              <div className="divide-y divide-border/50">
                {activeRules.map((rule) => {
                  const reward = rule.rewards?.[0];
                  const conditions = rule.conditions as { plan_ids?: string[]; min_plan?: string };
                  const planTarget = conditions?.plan_ids?.join(", ") || conditions?.min_plan || "any plan";
                  return (
                    <div key={rule.id} className="flex items-center justify-between px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{rule.name}</p>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          When referred gym activates: <span className="capitalize font-medium text-foreground">{planTarget}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {reward?.type === "extend_subscription" || reward?.type === "trial_extension" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas-soft-2 text-primary text-sm font-semibold">
                            <Gift className="w-3.5 h-3.5" />
                            +{reward.days} free days
                          </span>
                        ) : reward?.type === "account_credit" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-sm font-semibold">
                            ₹{reward.amount} credit
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Reward History ────────────────────────────── */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
              <div className="w-9 h-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Reward History</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Subscription extensions earned from referrals</p>
              </div>
            </div>

            {!stats?.recent_rewards || stats.recent_rewards.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                  <Gift className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No rewards yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Share your referral code to start earning free subscription days
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Referred Gym</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Reward</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Applied On</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Subscription Extended To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {stats.recent_rewards.map((reward, i) => (
                      <tr key={i} className="bg-card hover:bg-canvas-soft transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-canvas-soft-2 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium text-foreground">{reward.referred_gym}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-canvas-soft-2 text-primary text-xs font-semibold">
                            <Sparkles className="w-3 h-3" />
                            {rewardLabel(reward)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {fmtDateTime(reward.applied_at)}
                        </td>
                        <td className="px-6 py-4">
                          {reward.extended_to ? (
                            <span className="text-sm font-semibold text-success">
                              {fmtDate(reward.extended_to)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Referral Configuration (Owner Settings) ──── */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Referral Settings</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure the free days awarded to new referred members</p>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Free days for referred member
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  When a new member signs up with a referral code, their membership end date is automatically extended by this many days.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={freeDaysInput}
                    onChange={(e) => setFreeDaysInput(e.target.value)}
                    className="w-28 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                {Number(freeDaysInput) > 0 && (
                  <p className="text-xs text-success mt-2">
                    Referred members will receive {freeDaysInput} bonus day{Number(freeDaysInput) !== 1 ? "s" : ""} added to their membership.
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Reward days for referrer
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  The member who shared the referral code also gets their own membership extended by this many days.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={rewardDaysInput}
                    onChange={(e) => setRewardDaysInput(e.target.value)}
                    className="w-28 rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                {Number(rewardDaysInput) > 0 && (
                  <p className="text-xs text-success mt-2">
                    Referring members will receive {rewardDaysInput} bonus day{Number(rewardDaysInput) !== 1 ? "s" : ""} added to their membership.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => updateReferralMutation.mutate({
                  referral_free_days: Number(freeDaysInput) || 0,
                  referral_reward_days: Number(rewardDaysInput) || 0,
                })}
                disabled={updateReferralMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {updateReferralMutation.isPending ? "Saving..." : "Save Referral Settings"}
              </button>
            </div>
          </div>

          {/* ── How It Works ──────────────────────────────── */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> How Referrals Work
            </h3>
            <div className="space-y-3">
              {[
                { step: "1", text: "Share your referral code with other gym owners" },
                { step: "2", text: "They sign up and enter your code during onboarding" },
                { step: "3", text: "When they activate a paid plan, you earn free subscription days" },
                { step: "4", text: "Your subscription expiry is automatically extended — no action needed" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-canvas-soft-2 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {step}
                  </span>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </AppLayout>
  );
}
