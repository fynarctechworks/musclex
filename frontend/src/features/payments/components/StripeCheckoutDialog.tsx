"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

/**
 * Stripe card checkout for international payments.
 *
 * The Stripe backend (intent creation, server-side verification, webhook) has
 * been complete for a while but had NO frontend caller — Stripe was
 * effectively dead. This mounts Stripe Elements to finish the flow.
 *
 * Stripe.js is loaded from the CDN at runtime (same approach the Razorpay
 * checkout already uses) rather than adding @stripe/stripe-js — Stripe
 * requires their hosted script for PCI scope anyway, so a bundled wrapper
 * would still fetch it.
 */

interface StripeIntentResponse {
  payment_intent_id: string;
  client_secret: string;
  publishable_key: string;
  amount: number;
  currency: string;
  plan_name: string;
}

// Minimal shapes for the bits of Stripe.js we touch.
interface StripeCardElement {
  mount: (el: HTMLElement) => void;
  unmount: () => void;
  on: (event: string, cb: (e: { error?: { message?: string } }) => void) => void;
}
interface StripeElements {
  create: (type: "card", opts?: Record<string, unknown>) => StripeCardElement;
}
interface StripeInstance {
  elements: () => StripeElements;
  confirmCardPayment: (
    clientSecret: string,
    data: { payment_method: { card: StripeCardElement } },
  ) => Promise<{
    error?: { message?: string };
    paymentIntent?: { id: string; status: string };
  }>;
}
declare global {
  interface Window {
    Stripe?: (key: string) => StripeInstance;
  }
}

async function loadStripeJs(): Promise<void> {
  if (window.Stripe) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.stripe.com/v3/"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Stripe.js")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Stripe.js"));
    document.body.appendChild(script);
  });
}

interface StripeCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Payload for POST /payments/create-stripe-intent. */
  /** Exactly one of plan_id (membership purchase) or invoice_id (collect a bill). */
  order: {
    member_id: string;
    plan_id?: string;
    invoice_id?: string;
    branch_id: string;
  } | null;
  onSuccess: () => void;
}

export function StripeCheckoutDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: StripeCheckoutDialogProps) {
  const cardMountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<StripeInstance | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);

  const [intent, setIntent] = useState<StripeIntentResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "preparing" | "ready" | "paying">("idle");
  const [cardError, setCardError] = useState<string | null>(null);

  // Create the intent + mount Elements when the dialog opens.
  useEffect(() => {
    if (!open || !order) return;
    let cancelled = false;

    (async () => {
      setStatus("preparing");
      setCardError(null);
      try {
        const res = await apiClient.post<StripeIntentResponse>(
          "/payments/create-stripe-intent",
          { ...order, gateway: "stripe" },
          { headers: { "Idempotency-Key": crypto.randomUUID() } },
        );
        if (cancelled) return;
        setIntent(res);

        await loadStripeJs();
        if (cancelled) return;
        if (!window.Stripe) throw new Error("Stripe.js unavailable");
        if (!res.publishable_key) {
          throw new Error(
            "No Stripe publishable key configured. Add one under Settings → Payment gateways.",
          );
        }

        const stripe = window.Stripe(res.publishable_key);
        stripeRef.current = stripe;
        const card = stripe.elements().create("card", { hidePostalCode: true });
        card.on("change", (e) => setCardError(e.error?.message ?? null));
        cardRef.current = card;
        // Mount after paint so the dialog's node exists.
        requestAnimationFrame(() => {
          if (cardMountRef.current) card.mount(cardMountRef.current);
        });
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setStatus("idle");
        toast.error(err instanceof Error ? err.message : "Could not start Stripe checkout");
        onOpenChange(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        cardRef.current?.unmount();
      } catch {
        /* already unmounted */
      }
      cardRef.current = null;
      stripeRef.current = null;
      setIntent(null);
      setStatus("idle");
    };
  }, [open, order, onOpenChange]);

  const pay = async () => {
    if (!stripeRef.current || !cardRef.current || !intent) return;
    setStatus("paying");
    try {
      const result = await stripeRef.current.confirmCardPayment(intent.client_secret, {
        payment_method: { card: cardRef.current },
      });

      if (result.error) {
        setCardError(result.error.message ?? "Card was declined");
        setStatus("ready");
        return;
      }

      // NEVER trust the client result — the server re-reads the intent from
      // Stripe and only then claims pending→paid and grants the membership.
      await apiClient.post("/payments/verify-stripe", {
        payment_intent_id: intent.payment_intent_id,
      });

      toast.success("Payment successful");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setStatus("ready");
      toast.error(err instanceof Error ? err.message : "Payment verification failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Pay by card{intent?.plan_name ? ` — ${intent.plan_name}` : ""}
          </DialogTitle>
        </DialogHeader>

        {status === "preparing" ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure checkout…
          </div>
        ) : (
          <div className="space-y-4">
            {intent && (
              <p className="text-sm text-muted-foreground">
                Amount:{" "}
                <span className="font-medium text-foreground">
                  {intent.currency} {Number(intent.amount).toLocaleString()}
                </span>
              </p>
            )}

            {/* Stripe Elements mounts the card field here */}
            <div
              ref={cardMountRef}
              className="rounded-md border border-border bg-background p-3 min-h-[44px]"
            />

            {cardError && <p className="text-sm text-destructive">{cardError}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground"
                disabled={status !== "ready"}
                onClick={pay}
              >
                {status === "paying" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Processing…
                  </>
                ) : (
                  "Pay now"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
