import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/register",
  "/verify-email",
  "/verify-2fa",
  "/forgot-password",
  "/reset-password",
  "/workspace-select",
  "/onboarding",
  "/auth",
  "/landing",
  // PUBLIC per-gym self-serve portal (/join/[gymSlug]) — unauthenticated
  // marketing/checkout pages for gym prospects.
  "/join",
  // PUBLIC hosted checkout (/pay/[orderId]) — unauthenticated Razorpay payment
  // page opened from the member app's renewal flow (device browser hand-off).
  "/pay",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    pathname === "/" ||
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/brand") ||
    // any static file in /public (by extension) — these are public by definition
    // and must not be redirected to /login (that breaks <img>/<link> on auth pages)
    /\.(png|jpe?g|svg|gif|webp|avif|ico|css|js|map|woff2?|ttf|otf)$/i.test(pathname) ||
    pathname === "/favicon.ico"
  ) {
    const response = NextResponse.next();
    setSecurityHeaders(response);
    return response;
  }

  // All other paths are /{gymSlug}/... and require auth
  const authCookie = request.cookies.get("auth-token");

  if (!authCookie?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  setSecurityHeaders(response);
  return response;
}

function setSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // The check-in module needs `camera` for QR / Face scanning and `microphone`
  // is reserved for future RTC features. `geolocation` is used by the kiosk
  // branch resolver on tablets. All three are granted to the top-level
  // document only (`self`) — embedders cannot access them.
  //
  // IMPORTANT: this used to be `camera=()` (deny-all) which silently blocked
  // every on-device scanner with a "Permissions policy violation" in the
  // console. Be very careful about tightening this back to deny-all.
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self)"
  );

  // Baseline Content-Security-Policy. We intentionally set only the directives
  // that are safe WITHOUT a full origin inventory: these block clickjacking,
  // <base>-tag hijacking, plugin/object injection, and off-site form posts.
  // CRITICAL: do NOT add `default-src` here — its fallback would constrain
  // script-src/connect-src and break Next's inline bootstrap and the Supabase/
  // backend/map/Sentry calls. A full script-src/connect-src CSP (with a nonce and
  // an enumerated origin allowlist) is tracked as a follow-up (see AUDIT_REPORT).
  // NOTE: intentionally NO `upgrade-insecure-requests` — it rewrites http→https for
  // ALL subresource/API requests, which breaks local http dev (scripts + API calls
  // fail to load) and is a no-op in prod where everything is already https. Enforce
  // https at the edge/proxy instead (HSTS), not via CSP.
  //
  // Razorpay Checkout (used on the public /join portal): this CSP deliberately
  // sets NO script-src / frame-src / connect-src, so the dynamically injected
  // https://checkout.razorpay.com/v1/checkout.js and its api.razorpay.com
  // iframe are NOT blocked — nothing to extend today. If script-src/frame-src
  // are ever added here (the tracked follow-up above), they MUST include
  // `script-src https://checkout.razorpay.com` and
  // `frame-src https://api.razorpay.com https://checkout.razorpay.com`
  // (and connect-src must include the NEXT_PUBLIC_API_URL origin), or public
  // checkout breaks. Note: `form-action 'self'` is fine for the default modal
  // flow; only Razorpay's redirect-mode checkout (unused) would need it widened.
  response.headers.set(
    "Content-Security-Policy",
    [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
