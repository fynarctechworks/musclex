# Security audit — 2026-08-29

**Scope:** `backend/`, `frontend/` (web app), `staff-app/` (staff mobile).
**Method:** static analysis only. No traffic was fired at any server, no exploit
was executed, nothing in the repo was modified. Five parallel specialist audits
(secrets, tenant isolation, backend authz, web app, mobile app) plus tool scans:
gitleaks, trufflehog, semgrep, osv-scanner.

**Baseline:** findings from `SECURITY_FINDINGS_2026-08-26.md` (F-1/F-2/F-3) were
excluded as known. All three fixes were re-checked and are sound. Everything
below is new unless marked KNOWN.

> **Verification status.** Every CRITICAL and HIGH below was re-read against
> source by the lead auditor, not taken on an agent's word. Exploit paths are
> traced through code but **not executed** — no finding here is proven by a live
> request. That distinction is deliberate: the 2026-08-26 round proved its
> findings with real requests, this round did not, and two of its claims below
> are explicitly flagged as unresolved-without-runtime-checking.

---

## CRITICAL

### A-1 — Three mid-tier roles can promote themselves to `brand_owner`

**File:** `backend/src/staff/staff.controller.ts:237-248`

```ts
@Patch(':id')
@Permissions({ module: 'staff', action: 'edit' })   // NO @Roles
update(@Param('id') id, @Body() data: UpdateStaffDto, @CurrentUser() user) {
  if (user.role !== 'owner' && data.role === 'owner') {   // only 'owner' blocked
    throw new ForbiddenException('Cannot assign owner role');
  }
  return this.staffService.update(user.studio_id, id, data);
}
```

The guard blocks exactly one string, `'owner'`. It does not block `brand_owner`
or `super_admin`. `UpdateStaffDto.role` is `@IsString() @IsOptional()` with no
`@IsIn` allowlist (`dto/update-staff.dto.ts:18-20`), and `staff.service.ts:276`
spreads the body straight into Prisma (`const updateData: any = { ...data }`).

**Verified preconditions** (`common/guards/default-permissions.ts`):
`manager` (:96), `branch_manager` (:79) and `regional_manager` (:63) all hold
`staff: ['view','create','edit']`, so all three reach this route.
`brand_owner` is in `tenantAdminRoles` (`roles.guard.ts:65`) and `ADMIN_ROLES`
(`permissions.guard.ts:15`) — it satisfies every non-platform `@Roles` and
bypasses every `@Permissions`.

**Exploit path:** a branch manager calls `PATCH /api/v1/staff/{own_staff_id}`
with `{"role":"brand_owner"}`. On next login the RBAC resolver reads the new
role and mints a full tenant-admin session: payroll, refunds, staff deletion,
settings, SSO config. `POST /api/v1/staff` (:209) has the same gap and also
accepts `permission_grants[]`.

**Fix:** add `@Roles('owner','brand_owner')` to both routes; replace
`role?: string` with an `@IsIn([...])` allowlist; reject any role at or above the
caller's tier rather than string-matching `'owner'`; assign `role` and
`permission_grants` explicitly instead of spreading.

---

### A-2 — Cross-tenant staff-invite hijack → account takeover at another gym

**Files:** `backend/src/staff/staff.controller.ts:65-80`,
`staff-invite.service.ts:326-350`, `:142-150`

`resendInvite` loads the invite by bare ID with no studio check:

```ts
const invite = await this.pub.staffInvitation.findUnique({ where: { id: inviteId } });
```

then re-issues it carrying the victim's `studio_id` through unchanged.
`StaffInvitation` lives in the `public` schema and is keyed `studio_id`, so no
`gym_id` injection applies. **Verified:** `createInvite` returns the raw
`token` and `invite_link` to the caller (`:142-150`), and
`POST /api/v1/staff-invites/accept` is **unauthenticated**
(`staff.controller.ts:402`).

The endpoints do carry `@Roles('owner','brand_owner')` — but `owner` is a
**per-gym** role, so any gym owner passes.

**Exploit path:** Gym A's owner calls
`POST /api/v1/staff/invites/<gym-B-invite-id>/resend`; the response body
contains a live token for Gym B; they POST it to the public accept endpoint and
provision themselves a staff account inside Gym B's schema at Gym B's
`role_name`. Full cross-tenant compromise, not merely a read. `revokeInvite`
(`:76`, no `@CurrentUser` at all) is the same IDOR as denial-of-onboarding.

