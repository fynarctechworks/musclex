/**
 * Public portal API — UNauthenticated fetchers for the /join/[gymSlug] pages.
 *
 * These hit the public, rate-limited backend surface (`/public/gyms/*`) with
 * plain `fetch` — deliberately NOT the authed api-client (no token, no auth
 * store, no interceptors). Safe to call from both server and client components.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

// ---------------------------------------------------------------------------
// Types (shape of the public endpoints' responses)
// ---------------------------------------------------------------------------

export interface PublicGym {
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

export interface PublicBranch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  opening_time: string | null;
  closing_time: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PublicPlan {
  id: string;
  name: string;
  description: string | null;
  plan_type: string | null;
  duration_days: number | null;
  total_classes: number | null;
  price: number;
  currency: string;
  branch_id: string | null;
  tier: string | null;
}

export interface PublicGymResponse {
  gym: PublicGym;
  branches: PublicBranch[];
  plans: PublicPlan[];
}

export interface PublicClass {
  id: string;
  name: string;
  category: string | null;
  starts_at: string;
  duration_minutes: number | null;
  branch_id: string | null;
  trainer_name: string | null;
  spots_left: number | null;
}

export interface LeadPayload {
  full_name: string;
  phone: string;
  email?: string;
  branch_id?: string;
  notes?: string;
  intent?: "enquiry" | "trial";
  preferred_date?: string; // YYYY-MM-DD
}

export interface LeadResponse {
  lead_id: string;
  status: string;
  message: string;
}

export interface CheckoutPayload {
  plan_id: string;
  branch_id: string;
  full_name: string;
  phone: string;
  email?: string;
}

export interface CheckoutOrderResponse {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  plan_name: string;
  member_id: string;
}

/**
 * Context for the hosted /pay/[orderId] page — everything the page needs to
 * open Razorpay Checkout for an already-created pending order (member-app
 * renewals hand off here via the device browser).
 */
export interface PublicCheckoutContext {
  order_id: string;
  slug: string;
  gym_name: string;
  gym_logo_url: string | null;
  amount: number; // rupees (multiply by 100 for Razorpay's paise)
  currency: string;
  plan_name: string | null;
  key_id: string;
}

export interface CheckoutVerifyPayload {
  gateway_order_id: string;
  gateway_payment_id: string;
  signature: string;
}

export interface CheckoutVerifyResponse {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

class PublicApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

/** Friendly message for a failed public-API response (rate limits included). */
async function toApiError(res: Response): Promise<PublicApiError> {
  if (res.status === 429) {
    return new PublicApiError(
      "You're going a bit fast — please wait a minute and try again.",
      429
    );
  }
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body?.message === "string") message = body.message;
    else if (Array.isArray(body?.message)) message = body.message.join(", ");
  } catch {
    // non-JSON error body — keep the generic message
  }
  return new PublicApiError(message, res.status);
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Gym landing payload. Server-component friendly (ISR, 60 s).
 * Returns `null` on 404 (unknown or suspended slug).
 */
export async function getPublicGym(
  slug: string
): Promise<PublicGymResponse | null> {
  const res = await fetch(
    `${API_BASE}/public/gyms/${encodeURIComponent(slug)}`,
    { next: { revalidate: 60 } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** Upcoming classes, optionally filtered by branch. Client-side fetch. */
export async function getPublicClasses(
  slug: string,
  branchId?: string
): Promise<PublicClass[]> {
  const qs = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : "";
  const res = await fetch(
    `${API_BASE}/public/gyms/${encodeURIComponent(slug)}/classes${qs}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** Book a trial / leave an enquiry. Rate-limited (~5/min). */
export function createPublicLead(
  slug: string,
  payload: LeadPayload
): Promise<LeadResponse> {
  return postJson(`/public/gyms/${encodeURIComponent(slug)}/leads`, payload);
}

/** Create a Razorpay order for a plan purchase. Rate-limited (~5/min). */
export function createPublicCheckout(
  slug: string,
  payload: CheckoutPayload
): Promise<CheckoutOrderResponse> {
  return postJson(`/public/gyms/${encodeURIComponent(slug)}/checkout`, payload);
}

/**
 * Order context for the hosted checkout page (/pay/[orderId]).
 * Returns `null` on 404 (unknown, expired or already-paid order).
 */
export async function getPublicCheckoutContext(
  orderId: string
): Promise<PublicCheckoutContext | null> {
  const res = await fetch(
    `${API_BASE}/public/checkout/${encodeURIComponent(orderId)}`,
    { cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

/** Verify the Razorpay payment signature after checkout completes. */
export function verifyPublicCheckout(
  slug: string,
  payload: CheckoutVerifyPayload
): Promise<CheckoutVerifyResponse> {
  return postJson(
    `/public/gyms/${encodeURIComponent(slug)}/checkout/verify`,
    payload
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers shared by the portal UI
// ---------------------------------------------------------------------------

/** "₹1,999" style price. Falls back to a plain prefix for unknown currencies. */
export function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price);
  } catch {
    return `${currency} ${price}`;
  }
}

/** "3 months" / "45 days" from a duration in days. */
export function formatDuration(days: number | null): string | null {
  if (!days || days <= 0) return null;
  if (days % 365 === 0) {
    const y = days / 365;
    return y === 1 ? "1 year" : `${y} years`;
  }
  if (days % 30 === 0) {
    const m = days / 30;
    return m === 1 ? "1 month" : `${m} months`;
  }
  return days === 1 ? "1 day" : `${days} days`;
}
