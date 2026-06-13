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

### Cross-service `$transaction` rule (general)
When service A's `$transaction` passes `tx` into service B's method, A and B must use
the SAME generated client's `TransactionClient` type. Migrate transactionally-coupled
services together; type `tx: any` only as a last resort.

> **Cross-cutting rule discovered (6.4):** `gym_id` is a required field in the tenant client's generated create type (no default) → **tsc fails any tenant create missing `gym_id`**, a free compile-time safety net. And `Prisma.JsonNull`/`DbNull` for tenant writes must be imported from the tenant client, not `@prisma/client`.

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