**Fix:** use `findFirst({ where: { id, studio_id: user.studio_id } })` → 404 on
mismatch, before any mutation. Never return `token`/`invite_link` from resend —
it is delivered by email.

---

### A-3 — Unauthenticated forging of subscription-activation events

**File:** `backend/src/referrals/referrals.controller.ts:84-90`

**Verified:** `ReferralsController` has no class-level `@UseGuards`; only
`POST /` and `GET /stats` opt in individually. This route has no auth, no HMAC,
no internal secret — the code's own comment says *"In production, protect with
an API key guard or internal network policy."* It is not.
`ProcessSubscriptionEventDto` accepts attacker-chosen `studio_id` and
`amount_paid`; throttle is 100/min.

**Exploit path:** register a gym, get a referral link, sign up a throwaway
referred gym, POST a forged activation for it. `referrals.service.ts:201-214`
drives the referral `subscribed` → `payment_verified` with no payment taken —
defeating exactly the anti-fraud gate that state machine exists for. Rewards are
subscription-day credits, i.e. real money.

**Fix:** apply `InternalSecretGuard` — the correct pattern already exists next
door in `referrals-internal.controller.ts`.

---

## HIGH

### A-4 — `AuthAdminController`: a gym owner administers every gym's accounts

**File:** `backend/src/auth/auth-session.controller.ts:107-152`

`@Controller('api/v1/auth/admin')` + `@Roles('owner')` — a tenant role, not a
platform one. Three facts compound:

1. `RolesGuard` only refuses the owner bypass for platform-only requirements
   (`roles.guard.ts:59` — `PLATFORM_ONLY_ROLES = new Set(['super_admin'])`), so
   `@Roles('owner')` is satisfied by any gym owner.
2. `app.module.ts:169-175` excludes `api/v1/auth/(.*)` from `TenantMiddleware` —
   these requests carry **no tenant context at all**, so `gym_id` injection
   could not help even in principle.
3. `auth-identity.service.ts` contains **zero** occurrences of `studio_id`
   (grep-verified); `UserIdentity` is one global `public` table.

Reachable: `GET /login-history` returns every studio's login records (emails,
IPs, user agents) — `getFilteredHistory` builds `where` from query params with
no `studio_id` predicate; `POST /users/:userId/suspend` locks out any user on
the platform; `POST /users/:userId/revoke-sessions` mass-terminates sessions.

**Fix:** gate on `super_admin`. If gym owners need their own login history, add
an enforced `studio_id: user.studio_id` predicate.

### A-5 — 2FA admin-reset strips the second factor from any platform user

**File:** `backend/src/auth/two-factor.controller.ts:70-78` →
`two-factor.service.ts:605-624`

`@Roles('owner')`, and `adminReset2fa` does a bare `findUnique` on `userIdentity`
then clears `two_factor_enabled`, `two_factor_secret`, `two_factor_method` and
`two_factor_backup_codes` with no studio check. `admin.user_id` is used only for
logging, never for authorization. Same `auth/*` no-tenant-context exclusion.

**Exploit path:** Gym A's owner disables 2FA on a rival owner's account ahead of
a credential attack.

**Fix:** require `super_admin`, or verify the target shares a studio.

### A-6 — Kiosk mode fails *open* into the full staff app on restart

**Files:** `staff-app/app/kiosk/index.tsx`, `app/index.tsx:28`,
`src/auth/AuthGate.tsx:31-38`

Kiosk mode is pure navigation state — nothing persists that the device *is* a
kiosk. Only the exit PIN and pinned branch reach the Keychain
(`src/kiosk/pin.ts:24-25`), and neither is consulted at startup. Cold start is
unconditional: `<Redirect href={session ? '/(tabs)' : '/(auth)/sign-in'} />`.
`/kiosk` appears nowhere in the boot path.

**Attack path** (no tools, ~5 seconds): force-quit the unattended lobby tablet
from the app switcher — or wait for an OS memory kill. The app relaunches, reads
the still-valid staff session from SecureStore, and lands in `/(tabs)`: every
member's name, phone and address, payment history, the POS till.

Compounding, `app/kiosk/index.tsx:47` keeps the PIN attempt counter in React
state (resets on remount), and the lockout message at `:117` reads *"Close and
reopen the app to try again"* — which instructs the attacker to perform the
bypass. The 4-digit PIN therefore has no effective rate limit.

