# Per-Gym Schema Re-Architecture — Implementation Status & Rewiring Playbook

**Branch:** `feat/per-gym-schemas`  **Started:** 2026-06-13  **Status:** foundation done, service-rewiring in progress
**Companion:** [PER_GYM_SCHEMA_REARCHITECTURE_2026-06-13.md](PER_GYM_SCHEMA_REARCHITECTURE_2026-06-13.md) (the why + options analysis)

> All work is **branch-only**, against a local Docker replica. **Nothing has run
> against production** except one read-only `pg_dump --schema-only`. Nothing is
> committed yet.

---

## What is built & verified

| # | Deliverable | Verification |
|---|---|---|
| 1 | **Branch DB** — `musclex-branch-db` (pgvector/pg17) on `localhost:5433`; faithful schema replica of prod (`public`=37, `studio_template`=146). [backend/.env.branch](../backend/.env.branch) | table counts match prod exactly; 0 restore errors |
| 2 | **Schema split** — [schema.public.prisma](../backend/prisma/schema.public.prisma) (37 registry models) + [schema.tenant.prisma](../backend/prisma/schema.tenant.prisma) (146 tenant models), via [_phase2_split.js](../backend/scripts/_phase2_split.js) | both `prisma validate` ✓; 0 cross-schema relations, 0 enums |
| 3 | **Two clients** — `client-public`, `client-tenant` (generated to `node_modules/.prisma/`) | runtime probe: registry→`public.studios`, tenant→`studio_<x>.members` ✓ |
| 4 | **TenantClientFactory** — [tenant-client.factory.ts](../backend/src/prisma/tenant-client.factory.ts): per-schema cached client, `?schema=` in conn string, injection guard, bounded pool | [_phase2_isolation_test.js](../backend/scripts/_phase2_isolation_test.js): 100 concurrent interleaved queries, **0 leak**; tsc ✓ |
| 5 | **DI plumbing** — [public-prisma.service.ts](../backend/src/prisma/public-prisma.service.ts), [tenant-prisma.accessor.ts](../backend/src/prisma/tenant-prisma.accessor.ts), wired in [prisma.module.ts](../backend/src/prisma/prisma.module.ts) (global) | tsc ✓ |

