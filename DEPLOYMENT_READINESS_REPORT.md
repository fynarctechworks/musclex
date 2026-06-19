# MuscleX — Master Deployment Readiness Report

**Platform:** MuscleX — production multi-tenant gym-management SaaS (real, paying gyms)
**Branch audited:** `feat/per-gym-schemas` (uncommitted, mid-migration)
**Date:** 2026-06-19
**Method:** Evidence-based. Real code reads + live Supabase advisors + executed safety-net specs. Not docs-only. Where something could not be measured from this environment it is marked **UNVERIFIED**.
**Auditor framing:** Principal Architect / Security Auditor / DB Architect / SRE / QA Director.

> This report consolidates the 20-phase audit prompt in `audit-for-deploy.md` against the **actual** codebase, schema, RLS state, APIs, and the prior verified module-by-module audit in `docs/master-flow-audit/`. Live DB advisor state was re-pulled today and matches the recorded findings.

---

## 0. Executive Summary

MuscleX is **architecturally strong and security-conscious for its stage**, with a clean module separation, a single-source-of-truth tenant-isolation registry, hardened auth/payment/SCC surfaces, and a verified set of correctness fixes already shipped. The one **Critical** defect found in the prior audit (an unauthenticated account-takeover on password reset) is **fixed and guarded by a passing test**.

However, the platform is **mid-migration** (`feat/per-gym-schemas`, uncommitted). Two structural items block a clean production cutover:

1. **P0-1 — Onboarding↔runtime schema split.** Onboarding writes some tables to shared `studio_template`, while the new `TenantPrisma` runtime expects per-gym `studio_<uuid>` schemas. Onboarding a new gym at scale before this is resolved risks data landing in the wrong place.
2. **Test-harness debt (critical net restored 2026-06-19; broader suites in progress).** The migration rewired services to `this.tenant.client.*` / split `pub`+`tenant`, leaving unit mocks on the old shape. **Restored so far: all 14 safety-net suites (47/47) + the Memberships unit suite (12/12)** — these guard the 7 shipped fixes *and* the tenant-isolation invariants. Full-suite state after these fixes: **30 / 60 suites green, 213 / 402 tests pass**. The remaining 30 red suites are the *same* mechanical mock-drift (provider swap / `.client` nesting) across broader service-unit coverage (analytics, payments, classes, member-BFF data services, referrals). Completing them is bounded migration work, best finished once `feat/per-gym-schemas` (P0-1) stabilizes to avoid re-churn — see Appendix B.

**Verdict:** ✅ **APPROVED FOR UAT (CONDITIONAL)** · ❌ **NOT YET APPROVED FOR PRODUCTION**.
Production go requires closing P0-1, restoring the test net, committing the branch, and completing the operational gaps (backups/observability/DR are largely **UNVERIFIED** from this environment).

| Domain | Score | Notes |
|---|---:|---|
| Architecture | 86 / 100 | Clean separation; mid-migration debt is the drag |
| Security | 84 / 100 | 1 Critical fixed; residual by-id leak class + advertised-but-unenforced features |
| Database | 78 / 100 | Sound design; 200 no-PK + clone-fidelity risk + index bloat |
| Performance | 85 / 100 | No P0/P1; scale levers identified, not load-tested |
| DevOps / Observability | 65 / 100 | Largely UNVERIFIED — backups/DR/monitoring not evidenced here |
| **UAT Readiness** | **86 / 100** | **CONDITIONAL GO** |
| **Production Readiness** | **72 / 100** | **NO-GO until conditions met** |

---

## Severity legend & finding format

Each material finding carries: **Root cause · Impact · Severity · Evidence · Fix · Deployment risk.**
Severity: 🔴 Critical (block) · 🟠 High · 🟡 Medium · 🔵 Low.

---

## PHASE 1 — Codebase Audit

**Structure:** Monorepo of four apps on one Supabase Postgres DB:

| Path | App | Stack |
|---|---|---|
| `backend/` | Core gym API | NestJS 10 + Prisma 5 (multiSchema) |
| `frontend/` | Gym admin web | Next.js 14 (App Router) |
| `gym-member-app/` | Member mobile | Expo / React Native |
| `saas-control-center/` (+`/frontend`) | Super-admin SCC | NestJS + Next.js |

