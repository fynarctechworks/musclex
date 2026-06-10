# Phase 8.8 — Security Audit (Findings Report)

**Date:** 2026-06-07 • **Scope:** backend API security posture, authz matrix, tenant isolation, residual DB advisor WARNs. **Method:** static inspection + live advisors. Frontend/SCC app-level authz is a separate slice (noted).

---

## Verdict: backend security posture is **production-grade**. No unauthenticated privileged endpoints found.

### Global controls (verified in [main.ts](../../backend/src/main.ts) + [app.module.ts](../../backend/src/app.module.ts))
| Control | Status |
|---|---|
| `helmet()` security headers | ✅ |
| `compression()` | ✅ |
| Body size limit 1MB + `rawBody` captured for webhook HMAC | ✅ |
| Global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`) | ✅ |
| Global `StripSecretsInterceptor` (APP_INTERCEPTOR) | ✅ |
| Global `EnhancedThrottlerGuard` + Redis storage (rate limiting) | ✅ |
| Global `SubscriptionLockGuard` (LOCKED/SUSPENDED tenants read-only) | ✅ |
| CORS from `CORS_ORIGINS` env, credentials, explicit methods/headers | ✅ |
| Required-env validation at boot (+ prod-only: CORS, 2FA key, Razorpay webhook secret) → `process.exit(1)` if missing | ✅ |
| Sentry global filter (when DSN set) | ✅ |

### Authorization matrix
- **76 controllers; 72 apply `@UseGuards` explicitly.** The 4 without are all accounted for:
  - `app.controller` — `health` (public) + `debug/sentry-test` (already gated behind `ENABLE_SENTRY_DEBUG`, 404 by default).
  - `member/auth/member-auth.controller` — OTP login (intentionally public, like `auth/*`).
  - `onboarding/onboarding-plans.controller` — public plan listing (pre-signup pricing).
  - `onboarding/internal.controller` — protected by `x-internal-secret` header check (fails closed if `INTERNAL_API_SECRET` unset).
  - `check-ins/devices/device-checkin.controller` — protected by **device-auth middleware** (kiosk API key), not a Nest guard.
  - `common/observability/observability.controller` — client error-report sink, intentionally pre-auth, covered by the global throttler.
- **Member BFF JWT separation (CLAUDE.md requirement) — VERIFIED.** `MemberJwtGuard` requires `aud=member`; `@MemberDataController()` = `MemberJwtGuard + GymMemberGuard` (gym-only, public users 403), public variant = `MemberJwtGuard` only. Staff/Supabase tokens cannot be replayed on member routes.

### Tenant isolation
- Single source of truth (`tenant-models.ts`) feeds both the load-bearing `$use` middleware and the `$extends` client (drift-proof). ✅
- Member-BFF raw SQL reviewed: the one cross-tenant raw query (`member-directory.backfill`) is a **documented maintenance path** (not request-reachable); discovery queries (`member-discovery`) read intentionally-public `studios`/plans for gym discovery. No per-request member raw query returns another identity's gym-private rows. ✅
- 🔴→✅ The critical anon/PostgREST exposure (24 tables) was closed in Phase 8.1 / migration `phase8_s1_close_anon_public_table_exposure`. `get_advisors security`: 26 ERROR → 0.

---

## Residual items (non-blocking for UAT; need approval — DB/config hard-gates)

| # | Item | Severity | Recommendation |
|---|---|---|---|
| W1 | `auth_leaked_password_protection` disabled (Supabase Auth) | low | Toggle ON in Supabase Auth dashboard (HaveIBeenPwned check). Config change — your action. |
| W2 | `function_search_path_mutable` on `public.enable_tenant_rls` | low | `ALTER FUNCTION ... SET search_path = pg_catalog, public`. Part of Phase-B RLS keystone; needs approval (DB fn change). |
| W3 | `extension_in_public` (`vector`) | low | Move to a dedicated schema — **risky** (pgvector references in biometric/face code). Defer; do NOT auto-apply. |
| N1 | `internal.controller` secret compare not timing-safe | very low | Use `crypto.timingSafeEqual`. Trivial code fix, batchable. |
| N2 | Backend test coverage thin (17 specs / 150 services) | medium (post-UAT) | Add tests for payment, referral reward/clawback, and tenant-isolation guards before scaling past beta. |

**Not yet audited (separate slices):** frontend (admin) + SCC app-level route authz; `platform/webhooks` + integrations HMAC surface (flagged in CLAUDE.md as not-yet-audited).

---
*No code or DB state changed by this slice (the debug endpoint was already gated; residual fixes await approval).*