### Hard-won facts (do not relearn)
- **Prisma applies ONE schema prefix per client.** `search_path` fallback is impossible with one client → the two-client split is mandatory. (Proven empirically.)
- **`schema_name` ≠ `studio_<gym_id>`.** Onboarding sets `studios.schema_name = studio_<owner_user_id>`. Always resolve the schema from the **registry** (`TenantStore.schemaName`), never derive it from `gym_id`.
- **The 48 Prisma migrations are NOT replayable from zero** (migration #1 references `user_identity`, never created earlier). Provisioning (Phase 4) cannot rely on `prisma migrate` — clone from `studio_template` structure instead.
- **The tenant client has NO `$use` middleware.** The legacy auto-`gym_id` injection does not apply. Isolation is now **physical** (separate schema). But writes must set `gym_id` explicitly (NOT NULL column) — see playbook.

---

## Per-service REWIRING PLAYBOOK (the bulk)

For each service that injects `PrismaService` and uses `this.prisma.*`:

1. **Classify each model touched** as registry (one of the 37 public) or tenant (one of the 146). See `schema.public.prisma` for the registry list.
2. **Inject the right client(s):**
   - registry models → `private readonly pub: PublicPrismaService`
   - tenant models → `private readonly tenant: TenantPrisma`, then `this.tenant.client.<model>.*`
3. **Drop dead `gym_id` WHERE filters on reads** only if you want; harmless to keep. Isolation is now physical.
4. **Add `gym_id` explicitly on tenant CREATES** — the `$use` no longer injects it. (The column stays NOT NULL until/unless a later migration drops it.)
5. **Cross-model reads that span registry↔tenant** (e.g. join `members` to `studios`) can no longer be one Prisma query → split into two calls and stitch in app code. (Rare — there were 0 Prisma `@relation`s crossing the boundary, but raw joins exist.)
6. **Raw SQL** hardcoding `studio_template.x` → must become schema-dynamic (Phase 7); for now flag, don't half-fix.
7. **Verify:** `tsc --noEmit` on the service, then a focused query against the branch DB with two seeded gyms confirming isolation.

**Suggested domain order** (low-risk → high): auth/registry → settings → members → classes → inventory → check-ins → member BFF → dashboards/analytics → referrals/payments.

### Verification harness (branch DB only) — run after every slice
Two faithful test gyms exist on the branch DB for isolation checks (schema_name is
deliberately ≠ `studio_<gym_id>`, reproducing prod so routing must come from the registry):

| Gym | `studios.id` (gym_id) | `schema_name` | seed |
|---|---|---|---|
| A | `1111…1111` | `studio_aaaaaaaa_aaaa_aaaa_aaaa_aaaaaaaaaaaa` | Alice + 1 branch |
| B | `2222…2222` | `studio_bbbbbbbb_bbbb_bbbb_bbbb_bbbbbbbbbbbb` | Bob + 1 branch |

- **Build/reset:** `bash scripts/_phase6_setup_test_gyms.sh` — clones `studio_template`
  structure (146 tables) into both, registers studios, seeds distinguishing rows. Idempotent.
- **Verify:** `node scripts/_phase6_isolation_check.js` — registry→schema→rows routing,
  per-table isolation, cross-leak. **Add a line to its `PROBES` array per domain as you
  seed more tables.**

---

## Phase 6 progress log (per domain)
| Domain | Slice | Status | Notes |
|---|---|---|---|
| (harness) | 6.0 | ✅ | Two seeded gym schemas + `_phase6_isolation_check.js`. |
| auth/registry | 6.1 | ✅ registry done | `auth.service.ts`: 5 registry models (studio, pendingRegistration, userIdentity, subscriptionPlan, userRole → 29 sites) now on `pub`. **Deferred:** tenant writes (organization/branch/staff via `runInTenantContext`) → tenant-write slice; the ~14 raw-SQL `studio_template` sites + `cloneTenantSchema` → Phase 7/8. |
| settings | 6.2 | ✅ FULLY migrated | `settings.service.ts`: registry (studio, invoice, subscriptionPlan via `fetchAvailablePlans`) → `pub`; tenant (branch, member, staff + the `clearTenantData` `$transaction`) → `tenant.client`. **Legacy `PrismaService` injection removed** — first service fully off the legacy client. Harness extended to seed+probe `staff`. |
| members (a) | 6.3 | ✅ 5 services | Pure-tenant member services FULLY migrated to `tenant.client` (legacy injection removed): `member-visits`, `corporate-membership`, `family-membership`, `member-profile`, `member-crm`. All tenant-only, no raw SQL, creates already set `gym_id: getTenantGymId()!` (no `$use` reliance). |
| members (b) | 6.4 | ✅ 4 services | `membership`, `membership-access`, `plans`, `renewals` → `tenant.client` (incl. 3 `$transaction`s, all-tenant). **`plans.service.ts`: imported `Prisma` from the tenant client** (Json sentinel `Prisma.JsonNull` is a per-generated-client runtime value — must match the writing client). **Remaining members:** `members.service.ts` (1057 lines, 1 raw `studio_template` site → its own slice + Phase 7). |

| members (c) | 6.5 | ✅ DONE (members domain complete) | `members.service.ts`: studio → `pub`; all tenant models + the two all-tenant `$transaction`s (create-member, soft-delete) → `tenant.client`; the line-589 `$queryRaw FROM public.studios` converted to a typed `pub.studio.findUnique` (one raw site eliminated). **`saveFaceDescriptor`'s face_vec `$transaction` kept on legacy `prisma` + `// PHASE 7` marker** (array tx mixing a tenant write with the `studio_template.members` face_vec raw write; migrated with the face-matching subsystem in Phase 7). Keeps all 3 injections. **All 10 member services now migrated.** |

| crons + renewals fix | 6.6 | ✅ | **Cron architecture for Road B.** New `TenantTaskRunner.forEachTenant(fn)` (src/prisma/tenant-task-runner.ts, in PrismaModule): lists studios from the registry and runs `fn` once per gym inside that gym's tenant context (schema from registry, never derived from gym_id). Background jobs have NO request context, so a per-gym tenant client would otherwise throw. **Refactored `renewals.service.ts`'s 4 crons** to wrap their bodies in `forEachTenant` (fixes the 6.4 regression where top-level cron reads ran with no context; also removes the old buggy `studio_${gym_id}` schema derivation). New harness `_phase6_cron_check.js` proves the sweep is per-gym isolated. |

| classes | 6.7 | ✅ DONE | All 5 class services → `tenant.client` (all tenant-only): `attendance`, `booking` (4 all-tenant tx), `class-template`, `classes` (3 tx; `Prisma` namespace imported from tenant client for `Prisma.TransactionClient`), `scheduling`. **`scheduling.generateRecurringSessions` cron wrapped in `forEachTenant`.** Legacy injections removed. |

| inventory (a) | 6.8a | ✅ | `bundle` + `purchase-orders` (raw-SQL-free, tenant-only) → `tenant.client`. |

> **Cron rule (6.6):** any `@Cron`/background job that touches tenant data MUST run inside `tasks.forEachTenant(...)` — never call `this.tenant.client` at cron top level (no context → throws). Remaining crons to convert: `dashboard/briefing`, `dashboard/kpi-snapshot`. (scheduling done in 6.7.)

| inventory (b) | 6.8b | ✅ | **pos + batch + wallet cluster** migrated together. `pos`: studio→`pub`, rest + 2 tx → `tenant.client`. `wallet`: `tx`-param methods + default-client params → `tenant.client`; union type `Tx \| TenantPrismaClient`. `batch`: 2 own tx + the FIFO `deductFifo`. **Raw `studio_template.product_batches` → unqualified `product_batches`** so it resolves via the tenant client's `?schema=` search_path (proven isolated). Cross-service tx types now align (tsc-verified). |

> **KEY (6.8b): raw SQL on the tenant client is schema-dynamic for free.** Verified `?schema=studio_<gym>` sets `search_path`, so an UNQUALIFIED table name in `$queryRaw`/`$executeRaw` on the tenant client resolves to that gym's schema (isolated). Phase 7 = drop the `"studio_template".` qualifier on raw sites that already run on the tenant client; only sites on the legacy client (e.g. face_vec) need more.

| inventory (c) | 6.8c | ✅ DONE (inventory complete) | `inventory.service.ts` (3 raw low-stock `$queryRaw` → unqualified `inventory`/`products`) + `transfer.service.ts` (FIFO raw → unqualified `product_batches`; default-client param → `Tx \| TenantPrismaClient`). **All 6 inventory services migrated; all their raw sites are now schema-dynamic via search_path (no Phase-7 debt left in inventory).** |

### (done 6.8b) inventory (b) — the pos+batch+wallet transaction cluster
`pos.service.ts` is NOT yet migrated (still on legacy `prisma`, compiles fine). Its
`createSale` `$transaction` passes `tx` into **`walletService` (src/wallet) and
`batchService`** (redeemPoints/debitForPurchase/earnPoints/deductFifo). Migrating
pos's `tx` to the tenant client requires migrating those services' `tx`-param TYPES
to the tenant client's `Prisma.TransactionClient` **in the same slice** (else cross-
generated-client type mismatch). `pos` also reads `studio` (→ `pub`). And
`batch.service.ts` has 2 raw `studio_template` sites → its raw bits are Phase 7.
**Migrate pos + batch + wallet as one cluster.** Then `inventory.service.ts` (5 raw
sites) + `transfer.service.ts` (1 raw site) with Phase-7 flagging.

