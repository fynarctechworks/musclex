"use client";

/**
 * Public checkout dialog — collects the buyer's details, creates a Razorpay
 * order on the public checkout endpoint, opens Razorpay web Checkout, then
 * verifies the payment signature. On success shows a "membership active"
 * screen pointing at the MuscleX member app.
 */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPublicCheckout,
  formatPrice,
  verifyPublicCheckout,
  type PublicBranch,
  type PublicPlan,
} from "./api";
import { loadRazorpay, type RazorpaySuccessResponse } from "./razorpay";

type Phase = "form" | "creating" | "paying" | "verifying" | "success";

export function CheckoutDialog({
  slug,
  gymName,
  plan,
  branches,
  onClose,
}: {
  slug: string;
  gymName: string;
  plan: PublicPlan | null;
  branches: PublicBranch[];
  onClose: () => void;
}) {
  const [phase, setPhaseState] = useState<Phase>("form");
  // Razorpay callbacks fire outside React's render cycle — keep the current
  // phase in a ref so ondismiss can distinguish "closed mid-payment" from
  // "closed after the success handler already ran".
  const phaseRef = useRef<Phase>("form");
  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset state each time a plan is picked (dialog re-opens).
  useEffect(() => {
    if (plan) {
      setPhase("form");
      setError(null);
      setBranchId(plan.branch_id ?? branches[0]?.id ?? "");
    }
  }, [plan, branches]);

  const busy = phase === "creating" || phase === "paying" || phase === "verifying";

  function handleOpenChange(open: boolean) {
    // Don't allow closing mid-payment/verify — the buyer could lose the result.
    if (!open && !busy) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan) return;
    if (!fullName.trim() || !phone.trim()) {
      setError("Please fill in your name and phone number.");
      return;
    }
    if (!branchId) {
      setError("Please choose a branch.");
      return;
    }

    setError(null);
    setPhase("creating");

    try {
      const order = await createPublicCheckout(slug, {
        plan_id: plan.id,
        branch_id: branchId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      });

      const Razorpay = await loadRazorpay();
      setPhase("paying");

      const rzp = new Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount * 100, // Razorpay expects the smallest unit (paise)
        currency: order.currency,
        name: gymName,
        description: order.plan_name,
        prefill: {
          name: fullName.trim(),
          contact: phone.trim(),
          email: email.trim() || undefined,
        },
        handler: (resp: RazorpaySuccessResponse) => {
          void handleVerify(resp);
        },
        modal: {
          ondismiss: () => {
            // Buyer closed the Razorpay window without paying. If the success
            // handler already moved us past "paying", leave that flow alone.
            if (phaseRef.current === "paying") {
              setError(
                "Payment window closed — you haven't been charged. Try again when ready."
              );
              setPhase("form");
            }
          },
        },
      });

      rzp.on("payment.failed", () => {
        setError("Payment failed — you can retry with a different method.");
        setPhase("form");
      });

      rzp.open();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not start checkout. Please try again.";
      setError(message);
      setPhase("form");
      toast.error(message);
    }
  }

  async function handleVerify(resp: RazorpaySuccessResponse) {
    setPhase("verifying");
    setError(null);
    try {
      const result = await verifyPublicCheckout(slug, {
        gateway_order_id: resp.razorpay_order_id,
        gateway_payment_id: resp.razorpay_payment_id,
        signature: resp.razorpay_signature,
      });
      if (result.success) {
        setPhase("success");
        toast.success("Payment confirmed — welcome aboard!");
      } else {
        setError(result.message || "We couldn't confirm your payment. Contact the gym with your payment ID.");
        setPhase("form");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "We couldn't confirm your payment. Contact the gym with your payment ID.";
      setError(message);
      setPhase("form");
    }
  }

  const branchLocked = Boolean(plan?.branch_id);

  return (
    <Dialog open={plan !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {phase === "success" ? (
          <SuccessScreen onDone={onClose} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Join {gymName}</DialogTitle>
              <DialogDescription>
                {plan ? (
                  <>
                    {plan.name} ·{" "}
                    <span className="font-semibold text-foreground">
                      {formatPrice(plan.price, plan.currency)}
                    </span>
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="co-name">Full name *</Label>
                <Input
                  id="co-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  disabled={busy}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-phone">Phone *</Label>
                <Input
                  id="co-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  autoComplete="tel"
                  disabled={busy}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-email">Email (optional)</Label>
                <Input
                  id="co-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={busy}
                />
              </div>

              {branches.length > 1 && !branchLocked && (
                <div className="space-y-1.5">
                  <Label>Branch *</Label>
                  <Select value={branchId} onValueChange={setBranchId} disabled={busy}>
                    <SelectTrigger aria-label="Choose your branch">
                      <SelectValue placeholder="Choose your branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {branchLocked && plan?.branch_id && (
                <p className="text-xs text-muted-foreground">
                  This plan is for the{" "}
                  <span className="font-medium text-foreground">
                    {branches.find((b) => b.id === plan.branch_id)?.name ?? "selected"}
                  </span>{" "}
                  branch.
                </p>
              )}

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {phase === "creating" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Preparing payment…
                  </>
                ) : phase === "paying" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Complete payment in the window…
                  </>
                ) : phase === "verifying" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Confirming payment…
                  </>
                ) : plan ? (
                  <>Pay {formatPrice(plan.price, plan.currency)}</>
                ) : (
                  "Pay"
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Secure payment via Razorpay.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <CheckCircle2 className="h-12 w-12 text-foreground" />
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
        Membership active!
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Your payment is confirmed and your membership is live. Download the
        MuscleX member app and sign in with your phone number to check in,
        book classes and track your progress.
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-pill border border-hairline bg-canvas-soft px-4 py-2 text-xs text-muted-foreground">
        <Smartphone className="h-3.5 w-3.5" />
        Get the MuscleX member app
      </div>
      <Button size="lg" className="mt-6 w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
