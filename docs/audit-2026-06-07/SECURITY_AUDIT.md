# MuscleX — Security Audit
**Date:** 2026-06-07 · **Branch:** `feat/member-bff-phase0` · **Method:** static code inspection + live Supabase security advisors. **Read-only:** no code, DB, or config was changed by this audit.

> **Reconciliation note (avoids duplication).** This report *extends* the existing [`PHASE_8.8_SECURITY_AUDIT.md`](../phase-8-launch/PHASE_8.8_SECURITY_AUDIT.md) and the tenant-isolation work in `MASTER_PROJECT_DOCUMENTATION.md`, rather than restating it. Where 8.8 already verified a control, it is cited as **[8.8 ✓]** and not re-litigated. New ground covered here: file uploads, XSS/CSRF, secrets-on-disk, SCC frontend authz, platform-webhook signing direction, the new `public.app_user*` surface (shipped 2026-06-07), and a live advisor re-check.

---

## Verdict

**Backend security posture is production-grade.** Live security advisors show **0 ERROR-level** findings. The historic critical (24-table anon/PostgREST exposure) remains closed, and the brand-new public-app-user tables shipped today are correctly locked down. No Critical or High issues were found in this pass. Open items are **Medium and below**, dominated by *config toggles*, *defense-in-depth hardening*, and *test/coverage gaps* — not active vulnerabilities.

| Severity | Count | One-line |
|---|---:|---|
| 🔴 Critical | **0** | — |
| 🟠 High | **0** | — |
| 🟡 Medium | **4** | SCC frontend has no server-side route guard; file-upload MIME trust; thin audit-trail coverage; frontend test gap (security-adjacent). |
| 🔵 Low | **6** | leaked-password toggle off; `vector` ext in public; `internal.controller` non-timing-safe compare; magic-byte upload check; webhook inbound-HMAC unaudited; RLS-no-policy info noise. |

---

## Domain-by-domain findings

### 1. Authentication — ✅ strong
- Staff/admin: Supabase JWT verified against `SUPABASE_JWT_SECRET`; member BFF: separate `MEMBER_JWT_SECRET` with `aud=member` enforced via `jose.jwtVerify` ([member-token.service.ts](../../backend/src/member/auth/member-token.service.ts)). Token-audience separation means staff tokens can't be replayed on member routes **[8.8 ✓ + re-verified]**.
- Boot-time required-env validation `process.exit(1)` if `MEMBER_JWT_SECRET` (and prod CORS/2FA/Razorpay secrets) are missing — fails closed.
- Login lockout (5 fails → 15-min Redis lockout) per CLAUDE.md; member OTP login is throttled `@Throttle 5/min` (request) and `10/min` (verify) ([member-auth.controller.ts:26,52](../../backend/src/member/auth/member-auth.controller.ts)) — brute-force resistant.

### 2. Authorization — ✅ strong, one frontend gap
- **76 controllers; 72 carry explicit `@UseGuards`; the 4 without are all accounted for** (health, member OTP, public plan listing, internal `x-internal-secret`, kiosk device-auth middleware) **[8.8 ✓]**.
- 🟡 **M1 — SCC frontend (`saas-control-center/frontend`) has NO Next.js `middleware.ts`.** Route protection is **client-side only** (`hooks/use-auth.ts`, `stores/auth-store.ts`, `(dashboard)/layout.tsx`). The admin app *does* have [`frontend/src/middleware.ts`](../../frontend/src/middleware.ts). Real data is still protected by backend JWT guards (a logged-out user hitting the SCC shell gets 401s on every API call), so this is **defense-in-depth, not an exposure** — but the super-admin console should have a server-side redirect. **Fix:** add a `middleware.ts` that checks the session cookie and redirects unauthenticated requests away from `(dashboard)`.

### 3. Multi-tenant isolation — ✅ strong (crown jewel intact)
- Single source of truth `tenant-models.ts` feeds **both** the load-bearing `$use` middleware and the `$extends` client — drift-proof (the prior leak class) **[8.8 ✓, registry re-read this pass: 150+ models incl. the D4 + health-platform additions]**.
- Raw-SQL sweep (88 `$queryRaw*` sites): the `$queryRawUnsafe` calls in [auth.service.ts](../../backend/src/auth/auth.service.ts) and provisioning paths use **bound placeholders (`$1::uuid`)** and a `^studio_[0-9a-f_]+$` allowlist on schema names — *parameterized, not concatenated* (the "Unsafe" suffix only means Prisma skips tag-checking; binding is still safe). No per-request member raw query returns another identity's gym-private rows **[8.8 ✓]**.
- ⚠️ Architectural caveat (already documented, not new): RLS is **decorative** because the app connects as a `rolbypassrls` superuser. Isolation is **app-layer**. The Phase-B non-bypass-role keystone is the durable fix and is in flight on this branch. **This is the single most important thing to land before onboarding live gyms** — keep it on the critical path.