| check-ins | 6.9 | ✅ mostly (devices deferred) | Migrated: `check-ins.service`, `biometric-enrollment`, `facial-matcher` (pgvector `<=>` raw → unqualified `members`), `face-api-pgvector.provider` (face_vec array-tx → unqualified `members`). **Also retired the 6.5 PHASE-7 marker:** `members.saveFaceDescriptor` face_vec tx migrated to `tenant.client` + unqualified `members`; **`members.service.ts` now fully off legacy `prisma`.** All run with `schemaName` set (kiosk via `device-auth.middleware`, admin via TenantMiddleware). **DEFERRED:** `devices.service` + `device-auth.middleware` — `verifySecret` is a global device-token→tenant lookup that needs a `public` device-index table (HARD STOP: new schema). See below. |

| check-ins (b) | 6.9b | ✅ DONE (check-ins complete) | **Device-token→tenant resolution via `public.device_index` (user-approved HARD STOP).** New registry model `DeviceIndex` in schema.public.prisma (now 38) + `public.device_index` table on branch DB; public client regenerated. `devices.register` writes the index (device_id→gym_id, schema_name); `devices.verifySecret` reads the index (no gym ctx) → `factory.forSchema(schema)` → per-gym `check_in_devices` for secret/status; context methods → `tenant.client`. `device-auth.middleware` now uses `verifySecret().schema_name` (dropped its `studios` query + PrismaService). New check `_phase6_device_check.js` proves routing (resolves the gym; unknown→null). **Reusable pattern for any global-token→tenant lookup.** |