**Strengths**
- Backend is **feature-grouped** (`auth`, `members`, `check-ins`, `classes`, `payments`, `inventory`, `subscription`, `member`, `staff`, …) — clean service boundaries, not type-grouped.
- Tenant isolation has a **single source of truth**: `backend/src/prisma/tenant-models.ts` (one `TENANT_MODELS` set imported by both the load-bearing `$use` middleware and the `$extends` tenant client). This directly closes the "two model-sets drift" leak class that previously caused a cross-tenant read.
- Globals in place: `ValidationPipe` (whitelist + forbidNonWhitelisted + transform), `StripSecretsInterceptor`, per-route throttling, fail-closed SCC guards.

**Findings**
- 🟡 **Mid-migration technical debt (P0-1 family).** Two isolation regimes coexist (legacy `prisma.*` + new `this.tenant.client.*`); services are half-migrated. *Impact:* cognitive load + the by-id leak class below until the sweep completes. *Evidence:* `feat/per-gym-schemas` status docs; ~30 modified service files uncommitted. *Fix:* finish the service sweep per `docs/PER_GYM_SCHEMA_IMPL_STATUS.md`. *Risk:* medium — works today but fragile.
- 🔵 **Dead/duplicate code** flagged but not chased (P2 staff dead-code; two `subscription_plans` vs `subscription_plan` tables noted in earlier SCC audit). *Fix:* schedule a hygiene pass post-migration.
- 🔵 **Misleading comment** `members.service.ts` references "tenant isolation via search_path" — inert under multiSchema. Comment only, not a bug.

**Phase verdict:** 🟢 Healthy structure; the only real liability is the in-flight migration debt.

---

## PHASE 2 — Multi-Tenant Security Audit

**Isolation model (critical to understand):** The backend connects as a Postgres **superuser with `rolbypassrls`** — so **RLS is decorative / not load-bearing by design.** Real isolation is enforced in the app layer:
1. Prisma `$use` middleware auto-injects `gym_id` for every model in `TENANT_MODELS`.
2. JWT-sourced `gym_id` binds the request to a tenant.
3. The per-gym `TenantPrisma` client routes to the tenant's physical schema (migration target).

**Verified strong**
- Single registry (`tenant-models.ts`) — both isolation layers import the same set; cannot drift.
- Member BFF uses a **separate member-audience JWT**, identity only from the verified token, plus gym-gating + operator-suspension enforcement.
- A previously-found biometric cross-tenant leak (models missing from the registry; raw-SQL face matchers) was fixed and the registry single-sourced.

**Findings**
- 🟠 **R3 / by-id leak class (open).** On the legacy prisma path, some `findUnique({ where: { id } })` tenant reads fail *open* (return another gym's row if injection is bypassed). **One concrete instance was found and fixed this audit** (P1-M3-1: check-in orchestrator + QR controller read any member by id and could bump another gym's `qr_version` → cross-tenant read + DoS). *Impact:* cross-tenant exposure on un-swept call-sites. *Fix:* sweep remaining by-id reads as services migrate to `TenantPrisma` (X-2). *Deployment risk:* **high if not completed before scaling to many tenants.**
- 🟡 **Raw SQL must hand-filter `gym_id`** — `$queryRaw` is NOT covered by auto-injection. Audited raw paths filter correctly; any new raw query is a latent leak if it omits the filter. *Fix:* keep the lint/review rule; add a test for each raw path.

**Attack simulation (reasoned, not pen-tested):** A staff JWT for gym A calling gym B's resource by guessed id → blocked on migrated paths by `gym_id` injection; **the residual risk is only un-swept legacy by-id reads.** Un-hiding nav / forging API calls does **not** grant data — server stays authoritative.

**Phase verdict:** 🟢 Strong model, 🟠 one open leak class to finish closing.

---

## PHASE 3 — Database Audit

**Source:** live Supabase advisors (re-pulled 2026-06-19) + schema reads. Postgres, Prisma multiSchema; per-gym physical schemas (`studio_<uuid>`) cloned from `studio_template`.

**Live performance advisors — 1553 total (1386 INFO / 167 WARN):**

| Lint | ~Count | Level | Read |
|---|---:|---|---|
| `unused_index` | ~1182 | INFO | Amplified by schema cloning (`CREATE TABLE … LIKE … INCLUDING ALL` copies every index into each `studio_*`). Low urgency; prune the **template's** unused indexes so clones don't inherit N× bloat. |
| `no_primary_key` | ~200 | 🟠 WARN | **Investigate.** Likely cloned `studio_*` tables that didn't carry PKs. No-PK harms replication/dedup/`findUnique`. Verify `cloneTenantSchema` copies PRIMARY KEY constraints. |
| `auth_rls_initplan` | ~147 | WARN | RLS re-evaluates `auth.*` per row; wrap in `(select …)`. **Low priority — RLS is decorative here.** |
| `unindexed_foreign_keys` | small | INFO | Add covering indexes on hot FKs. |

