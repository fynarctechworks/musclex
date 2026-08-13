# MuscleX Security & Architecture Audit — Final Report

**Scope:** `backend/` (NestJS + Prisma multiSchema), `frontend/` (Next.js admin), `gym-member-app/` (Expo RN), `saas-control-center/` (+`/frontend`), and live Supabase Postgres database state.
**Method:** Static read-only source review + database-advisor/`pg_catalog` inspection. Every finding below was independently reproduced by a verifier against real code or live DB state; each carries the verifier's verdict and the **severity adjusted after verification** (which supersedes the original triage severity).
**Date:** 2026-07-11

---

## 1. Executive Summary

Overall posture is **moderate-to-strong, with one un-gated critical financial IDOR that must be fixed before anything else.** The core tenant-isolation model (Prisma `$use` gym_id injection, single-source `tenant-models.ts`) is real and largely holds, but the audit found **two classes of app-layer bypass** — a fail-open `findUnique` post-check and a set of referral-wallet endpoints that ignore tenant scoping entirely — plus **two authentication fail-open defaults** in the staff `JwtAuthGuard`. The frontend and database findings are mostly latent/defense-in-depth issues that are correctly fail-closed today but sit one misconfiguration away from becoming live.

**Count by adjusted severity (26 findings):**

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 4 |
| MEDIUM | 7 |
| LOW | 12 |
| INFO | 2 |

**The 3–5 things that matter most:**

1. **CRITICAL — Referral-wallet financial IDOR (F-10).** A self-serve gym owner can credit their own B2B referral wallet with an unbounded amount, or drain a competitor's, by passing an arbitrary `studio_id`. Real-money cross-tenant manipulation from an ordinary owner JWT. **Fix first.**
2. **HIGH — Auth guard fails open to `owner` (F-3).** When JWT `user_metadata` omits `role` or RBAC returns no rows, the staff guard grants full `owner` permissions and skips secret-stripping — a fail-open privilege-escalation default sitting on client-writable metadata.
3. **HIGH — Cross-tenant referral-wallet read/freeze (F-11)** and **HIGH — Dev OTP bypass on shared prod DB (F-21).** The first is the read/DoS sibling of the critical IDOR; the second lets anyone log in as any member from any non-prod backend pointed at the shared production database.
4. **HIGH — Staff access + refresh tokens in `localStorage` (F-18).** Any XSS on the money-handling admin app yields a 7-day refresh token and full owner impersonation; compounded by **no CSP anywhere (F-19)**.
5. **Systemic isolation weakness (F-2).** The `$use`/extension `findUnique` guard fails open whenever a `select` omits `gym_id` — the R3 "findUnique fails-open" leak class is still only partially closed and underlies F-1.

**Cross-gym leakage is possible today** via F-10/F-11 (referral wallets, confirmed) and narrowly via F-1 (check-in branch metadata). See §4.

---

## 2. CRITICAL & HIGH Findings (most-severe first)