> **Resolved (6.9b): the global-token→tenant pattern** = a thin `public` index keyed by the token id → (gym_id, schema_name), maintained on create/disable; the secret/verification stays in the per-gym table. Apply this for any future "resolve tenant from an opaque token before context exists" case.

| member BFF | 6.10a-d | ✅ mostly (cross-tenant trio deferred) | 6.10a interceptor sets `schemaName` (gate); 6.10b 12 pure-tenant data services; 6.10c registry services (app-user/auth/public-profile/public-health/events/idempotency → `pub`) + member-billing (tenant); 6.10d `member-data` (studio→pub, rest→tenant.client; spec split pub/tenant, 7/7 pass). |

> **DEFERRED — cross-tenant READS (needs strategy, Phase 8/9).** `member-discovery` (public "find a gym" directory — `FROM studio_template.branches JOIN public.studios` across ALL gyms), `member-context`, and `member-directory.backfill()` deliberately read EVERY gym's data from the shared `studio_template`. Post data-migration that table is empty, so these break. Options: (a) a `public` directory table synced on change (like the existing `member_directory` for member→gym lookup) — best for hot paths like nearbyGyms; (b) `forEachTenant` aggregation + cache — fine for `backfill()`/admin; (c) per-gym single lookups via `factory.forSchema()` for by-tenant-id reads (e.g. `gymProfile`). `member-directory.{syncMember,resolveByPhone}` are pure registry and CAN move to `pub` now; only `backfill()` is cross-tenant. Left on legacy `prisma` + flagged. **This is the general cross-tenant-aggregation problem Road B introduces — decide the directory strategy before Phase 9.**

| dashboards | 6.11a/b | ✅ DONE | All 20 services. 6.11a: 15 pure-tenant analytics → tenant.client. 6.11b: briefing + kpi-snapshot crons (studios via pub + per-gym tenantContext.run from registry schema_name; unqualified raw → tenant.client); dashboard-layout → pub; dashboard + occupancy (studio→pub, rest tenant). |

| referrals | 6.12 | ✅ DONE | 11 services. B2B program = registry→pub (Referral/Wallet/RewardRule/RewardLog incl. their tx + raw on public tables); member-referral = tenant→tenant.client; mixed (referral-analytics per-model split; referral-notification B2C wrapped in `runForGym`). **New `TenantTaskRunner.runForGym(gymId, fn)`** for event handlers/webhooks with no req context (resolve schema from registry + run in context). |

| payments | 6.13 | ✅ DONE | 10 services → tenant.client (only studio→pub). billing `tx.studio` GST read → `this.pub.studio` (registry read inside a tenant tx is fine). **Razorpay webhook** (no JWT): createOrder now sets `gym_id` in order notes; `handleRazorpayWebhook` resolves gym via `razorpay.getOrder().notes.gym_id` + `runForGym` (also fixed a pre-existing context-less `getTenantGymId()!` bug). |

> **Webhook/event→tenant rule:** stamp `gym_id` into the gateway's order/event metadata at creation (you have context then), read it back in the handler, and `runForGym`. Avoids a new index table when the provider echoes metadata.

### Cross-service `$transaction` rule (general)
When service A's `$transaction` passes `tx` into service B's method, A and B must use
the SAME generated client's `TransactionClient` type. Migrate transactionally-coupled
services together; type `tx: any` only as a last resort.

