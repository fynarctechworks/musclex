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
import {
  subscriptionApi,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/features/subscription/api";

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

  // ── Load preview + account in parallel ─────────────────────
  const { data: account, isLoading: accountLoading } = useQuery<AccountOverview>({
    queryKey: ["account-overview"],
    queryFn: () => apiClient.get("/settings/account"),
  });

  const { data: preview, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ["subscription", "renewal-preview", planParam, cycleParam],
    queryFn: () =>
      subscriptionApi.getRenewalPreview({
        plan: planParam,
        billing_cycle: cycleParam,
      }),
    staleTime: 30_000,
  });

  // ── Form state ─────────────────────────────────────────────
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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

  // ── Renew mutation ─────────────────────────────────────────
  const renewMutation = useMutation({
    mutationFn: () =>
      subscriptionApi.renew({
        plan: planParam,
        billing_cycle: cycle,
        currency: preview?.currency ?? "INR",
        payment_method: method as PaymentMethod,
        payment_reference: reference.trim(),
        billing_name: billingName.trim() || undefined,
        billing_email: billingEmail.trim() || undefined,
        tax_id: taxId.trim() || undefined,
      }),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["account-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
        refresh(),
      ]);
      toast.success(
        data.plan_changed
          ? `Plan changed to ${planDisplayName}. Invoice ${data.invoice_number} recorded.`
          : `Renewal recorded. Invoice ${data.invoice_number}.`,
      );
      router.push(
        gymPath(`/settings/subscription?invoice=${encodeURIComponent(data.invoice_id)}`),
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Renewal failed. Please try again.");
      setSubmitting(false);
    },
  });

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
    if (!method) next.method = "Pick a payment method.";
    if (method && PAYMENT_METHODS.find((m) => m.value === method)?.comingSoon) {
      next.method = "That gateway isn't live yet — pick another method.";
    }
    const isGateway = method === "razorpay";
    if (!isGateway && (!reference.trim() || reference.trim().length < 3)) {
      next.reference = "Enter the transaction reference (min 3 characters).";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    if (isGateway) {
      void handleRazorpay();
    } else {
      renewMutation.mutate();
    }
  }

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  const loading = accountLoading || previewLoading;

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
            Checkout
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {preview?.plan_changed
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
      ) : previewError ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-5 text-sm">
          We couldn't load pricing for this plan. Please go back and try again.
        </div>
      ) : preview ? (
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
                    Payment method
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pay via your bank app, then record the transaction reference here.
                  </p>
                </div>
              </header>
              <div className="p-6 space-y-2">
                {PAYMENT_METHODS.map((pm) => {
                  const disabled = pm.comingSoon;
                  const active = method === pm.value;
                  return (
                    <button
                      key={pm.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setMethod(pm.value);
                        if (errors.method) setErrors({ ...errors, method: "" });
                      }}
                      className={[
                        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-canvas-soft",
                        disabled ? "opacity-50 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      <div
                        className={`mt-0.5 h-4 w-4 rounded-full border ${
                          active
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30"
                        }`}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {pm.label}
                          {pm.comingSoon && (
                            <span className="text-[10px] uppercase tracking-wide rounded bg-warning-soft px-1.5 py-0.5 text-warning-deep">
                              Coming soon
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {pm.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {errors.method && (
                  <p className="text-xs text-error">{errors.method}</p>
                )}

                {method === "razorpay" && (
                  <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                    Razorpay Checkout opens when you confirm. Pay by card, UPI,
                    netbanking or wallet — the renewal is recorded automatically
                    once payment succeeds. No manual reference needed.
                  </div>
                )}

                {method &&
                  method !== "razorpay" &&
                  !PAYMENT_METHODS.find((m) => m.value === method)?.comingSoon && (
                    <div className="mt-3">
                      <Label htmlFor="reference">
                        Transaction reference <span className="text-error">*</span>
                      </Label>
                      <Input
                        id="reference"
                        value={reference}
                        onChange={(e) => {
                          setReference(e.target.value);
                          if (errors.reference)
                            setErrors({ ...errors, reference: "" });
                        }}
                        placeholder={
                          method === "upi"
                            ? "UPI ref / UTR (e.g. 412345678901)"
                            : method === "card"
                              ? "Auth code / last 4 digits"
                              : method === "cash"
                                ? "Receipt # / cheque #"
                                : "UTR / transaction ID"
                        }
                        className="mt-1.5"
                      />
                      {errors.reference && (
                        <p className="mt-1 text-xs text-error">{errors.reference}</p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Recorded on your invoice for reconciliation.
                      </p>
                    </div>
                  )}
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
                <div className="border-t border-border pt-3 mt-3 flex items-center justify-between text-base">
                  <span className="font-semibold">Amount due</span>
                  <span className="text-2xl font-semibold text-primary">
                    ₹{preview.amount.toLocaleString("en-IN")}
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
                      {method === "razorpay" ? "Opening Razorpay…" : "Recording payment…"}
                    </>
                  ) : (
                    <>
                      {method === "razorpay" ? "Pay with Razorpay" : "Confirm payment"}
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