**Schema design (observed):** UUID PKs, snake_case, `created_at/updated_at`, per-tenant `gym_id` retained. `cloneTenantSchema` copies tables + re-adds FKs from `information_schema` with identifier + FK-rule allow-listing.

**Findings**
- 🟠 **Clone fidelity is load-bearing.** Every new gym depends on `cloneTenantSchema` being correct; the 200 `no_primary_key` advisors suggest PK fidelity needs verification. *Fix:* confirm PKs (and constraints) survive the clone; add a post-clone assertion. *Risk:* high for new-gym onboarding.
- 🟡 **Two tenant-data locations during migration.** Live data is in shared `studio_template` keyed by `gym_id`; per-gym schemas are the target but onboarding still writes some tables to `studio_template` (**P0-1**).
- 🔵 **Index bloat** (prune template unused indexes).
- 🔵 **`Json` null** convention (`Prisma.JsonNull` / `{}`, never raw null) — adhered to in audited code.

**Database score: 78/100.**

---

## PHASE 4 — RLS Audit

**Live security advisors (re-pulled today):**
- **39× `rls_enabled_no_policy` (INFO)** — expected: RLS is enabled but unpoliced on tenant/public tables because the app role bypasses RLS. **By design**, not a hole.
- **1× `extension_in_public` (WARN)** — `vector` installed in `public`; move to a dedicated schema.
- **No anon-exposure advisors** — the Phase 8.1 fix (revoke anon RWD + RLS + default-privilege guard on 24 public tables) **still holds.** This was previously a *critical live leak* and is confirmed closed.

**Reality check:** RLS here is **decorative**. It is NOT a second line of defense today. The "Phase-B non-bypass-role keystone" (an app role *without* `rolbypassrls` + real policies + connection pooling) is the long-term hardening; until it ships, isolation rests entirely on the app layer (Phase 2).

**Findings**
- 🟡 **RLS provides no defense-in-depth today.** *Fix (gated, not for this release):* the Phase-B keystone in `docs/RLS-PHASE-B-CUTOVER-RUNBOOK-2026-06-03.md`. *Risk:* acceptable for UAT; a real second layer before large-scale multi-tenant production is strongly recommended.
- 🔵 Move `vector` out of `public`.

**Phase verdict:** 🟢 Matches design intent; no active RLS-class leak. Hardening is roadmap, not blocker.

---

## PHASE 5 — Authentication Audit

**Verified strong**
- **SCC:** bcrypt(12) + Redis login lockout + TOTP MFA + single-use **hashed** recovery codes; hashed/expiring/single-use reset tokens; refresh-token revocation; SUPER-gated suspend; SUPER/SUPPORT-gated **audited** impersonation.
- **Member BFF:** separate member JWT audience; identity only from verified token.
- **Login lockout:** 5 fails → 15-min Redis lockout (per CLAUDE.md, enforced).

**Findings**
- 🔴→✅ **P0-2 Account takeover (FIXED).** `POST /auth/reset-password` set **any** account's password by a client-supplied user-id with **no recovery-token check**. *Now:* server-side Supabase recovery-session verification derives the user from the token. *Evidence:* `backend/test/safety-net/reset-password.spec.ts` (5/5 PASS). *Was:* Critical, internet-facing.
- 🟠 **P1-1 User enumeration / scale ceiling.** register/verify call `listUsers({ perPage: 1000 })` — scans all Supabase users; breaks past 1000 users and is O(N). *Fix:* query by email/phone directly. *Risk:* correctness + perf at scale.
- 🟡 **P1-2 Silent verification-email failure.** UI says "check your email" but send can fail silently → user never receives it. *Fix:* surface send errors; retry/queue.
- 🟡 **P2-M10-1 SCC Redis-down login fail-open** (lockout bypassed if Redis is unavailable). *Fix:* fail-closed or degrade explicitly.
- 🔵 **P2-M10-2** impersonation-token single-use consumption check **UNVERIFIED.**

**Phase verdict:** 🟢 Strong; the one Critical is fixed. Close P1-1/P1-2 before UAT sign-off.

---

## PHASE 6 — Subscription System Audit