> **Cross-cutting rule discovered (6.4):** `gym_id` is a required field in the tenant client's generated create type (no default) → **tsc fails any tenant create missing `gym_id`**, a free compile-time safety net. And `Prisma.JsonNull`/`DbNull` for tenant writes must be imported from the tenant client, not `@prisma/client`.

| staff | 6.14a/b | ✅ DONE | All 5. payroll/trainer/staff-biometrics (raw `studio_template.staff` face_vec → unqualified) pure-tenant; staff+staff-invite mixed (studio/staffInvitation/userIdentity/userRole→pub, rest→tenant.client). |

| org + branches | 6.15 | ✅ DONE | organization (3) + branches (2) domains migrated (commit ccbec3f). |

| cross-tenant trio (2 of 3) + directory decision | 6.22 | ✅ DONE (safe part) | **User-approved strategy (2026-06-14): "Hybrid"** — public projection for the all-gym directory + per-gym `factory/runForGym` for by-id / own-rows. **Built now:** (1) `member-directory` FULLY migrated — `syncMember`/`resolveByPhone` → `pub` (public.member_directory); `backfill()` rewritten from a cross-tenant `studio_template.members` raw scan to a `forEachTenant` reconcile (per-gym `tenant.client.member` → upsert to `pub.memberDirectory`). (2) `member-context.loadMemberships` (shape C) — the cross-tenant raw join replaced by: group the caller's links by gym → batch `pub.studio` for name/suspended → `runForGym(tenantId)` per gym to read ONLY the caller's own member rows (`tenant.client.member` + memberships + plan); `pickBestMembership` reproduces the old `ORDER BY (status='active') DESC, end_date DESC` LATERAL. N = the user's own gyms (1–3), negligible fan-out. tsc ✓. **⛔ DEFERRED — `member-discovery` (nearbyGyms/gymProfile) = the new `public.gym_directory` projection table** (Hybrid shape A). Stays on legacy prisma + studio_template (CORRECT until Phase-9 migration). Design: a public.gym_directory(gym+branch+plan public-safe cols) synced on branch/plan/studio change + reconciled by a backfill; nearbyGyms/gymProfile then read it via `pub` (no cross-tenant scan). Build in Phase 8/9 — it's a NEW public table (DB-schema HARD STOP) and only matters post-migration, so it can't be created/verified now (Docker down). |

| auth (8 of 10; 2 keystone deferred) | 6.21a/b | ✅ DONE (safe part) | **6.21a — 5 registry services → `pub`:** auth-device/auth-identity/auth-login-history/auth-session/two-factor (all query PUBLIC identity tables: userDevice/userSession/userIdentity/loginHistory/backupCode/studio; run pre-tenant-context, so pub is strictly safer). **6.21b — request-context services:** auth-api-key + auth-sso are pure-tenant MANAGEMENT surfaces (apiKey/ssoProvider CRUD via controllers) → tenant.client; rbac.service MIXED (userRole/studio→pub; role/rolePermission/staff/staffPermissionOverride→tenant.client — only `resolvePermissions` touches tenant, and its documented invariant is "search_path set before calling"; JwtAuthGuard runs post-TenantMiddleware). tsc ✓. **RISK:** resolvePermissions is the JwtAuthGuard hot path — its tenant reads now THROW without schemaName in context (vs legacy silently reading studio_template); fail-closed but needs a live-login check once DB is back. **⛔ DEFERRED to Phase-8 provisioning keystone (still on legacy prisma):** `auth.service.ts` (org/branch/staff onboarding writes + `cloneTenantSchema` + 19 raw `studio_template` sites) and `rbac-seed.service.ts` (`seedStudioRoles`) — both write a NEW gym's tenant data into a `studio_<gym>` schema that only exists AFTER cloneTenantSchema runs; not a client swap. The global-token VERIFICATION paths (api-key.guard, SSO callback) are the deferred non-service guards. |