The code's stated defence is iOS Guided Access / Android screen pinning, which
is real — but it makes an OS setting a staffer may forget the only thing between
a passer-by and the member database, while setup copy claims the PIN is the
control.

**Fix:** persist a kiosk flag in SecureStore beside the PIN, gate `app/index.tsx`
and `AuthGate` on it, clear it only after a successful PIN check; persist the
attempt counter with backoff and fix the copy.

### A-7 — WebSocket gateways: no algorithm pinning, asymmetric→symmetric fallback

**Files:** `backend/src/check-ins/check-ins.gateway.ts:182-215`,
`subscription/subscription.gateway.ts:118-146`

**Verified:** `grep -rn "algorithms" backend/src` returns **nothing** — no
`jwtVerify` call anywhere pins the algorithm. These two gateways are the worst
case: they try a JWKS (asymmetric) verify, then fall through to an HMAC verify
on the same input, and the HMAC branch pins neither `issuer` nor `audience`.
Anyone who learns the HMAC secret — or exploits the RS256→HS256 confusion class
this shape invites — mints a socket session with attacker-chosen `studio_id`,
joining `gym:*` rooms to stream another gym's live check-in feed.

Note the two gateways read *different* secrets (`JWT_SECRET` vs
`SUPABASE_JWT_SECRET`) for the same claimed token type, which suggests the
fallback is not deliberate.

**Fix:** pass `{ algorithms: [...] }` to every `jwtVerify`, including
`jwt-auth.guard.ts:56`; delete the symmetric fallback in the gateways.

### A-8 — `front_desk` and `accountant` can refund money and rewrite gateway config

**Files:** `backend/src/payments/refunds.controller.ts:23-27`,
`payments/discounts.controller.ts:87-100`

Both routes carry `@Permissions({module:'payments', action:'create'})` and **no
`@Roles`**. `front_desk` holds `payments: ['view','create']`. So a front-desk
clerk can move money out via refunds, and — worse — write `webhook_secret` and
gateway credentials (`discounts.service.ts:142,173`), which forges payment
confirmation for the whole gym.

**Fix:** `@Roles('owner','brand_owner','manager')` on refunds; restrict
`payment-gateways` to owner tier — those are tenant-wide credentials, not
till-level operations.

### A-9 — Logout does not invalidate access tokens

**File:** `backend/src/auth/auth-session.service.ts:53`

`validateSession()` is defined and **never called** — `grep -rn "validateSession"
backend/src` returns only the definition. `JwtAuthGuard` verifies the signature
and checks the user row exists; it performs no session lookup.

So `POST /auth/logout` marks the DB row inactive and kills the *refresh* token,
but the issued access token keeps working until natural expiry. Same for
`revoke`, `revoke-all`, `suspend` and `revoke-sessions` — all report success
while tokens stay live. A stolen token survives the victim's logout; suspending
a compromised account does not evict it.

**Fix:** call `validateSession` in `JwtAuthGuard` after signature verification,
cached by token hash to protect the sub-100ms budget, or use a Redis denylist.

### A-10 — Real owner session committed to git: `backend/login.json`

**Verified:** still tracked in HEAD (`git ls-files` confirms), first committed
in `f1d4d9f` (2026-05-07).

A captured live login response containing a real `access_token`,
`refresh_token`, `session_id`, the owner's real email, and the real `user.id`,
`studio.id` and internal `studio_<uuid>` schema name.

The access token is **expired** (decoded `exp` = 2026-04-08T21:44:11Z), which
keeps this out of CRITICAL. The **refresh token is the live risk** — Supabase
refresh tokens carry no own expiry and stay redeemable until used or revoked.
Whether this one still is, is **unverified** (checking requires an auth-server
request, out of scope). Treat it as live.

`.gitignore:62` lists `login.json`, but the file was committed *before* that
rule and gitignore does not apply to tracked files — the rule creates false
confidence.