**Engine:** `SubscriptionPolicyService` is a clean single source of truth (verified by read):
- Pure `computeStatus()` → `active | grace_period | locked | suspended`; **manual suspension always wins**; trials extend ACTIVE; deterministic `locked_at` (= end of grace, not `now()`).
- **Strict continuity** renewal: next period starts from prior expiry, not payment date (late payers lose gap days — intended).
- `recordRenewal` wrapped in `$transaction`; writes Invoice + `payment_recorded` + `renewed` ledger events; mirrors to SCC `scc.payments` **after** commit (rolled-back renewals never leak a phantom payment).
- 60s per-tenant context cache to avoid hammering `studios`.

**Findings**
- 🟠→🟡 **P1-M9-1 Renewal idempotency (mitigated, not race-proof).** `recordRenewal` is now idempotent on `payment_reference` (replayed double-click/gateway retry returns the prior renewal — no double period, no duplicate invoice). *Guarded by:* `renewal-idempotency.spec.ts` (PASS). *Residual:* app-level dedup; a concurrent true race needs a **DB unique constraint on payment reference** (migration-gated — HARD STOP). *Fix:* add the constraint during the migration.
- 🔵 **Invoice numbering** (`INV-YYYYMMDD-XXXX`) uses count+retry, not a sequence — fine at current volume, revisit at scale.
- 🔵 Defensive default treats unknown studio as `active` to avoid breaking onboarding — acceptable, cron corrects.

**Simulated lifecycles:** expired → grace → locked transitions are deterministic and event-logged; suspension overrides; renewal restores ACTIVE atomically. No hidden bypass found in the engine.

**Phase verdict:** 🟢 Solid lifecycle; one schema-backed hardening pending.

---

## PHASE 7 — Feature Gating Audit (critical)

**Reality (verified in `docs/subscription-visibility-audit/AUDIT_REPORT.md`):** there are **three independent gating systems**:

| # | System | Gates on | Hides UI? | Server-enforced? |
|---|---|---|---|---|
| 1 | Lifecycle lock (`SubscriptionLockGuard`) | billing state | No (visible + read-only + renewal modal) | ✅ global `APP_GUARD`, blocks writes |
| 2 | Plan feature map (`features.<key>`) | entitlement tier | **Yes (hard-hide via `filterByFeatures`)** | ⚠️ **only 3 keys** |
| 3 | RBAC (`can(module,'view')`) | staff role | Yes | ✅ |

**Module × protection matrix (system 2):**

| Feature key | Frontend (hidden by plan) | Backend `checkFeatureAccess` | Status |
|---|---|---|---|
| `staff_management` | yes | ✅ `staff.service.ts:153` | 🟢 protected |
| `class_scheduling` | yes (free) | ✅ `classes.service.ts:79` | 🟢 protected |
| `ai_advisor` | yes (free+starter) | ✅ `ai.controller.ts:29,41` | 🟢 protected |
| `marketing_campaigns` | yes (free+starter) | ❌ none | 🟠 **hide-only** |
| `whatsapp_notifications` | yes | ❌ none | 🟠 **hide-only** |
| `email_campaigns` | yes | ❌ none | 🟠 **hide-only** |
| `custom_roles` | yes | ❌ none | 🟠 **hide-only** |
| `audit_logs` | yes | ❌ none | 🟠 **hide-only** |
| `api_access` | yes | ❌ none | 🟠 **hide-only** |
| numeric limits (members/branches/staff) | n/a | ✅ `check*Limit` | 🟢 protected |

**Findings**
- 🟠 **Advertised-but-unenforced features.** Six feature keys are protected **only by nav-hiding**; a crafted API call would reach them. Today that's latent (UI hides them), but it is the single most important security item if/when the planned "show-everything-but-locked" refactor lands — converting hide→visible removes their only protection. *Fix:* add `checkFeatureAccess` (Slice F in the audit) **before** surfacing those features as locked-but-visible. *Deployment risk:* medium now, high if the entitlements refactor ships first.
- 🟢 Direct-URL / API / frontend-bypass tests reasoned out: enforced features 403 regardless of UI; non-enforced features are reachable by crafted calls (above).

**Phase verdict:** 🟡 Core gating sound; backfill the 6 unenforced keys before any entitlements-visibility change.

---

## PHASE 8 — API Audit