| platform/services | 6.20 | ✅ DONE | **All pure-tenant** (integrations/featureFlag/organization/organizationSettings/ssoProvider/systemNotification/webhook/webhookDelivery/whiteLabelConfig — all 9 models tenant-schema). `integrations`, `platform-settings`, `webhooks` → tenant.client; `Prisma.InputJsonValue` re-imported from the tenant client (6.4). webhooks.service `dispatch()` is only reachable via its controller (request-context) — no context-free caller. **Note:** these deeper `platform/services/*` files need `../../../node_modules/.prisma/client-tenant` (one more `../` than top-level src services) — tsc caught the wrong depth. tsc ✓. 15 services left. |

| common/services | 6.19 | ✅ DONE | **Shared infra — mostly REGISTRY → `pub`.** subscription-policy (the lifecycle engine: studio/subscriptionPlan/subscriptionEvent/invoice + its `recordRenewal` `$transaction` → `pub`; `getContext` is called by JwtAuthGuard every request — now a pure registry read needing NO tenant context, strictly safer than before). cron-lock (pg advisory locks via `$queryRawUnsafe` → `pub`; locks are DB-global, not schema-scoped). scc-sync (fully-qualified `scc.*` raw SQL → `pub`; resolves on the superuser connection). **resource-limit is MIXED:** studio/subscriptionPlan→`pub`, member/branch/staff `.count()`→`tenant.client` (those always ran under tenant search_path, so context is present at every call site). tsc ✓. 18 services left. **NOTED:** cron-lock's session-level advisory acquire/release can land on different pooled connections — pre-existing, unchanged by this swap. |

| onboarding + compliance + audit + ai | 6.18 | ✅ DONE | audit (`auditLog`; `Prisma.InputJsonValue` re-imported from tenant client), compliance (all GDPR member-data models — consentLog/dataRequest/member/profile/membership/checkIn/payment/booking/bodyStats/note/document), ai (`aiConversation` + member/checkIn/membership/payment briefing reads) → **tenant.client** (all request-context). **onboarding is REGISTRY → `pub`:** `OnboardingPlansService` only touches `subscriptionPlan`; safe in its `onModuleInit` seeding because `pub` is a global long-lived client needing no tenant context. tsc ✓ (no DB). 22 services left. **NOTED:** ai.service still pins `claude-sonnet-4-20250514` (stale model id) — out of scope for this migration; flag for a model-id refresh. |

| documents + subscription + search + roles | 6.17 | ✅ DONE | **Mix of pure-tenant, pure-registry, and one mixed.** roles (`role`/`rolePermission` → tenant) and search (`member`/`staff`/`lead` → tenant; both the Prisma-fallback and `reindexAll` stay per-gym, request-context) are pure-tenant. **subscription is pure REGISTRY → `pub`:** `subscription.service` (studio/subscriptionEvent/subscriptionPlan/userIdentity/invoice + its `$transaction`) and `subscription.cron` — the cron iterates studios straight from the registry (control-plane, NOT tenant data) so it needs **no `forEachTenant`**, just `pub`. **documents is MIXED:** `documents.service` splits studio→`pub`, document/posSale/memberInvoice→`tenant.client`; `document-delivery` is pure-tenant (posSale/memberInvoice/documentDelivery). Both only called from the documents controller (request-context), so `tenant.client` is safe. tsc ✓ (no DB). 26 services left. |