### F-10 — CRITICAL — Cross-tenant IDOR: gym owner can credit/debit ANY studio's referral wallet with an unbounded amount
- **Location:** `backend/src/referrals/referrals-admin.controller.ts:384` (DTO `backend/src/referrals/dto/admin-actions.dto.ts:62`; service `referral-admin.service.ts:240`)
- **Evidence:** Controller gated `@Roles('owner', 'super_admin')` (line 41). `manualAdjustment(@Body() dto)` forwards `dto.studio_id` and `dto.amount` verbatim to `manualWalletAdjustment({ studioId: dto.studio_id, amount: dto.amount, ... })` with **no check that `dto.studio_id === user.studio_id`**. `ManualAdjustmentDto` binds `studio_id` to a bare `@IsUUID()` and `amount` to a bare `@IsNumber()` — **no `@Min`/`@Max`**. The wallet is keyed purely by `studio_id` on the public-schema client (`this.pub`), so the tenant `gym_id` `$use` injection does not apply (it's a write value, not a where-filter).
- **Impact:** A paying gym owner can credit their own referral wallet with unlimited value (redeemable against subscription = free money) or debit/drain a competitor gym's wallet. Full cross-tenant financial manipulation from a self-serve owner JWT.
- **Proposed fix:** Restrict wallet-mutation endpoints to `@Roles('super_admin')` only (this is a platform action), **or** bind `studioId` to `user.studio_id` and reject mismatches. Add `@Min`/`@Max` bounds to `amount`.
- **Verifier verdict:** **CONFIRMED.** "Full cross-tenant financial IDOR from a self-serve owner JWT. No compensating control found (no ownership check, no amount bounds, RLS is decorative). Severity critical is appropriate."

---

### F-3 — HIGH — `JwtAuthGuard` fails open to full `owner` privileges when JWT metadata omits role or RBAC returns no rows
- **Location:** `backend/src/common/guards/jwt-auth.guard.ts:91` (and `:137`; `default-permissions.ts:25`)
- **Evidence:** `let role = metadata.role || 'owner';` (line 91). The RBAC override only runs when `studioId` is present **and** `userRoles.length > 0`; otherwise role/permissions are never recomputed. Line 137: `if (Object.keys(permissions).length === 0) { permissions = metadata.permissions || DEFAULT_ROLE_PERMISSIONS[role] || {}; }` → `DEFAULT_ROLE_PERMISSIONS['owner']` = full CRUD+export on members/payments/staff/settings/roles/inventory. `RolesGuard` (`roles.guard.ts:45`), `PermissionsGuard` (`permissions.guard.ts:41`), and `StripSecretsInterceptor` (`strip-secrets.interceptor.ts:55`) all short-circuit for `owner`, so every gate is bypassed and salary/base_salary/hourly_rate are **not** stripped. `studio_id`/`role`/`branch_ids` come solely from `user_metadata` with no DB-membership cross-check on this path.
- **Impact:** Any admin-side token whose Supabase `user_metadata` lacks `role` (or where RBAC returns nothing) is granted full owner access. Supabase `user_metadata` is self-writable by the authenticated user via GoTrue `updateUser`, so a user can set `studio_id` to a gym where they hold no RBAC assignment and land on `owner`. Fail-open privilege escalation, not a deny.
- **Proposed fix:** Default `role` to a deny/least-privilege value (or reject). When `studioId` is present, require ≥1 RBAC role row before granting any permission. Never fall back to `DEFAULT_ROLE_PERMISSIONS['owner']` or `metadata.permissions` for authorization.
- **Verifier verdict:** **CONFIRMED** (kept HIGH, not critical, only because full weaponization depends on Supabase's client-writable-metadata default — standard but not provable from this repo alone; the fail-open-to-owner default is itself an unambiguous authorization defect).

---

### F-11 — HIGH — Cross-tenant read/freeze of another studio's referral wallet by a gym owner
- **Location:** `backend/src/referrals/referrals-admin.controller.ts:349` (also `:358`, `:372`)
- **Evidence:** Same `@Roles('owner','super_admin')` controller. `getWallet(@Param('studio_id') studioId)` returns `this.wallet.getBalance(studioId)` + `listEntries(studioId, {limit:50})`; `freezeWallet`/`unfreezeWallet` act on the `:studio_id` path param with **no binding to `user.studio_id`**. Service methods operate on the raw `studioId` against the public schema (`PublicPrismaService`), so gym_id auto-injection does not apply.
- **Impact:** Any gym owner can read another gym's referral wallet balance and last 50 ledger entries, and freeze/unfreeze a competitor's wallet — cross-tenant data disclosure and denial of a paid feature.
- **Proposed fix:** Scope to `super_admin`, or assert the path `studio_id` matches the caller's `user.studio_id`.
- **Verifier verdict:** **CONFIRMED.** "Genuine cross-tenant IDOR; the cited evidence is accurate."

---

### F-21 — HIGH — Dev OTP login bypass gated only on `NODE_ENV`, accepts any 4–8 digit code — member account takeover in any non-prod env against the shared DB
- **Location:** `backend/src/member/auth/member-auth.service.ts:49` (route `member-auth.controller.ts:49`)
- **Evidence:** `get devBypassEnabled(): boolean { return this.config.get('NODE_ENV') !== 'production'; }`. `fixedDevOtp` is null when `MEMBER_DEV_OTP` is unset; then `const ok = fixed ? entered === fixed : /^\d{4,8}$/.test(entered)` — **any** 4–8 digit code passes. `devSession` then calls `appUsers.findOrCreate(normalized)` and `sessionForAppUser(...)`, issuing **real** member tokens with no SMS/OTP. The controller/DTO docstrings claim the route requires "non-production + `MEMBER_DEV_OTP` set," but `MEMBER_DEV_OTP` is never actually enforced.
- **Impact:** All four apps share ONE production Supabase DB. Any staging/preview/dev backend pointed at that DB with `NODE_ENV != 'production'` lets anyone who knows a real member's phone number log in as that member (gym scope resolved by phone) — full member account takeover. Safety rests entirely on `NODE_ENV` being exactly `'production'` everywhere touching prod data, and the documented second factor is not required.
- **Proposed fix:** Require BOTH `NODE_ENV !== 'production'` AND a configured `MEMBER_DEV_OTP` (return `devBypassEnabled` only when `fixedDevOtp` is non-null). Never accept an arbitrary well-formed code. Add an explicit `MEMBER_DEV_BYPASS=true` flag so a mis-set `NODE_ENV` alone cannot enable it.
- **Verifier verdict:** **CONFIRMED** (kept HIGH, not critical: the primary prod backend runs `NODE_ENV=production` and correctly 404s, so exploitation is conditional on a misconfigured/staging deployment against the shared DB).

---

### F-18 — HIGH — Staff access AND refresh tokens persisted in `localStorage` — any XSS = full session/account takeover
- **Location:** `frontend/src/stores/auth-store.ts:146` (read side `frontend/src/services/api-client.ts:65`, cookie `:147`)
- **Evidence:** zustand `persist` with `name: 'auth-storage'` (no custom `storage` → defaults to `localStorage`) and `partialize` persisting **both** `accessToken` and `refreshToken`. `api-client.ts` reads `localStorage.getItem('auth-storage')` and posts the refresh token to `/auth/refresh`; line 147 sets a 7-day (`max-age=60*60*24*7`) auth cookie.
- **Impact:** Both the staff JWT and the long-lived refresh token sit in JS-readable `localStorage` on an app that moves real money and multi-tenant member data. Any XSS can exfiltrate the refresh token and continuously mint access tokens for 7 days, impersonating an owner/brand_owner. A refresh token in `localStorage` cannot be `httpOnly`-protected and survives rotation.
- **Proposed fix:** Move the session to an `httpOnly`, `Secure`, `SameSite=Strict` cookie set by the backend/auth-callback route; stop persisting `accessToken`/`refreshToken` in the zustand store. At minimum keep the refresh token out of JS-reachable storage and hold only a short-lived access token in memory.
- **Verifier verdict:** **CONFIRMED** (HIGH; a well-recognized defense-in-depth weakness that requires a separate XSS foothold to trigger).

---

## 3. MEDIUM / LOW / INFO Findings (condensed)

| ID | Sev | Title | Location | One-line evidence | Verdict |
|---|---|---|---|---|---|
| F-2 | MED | `$use` `findUnique` cross-tenant post-check fails open when a `select`/`include` omits `gym_id` | `backend/src/prisma/prisma.service.ts:152` (also `tenant-prisma.extension.ts:106`) | Guard `if (result && (result as any).gym_id && ...)` skips when `gym_id` not selected; reproduced at `wallet.service.ts:34` | CONFIRMED |
| F-1 | MED | Cross-tenant branch read in check-in access-scope resolver via unscoped `findUnique` with client `branch_id` | `backend/src/check-ins/policy/access-scope.resolver.ts:144` | `branch.findUnique({ where:{id:targetBranchId}, select:{organization_id:true} })` — no gym filter, `gym_id` omitted so F-2 guard skipped | CONFIRMED (downgraded high→med; narrow data, needs foreign branch UUID) |
| F-4 | MED | RBAC resolution errors swallowed → downgrade to trusting client metadata (fail-open on infra failure) | `backend/src/common/guards/jwt-auth.guard.ts:130` | `catch(error){ logger.warn(...) // fall through }` → `metadata.permissions || DEFAULT_ROLE_PERMISSIONS[role]` | CONFIRMED |
| F-7 | MED | Member photo signed URLs minted with 1-year expiry (policy: 1-hour) | `backend/src/uploads/uploads.controller.ts:74` | `.createSignedUrl(fileName, 365*24*60*60)` on private `member-photos` bucket | CONFIRMED |
| F-8 | MED | Upload validation trusts client MIME; no extension/content check; SVG into public bucket | `backend/src/uploads/uploads.controller.ts:32` | `if(!file.mimetype.startsWith('image/'))`; `ext = file.originalname.split('.').pop()`; `contentType: file.mimetype` | CONFIRMED |
| F-13 | MED | Stale `zzz_backup_pre_truncate_*` schemas retain member/identity PII in prod DB | DB: `zzz_backup_pre_truncate_20260614/23` | Flat copies incl. `public__user_identities` (2FA secret/backup codes), `studio_template__members` (115 rows); no PK, no RLS | CONFIRMED (data-at-rest governance, not a runtime leak) |
| F-23 | MED | Razorpay webhook HMAC-verify + replay-window gate has no test | `backend/src/payments/payments.controller.ts:130-180` | Only trust boundary for inbound money events; no spec exercises `razorpayWebhook` | CONFIRMED (downgraded high→med; control present, regression-coverage gap) |
| F-6 | LOW | SSRF: tenant webhook URL fetched server-side, no private-IP allowlist; response body stored | `backend/src/platform/services/webhooks.service.ts:228` | `fetch(webhook.url,...)`; `@IsUrl({require_tld:false})` allows `localhost`/`169.254.169.254` | UNCERTAIN (downgraded high→low; sink real but **dispatch path has no reachable trigger today** — latent) |
| F-19 | LOW | No Content-Security-Policy header anywhere | `frontend/src/middleware.ts:52` | `setSecurityHeaders` sets only XCTO/XFO/Referrer/Permissions-Policy; grep for CSP = none | CONFIRMED (defense-in-depth; only material with an XSS vector) |
| F-12 | LOW | Inline object-typed `@Body()` params bypass the global ValidationPipe | `backend/src/staff/staff.controller.ts:323` (+`subscription.controller.ts:210/236/379`, others) | Inline TS type → metatype `Object` → ValidationPipe skips whitelist/transform | CONFIRMED (downgraded med→low; `role_name` still rejected downstream, owner-only) |
| F-5 | LOW | Member refresh-token rotation lacks reuse/family revocation on revoked-token replay | `backend/src/member/auth/member-auth.service.ts:198` | Revoked token → generic 401; `replaced_by` written but never read; no family revoke | CONFIRMED |
| F-9 | LOW | Committed default super-admin password in tracked `.env.example` | `saas-control-center/.env.example:26` | `SUPER_ADMIN_PASSWORD="MuscleX@Admin#2026!"` seeded by `ensureSuperAdmin()` on boot | CONFIRMED |
| F-14 | LOW | 18 `scc.*` tables have RLS disabled, zero policies | DB: schema `scc` | `relrowsecurity=false`, 0 policies; **mitigated**: `anon`/`authenticated` have no `USAGE` on `scc` | CONFIRMED (self-mitigated) |
| F-15 | LOW | `anon` still holds SELECT/INSERT/DELETE on sensitive `public` tables | DB: `public.user_identities`, `user_sessions`, `studios`, `invoices`, etc. | Grants present; RLS-enabled-with-0-policies is the only thing preventing leak (fail-closed today) | CONFIRMED (latent footgun) |
| F-20 | LOW | Route-protection middleware checks cookie presence only, not JWT validity | `frontend/src/middleware.ts:38` | `if(!authCookie?.value) redirect('/login')` — any non-empty value passes | CONFIRMED (UX gate; backend remains authoritative) |
| F-22 | LOW | SCC member-app analytics/CRM/campaign endpoints have no `@Roles` gate | `saas-control-center/src/modules/member-app-analytics/member-app-analytics.controller.ts:62` | No `@Roles` → `RolesGuard` fails open; SUPPORT/BILLING admin can send push campaigns | CONFIRMED (internal SCC; least-privilege gap) |
| F-24 | LOW | Jest coverage thresholds very low (branches 20%, stmts/lines 30%) | `backend/package.json:129-136` | Single global floor; no per-directory thresholds on payments/auth/prisma | CONFIRMED (downgraded med→low; process hygiene) |
| F-16 | LOW | Four unindexed foreign keys on hot public tables | `backend/prisma/schema.prisma:629,654` | `login_history.device_id`, `user_sessions.device_id`, `referral_fraud_signals.referral_id`, `reward_logs.rule_id` | CONFIRMED |
| F-26 | LOW | `gym-member-app` has zero automated tests | `gym-member-app/package.json` | No `test` script, no specs; verification = `tsc --noEmit` + device QA | CONFIRMED (acknowledged in CLAUDE.md) |
| F-17 | INFO | 1481 unused indexes + 147 `auth_rls_initplan` + 20 multiple-permissive-policy warnings | DB advisors | Expected pre-launch (empty tables; RLS decorative); no action now | CONFIRMED |
| F-25 | INFO | `@types/ioredis` v4 declared against `ioredis` v5 runtime | `backend/package.json:55,81` | v5 bundles its own types and shadows the stale `@types/*`; redundant deprecated dep | CONFIRMED (downgraded low→info; cosmetic) |

---

## 4. Tenant-Isolation Posture — Verdict

**Is cross-gym leakage possible today? YES — through the referral-wallet endpoints, and narrowly through the check-in resolver.**

- **Confirmed active cross-tenant financial manipulation (F-10, CRITICAL):** the referral-wallet admin endpoints operate on a client-supplied `studio_id` against the **public schema** (`this.pub`/`PublicPrismaService`), which is *outside* the `gym_id` `$use` injection. There is no ownership check. A gym owner can credit their own wallet unbounded or drain a competitor's. **F-11 (HIGH)** is the read/freeze sibling on the same controller.
- **Confirmed narrow cross-tenant read (F-1, MED):** the check-in access-scope resolver reads a foreign gym's branch row (`organization_id`/`city`) via an unscoped `findUnique` whose `select` omits `gym_id`. Blast radius is limited (branch metadata, attacker needs a foreign branch UUID) but it is a genuine app-layer isolation bypass and can influence a `city_access` check-in decision.
- **Systemic root cause (F-2, MED):** the crown-jewel isolation layer's `findUnique` guard — in **both** `prisma.service.ts` and `tenant-prisma.extension.ts` — is post-check-only and **fails open whenever a `select` omits `gym_id`**. This is the R3 "findUnique fails-open" leak class, still only partially closed. Every current/future `select`-projecting `findUnique` on a tenant model with an attacker-influenced id is a latent leak (reproduced at `wallet.service.ts:34`).
- **Auth-layer amplifier (F-3/F-4, HIGH/MED):** the staff guard reads `studio_id`/`role` from client-writable `user_metadata` and, on a missing role or RBAC error, grants `owner`. This weakens the JWT-`gym_id` leg of the isolation model on a fail-open path.

**Where isolation holds:** the standard `where`-injection path (`findFirst`/`findMany`/`update`/`delete` on models listed in `tenant-models.ts`) is enforced correctly, and `include`-based `findUnique` is safe (Prisma returns all scalars incl. `gym_id`). The leaks are concentrated in (a) public-schema code that legitimately sits outside injection but lacks manual scoping, and (b) `select`-projecting `findUnique`.

**Bottom line:** the model is sound in design but has **holes at its two documented weak seams** (public-schema raw access and `findUnique` fail-open). F-10 is exploitable now; the rest are real but narrower or latent.

---

## 5. What Is Done Well (controls confirmed present and correct)

- **`gym_id` where-injection** for the common Prisma verbs on tenant models works; single source of truth `tenant-models.ts` is respected (Branch, Member, etc. are present).
- **`include`-based `findUnique` is safe** — Prisma returns `gym_id`, so the post-check fires correctly.
- **Global ValidationPipe** (`whitelist`+`forbidNonWhitelisted`+`transform`) is configured (`main.ts:60-66`) and does protect all properly-decorated DTO classes; the gap (F-12) is limited to inline object types.
- **Razorpay webhook trust boundary is correctly implemented** (`payments.controller.ts`): HMAC-SHA256 via `createHmac`, `timingSafeEqual` comparison, `BadRequestException` on missing secret, and a 300s replay window. (The only gap is *test coverage*, F-23 — the control itself is right.)
- **`StripSecretsInterceptor`** correctly strips salary/2FA/tokens for non-owner roles (the F-3 concern is only on the fail-open owner default).
- **`RolesGuard`/`PermissionsGuard`** apply consistently across most controllers (`tenant.controller.ts`, `system-errors.controller.ts` in SCC); F-22 is a documented outlier, not the norm.
- **Sensitive `public` tables are fail-closed** (F-15): RLS enabled with zero permissive policies means `anon`/`authenticated` see zero rows today; `scc` schema grants no `USAGE` to public roles (F-14). Phase-8.1 anon-revoke posture largely holds.
- **`member-photos` bucket is genuinely private** (`public: false`) — F-7 is a TTL problem, not a public-bucket exposure.
- **Refresh-token rotation exists** (revoked tokens are correctly rejected; F-5 is only the missing reuse-detection escalation).
- **Backend never uses the `anon`/`authenticated` PostgREST roles** — it connects as the bypass superuser, so the leftover grants (F-15) are a footgun, not an active backend path.

---

## 6. What Was NOT Verifiable in a Static Read-Only Pass (honest limits)

- **PostgREST "Exposed Schemas" runtime config** could not be read directly from the DB. F-14/F-15 reachability was inferred from schema-`USAGE` grants (the effective gate), which is sound but not a direct read of the PostgREST exposed-schemas setting.
- **Supabase `user_metadata` writability** (central to weaponizing F-3/F-4) is standard GoTrue behavior but not provable from this repo alone — it depends on the live GoTrue config. Severity was held at HIGH accordingly.
- **F-6 SSRF exploitability** is uncertain by design: the sink is real and unguarded, but no reachable event-dispatch trigger exists in the current code (the outbound-webhook feature is half-wired). It becomes live the moment dispatch wiring is added. Runtime confirmation would require exercising the deployed event pipeline.
- **On-device RN behavior** (`gym-member-app`) — auth token handling, offline/optimistic flows, animation/layout — is not verifiable from a static pass and has no automated tests (F-26). CLAUDE.md correctly flags this as device-QA-only.
- **Actual production `NODE_ENV` on every deployment** (F-21) — the primary prod backend was confirmed to 404 the dev route, but the audit cannot enumerate every staging/preview backend that may point at the shared DB.
- **XSS presence** — F-18/F-19 are XSS-multiplier findings; no specific XSS injection point was hunted or confirmed in this pass. The severity reflects the token-storage/CSP posture, not a proven XSS chain.
- **Live exploit execution** — this was a read-only audit. No endpoint was actually called; findings are proven by code/DB evidence, not by running an attack.

---

## 7. Prioritized Remediation Plan

Ordered by risk. HARD-STOP tags per CLAUDE.md: **[AUTH/RLS]**, **[SCHEMA/MIGRATION]**, **[DESTRUCTIVE-DB]**, **[NEW-DEP]**.

**P0 — Fix before next deploy (active exploitable cross-tenant / money paths)**
1. **F-10 / F-11 — Referral-wallet endpoints.** Gate `manualAdjustment`/`getWallet`/`freeze`/`unfreeze` to `@Roles('super_admin')` **or** bind `studio_id` to `user.studio_id` and reject mismatches; add `@Min`/`@Max` to `ManualAdjustmentDto.amount`. **[AUTH/RLS]** (changes authorization scoping).
2. **F-3 / F-4 — Auth guard fail-open.** Default `role` to least-privilege/deny; require ≥1 RBAC row when `studioId` is present; on RBAC error, **throw** instead of falling through to metadata/`DEFAULT_ROLE_PERMISSIONS`. **[AUTH/RLS]**.
3. **F-21 — Dev OTP bypass.** Require both `NODE_ENV !== 'production'` AND a configured `MEMBER_DEV_OTP`; add an explicit `MEMBER_DEV_BYPASS` flag; never accept an arbitrary 4–8 digit code. **[AUTH/RLS]**.

**P1 — Close the systemic isolation seam and the highest-value client exposure**
4. **F-2 — `findUnique` fail-open.** Force `gym_id` into the `findUnique` select and strip after verifying, or convert tenant-model `findUnique` to gym-scoped `findFirst`; treat a missing `gym_id` on the fetched row as a violation. Apply in **both** `prisma.service.ts` and `tenant-prisma.extension.ts`. **[AUTH/RLS]**.
5. **F-1 — Check-in branch resolver.** Load the target branch gym-scoped (`findFirst({ where:{ id, gym_id } })`); reuse the already-scoped `ctx.branch`; treat null as `branch_not_found`. (Largely subsumed once F-2 lands.)
6. **F-18 — Staff tokens in `localStorage`.** Move refresh token to an `httpOnly`/`Secure`/`SameSite=Strict` cookie; keep only a short-lived access token in memory. **[AUTH/RLS]** (session-mechanism change).

**P2 — Defense-in-depth and data hygiene**
7. **F-19 — Add a strict CSP** in `middleware.ts`/`next.config` (script-src 'self' + nonces, tight connect-src, object-src 'none', base-uri 'self').
8. **F-8 / F-7 — Uploads:** validate by magic-byte content-type + extension allowlist; drop client SVG (or sanitize) for the public bucket; reduce member-photo signed-URL TTL to ~1h and mint on demand.
9. **F-15 — `REVOKE ALL` on the sensitive `public` tables FROM `anon, authenticated`** (backend uses the bypass role); keep RLS as belt-and-suspenders. **[SCHEMA/MIGRATION]** (SQL grant change).
10. **F-14 — Enable deny-by-default RLS on `scc.*`**; add a guard test asserting `anon`/`authenticated` have no `USAGE` on `scc`. **[AUTH/RLS] + [SCHEMA/MIGRATION]**.
11. **F-13 — Drop / cold-archive `zzz_backup_pre_truncate_*` schemas** after confirming they are no longer needed. **[DESTRUCTIVE-DB]** — requires explicit confirmation.
12. **F-9 — Replace the committed super-admin password** with a placeholder; fail boot / force rotation if the default is detected.
13. **F-22 — Add `@Roles(AdminRole.SUPER)`** to the SCC member-app analytics/campaign controller (at minimum gate campaign-send/automation-run).
14. **F-6 — Add a private-IP/host allowlist + post-DNS re-validation** to the webhook fetch sink *before* wiring up event dispatch, so the latent SSRF never goes live.
15. **F-5 — Add refresh-token reuse detection** (revoke the whole `replaced_by` chain on replay of a revoked token).

**P3 — Process / hygiene (no runtime risk today)**
16. **F-12 — Convert inline `@Body()` object types to decorated DTO classes** so the global whitelist applies.
17. **F-23 / F-24 — Add a controller-level Razorpay-webhook spec** (valid/tampered/missing-secret/expired-timestamp); raise coverage thresholds and add per-directory floors for `payments`/`auth`/`prisma`/`subscription`.
18. **F-16 — Add `@@index([device_id])`** on `LoginHistory`/`UserSession` and covering indexes on `referral_fraud_signals.referral_id`, `reward_logs.rule_id`. **[SCHEMA/MIGRATION]**.
19. **F-26 — Add a Jest config for pure-logic member-app modules** (API clients, date/streak utils).
20. **F-25 — Remove `@types/ioredis`** and rely on v5 bundled types. **[NEW-DEP]** (dependency removal — trivial, but touches deps).
21. **F-17 — No pre-launch action**; revisit RLS-initplan and duplicate-policy warnings when the non-bypass RLS keystone ships, and re-lint indexes against populated tables.

---

*Confidence note: all 26 findings carry an independent CONFIRMED verdict except F-6 (UNCERTAIN — real sink, no reachable trigger today). Severities in this report are the post-verification adjusted values, which in six cases differ from the original triage (F-1, F-6, F-12, F-19, F-23, F-24 downgraded; F-25 downgraded to info). No finding was accepted on assertion alone; each is anchored to a quoted line or a reproduced DB query.*