**Fix, in order:** (1) revoke the Supabase session now — this is the only step
that closes the exposure immediately; (2) `git rm --cached backend/login.json`;
(3) purge from history with `git filter-repo` + force-push. Step 3 is a
**CLAUDE.md hard-stop (#7)** and needs explicit sign-off; every clone must
re-clone. The studio/user UUIDs cannot be rotated, which is a further reason to
revoke rather than rely on the rewrite.

### A-11 — Session JWTs in `localStorage` and a non-httpOnly cookie

**Files:** `frontend/src/stores/auth-store.ts:66-68`, `:139-148`

Both the access token and the 7-day refresh token persist to `localStorage`
under `auth-storage`, and the access token is mirrored into a cookie written
from JS — which therefore **cannot** be `httpOnly`. One XSS yields a refresh
token valid for 7 days. Cookie flags are otherwise correct (`SameSite=Lax`,
`Secure` when https).

HIGH rather than CRITICAL because no working XSS was found — it is a severity
multiplier that leaves the app zero margin for one.

**Fix:** backend-set `httpOnly; Secure; SameSite=Lax` cookie for the refresh
token; keep only a short-lived access token in memory.

### A-12 — Web middleware performs no JWT validation

**File:** `frontend/src/middleware.ts:39-48`

The gate is presence of a non-empty `auth-token` cookie — no signature check, no
expiry, no role extraction. `document.cookie = "auth-token=x"` in any console
satisfies it. Every page guard is client-side and reads role from the same
attacker-writable `localStorage`, and `auth-store.ts:120` grants blanket access
to `owner`/`super_admin`/`brand_owner`.

Practical impact is **UI-only reconnaissance** — page structure, module names,
permission taxonomy — *provided* the backend rejects the calls those pages fire.
That proviso is the point: it is exactly what A-1, A-4 and A-8 show is not
uniformly true.

**Fix:** verify signature and `exp` in middleware (jose) and redirect on
invalid, not merely absent. This does not replace backend checks.

---

## MEDIUM

- **A-13 — `user_metadata.role` is client-writable and defaults to `'owner'`.**
  `jwt-auth.guard.ts:86-153`. `role`/`studio_id` come from Supabase
  `user_metadata`, which a user can write via `auth.updateUser()`; `metadata.role
  || 'owner'` means an *absent* claim yields the highest tenant role, and an RBAC
  outage (`catch` at :130) degrades every session to metadata-supplied roles.
  Documented as the known Phase-B gap, which is why it is MEDIUM — but its blast
  radius equals A-1. Moving `role`/`studio_id` to `app_metadata`
  (server-writable only) closes both; default to least privilege, not most.
- **A-14 — Supabase Realtime `check_ins` subscription has no tenant filter.**
  `frontend/src/hooks/use-realtime-checkins.ts:26-38` — the one place the web app
  talks to Postgres directly, with no `filter:` clause. Reasoned analysis says
  the RLS predicate (`current_setting('app.gym_id')`) is **fail-closed** for the
  anon role, so it is probably not leaking today. It is listed because it is
  *fragile*: the RLS migration covers `studio_template` while the hook subscribes
  to `public`, and per CLAUDE.md RLS is decorative here. Anyone "fixing" the
  apparently-broken tile with a permissive `authenticated` policy converts this
  into a full cross-tenant breach. **Whether `public.check_ins` exists and carries
  RLS is UNVERIFIED and is the single highest-value runtime check to run.**
  Related: `features/checkins/realtime.ts:246` reads localStorage key
  `'auth-store'` where the store persists as `'auth-storage'`, so the
  *authenticated* socket never connects — plausibly why this fallback exists.
  Fix that key, then delete the hook.
- **A-15 — `document.write` with unescaped API data.**
  `frontend/src/features/members/components/MemberIdCard.tsx:79-91` —
  `${memberCode}` interpolated raw into `<title>`. The window is `about:blank`,
  which inherits the opener's origin, so script there reads `localStorage` and
  chains into A-11. `features/reports/utils/export.ts` already has the correct
  `escapeHtml()` pattern to reuse. Severity depends on whether `member_code` is
  server-generated — **unverified**.
- **A-16 — IDOR on trainer dashboards.** `backend/src/staff/trainer.controller.ts:120,142`
  — `:id` is any staff UUID, ownership never checked, and `trainer`/`front_desk`
  hold `staff: ['view']`. Intra-gym peer-data leak (client rosters, performance
  history), not cross-tenant. Payslips are *not* affected — `payroll.controller.ts`
  role-gates every route.
- **A-17 — `stripSalary` bypassed on staff create/update.**
  `staff.service.ts:259,286` pass the literal `'owner'` as the caller's role, so
  a `manager` calling `POST`/`PATCH /staff` receives `salary` and the full
  nested `payroll_config` that `GET` would have redacted. Partially mitigated by
  `StripSecretsInterceptor`, but nested `payroll_config` fields are not in
  `OWNER_ONLY`. Thread the real `user.role` through.
- **A-18 — Android `allowBackup="true"` with both referenced rule files missing.**
  `staff-app/android/app/src/main/AndroidManifest.xml` references
  `@xml/secure_store_backup_rules` and `@xml/secure_store_data_extraction_rules`;
  `res/xml/` does not exist. Default unrestricted backup then covers
  `musclex-staff-cache.db`, which holds the persisted `members` query cache
  (full name, phone, email, member code). Note `android/` is gitignored prebuild
  output, so **whether an EAS build reproduces this is unverified.**
  Fix: `android.allowBackup: false` in `app.json`.
- **A-19 — `@Roles('owner','admin')` — `'admin'` is not a real role.**
  `platform.controller.ts:40,48,95,109,157`, `webhooks.controller.ts:26`,
  `integrations.controller.ts:26`. Dead text today (these resolve owner-only via
  the tenant bypass, which is *stricter* than intended). Latent: if a gym ever
  creates a custom role named `admin`, `resolveRoleId` matches by name and it
  silently inherits SSO management, feature flags and webhook secret rotation.
- **A-20 — `POST /api/v1/auth/onboarding` is unauthenticated and unthrottled.**
  `auth.controller.ts:163` creates a studio *and* a `role:'owner'` user. Self-serve
  signup is legitimate; the missing `@Throttle` is not — it invites schema-spam
  resource exhaustion. Every other public auth route is throttled.
- **A-21 — No `script-src` CSP, no HSTS.** `frontend/src/middleware.ts:96-104`
  sets `frame-ancestors`, `object-src`, `base-uri`, `form-action` — genuinely
  good — but no `script-src`, so the CSP offers **zero XSS mitigation** on a flow
  that loads Razorpay Checkout. It is the control that would have contained
  A-15. The deferral is deliberate and the code enumerates the origins a future
  policy needs. **Whether HSTS is set at the proxy is unverified** — worth a
  `curl -I`, since the `Secure` cookie flag is conditional on https.
- **A-22 — Plan entitlements are enforced only in the client.**
  `staff-app/src/rbac/Gate.tsx:59-71`. A modified client reaches
  `marketing_campaigns`, `ai_advisor`, `multi_branch` regardless of the gym's
  tier. Revenue integrity as much as security. Client-side role gating is
  correctly documented as non-authoritative in three places — this is about
  whether the *server* re-checks.
- **A-23 — Public checkout context has no ownership proof.**
  `public-portal.controller.ts:57` — `GET /public/checkout/:orderId`,
  unauthenticated by design, throttled 30/min. Protection rests entirely on
  `orderId` entropy. **Unverified:** the return shape was not read; if it carries
  name/email/phone, confirm the ID is high-entropy random, not sequential.

---

## LOW

- **A-24** — `InternalSecretGuard` uses non-timing-safe `!==`
  (`internal-secret.guard.ts:27`). The correct `timingSafeEqual` pattern already
  exists in `onboarding/internal.controller.ts:34-39`.
- **A-25** — `BranchAccessGuard` returns `true` when no branch context is present
  (`branch-access.guard.ts:50`). Documented as intentional (ALS handles scoping),
  but it makes the guard a no-op on any route lacking a branch identifier.
- **A-26** — `GET /debug/sentry-test` (`app.controller.ts:12`), unauthenticated,
  env-gated, marked "REMOVE after launch" in code.
- **A-27** — `iclock` endpoints authenticate on device serial only
  (`check-ins/biometric/iclock.controller.ts:24-67`). A protocol constraint of
  ADMS, honestly documented; a leaked serial lets an attacker inject attendance.
  Mitigation is network-level (IP allowlist / mTLS), not code.
- **A-28** — Deep link `musclex-staff://(auth)/two-factor?tempToken=<x>` reaches
  `verifyTwoFactor` unvalidated (`staff-app/app/(auth)/two-factor.tsx:18,25-28`).
  Low: the attacker must already hold a valid temp token (i.e. the victim's
  password) *and* a correct TOTP. Realistic outcome is a confusing failed login.
- **A-29** — Kiosk PIN on web is an unsalted client-side SHA-256 in
  `localStorage` with a resettable attempt counter
  (`frontend/src/features/checkins/kiosk/KioskPinLock.tsx:108-138`). The file's
  own comment correctly scopes it as a tamper-deterrent, not an API boundary.

---

## Dependency CVEs (osv-scanner)

229 advisories across the three apps: 2 CRITICAL, 100 HIGH, 111 MODERATE, 16 LOW.
Most are transitive dev-tooling and not reachable in production. Triaged:

| Package | Sev | Assessment |
|---|---|---|
| `next@14.2.35` (frontend, direct) | HIGH ×21 | The one that matters. **But most of the severe advisories do not apply**: the SSRF-in-Server-Actions, DoS-via-Server-Actions and Server-Function-disclosure issues all need Server Actions, and this app has **zero** (verified). The i18n middleware bypass needs Pages Router + i18n; this is App Router with no i18n (verified). Real residual exposure is cache-poisoning and image-optimizer DoS. Fix is 15.5.21+ — a major-version jump that needs its own testing slice. **Not an emergency.** |
| `handlebars@4.7.8` (backend) | CRITICAL | JS injection via AST type confusion. Reachable only if a template is attacker-controlled — **unverified** which templates exist. |
| `@xhmikosr/decompress@10.2.0` (backend) | CRITICAL | Zip-slip. Almost certainly build-time tooling, not runtime. |
| `axios@1.13.6` (backend) | HIGH ×10 | MitM via prototype pollution in `config.proxy`. Only exploitable if proxy config is attacker-influenced. |
| `multer@2.0.2` (backend) | HIGH ×4 | DoS via uncontrolled recursion — reachable, this app takes uploads. |
| `ws`, `engine.io`, `socket.io-parser` | HIGH | Memory-exhaustion DoS. Server-side and reachable — the app runs Socket.IO gateways. |
| `brace-expansion`, `picomatch`, `js-yaml`, `glob`, `flatted`, `tmp` | HIGH | Dev/build tooling ReDoS. Not reachable in production. Noise. |

---

## Scanner results

- **gitleaks:** 10 hits, **9 false positives** (the `generic-api-key` rule firing
  on `const KEY = 'storage.key'`, and `stripe-access-token` on the literal
  `sk_live_` inside a PII-scrubber *test fixture*). The 1 true positive is A-10.
  Worth a `.gitleaksignore` so the signal stays readable.
- **trufflehog (git history):** **zero verified credentials across all history.**
- **trufflehog (filesystem):** one verified live credential — the production
  Postgres superuser password in `backend/.env.remote`. **Correctly contained:**
  never committed (`git log --all --full-history` empty), gitignored, and the
  password appears nowhere else in the tree. No rotation indicated on this
  evidence; move to a secret manager and rotate on any suspicion of endpoint
  compromise.
- **semgrep** (211 rules, `p/default` + xss + sql-injection + command-injection,
  1397 files): 8 findings, 2 ERROR — both `createDecipheriv` GCM calls without
  an explicit auth-tag length (`auth-sso.service.ts:200`, `auth.service.ts:1384`).
  The rest are test files and one already-escaped export path.
  *Caveat: registry rulesets `p/security-audit`/`p/owasp-top-ten` needed
  authentication and did not run; coverage is narrower than a full CI semgrep.*
- **osv-scanner:** see above.

---

## Checked and clean

Recording these because they are load-bearing and several are better than typical:

- **Tenant-model drift is closed.** `backend/src/prisma/tenant-models.spec.ts` is
  a real CI-enforced drift guard and passes 4/4. All 12 models carrying
  `gym_id`/`studio_id` but absent from `TENANT_MODELS` are `@@schema("public")`
  and were individually assessed — 10 safe, 2 are A-2/A-4.
  **Its gap: it only inspects fields named `gym_id`**, so the `studio_id`-named
  public models are invisible to it — which is exactly where both leaks live.
  Extending it is the fix that would have caught these mechanically.
- **No SQL injection.** 94 raw-SQL sites reviewed; `$queryRawUnsafe` calls
  interpolate only a schema name validated against `/^studio_[0-9a-f_]+$/i`, with
  all user values bound as parameters.
- **Global `ValidationPipe`** runs `whitelist` + `forbidNonWhitelisted` +
  `transform` and **no controller overrides it** (grep-verified) — mass
  assignment is blocked. This is what limits A-1 to the fields the DTO declares.
- **Webhook HMAC verified timing-safe before processing** — Razorpay (with a
  300s replay window), Stripe, and WhatsApp, which correctly *refuses* when
  unconfigured.
- **Login lockout is real** — 5 fails → 15 min, plus a 50/hr per-IP layer. Note
  it is **DB-backed, not Redis** as the docs claim; the DB version is stronger
  (survives restart). Worth correcting in CLAUDE.md.
- **Member BFF audience separation** is sound: member JWTs are HS256 with
  `aud=member`, issuer pinned, opaque rotating refresh tokens stored as SHA-256.
  Tenant context comes from the verified JWT claim, never client input.
- **No `service_role` key reaches any browser or device bundle.** All 16
  `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` vars across five apps are legitimately public.
- **No hardcoded or fallback signing secrets.** Every JWT/encryption secret
  fails fast at boot rather than defaulting.
- **No private keys or signing material committed** anywhere; `staff-app/android`
  and `ios` have **0 tracked files** (gitignored prebuild output).
- **`dangerouslySetInnerHTML` still zero** in `frontend/src` — the 2026-08-26
  finding holds. No `eval`, no `new Function`, no `javascript:` URLs.
- **frontend has zero Route Handlers and zero Server Actions** — no server-side
  attack surface, and no SSRF, in the web app at all.
- **Sentry PII scrubbing is thorough on both web and mobile** — 40-key deny-list
  including `face_descriptor` and `biometric_template`, stack-frame locals
  scrubbed, console breadcrumbs dropped, `sendDefaultPii: false`.
- **Face descriptors handled correctly** — computed on-device, never persisted to
  storage, never in a URL.
- **staff-app credential storage is correct** — SecureStore only, **zero**
  AsyncStorage usage. The persisted query cache uses an allowlist (not a
  denylist), excludes payments and member detail, is tenant-keyed and wiped on
  scope change, with a 12-hour max age.
- **staff-app QR trust boundary is right** — the scanned string is forwarded
  verbatim to the server and never used to navigate or identify a member
  client-side.
- **staff-app transport** — HTTPS enforced; the release build **refuses** to fall
  back to a localhost API and throws early rather than issuing the request.
- **KNOWN-OPEN now closed:** the four unscoped `referrals-admin` reads
  (`GET /`, `/overview`, `/analytics`, `/fraud-queue`) all call
  `assertPlatformAdmin` as of this reading. The previously-noted gap is
  remediated. The 2026-08-26 F-1/F-2/F-3 fixes are all sound.

---

## Suggested order

1. **A-1**, **A-2**, **A-3** — three small, self-contained backend changes that
   close self-promotion to tenant admin, cross-tenant account takeover, and
   unauthenticated reward fraud.
2. **A-10** — revoke the Supabase session, then untrack the file. History rewrite
   is a separate, gated decision.
3. **A-4**, **A-5** — change two `@Roles('owner')` to `super_admin`.
4. **A-6** — persist the kiosk flag; ship with the attempt-counter fix.
5. **A-7**, **A-8**, **A-9** — pin JWT algorithms, role-gate refunds/gateways,
   wire `validateSession` into the guard.
6. **A-14** — resolve the `public.check_ins` RLS question, fix the localStorage
   key, delete the Supabase hook.
7. **A-13** — Phase-B `app_metadata` migration; closes A-1's blast radius too.

## Runtime checks worth running (this audit could not)

- Does `public.check_ins` exist, and does it have RLS enabled and forced? (A-14)
- Is the `backend/login.json` refresh token still redeemable? (A-10)
- Is HSTS set at the nginx/VPS layer? (A-21)
- Is `member_code` server-generated or user-influenced? (A-15)
- Does an EAS-produced Android build reproduce the missing backup rules? (A-18)
- Is `MEMBER_DEV_OTP` unset in the production environment?

## Noted for later (seen, not investigated)

- `api-key.guard.ts:52` issues `SET search_path` via `$executeRawUnsafe` on a
  **pooled** connection — the same cross-connection hazard `staff-invite.service.ts:253-257`
  explicitly worked around with ALS. Worth a dedicated look.
- `rbac.service.ts:392` `removeRole(userRoleId)` is unscoped; currently has no
  controller, but wiring one up would create an instant IDOR.
- The `api/v1/auth/*` exclusion from `TenantMiddleware` (`app.module.ts:169-175`)
  is a structural sharp edge — any future `auth/` endpoint silently has no
  tenant context. A-4 and A-5 both live there. Worth a comment at minimum.
- **Member BFF horizontal IDOR was not swept** — whether member A can read member
  B's data *within the same gym* is not caught by `gym_id` injection and needs
  its own pass over invoices, progress photos, body stats, and AI conversations.
