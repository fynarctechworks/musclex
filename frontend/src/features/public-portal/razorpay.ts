/**
 * Razorpay web Checkout loader — injects https://checkout.razorpay.com/v1/checkout.js
 * once and resolves when `window.Razorpay` is available. Client-only.
 */

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  amount: number; // paise
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

export type RazorpayConstructor = new (
  options: RazorpayCheckoutOptions
) => RazorpayInstance;

// NOTE: `Window.Razorpay` is already declared globally (loosely) by the admin
// finance page — we deliberately do NOT redeclare it here (TS forbids two
// differing declarations). Instead we read it through a local, precise cast.
function getRazorpay(): RazorpayConstructor | undefined {
  return (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise: Promise<RazorpayConstructor> | null = null;

/** Load checkout.js exactly once; resolves with the Razorpay constructor. */
export function loadRazorpay(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay can only load in the browser"));
  }
  const already = getRazorpay();
  if (already) return Promise.resolve(already);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    const script = existing ?? document.createElement("script");

    const fail = (message: string) => {
      loadPromise = null; // allow a retry on the next attempt
      reject(new Error(message));
    };
    const onLoad = () => {
      const ctor = getRazorpay();
      if (ctor) resolve(ctor);
      else fail("Payment window failed to initialise. Please try again.");
    };
    const onError = () => {
      script.remove();
      fail(
        "Could not load the payment window. Check your connection and try again."
      );
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return loadPromise;
}
