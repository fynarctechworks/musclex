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
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    pathname === "/" ||
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
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
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
