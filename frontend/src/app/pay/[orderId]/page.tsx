"use client";

/**
 * Hosted checkout page — /pay/[orderId] (PUBLIC, unauthenticated).
 *
 * The member app's renewal flow creates a Razorpay order via the BFF, then
 * opens this page in the device browser. We fetch the order context from the
 * public checkout endpoint, open Razorpay web Checkout (auto-triggered once
 * on load, with a manual button as fallback/retry), verify the signature on
 * the public verify endpoint, and tell the member to return to the app.
 *
 * Payment truth is server-side (webhook + verify) — this page never activates
 * anything itself.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatPrice,
  getPublicCheckoutContext,
  verifyPublicCheckout,
  type PublicCheckoutContext,
} from "@/features/public-portal/api";
import {
  loadRazorpay,
  type RazorpaySuccessResponse,
} from "@/features/public-portal/razorpay";

type Phase =
  | "loading" // fetching order context
  | "notfound" // 404 — unknown / expired / already-paid order
  | "ready" // context loaded, waiting for the buyer to (re)open checkout
  | "paying" // Razorpay modal open
  | "verifying" // signature verify in flight
  | "success"; // verified — membership activated

export default function HostedCheckoutPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;

  const [phase, setPhaseState] = useState<Phase>("loading");
  // Razorpay callbacks fire outside React's render cycle — keep the current
  // phase in a ref so ondismiss can distinguish "closed mid-payment" from
  // "closed after the success handler already ran".
  const phaseRef = useRef<Phase>("loading");
  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  const [ctx, setCtx] = useState<PublicCheckoutContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Auto-open checkout exactly once per page load.
  const autoOpenedRef = useRef(false);

  const handleVerify = useCallback(
    async (context: PublicCheckoutContext, resp: RazorpaySuccessResponse) => {
      setPhase("verifying");
      setError(null);
      try {
        const result = await verifyPublicCheckout(context.slug, {
          gateway_order_id: resp.razorpay_order_id,
          gateway_payment_id: resp.razorpay_payment_id,
          signature: resp.razorpay_signature,
        });
        if (result.success) {
          setPhase("success");
        } else {
          setError(
            result.message ||
              "We couldn't confirm your payment. Contact your gym with your payment ID."
          );
          setPhase("ready");
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "We couldn't confirm your payment. Contact your gym with your payment ID.";
        setError(message);
        setPhase("ready");
      }
    },
    []
  );

  const openCheckout = useCallback(
    async (context: PublicCheckoutContext) => {
      setError(null);
      try {
        const Razorpay = await loadRazorpay();
        setPhase("paying");

        const rzp = new Razorpay({
          key: context.key_id,
          order_id: context.order_id,
          amount: context.amount * 100, // Razorpay expects the smallest unit (paise)
          currency: context.currency,
          name: context.gym_name,
          description: context.plan_name ?? undefined,
          handler: (resp: RazorpaySuccessResponse) => {
            void handleVerify(context, resp);
          },
          modal: {
            ondismiss: () => {
              // Buyer closed the Razorpay window without paying. If the
              // success handler already moved us past "paying", leave it be.
              if (phaseRef.current === "paying") {
                setError(
                  "Payment window closed — you haven't been charged. You can retry below."
                );
                setPhase("ready");
              }
            },
          },
        });

        rzp.on("payment.failed", () => {
          setError("Payment failed — you can retry with a different method.");
          setPhase("ready");
        });

        rzp.open();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Could not open the payment window. Please try again.";
        setError(message);
        setPhase("ready");
      }
    },
    [handleVerify]
  );

  // Fetch the order context, then auto-open checkout once.
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const context = await getPublicCheckoutContext(orderId);
        if (cancelled) return;
        if (!context) {
          setPhase("notfound");
          return;
        }
        setCtx(context);
        setPhase("ready");
        if (!autoOpenedRef.current) {
          autoOpenedRef.current = true;
          void openCheckout(context);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Could not load this payment link. Please try again."
        );
        setPhase("notfound");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, openCheckout]);

  // ------------------------------------------------------------- render

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading your payment…</p>
      </div>
    );
  }

  if (phase === "notfound") {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          This payment link isn&apos;t valid
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {error ??
            "The link may have expired or the payment was already completed. Return to the MuscleX app and start the renewal again."}
        </p>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-foreground" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Payment complete
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Your membership is activated. Return to the MuscleX app and pull to
          refresh to see your updated membership.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-pill border border-hairline bg-canvas-soft px-4 py-2 text-xs text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" />
          Back to the MuscleX member app
        </div>
      </div>
    );
  }

  // ready / paying / verifying — the compact payment card
  const busy = phase === "paying" || phase === "verifying";

  return (
    <div className="py-10">
      <div className="rounded-2xl border border-hairline bg-canvas-soft p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          {ctx?.gym_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ctx.gym_logo_url}
              alt={`${ctx.gym_name} logo`}
              className="h-16 w-16 rounded-2xl border border-hairline object-cover"
            />
          ) : null}
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            {ctx?.gym_name}
          </h1>
          {ctx?.plan_name ? (
            <p className="mt-1 text-sm text-muted-foreground">{ctx.plan_name}</p>
          ) : null}
          {ctx ? (
            <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
              {formatPrice(ctx.amount, ctx.currency)}
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          size="lg"
          className="mt-6 w-full"
          disabled={busy || !ctx}
          onClick={() => ctx && void openCheckout(ctx)}
        >
          {phase === "paying" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Complete payment in the
              window…
            </>
          ) : phase === "verifying" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Confirming payment…
            </>
          ) : (
            "Pay securely with Razorpay"
          )}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Secure payment via Razorpay. You&apos;ll be returned here when it&apos;s
          done.
        </p>
      </div>
    </div>
  );
}