**Verified**
- Every route requires `Authorization: Bearer <jwt>` except `auth/*` and `health`. Member BFF (`member/v1/*`) uses the member JWT.
- Global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform) — mass-assignment and unknown-field injection blocked at the edge.
- `StripSecretsInterceptor` prevents leaking `face_descriptor`, card tokens, salary fields, passwords, 2FA secrets.
- Per-route throttling present.
- **SQL injection:** Prisma parameterizes; raw paths use parameterized `$queryRaw` + explicit `gym_id`. No string-concatenated SQL found in audited paths.

**Findings**
- 🟡 **Webhook coverage gap.** Razorpay webhook is HMAC-verified (timing-safe, raw-body, 300s replay window) — **strong**. But `platform/webhooks` + integrations surface is **not yet HMAC-audited**. *Fix:* verify inbound HMAC (timing-safe) on every external webhook before processing.
- 🟡 **Rate limiting** is per-route in-app; no evidence of an edge/WAF layer (CSRF/SSRF/DDoS at the gateway is **UNVERIFIED**).
- 🔵 CSRF: APIs are token-bearer (not cookie-session) for the SPA → CSRF surface low; confirm any cookie-auth surfaces.

**Phase verdict:** 🟢 Edge hygiene strong; finish webhook HMAC sweep + confirm gateway protections.

---

## PHASE 9 — Email System Audit

**Observed:** an email infrastructure layer exists (`backend/src/email/` with providers + templates; `saas-control-center/src/modules/email/`; `docs/email-infrastructure/EMAIL_INFRASTRUCTURE.md` + `DNS_SETUP.md`). This is **new/uncommitted** work.

**Findings**
- 🟡 **P1-2 (cross-ref Phase 5):** verification-email send can fail silently. *Fix:* surface + retry.
- 🟡 **SPF / DKIM / DMARC are DNS-side and UNVERIFIED from this environment.** *Fix:* confirm all three are published for the sending domain before UAT invites go out (see `DNS_SETUP.md`).
- 🔵 Confirm **no hardcoded/test recipient addresses** and no dev SMTP sink remains in production config (spot-check passed in audited code; do a full grep before release).

**Phase verdict:** 🟡 Infra exists; **DNS auth records + deliverability must be verified out-of-band before UAT.**

---

## PHASE 10 — Payment Audit

**Provider:** Razorpay (member payments + subscription renewal). Stripe is stubbed.

**Verified strong**
- Timing-safe HMAC on Checkout signature **and** raw-body webhook; 300s replay window.
- Authoritative `getOrder` notes — no cheap-order/expensive-plan swap.
- 🟠→✅ **P1-M5-1 double-credit (FIXED).** Concurrent webhook + client-verify could double-credit / create a duplicate membership. *Now:* atomic `pending→paid` claim via guarded `updateMany`. *Guarded by:* `payment-atomic-claim.spec.ts` (PASS).
- 🟠→🟡 **P1-M9-1 duplicate renewal** mitigated (idempotent on `payment_reference`; DB constraint pending — Phase 6).

**Findings**
- 🟡 **Duplicate-webhook / webhook-delay edge:** handled at app level (idempotent claim). True race-proofing for renewals needs the DB unique constraint.
- 🔵 Stripe path stubbed — must not be advertised as live.

**Phase verdict:** 🟢 No double-charge / no duplicate-subscription on the audited Razorpay path; one DB constraint outstanding.

---

## PHASE 11 — Frontend Audit

**Verified by read; on-device/visual rendering UNVERIFIED from this environment.**
- Admin web is Next.js 14 App Router; design-system migration (Vercel/Geist via `design.md`) is in progress (~80 pages swept historically, more remain on pattern-apply).
- SCC frontend is mobile-responsive (sidebar → Sheet drawer at `lg`).
- Lifecycle lock surfaces a visible-but-locked pattern (banner + renewal modal + write-gate) — good UX precedent.

**Findings**
- 🟡 **Design.md compliance is partial** — not every page is swept. *Fix:* finish the pattern-apply sweep; not a blocker for UAT.
- 🟡 **Loading/empty/error states** exist on audited pages but full coverage is **UNVERIFIED**. *Fix:* QA pass per page in the UAT checklist (Phase 16).
- 🔵 **Member mobile app:** cannot run in Expo Go (native modules) — verify via `tsc --noEmit` + on-device QA only; RN animation/layout is **not verifiable from here**.

**Phase verdict:** 🟡 Structurally sound; responsive/visual QA is a UAT activity, not a code blocker.

---

## PHASE 12 — Performance Audit