### 4. RLS policies — ✅ correct posture (info-level noise only)
- Live advisor: **38 × `rls_enabled_no_policy` (INFO)**. For this architecture that is the *intended* state — RLS enabled + zero policies = **deny-all to the anon/authenticated PostgREST roles**, while the backend superuser bypasses RLS. So these INFOs are the lockdown working, **not** vulnerabilities. (Includes today's `app_users`, `app_user_events`, `app_user_health_daily`, etc. — all correctly locked.) 🔵 **L6:** they create advisor noise that can mask a *real* future regression; consider documenting the expected baseline so a genuinely-new unlocked table stands out.

### 5. API security — ✅ strong
- Global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`), `helmet()`, `compression()`, 1 MB body limit with `rawBody` for webhook HMAC, `EnhancedThrottlerGuard` (Redis), `SubscriptionLockGuard`, CORS from `CORS_ORIGINS` **[8.8 ✓]**.

### 6. JWT / session handling — ✅ strong
- Dual-secret separation (above); audience pinning; member refresh tokens persisted in `public.member_refresh_tokens` (RLS-locked). No JWT in localStorage on the API side. **UNVERIFIED:** member-app client token storage (expo-secure-store vs web) — note only, RN client not in scope of this static pass.

### 7. Secrets management — ✅ good
- **No `.env` files are tracked** (`git ls-files` shows none); `.gitignore` covers `.env`, `*.env`, `.env*.local`, plus explicit `backend/.env`, `saas-control-center/.env`. On-disk `.env` files exist for local dev (incl. the one open in your IDE, `saas-control-center/.env`) but are correctly ignored.
- 🔵 **L7 (advisory, verify):** confirm CI/CD and deployment inject secrets via environment, not committed files (CI footprint is a single `.github/workflows/ci.yml` — review it in the DevOps slice).

### 8. Environment variables — ✅ good
- Boot validation rejects missing critical envs in prod (CORS, 2FA key, Razorpay webhook secret, member JWT). `.env.example` files exist for all four apps.

### 9. File uploads — 🟡 mostly good, MIME trust gap
- [uploads.controller.ts](../../backend/src/uploads/uploads.controller.ts): 5 MB limit, mimetype allowlist (`image/jpeg|png|webp`), Supabase Storage with `contentType`. [documents.service.ts](../../backend/src/documents/documents.service.ts): 10 MB, `application/pdf` only.
- 🟡 **M2 / 🔵 L4:** validation trusts the **client-supplied `file.mimetype`** (multer reports the browser's declared type, which is spoofable). **Fix (defense-in-depth):** validate the **magic bytes** (file signature) server-side, and confirm Supabase buckets are private + served via 1-hour signed URLs (per CLAUDE.md) for the document path.

### 10. Input validation — ✅ strong
- Global `forbidNonWhitelisted` + `transform` + class-validator DTOs everywhere; raw input is never trusted **[8.8 ✓]**.

### 11. SQL injection — ✅ no injectable sites found
- 88 raw-SQL sites reviewed by pattern; all `Unsafe` variants use bound parameters + identifier allowlisting (§3). No string-concatenated user input into SQL was found. **UNVERIFIED:** I pattern-scanned all 88 but deep-read ~6; a focused follow-up could read the remaining inventory-/referral-/dashboard- raw queries line-by-line.

### 12. XSS — ✅ clean
- **Zero** `dangerouslySetInnerHTML` across `frontend` + `saas-control-center/frontend`. No `eval`/`new Function`/`.innerHTML` sinks except a **fixed server-side Redis Lua script** in the throttler (not user-reachable).

### 13. CSRF — ✅ N/A by design
- Backend is a **pure Bearer-token API** (no cookie-based session auth; the only `csrf` reference is in the Sentry PII-scrubber header denylist). Token-in-header is not CSRF-replayable. Next.js admin/SCC apps that use Supabase cookies rely on Supabase's SameSite handling — **UNVERIFIED** at the cookie-flag level; low risk.

### 14. Rate limiting — ✅ strong
- Global `EnhancedThrottlerGuard` + Redis storage; targeted `@Throttle` on member OTP endpoints; pre-auth observability sink covered by the global throttler **[8.8 ✓]**.

### 15. Logging & audit trails — 🟡 present but coverage thin
- PII scrubber exists for Sentry ([pii-scrubber.ts](../../backend/src/common/sentry/pii-scrubber.ts)) — good. `StripSecretsInterceptor` prevents secret fields (`face_descriptor`, card tokens, salaries, 2FA) leaving the API **[8.8 ✓]**.
- 🟡 **M3:** the `AuditLog` model exists with a dedicated [audit.service.ts](../../backend/src/audit/audit.service.ts), but only **~5 files reference it** — audit-trail *write* coverage looks sparse for a multi-tenant SaaS handling money. **Fix:** ensure security-sensitive mutations (role/permission changes, payments, refunds, member data export, tenant config) all write audit entries. (Exact covered-mutation set is **UNVERIFIED** — needs a write-site enumeration.)

### Outbound webhooks (bonus, resolves an 8.8 "not audited" flag)
- [platform/services/webhooks.service.ts:212](../../backend/src/platform/services/webhooks.service.ts) and [queue/processors/webhook.processor.ts:40](../../backend/src/queue/processors/webhook.processor.ts) **sign outbound** deliveries with `HMAC-SHA256` (`X-Webhook-Signature`). Payment **inbound** webhooks already verify HMAC with `rawBody` (Razorpay, per project memory).
- 🔵 **L5:** inbound HMAC verification for the *integrations* surface (3rd-party → us) is **UNVERIFIED** beyond payments — enumerate any inbound integration endpoints and confirm timing-safe verification.

---

## Recommended fixes (prioritized)

| ID | Sev | Fix | Effort | Gate |
|---|---|---|---|---|
| **CRIT-PATH** | (arch) | Land the Phase-B non-bypass-role RLS keystone **before** onboarding live gyms. | large | HARD GATE (DB/RLS) |
| M1 | 🟡 | Add server-side `middleware.ts` to SCC frontend `(dashboard)` route group. | small | code only |
| M2/L4 | 🟡/🔵 | Magic-byte (signature) validation on uploads; confirm private buckets + signed URLs. | small | code only |
| M3 | 🟡 | Audit-trail write coverage for sensitive mutations (enumerate first). | medium | code only |
| M4 | 🟡 | Frontend security-adjacent tests (auth guard, middleware redirect) — see `CODE_QUALITY` slice. | medium | code only |
| L1 | 🔵 | Enable Supabase leaked-password protection (HaveIBeenPwned). | trivial | **your action** (dashboard) |
| L2 | 🔵 | Move `vector` extension out of `public` — **risky** (biometric/face pgvector refs); defer. | medium | HARD GATE (DB) |
| L3 | 🔵 | `crypto.timingSafeEqual` for `internal.controller` secret compare. | trivial | code only |
| L5 | 🔵 | Audit inbound integration-webhook HMAC. | small | investigation |
| L6 | 🔵 | Document the expected `rls_enabled_no_policy` baseline so new gaps stand out. | trivial | docs |

---

## Security Score: **88 / 100**

| Dimension | Score | Note |
|---|---:|---|
| AuthN / AuthZ | 92 | Strong; SCC server-side guard the only gap. |
| Tenant isolation (app-layer) | 90 | Drift-proof single source; **−** RLS keystone still pending = ceiling until it lands. |
| API hardening / validation | 95 | Helmet, throttle, whitelist DTOs, strip-secrets. |
| Injection / XSS / CSRF | 95 | No injectable sites, zero XSS sinks, bearer-only. |
| Secrets / env | 90 | Nothing tracked; verify CI injection. |
| Uploads | 80 | MIME-trust + magic-byte gap. |
| Audit/logging | 75 | Exists; coverage thin. |

> The score is **88, not higher**, principally because (a) the RLS keystone that makes isolation database-enforced is **not yet shipped** — until it lands, a single app-layer bug is the only thing between tenants — and (b) audit-trail coverage and the SCC server-side guard are incomplete. None of these is an *active* exploit path today; they are the difference between "secure" and "defense-in-depth secure."

*No code, DB, or config changed by this audit. Hard-gated fixes (RLS keystone, `vector` move, leaked-password toggle) await explicit approval / are your dashboard actions.*
