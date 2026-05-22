"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Smartphone, Banknote, Building2, Zap, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import type { Member, MembershipPlan, PaginatedResponse } from "@/lib/types";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useCurrency } from "@/lib/hooks/use-currency";

interface PaymentForm {
  member_id: string;
  plan_id: string;
  amount: string;
  notes: string;
}

type PaymentMethod = "cash" | "card" | "upi" | "bank_transfer" | "razorpay" | "stripe";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType; description: string }[] = [
  { value: "cash", label: "Cash", icon: Banknote, description: "Record cash payment" },
  { value: "card", label: "Card", icon: CreditCard, description: "POS card swipe" },
  { value: "upi", label: "UPI", icon: Smartphone, description: "UPI / QR transfer" },
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2, description: "NEFT / IMPS" },
  { value: "razorpay", label: "Razorpay", icon: Zap, description: "Online payment link" },
  { value: "stripe", label: "Stripe", icon: ExternalLink, description: "International card" },
];

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

export default function RecordPaymentPage() {
  const { allowed, checked } = useRequirePermission("payments", "create", "deny");
  const { gymPath } = useGymSlug();
  const CURRENCY_SYMBOL = useCurrency();
  const router = useRouter();
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const { register, handleSubmit, setValue, watch } = useForm<PaymentForm>();

  const selectedPlanId = watch("plan_id");

  const { data: members } = useQuery({
    queryKey: ["member-search-pay", memberSearch],
    queryFn: () => apiClient.get<PaginatedResponse<Member>>(`/members?search=${memberSearch}&limit=5`),
    enabled: memberSearch.length >= 2,
  });

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiClient.get<MembershipPlan[]>("/membership-plans"),
  });

  const selectedPlan = (Array.isArray(plans) ? plans : []).find((p) => p.id === selectedPlanId);

  // Auto-update amount when plan or billing cycle changes
  useEffect(() => {
    if (!selectedPlan) return;
    const amount = billingCycle === "yearly"
      ? (selectedPlan.yearly_price != null ? Number(selectedPlan.yearly_price) : Number(selectedPlan.price) * 12)
      : Number(selectedPlan.price);
    setValue("amount", String(amount));
  }, [selectedPlan, billingCycle, setValue]);

  // Manual payment methods (cash/card/upi/bank_transfer)
  const manualMutation = useMutation({
    mutationFn: (data: PaymentForm & { payment_method: string }) =>
      apiClient.post("/payments/cash", {
        member_id: data.member_id,
        branch_id: selectedMember?.branch_id,
        amount: Number(data.amount),
        payment_method: data.payment_method,
        billing_cycle: billingCycle,
        notes: data.notes,
      }),
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      router.push(gymPath("/finance/payments"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Razorpay: create order → open checkout → verify
  const handleRazorpayPayment = async (data: PaymentForm) => {
    if (!selectedMember || !data.plan_id) {
      toast.error("Please select a member and plan");
      return;
    }
    setGatewayLoading(true);
    try {
      // Load Razorpay checkout.js dynamically
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(script);
        });
      }

      // Create order
      const order = await apiClient.post<{
        order_id: string;
        amount: number;
        currency: string;
        plan_name: string;
      }>("/payments/create-order", {
        member_id: selectedMember.id,
        plan_id: data.plan_id,
        branch_id: selectedMember.branch_id,
        gateway: "razorpay",
      });

      // Open Razorpay checkout modal
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: order.amount * 100, // paise
          currency: order.currency || "INR",
          name: "MuscleX",
          description: order.plan_name,
          order_id: order.order_id,
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              await apiClient.post("/payments/verify", {
                gateway_payment_id: response.razorpay_payment_id,
                gateway_order_id: response.razorpay_order_id,
                signature: response.razorpay_signature,
                member_id: selectedMember.id,
                plan_id: data.plan_id,
                branch_id: selectedMember.branch_id,
              });
              toast.success("Payment successful!");
              router.push(gymPath("/finance/payments"));
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          prefill: {
            name: selectedMember.full_name,
            contact: selectedMember.phone,
            email: selectedMember.email || "",
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
      setGatewayLoading(false);
    }
  };

  // Stripe: create order and redirect to payment link (Stripe Checkout)
  const handleStripePayment = async (data: PaymentForm) => {
    if (!selectedMember || !data.plan_id) {
      toast.error("Please select a member and plan");
      return;
    }
    setGatewayLoading(true);
    try {
      const order = await apiClient.post<{ order_id: string; checkout_url?: string }>("/payments/create-order", {
        member_id: selectedMember.id,
        plan_id: data.plan_id,
        branch_id: selectedMember.branch_id,
        gateway: "stripe",
      });
      if (order.checkout_url) {
        window.open(order.checkout_url, "_blank");
        toast.info("Complete payment in the new tab — page will update automatically");
      } else {
        toast.info("Stripe order created. Share the payment link with the member.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create Stripe order");
    } finally {
      setGatewayLoading(false);
    }
  };

  const onSubmit = (data: PaymentForm) => {
    if (selectedMethod === "razorpay") return handleRazorpayPayment(data);
    if (selectedMethod === "stripe") return handleStripePayment(data);
    manualMutation.mutate({ ...data, payment_method: selectedMethod });
  };

  const isGateway = selectedMethod === "razorpay" || selectedMethod === "stripe";
  const isLoading = manualMutation.isPending || gatewayLoading;

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="payments" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link href={gymPath("/finance/payments")} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-xl font-semibold text-foreground mb-6">Record Payment</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-6">
        {/* Member Search */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Member</label>
          <Input
            placeholder="Search by name or phone..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="bg-background border-border text-foreground"
          />
          {members?.data?.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => { setSelectedMember(m); setValue("member_id", m.id); setMemberSearch(""); }}
              className="w-full text-left p-2 hover:bg-muted rounded text-sm text-foreground"
            >
              {m.full_name} <span className="text-muted-foreground">({m.member_code})</span>
            </button>
          ))}
          {selectedMember && (
            <p className="text-sm text-primary mt-1 font-medium">
              {selectedMember.full_name} ({selectedMember.member_code})
            </p>
          )}
          <input type="hidden" {...register("member_id", { required: true })} />
        </div>

        {/* Plan */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Membership Plan</label>
          <select
            {...register("plan_id")}
            className="w-full rounded-md border border-border bg-background text-foreground p-2 text-sm"
          >
            <option value="">Select plan</option>
            {(Array.isArray(plans) ? plans : []).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {CURRENCY_SYMBOL}{Number(p.price)}</option>
            ))}
          </select>
        </div>

        {/* Billing Cycle Toggle */}
        {selectedPlan && (
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Billing Cycle</label>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${billingCycle === "monthly" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Monthly</span>
              <button
                type="button"
                onClick={() => setBillingCycle((c) => c === "monthly" ? "yearly" : "monthly")}
                className={`relative w-10 h-6 rounded-full transition-colors ${billingCycle === "yearly" ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-canvas transition-transform ${billingCycle === "yearly" ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className={`text-sm ${billingCycle === "yearly" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Yearly{billingCycle === "yearly" && selectedPlan.yearly_price != null
                  ? ` (${CURRENCY_SYMBOL}${Number(selectedPlan.yearly_price).toLocaleString()})`
                  : billingCycle === "yearly"
                    ? ` (${CURRENCY_SYMBOL}${(Number(selectedPlan.price) * 12).toLocaleString()})`
                    : ""}
              </span>
            </div>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Amount ({CURRENCY_SYMBOL})</label>
          <Input
            type="number"
            {...register("amount", { required: true })}
            className="bg-background border-border text-foreground"
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">Payment Method</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              const active = selectedMethod === method.value;
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setSelectedMethod(method.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-canvas-soft-2 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[13px] font-medium">{method.label}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{method.description}</span>
                </button>
              );
            })}
          </div>

          {/* Gateway info banner */}
          {selectedMethod === "razorpay" && (
            <p className="mt-2 text-[12px] text-muted-foreground bg-muted rounded-md px-3 py-2">
              Razorpay checkout will open. The member can pay via card, UPI, netbanking, or wallet.
            </p>
          )}
          {selectedMethod === "stripe" && (
            <p className="mt-2 text-[12px] text-muted-foreground bg-muted rounded-md px-3 py-2">
              A Stripe Checkout link will be created for international card payments.
            </p>
          )}
        </div>

        {/* Notes (manual methods only) */}
        {!isGateway && (
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Notes</label>
            <textarea
              {...register("notes")}
              rows={2}
              className="w-full rounded-md border border-border bg-background text-foreground p-2 text-sm"
              placeholder="Receipt number, reference, etc."
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary text-primary-foreground"
        >
          {isLoading
            ? "Processing…"
            : isGateway
              ? `Pay via ${selectedMethod === "razorpay" ? "Razorpay" : "Stripe"}`
              : "Record Payment"}
        </Button>
      </form>
    </AppLayout>
  );
}