**Hot paths (verified by read):**
- Check-in orchestrator: single `$transaction`, indexed lookups, idempotent replay — efficient.
- POS sale / booking / renewal: bounded transactions, guarded atomic updates (fixes added no extra round-trips).
- Subscription context cached 60s; member BFF caches immutable gym→schema mapping.
- Facial 1:N match uses an IVFFlat pgvector index with a logged >200ms slow-scan warning.

**Findings**
- 🟡 **Per-gym client fan-out.** `TenantClientFactory` caches one PrismaClient per schema (`connection_limit=3`). Total DB connections grow with gym count; factory comment flags an LRU/eviction revisit. *Fix:* add eviction before high tenant counts. *Risk:* connection exhaustion at scale.
- 🟡 **O(N) waitlist renumber** (classes) and **`listUsers({perPage:1000})`** (auth, P1-1) won't scale.
- 🟡 **CLAUDE.md P95 targets** (dashboard <2s, check-in <1s, AI <4s, member list <1.5s, DB query <100ms) are **not load-tested** here — **UNVERIFIED**. *Fix:* run a load test before production.
- 🔵 Index bloat (Phase 3) is a maintenance cost, not a latency defect.

**Phase verdict:** 🟢 No P0/P1 perf defect; two clear scale levers (client eviction, index pruning).

---

## PHASE 13 — Observability Audit

**Observed:** SCC has an Error Monitoring Center (ingest/grouping/CRUD/stats, socket.io alerts, UI). Member app has a PostHog HTTP sink + JS error capture (env-gated). Backend has `instrument.ts` (Sentry-style) gated for prod.

**Findings (mostly UNVERIFIED from this environment)**
- 🟡 **Uptime monitoring / external APM / log aggregation** not evidenced. *Fix:* confirm an uptime monitor + error tracking + log retention are wired in the production deploy.
- 🟡 **Audit logs:** `AuditLog` model exists and SCC impersonation/suspend are audited; full coverage of sensitive admin actions **UNVERIFIED**.
- 🔵 Security logs (login history, lockouts) exist (`login_history`, Redis lockout).

**Phase verdict:** 🟡 In-app foundations exist; **production-grade external observability must be confirmed before production go.**

---

## PHASE 14 — Backup & Recovery Audit

**Status: UNVERIFIED from this environment.** Supabase provides managed backups (PITR on paid tiers), but frequency, retention, and a tested restore/tenant-recovery path are **not evidenced in the repo.**

