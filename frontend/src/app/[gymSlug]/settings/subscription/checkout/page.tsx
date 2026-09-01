"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSkeleton, AccessDenied } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useSubscription } from "@/features/subscription/subscription-provider";
import { subscriptionApi } from "@/features/subscription/api";

interface AccountOverview {
  studio: { name: string };
  billing: {
    billing_name: string | null;
    billing_email: string | null;
    billing_address: string | null;
    tax_id: string | null;
    currency: string;
  };
}

/**
 * Dedicated checkout surface for subscription renewal and plan switches.
 *
 * Why a full page, not a modal:
 *   - Mobile users can scroll naturally, not fight a clipped dialog.
 *   - The URL itself is the renewal intent — refreshable, sharable with support.
 *   - We can collect billing info (Billing Name / Email / Tax ID) inline
 *     without nesting another modal inside the payment modal.
 *
 * Query params drive intent:
 *   ?plan=pro&cycle=annual
 *
 * Defaults to the studio's current plan + monthly if either is missing.
 */
export default function SubscriptionCheckoutPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const { gymPath } = useGymSlug();
  const { refresh } = useSubscription();
  const gymSlug = (params?.gymSlug as string) || "";

  const planParam = search.get("plan") || undefined;
  const cycleParam = (search.get("cycle") as "monthly" | "annual" | null) || undefined;
  // intent=change → mid-cycle plan change. The SERVER decides the mode:
  // prorated-immediate (upgrade), scheduled (downgrade / cycle switch), or
  // renewal_due (no active paid period → plain renewal flow below).
  const isChangeIntent = search.get("intent") === "change" && !!planParam;

  // ── Load preview + account in parallel ─────────────────────
  const { data: account, isLoading: accountLoading } = useQuery<AccountOverview>({
    queryKey: ["account-overview"],
    queryFn: () => apiClient.get("/settings/account"),
  });

  const {
    data: changePreview,
    isLoading: changeLoading,
    error: changeError,
  } = useQuery({
    queryKey: ["subscription", "change-preview", planParam, cycleParam],
    queryFn: () =>
      subscriptionApi.getChangePlanPreview({
        plan: planParam!,
        billing_cycle: cycleParam,
      }),
    enabled: isChangeIntent,
    staleTime: 30_000,
  });

  const changeMode = isChangeIntent ? (changePreview?.mode ?? null) : null;
  const isProrated = changeMode === "immediate_prorated";
  const isScheduled = changeMode === "scheduled";
  // Plain renewal flow: direct renewals, and change intents the server bounced
  // back because no paid period is active (proration doesn't apply there).
  const useRenewalFlow = !isChangeIntent || changeMode === "renewal_due";

  const { data: preview, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ["subscription", "renewal-preview", planParam, cycleParam],
    queryFn: () =>
      subscriptionApi.getRenewalPreview({
        plan: planParam,
        billing_cycle: cycleParam,
      }),
    enabled: useRenewalFlow,
    staleTime: 30_000,
  });

  // ── Form state ─────────────────────────────────────────────
  // Payment is gateway-only (Razorpay Checkout) — this is a remote SaaS
  // payment, so unverifiable manual modes (cash / self-typed UTR) don't exist.
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ── Coupon (platform codes created in the SaaS Control Center) ──
  // The applied discount here is display-only: create-order re-resolves the
  // code server-side, so the charged amount never comes from this state.
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    name: string | null;
    discount_amount: number;
    covers_full_amount: boolean;
    subtotal: number;
    gst_amount: number;
    gst_label: string;
    gst_percent: number;
    total: number;
  } | null>(null);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCheckingCoupon(true);
    setCouponError("");
    try {
      const r = await subscriptionApi.validateCoupon({
        code,
        plan: planParam ?? undefined,
        billing_cycle: cycleParam,
      });
      setAppliedCoupon({
        code: r.coupon_code ?? code.toUpperCase(),
        name: r.coupon_name,
        discount_amount: r.discount_amount,
        covers_full_amount: r.covers_full_amount,
        subtotal: r.subtotal,
        gst_amount: r.gst_amount,
        gst_label: r.gst_label,
        gst_percent: r.gst_percent,
        total: r.total,
      });
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(
        err instanceof Error ? err.message : "Could not apply this coupon.",
      );
    } finally {
      setCheckingCoupon(false);
    }
  };

  const clearCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  /** Nothing left to pay — the CTA activates directly instead of paying. */
  const isFreeActivation = !isProrated && !!appliedCoupon?.covers_full_amount;

  // Hydrate billing fields once account loads. We DON'T overwrite a user's
  // in-flight edits if the query refetches later — only seed on first load.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!hydrated && account) {
      setBillingName(account.billing.billing_name ?? account.studio.name ?? "");
      setBillingEmail(account.billing.billing_email ?? "");
      setTaxId(account.billing.tax_id ?? "");
      setHydrated(true);
    }
  }, [account, hydrated]);

  // Effective values used for the renewal call.
  const planDisplayName = useMemo(() => {
    if (!planParam) return "Subscription";
    return planParam.charAt(0).toUpperCase() + planParam.slice(1);
  }, [planParam]);

  const cycle: "monthly" | "annual" = cycleParam ?? "monthly";

  // ── Scheduled change (downgrade / cycle switch) — no payment ──
  const scheduleMutation = useMutation({
    mutationFn: () =>
      subscriptionApi.changePlan({
        plan: planParam!,
        billing_cycle: cycleParam,
      }),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["account-overview"] }),
        refresh(),
      ]);
      toast.success(
        data.effective_at
          ? `Plan change scheduled for ${format(new Date(data.effective_at), "d MMM yyyy")}.`
          : "Plan change scheduled.",
      );
      router.push(gymPath("/settings/subscription"));
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not schedule the plan change.");
      setSubmitting(false);
    },
  });

  // ── Prorated upgrade via Razorpay: change order → Checkout → verify ──
  // verify routes on the server-set order notes (kind=plan_change), so the
  // same verify endpoint applies the upgrade without moving the billing date.
  const handleRazorpayChange = async () => {
    try {
      if (!(window as { Razorpay?: unknown }).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(s);
        });
      }

      const order = await subscriptionApi.createChangePlanOrder({
        plan: planParam!,
        billing_cycle: cycleParam,
      });

      await new Promise<void>((resolve, reject) => {
        const RazorpayCtor = (
          window as unknown as {
            Razorpay: new (o: Record<string, unknown>) => { open(): void };
          }
        ).Razorpay;
        const rzp = new RazorpayCtor({
          key: order.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: order.amount * 100, // paise
          currency: order.currency || "INR",
          name: account?.studio.name || "MuscleX",
          description: `Prorated upgrade · ${order.plan_display_name}`,
          order_id: order.order_id,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const result = await subscriptionApi.verifyPayment({
                gateway_order_id: response.razorpay_order_id,
                gateway_payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                billing_name: billingName.trim() || undefined,
                billing_email: billingEmail.trim() || undefined,
                tax_id: taxId.trim() || undefined,
              });
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["subscription"] }),
                queryClient.invalidateQueries({ queryKey: ["account-overview"] }),
                queryClient.invalidateQueries({ queryKey: ["settings"] }),
                queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
                refresh(),
              ]);
              toast.success(
                `Upgrade successful. Invoice ${result.invoice_number}.`,
              );
              router.push(
                gymPath(
                  `/settings/subscription?invoice=${encodeURIComponent(result.invoice_id)}`,
                ),
              );
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          prefill: {
            name: billingName || account?.studio.name || "",
            email: billingEmail || "",
          },
          theme: { color: "#4A9FD4" },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        });
        rzp.open();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Coupon covers the whole amount — activate directly, no gateway. The server
  // re-resolves the coupon and refuses unless the total is genuinely zero, so
  // this path cannot be used to skip a partial payment.
  const handleFreeActivation = async () => {
    try {
      const result = await subscriptionApi.redeemCoupon({
        code: appliedCoupon!.code,
        plan: planParam,
        billing_cycle: cycle,
        billing_name: billingName.trim() || undefined,
        billing_email: billingEmail.trim() || undefined,
        tax_id: taxId.trim() || undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["account-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
        refresh(),
      ]);
      toast.success(
        `Subscription activated with coupon ${appliedCoupon!.code}. Invoice ${result.invoice_number}.`,
      );
      router.push(
        gymPath(
          `/settings/subscription?invoice=${encodeURIComponent(result.invoice_id)}`,
        ),
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Could not activate with this coupon.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Razorpay: create order → open Checkout → verify (records the renewal).
  const handleRazorpay = async () => {
    try {
      if (!(window as { Razorpay?: unknown }).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(s);
        });
      }

      const order = await subscriptionApi.createOrder({
        plan: planParam,
        billing_cycle: cycle,
        coupon_code: appliedCoupon?.code,
      });

      await new Promise<void>((resolve, reject) => {
        const RazorpayCtor = (
          window as unknown as {
            Razorpay: new (o: Record<string, unknown>) => { open(): void };
          }
        ).Razorpay;
        const rzp = new RazorpayCtor({
          key: order.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: order.amount * 100, // paise
          currency: order.currency || "INR",
          name: account?.studio.name || "MuscleX",
          description: `${order.plan_display_name} · ${cycle === "annual" ? "Annual" : "Monthly"}`,
          order_id: order.order_id,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const result = await subscriptionApi.verifyPayment({
                gateway_order_id: response.razorpay_order_id,
                gateway_payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                billing_name: billingName.trim() || undefined,
                billing_email: billingEmail.trim() || undefined,
                tax_id: taxId.trim() || undefined,
              });
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["subscription"] }),
                queryClient.invalidateQueries({ queryKey: ["account-overview"] }),
                queryClient.invalidateQueries({ queryKey: ["settings"] }),
                queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
                refresh(),
              ]);
              toast.success(`Payment successful. Invoice ${result.invoice_number}.`);
              router.push(
                gymPath(
                  `/settings/subscription?invoice=${encodeURIComponent(result.invoice_id)}`,
                ),
              );
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          prefill: {
            name: billingName || account?.studio.name || "",
            email: billingEmail || "",
          },
          theme: { color: "#4A9FD4" },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        });
        rzp.open();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  function handleSubmit() {
    const next: Record<string, string> = {};
    if (!billingName.trim()) next.billing_name = "Billing name is required.";
    if (
      billingEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim())
    ) {
      next.billing_email = "Enter a valid email address.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    // A coupon covering the whole amount activates directly — opening Razorpay
    // for a ₹0 order would fail. Proration still goes through the gateway;
    // coupons don't apply to mid-cycle upgrades.
    if (!isProrated && appliedCoupon?.covers_full_amount) {
      void handleFreeActivation();
      return;
    }
    void (isProrated ? handleRazorpayChange() : handleRazorpay());
  }

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  const loading =
    accountLoading ||
    (isChangeIntent && changeLoading) ||
    (useRenewalFlow && previewLoading);
  const loadError =
    (isChangeIntent && changeError) || (useRenewalFlow && previewError);

  return (
    <AppLayout>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push(gymPath("/settings/subscription"))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-canvas-soft transition-colors"
          aria-label="Back to subscription"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2.5">
            <Wallet className="h-7 w-7 text-primary" />
            {isScheduled ? "Schedule plan change" : "Checkout"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isProrated && changePreview
              ? `Upgrading to ${changePreview.target.display_name} — prorated mid-cycle`
              : isScheduled && changePreview
                ? `Switching to ${changePreview.target.display_name} at your next renewal`
                : preview?.plan_changed
                  ? `Switching to ${planDisplayName} · ${cycle === "annual" ? "Annual" : "Monthly"}`
                  : `Renewing ${planDisplayName} · ${cycle === "annual" ? "Annual" : "Monthly"}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-5">
          <LoadingSkeleton className="h-40" />
          <LoadingSkeleton className="h-64" />
          <LoadingSkeleton className="h-48" />
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-5 text-sm">
          We couldn't load pricing for this plan. Please go back and try again.
        </div>
      ) : isScheduled && changePreview ? (
        /* ── Scheduled change: no payment — confirm and done ─── */
        <div className="max-w-xl">
          <section className="rounded-lg border border-border bg-card overflow-hidden">
            <header className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
              <div className="h-9 w-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Nothing to pay today
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {changePreview.change_type === "downgrade"
                    ? "Downgrades apply at the end of your paid period — you keep what you paid for."
                    : "This change applies at the end of your current billing period."}
                </p>
              </div>
            </header>
            <div className="px-6 py-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current plan</span>
                <span className="font-semibold">
                  {changePreview.current.display_name} ·{" "}
                  {changePreview.current.billing_cycle === "annual" ? "Annual" : "Monthly"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stays active until</span>
                <span>
                  {changePreview.effective_at
                    ? format(new Date(changePreview.effective_at), "d MMM yyyy")
                    : "—"}
                </span>
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-muted-foreground">New plan from then</span>
                <span className="font-semibold text-primary">
                  {changePreview.target.display_name} — ₹
                  {changePreview.target.price.toLocaleString("en-IN")}/
                  {changePreview.target.billing_cycle === "annual" ? "yr" : "mo"}
                </span>
              </div>
              {changePreview.pending_change && (
                <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning-soft p-2.5 text-xs text-warning-deep">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div>
                    This replaces your previously scheduled change to{" "}
                    <span className="capitalize font-semibold">
                      {changePreview.pending_change.target_plan}
                    </span>
                    .
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Your next renewal bills the new plan's full price. You can cancel
                this scheduled change any time before it takes effect.
              </p>
            </div>
            <div className="px-6 pb-6">
              <Button
                className="w-full"
                size="lg"
                disabled={submitting || scheduleMutation.isPending}
                onClick={() => {
                  setSubmitting(true);
                  scheduleMutation.mutate();
                }}
              >
                {submitting || scheduleMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scheduling…
                  </>
                ) : (
                  <>
                    Confirm scheduled change
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="mt-3 text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                No charge now — the change is recorded in your subscription history.
              </p>
            </div>
          </section>
        </div>
      ) : (isProrated && changePreview) || preview ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── LEFT: form ─────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Billing info */}
            <section className="rounded-lg border border-border bg-card overflow-hidden">
              <header className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
                <div className="h-9 w-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Billing information
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    These details appear on every invoice we generate for you.
                  </p>
                </div>
              </header>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="billing-name">
                    Billing name <span className="text-error">*</span>
                  </Label>
                  <Input
                    id="billing-name"
                    value={billingName}
                    onChange={(e) => {
                      setBillingName(e.target.value);
                      if (errors.billing_name) setErrors({ ...errors, billing_name: "" });
                    }}
                    placeholder="Business or legal name"
                    className="mt-1.5"
                  />
                  {errors.billing_name && (
                    <p className="mt-1 text-xs text-error">{errors.billing_name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="billing-email">Billing email</Label>
                  <Input
                    id="billing-email"
                    type="email"
                    value={billingEmail}
                    onChange={(e) => {
                      setBillingEmail(e.target.value);
                      if (errors.billing_email)
                        setErrors({ ...errors, billing_email: "" });
                    }}
                    placeholder="billing@yourgym.com"
                    className="mt-1.5"
                  />
                  {errors.billing_email && (
                    <p className="mt-1 text-xs text-error">{errors.billing_email}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Receipt + invoice link goes here.
                  </p>
                </div>
                <div>
                  <Label htmlFor="tax-id">Tax ID / GSTIN</Label>
                  <Input
                    id="tax-id"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Optional. Shown on the invoice if provided.
                  </p>
                </div>
              </div>
            </section>

            {/* Payment method */}
            <section className="rounded-lg border border-border bg-card overflow-hidden">
              <header className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
                <div className="h-9 w-9 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Payment
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Secure online payment via Razorpay Checkout.
                  </p>
                </div>
              </header>
              <div className="p-6 space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-primary bg-primary/5 ring-1 ring-primary p-3">
                  <div className="mt-0.5 h-4 w-4 rounded-full border border-primary bg-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Razorpay Checkout</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Pay by card, UPI, netbanking or wallet — all inside the
                      secure Razorpay window.
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-canvas-soft p-3 text-xs text-muted-foreground">
                  Razorpay Checkout opens when you confirm. Your subscription is
                  activated automatically the moment the payment succeeds — no
                  references to type, nothing to reconcile.
                </div>
              </div>
            </section>
          </div>

          {/* ── RIGHT: order summary ───────────────────────── */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-lg border border-border bg-card overflow-hidden">
              <header className="px-6 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Order summary
                </h2>
              </header>
              {isProrated && changePreview ? (
                /* ── Prorated upgrade breakdown ─────────────── */
                <div className="px-6 py-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Upgrading to</span>
                    <span className="font-semibold">
                      {changePreview.target.display_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Days left in period</span>
                    <span>
                      {changePreview.proration?.remaining_days} of{" "}
                      {changePreview.proration?.total_days}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {changePreview.target.display_name} for remaining days
                    </span>
                    <span>
                      ₹{(changePreview.proration?.remaining_cost ?? 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Credit for unused {changePreview.current.display_name}
                    </span>
                    <span className="text-success">
                      −₹{(changePreview.proration?.unused_credit ?? 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  {changePreview.gst_amount > 0 && (
                    <>
                      <div className="flex items-center justify-between border-t border-border pt-3">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>₹{changePreview.subtotal.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {changePreview.gst_label} ({changePreview.gst_percent}%)
                        </span>
                        <span>₹{changePreview.gst_amount.toLocaleString("en-IN")}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t border-border pt-3 mt-3 flex items-center justify-between text-base">
                    <span className="font-semibold">Pay now</span>
                    <span className="text-2xl font-semibold text-primary">
                      ₹{changePreview.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 rounded border border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                    <div>
                      Your billing date doesn't move — the upgrade applies
                      instantly and your next renewal
                      {changePreview.current.period_end
                        ? ` on ${format(new Date(changePreview.current.period_end), "d MMM yyyy")}`
                        : ""}{" "}
                      bills the full {changePreview.target.display_name} price.
                    </div>
                  </div>
                </div>
              ) : preview ? (
                <div className="px-6 py-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-semibold">{planDisplayName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Billing cycle</span>
                    <span>{cycle === "annual" ? "Annual" : "Monthly"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">New period</span>
                    <span className="text-right">
                      {format(new Date(preview.period_start), "d MMM")} —{" "}
                      {format(new Date(preview.period_end), "d MMM yyyy")}
                    </span>
                  </div>
                  {/* ── Coupon (SCC platform codes) ── */}
                  <div className="border-t border-border pt-3">
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium">
                            Coupon {appliedCoupon.code} applied
                          </div>
                          {appliedCoupon.name && (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {appliedCoupon.name}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={clearCoupon}
                          className="shrink-0 text-[11px] text-muted-foreground underline hover:text-foreground"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="coupon-code"
                          className="text-xs text-muted-foreground"
                        >
                          Have a coupon?
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="coupon-code"
                            value={couponInput}
                            onChange={(e) => {
                              setCouponInput(e.target.value.toUpperCase());
                              if (couponError) setCouponError("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                applyCoupon();
                              }
                            }}
                            placeholder="Enter code"
                            className="h-9 flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9"
                            disabled={!couponInput.trim() || checkingCoupon}
                            onClick={applyCoupon}
                          >
                            {checkingCoupon ? "Checking…" : "Apply"}
                          </Button>
                        </div>
                        {couponError && (
                          <p className="text-[11px] text-error">{couponError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {((preview.gst_amount ?? 0) > 0 || appliedCoupon) && (
                    <>
                      <div className="flex items-center justify-between border-t border-border pt-3">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>
                          {/* Pre-discount list price, so the discount line below
                              reads as a subtraction from it. */}
                          ₹
                          {(appliedCoupon
                            ? appliedCoupon.subtotal + appliedCoupon.discount_amount
                            : (preview.subtotal ?? 0)
                          ).toLocaleString("en-IN")}
                        </span>
                      </div>
                      {appliedCoupon && (
                        <div className="flex items-center justify-between text-success">
                          <span>Discount ({appliedCoupon.code})</span>
                          <span>
                            −₹
                            {appliedCoupon.discount_amount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {(appliedCoupon?.gst_label ?? preview.gst_label ?? "GST")} (
                          {appliedCoupon?.gst_percent ?? preview.gst_percent ?? 0}%)
                        </span>
                        <span>
                          ₹
                          {(
                            appliedCoupon?.gst_amount ??
                            preview.gst_amount ??
                            0
                          ).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="border-t border-border pt-3 mt-3 flex items-center justify-between text-base">
                    <span className="font-semibold">Amount due</span>
                    <span className="text-2xl font-semibold text-primary">
                      ₹
                      {(appliedCoupon?.total ?? preview.amount).toLocaleString(
                        "en-IN",
                      )}
                    </span>
                  </div>
                  {preview.days_lost_to_continuity > 0 && (
                    <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning-soft p-2.5 text-xs text-warning-deep">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div>
                        Late renewal — {preview.days_lost_to_continuity} day
                        {preview.days_lost_to_continuity === 1 ? "" : "s"} of
                        paid time will not roll forward (continuity-strict).
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
              <div className="px-6 pb-6">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isFreeActivation ? "Activating…" : "Opening Razorpay…"}
                    </>
                  ) : (
                    <>
                      {isFreeActivation
                        ? "Activate subscription"
                        : "Pay with Razorpay"}
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="mt-3 text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" />
                  Invoice generated immediately on confirmation.
                </p>
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </AppLayout>
  );
}