| marketing + analytics + events | 6.16 | ✅ DONE | **All pure-tenant.** marketing (3: `marketing`/`leads`/`automation` — automation's `Prisma.JsonNull`/`InputJsonValue` re-imported from the tenant client per the 6.4 rule); analytics/services (2: `analytics` — `Prisma.*WhereInput` types re-imported from tenant client; `reports`); events (2: `event-store` — reads→`tenant.client`, `emit(tx,…)` keeps `tx: any` so already-tenant callers are unaffected; `event-projector` — all 3 entry paths are request-context [HTTP catchup/replay + inline post-tx in members/staff], no context-less cron, so `tenant.client` is safe). **Also `analytics/jobs/metrics-aggregation.job.ts` (7 crons):** deleted its buggy local `runForGym` (the `studio_${gym_id}` derivation) and wrapped each cron in `tasks.forEachTenant` — the cross-gym top-level enumeration (branches/members/templates/trainers/campaigns) is now a per-gym `tenant.client` query inside each gym's context; cron lock still wraps the whole sweep. tsc ✓ (no DB — Docker down; isolation harness deferred to DB-up). |

## ACCURATE remaining Phase-6 inventory (5 services still on legacy PrismaService, 2026-06-14)
Measured via `grep -rln "import { PrismaService }" src --include=*.service.ts | grep -v spec`.
Per module (count): **auth 2** (the Phase-8 provisioning keystone: `auth.service.ts` onboarding tenant-writes + cloneTenantSchema + 19 raw studio_template sites; `rbac-seed.service.ts` seedStudioRoles), member/data 1 (`member-discovery` = the deferred Phase-8/9 public.gym_directory build), referrals 1 (re-check member-referrals), prisma 1 (legacy PrismaService itself — stays until cutover).
> **All 5 remaining are intentional defers, not pending swaps:** the 2-service onboarding/provisioning keystone (Phase 8), the gym_directory projection table (Phase 8/9, new public table), the referrals re-check (1), and the legacy PrismaService class (removed at cutover). Plus the ~13 non-`*.service.ts` legacy users (guards/middleware/queue-processors/controllers) — several are global-token VERIFICATION paths (api-key.guard, SSO callback) pairing with already-migrated management services.
> **All the mechanical service-swaps are now done.** The 7 left are: (a) the 2-service onboarding/provisioning keystone = Phase 8 (clone schema → set schemaName ctx → write org/branch/staff + seed roles); (b) the cross-tenant trio (member-discovery/member-context/member-directory.backfill) = needs the directory strategy decision; (c) referrals re-check (1); (d) the legacy PrismaService class itself (stays till cutover). **Plus ~13 non-`*.service.ts` legacy users** (guards incl. api-key/jwt-auth/gym-member, tenant.middleware, check-ins policy+qr, queue processors, referrals controllers) — several are global-token VERIFICATION paths that pair with the migrated management services.
> **Plus ~13 non-`*.service.ts` legacy users** (NOT in the count above) — migrate alongside their domains: guards (`api-key`, `jwt-auth`, `gym-member`), middleware (`tenant.middleware`), check-ins policy/qr (`access-scope.resolver`, `check-in.orchestrator`, `qr.controller`), queue processors (`campaign`, `report`, `webhook`), `subscription.cron`, referrals controllers (`referrals-admin`, `referrals-internal`).
> Domains migrated so far (~124 services, 45 commits): auth-registry, settings, members, classes, inventory, check-ins, member-BFF (minus cross-tenant trio), dashboards, referrals, payments, staff, organization, branches, marketing, analytics, events, documents, subscription, search, roles, onboarding, compliance, audit, ai, common/services, platform/services, **auth (8 of 10 — registry + request-context)**. **Still TODO:** auth Phase-8 keystone (auth.service + rbac-seed), gym_directory projection table (member-discovery, Phase 8/9), referrals (1 — re-check), SCC; the non-service legacy users (guards/middleware/queue-processors/controllers); then Phases 7–10. **Cross-tenant directory strategy = DECIDED: "Hybrid"** (public gym_directory projection + per-gym for own-rows); member-directory + member-context already built to it (6.22).

## Remaining phases (not started)
- **6 (in progress):** rewire all services (playbook above) — multi-week.
- **7:** 32 raw-SQL `studio_template` sites → schema-dynamic + lint guard banning the literal.
- **8:** drift-proof provisioning — clone `studio_template`→`studio_<gym>` (structure clone, not `prisma migrate`); must fan out every future migration to all gym schemas.
- **9:** live-data migration `studio_template`→per-gym, checksums + rehearsed rollback (branch only).
- **10:** full cutover rehearsal on branch + per-gym isolation e2e; prod cutover runbook. Deploy waits on this.

## Environment recreate (if container is lost)
```
docker run -d --name musclex-branch-db -e POSTGRES_PASSWORD=branchpass -e POSTGRES_DB=postgres -p 5433:5432 pgvector/pgvector:pg17
# enable: CREATE EXTENSION vector, pgcrypto; create roles anon/authenticated/service_role/authenticator/supabase_admin
# pg_dump --schema-only -n public -n studio_template from prod (READ-ONLY) → restore
# prisma generate --schema prisma/schema.public.prisma && --schema prisma/schema.tenant.prisma
```