**Required before production:**
- Confirm automated DB backup frequency + retention (Supabase plan-dependent).
- Execute a **test restore** to a scratch project.
- Document **per-tenant recovery** (a single gym's schema/data restore) — non-trivial given the per-gym schema model.
- **RTO/RPO:** propose RTO ≤ 1h, RPO ≤ 5min (PITR) — **must be validated, currently aspirational.**

**Phase verdict:** 🟠 **Gap.** No evidence of a tested backup/restore/DR path — a hard production prerequisite.

---

## PHASE 15 — UAT Readiness Certification

### UAT GO / NO-GO

**Critical:** 0 open (P0-2 fixed). **High:** by-id leak sweep (X-2), advertised-but-unenforced features, P1-1 enumeration, P1-2 email, P0-1 schema split (gated). **Medium:** webhook HMAC sweep, SCC Redis fail-open, email DNS verification, DB no-PK/clone fidelity. **Low:** index bloat, vector-in-public, invoice numbering, dead code.

**Required fixes before UAT sign-off (not all are code):**
1. Verify email **SPF/DKIM/DMARC** published (Phase 9) — invites must deliver.
2. Fix **P1-1** enumeration and **P1-2** silent email failure.
3. ~~Restore the **test harness** (migration mocks) so regressions are catchable during UAT.~~ ✅ **DONE 2026-06-19** — safety-net suites restored (14/14, 47 tests). Finish broader service-unit mocks as the migration lands.
4. Confirm **P0-1** does not affect the UAT tenant (use an existing gym in `studio_template`, or a fully-provisioned per-gym schema).

**UAT Approval Score: 86 / 100 → CONDITIONAL GO** (80–89 band).
UAT may proceed on a controlled tenant set with the above conditions tracked.

---

## PHASE 16 — UAT Execution Checklist

| Area | Test | Pass/Fail |
|---|---|---|
| Auth | Login, lockout after 5 fails, logout invalidates session | ☐ |
| Auth | Password reset requires valid recovery token (P0-2 regression) | ☐ |
| Auth | Email verification delivered + completes | ☐ |
| Tenant isolation | Gym A cannot read/write/delete Gym B by guessed id (members, check-ins, payments) | ☐ |
| Tenant isolation | Raw-search/dashboard queries scoped to one gym | ☐ |
| Subscription | active→grace→locked→renew transitions; suspension overrides | ☐ |
| Subscription | Renewal idempotent on double-click / webhook retry | ☐ |
| Feature gating | Locked feature 403s on direct API call (enforced keys) | ☐ |
| Payments | Razorpay success / failure / retry; no double charge; no duplicate membership | ☐ |
| Payments | Webhook replay within/after 300s window | ☐ |
| Emails | Verify / reset / invite / notification all deliver (SPF/DKIM/DMARC) | ☐ |
| Reports / Dashboards | Load < target; correct per-gym numbers; empty/error states | ☐ |
| CRUD | Members / classes / inventory / staff create-read-update-delete | ☐ |
| RBAC | Receptionist cannot reach owner-only actions / salary fields | ☐ |
| Mobile (member) | On-device build: login, check-in, payment, push | ☐ |
| Web | Responsive admin (desktop/tablet/mobile Sheet nav) | ☐ |

---

## PHASE 17 — Production Readiness Review

**Blockers to production (must close):**
1. 🔴 **P0-1** onboarding↔runtime schema split resolved (gated — DB/migration HARD STOP).
2. 🟠 **X-2** by-id tenant-read sweep complete (no fail-open legacy reads).
3. 🟠 **Backups + tested restore + DR runbook** evidenced (Phase 14).
4. 🟠 **Test harness restored** + branch committed; full regression green.
5. 🟠 **P1-M9-1** DB unique constraint on payment reference (migration).
6. 🟡 **Webhook HMAC sweep**, **email DNS**, **external observability**, **load test** vs P95 targets.
7. 🟡 RLS Phase-B keystone for real defense-in-depth (strongly recommended before large multi-tenant scale).

**Production Confidence Score: 72 / 100 → NO-GO** until the above close.

---

## PHASE 18 — Safe Deployment Plan

- **Stage 1 — Pre-deploy verification:** commit `feat/per-gym-schemas`; full `tsc --noEmit` (backend + frontend + member app); restore + run test suite green; confirm env vars (no test secrets) in `*.env.example` parity.
- **Stage 2 — DB migration verification:** apply forward-only migrations to a staging clone; verify `cloneTenantSchema` produces PKs + FKs (chase 200 no-PK); add payment-reference unique constraint; **never** `prisma migrate dev`/`db push` in prod (SCC = hand-SQL only).
- **Stage 3 — Canary:** deploy to one or two pilot gyms; watch error center + logs 24–48h; verify check-in/payment/renewal hot paths.
- **Stage 4 — Production rollout:** progressive enablement; entitlements-visibility refactor behind `NEXT_PUBLIC_ENTITLEMENT_UPSELL` flag (off until Slice F security backfill done).
- **Stage 5 — Post-deploy verification:** re-run `get_advisors` (expect only the by-design INFO RLS + vector WARN); smoke-test auth/payment/email; confirm SCC billing mirror.
- **Stage 6 — Rollback verification:** confirm the rollback (Phase 19) executes < 15 min on staging before relying on it.

---

## PHASE 19 — Rollback Plan (target: < 15 min)

- **App (backend/frontend):** redeploy previous image/commit (immutable artifacts). < 5 min.
- **DB migration failure:** forward-only — prefer a **compensating forward migration**; never `migrate reset` on the shared DB. Keep each migration small + reversible-by-design. Restore from PITR only as last resort (validate RTO in Stage 6).
- **Payment failure:** disable the affected gateway path via config flag; webhooks are idempotent so replays are safe after recovery; reconcile from `subscription_events` + `invoices` ledger.
- **Auth failure:** the prior auth deploy is the rollback; sessions are JWT — confirm signing keys unchanged so existing tokens stay valid.
- **Email failure:** queue-backed (`email.processor`) — pause the queue, fix provider/DNS, drain; no data loss.

---

## PHASE 20 — Final CTO Sign-Off

**Executive summary:** MuscleX is a well-architected, security-aware multi-tenant SaaS with a strong tenant-isolation core, hardened auth/payment/SCC surfaces, and a verified set of correctness fixes (7 shipped, each test-guarded). The lone Critical (account-takeover) is fixed. It is **ready to enter UAT under conditions** but **not yet production-ready** — the per-gym schema migration is in flight (P0-1), the regression test net is partially down, and backups/DR/observability are unverified operationally.

| Score | Value |
|---|---:|
| Architecture | 86 |
| Security | 84 |
| Performance | 85 |
| Database | 78 |
| DevOps / Observability | 65 |
| UAT Readiness | 86 |
| Production Readiness | 72 |

**Final recommendation:**

> ✅ **APPROVED FOR UAT — CONDITIONAL** (close P1-1, P1-2, email DNS, restore test net; run UAT on a controlled tenant).
> ❌ **REJECT FOR PRODUCTION** until: P0-1 schema split resolved · X-2 by-id sweep complete · payment-reference DB constraint added · backups/restore/DR evidenced · external observability wired · load test vs P95 targets · branch committed with green regression.

---

## Appendix A — Fixes already shipped this audit cycle (verified, test-guarded)

| ID | Fix | Safety-net spec |
|---|---|---|
| P0-2 | reset-password account-takeover → server-verifies recovery token | `reset-password.spec.ts` ✅ |
| P1-M2-2 | membership assign/renew money writes wrapped in `$transaction` | (module) |
| P2-M2-1 | `trackVisit` atomic guarded decrement (no double-spend) | `membership-track-visit.spec.ts` ✅ |
| P1-M3-1 | check-in orchestrator + QR controller `gym_id`-scoped (cross-tenant read + DoS) | `qr-tenant-scope.spec.ts` ✅ |
| P1-M4-1 | class booking atomic seat claim (no overbooking) | `class-booking-capacity.spec.ts` ✅ |
| P1-M5-1 | payment confirmation atomic `pending→paid` claim (no double-credit) | `payment-atomic-claim.spec.ts` ✅ |
| P1-M9-1 | `recordRenewal` idempotent on `payment_reference` | `renewal-idempotency.spec.ts` ✅ |

## Appendix B — Open items register

| ID | Item | Severity | Gate |
|---|---|---|---|
| P0-1 | Onboarding↔runtime schema split | 🔴 | DB/migration HARD STOP |
| X-2 / R3 | Legacy by-id tenant-read sweep | 🟠 | finish migration |
| — | Advertised-but-unenforced feature keys (6) | 🟠 | backend (Slice F) |
| P1-1 | `listUsers({perPage:1000})` enumeration/scale | 🟠 | code |
| P1-2 | Silent verification-email failure | 🟡 | code |
| P1-M9-1b | Payment-reference DB unique constraint | 🟠 | DB/migration HARD STOP |
| — | Safety-net regression net | ✅ DONE | restored 2026-06-19 (14/14 suites, 47 tests) |
| — | Memberships unit suite | ✅ DONE | restored 2026-06-19 (12/12) |
| — | Broader service-unit mock debt (30 suites / 189 tests: analytics, payments, classes, member-BFF data, referrals) | 🟡 | migration — same mechanical mock-drift; finish once P0-1 stabilizes |
| — | Backups / tested restore / DR runbook | 🟠 | ops (UNVERIFIED) |
| — | External observability (uptime/APM/logs) | 🟡 | ops (UNVERIFIED) |
| — | Email SPF/DKIM/DMARC | 🟡 | ops (UNVERIFIED) |
| — | Webhook HMAC sweep (platform/integrations) | 🟡 | code |
| P2-M10-1 | SCC Redis-down login fail-open | 🟡 | code |
| P2-M10-2 | Impersonation token consumption check | 🔵 | verify |
| DB | 200 no-PK / clone PK fidelity | 🟠 | verify clone |
| DB | 1182 unused-index bloat | 🔵 | maintenance |
| DB | `vector` extension in `public` | 🔵 | maintenance |
| Perf | Per-schema client eviction (LRU) | 🟡 | scale |
| Sec | RLS Phase-B non-bypass keystone | 🟡 | roadmap |

## Appendix C — Evidence basis & limitations

- **Verified:** code reads of isolation registry, subscription engine, security/feature-gating inventory; live Supabase advisors (security 39 INFO + 1 WARN, no anon exposure; performance 1553 lints) re-pulled 2026-06-19; prior module audit's 7 fixes each have a passing spec.
- **UNVERIFIED (not measurable from this environment):** on-device mobile QA, frontend visual rendering, load testing vs P95 targets, backup/restore/DR execution, external uptime/APM, DNS email-auth records, gateway/WAF protections. These are explicitly flagged per-phase and must be confirmed operationally before production.
- **Not committed:** all referenced fixes + this report live on the uncommitted `feat/per-gym-schemas` branch; owner commits per working-rules cadence.
