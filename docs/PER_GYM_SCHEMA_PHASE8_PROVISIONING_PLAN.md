# Per-Gym Schema — Phase 8 Provisioning Plan (drift-proof clone + onboarding keystone)

**Branch:** `feat/per-gym-schemas`  **Drafted:** 2026-06-14 (head `5ebb0ef`)
**Companion:** [PER_GYM_SCHEMA_IMPL_STATUS.md](PER_GYM_SCHEMA_IMPL_STATUS.md) (the Phase-6 service-migration log)

> Phase 6 (service rewiring) is effectively done: 5 services remain and all are
> intentional Phase-8/9 defers. This doc plans Phase 8 — **provisioning**: how a
> new gym gets its own `studio_<gym>` schema, how the onboarding keystone writes
> that gym's first tenant rows, and how future schema changes fan out to every
> live gym schema without drift. Nothing here is built yet; it is a reviewed
> runbook. **Every step needs the branch DB up to verify — onboarding
> correctness is NOT establishable by `tsc` (a silently-broken onboarding
> compiles fine), so this phase is DB-gated, not tsc-gated.**

---

## 0. Correction to the earlier "keystone is blocked" framing

Reading the actual onboarding flow ([auth.service.ts:780-866](../backend/src/auth/auth.service.ts#L780-L866))
shows the keystone is **more tractable than 6.21/6.22 implied**. The initial
register already does, in order:

1. `this.pub.studio.create(...)` — registry row (migrated in 6.1). `schema_name = studio_<ownerUserId>`.
2. `CREATE SCHEMA IF NOT EXISTS "<schema>"` + `this.cloneTenantSchema(schema)` — **the per-gym schema + all 146 tables now exist**.
3. `runInTenantContext(schema, () => { organization.create(); branch.create() }, studioId)` — first tenant rows, **inside a context that already sets `schemaName`**.
4. `rbacService.assignRole(...)` — `userRole` (registry, migrated in 6.21b).
5. `runInTenantContext(schema, () => rbacSeedService.seedStudioRoles(), studioId)` — seed roles.

So the schema **exists before** any tenant write (step 2 precedes step 3), and
`runInTenantContext` already puts `schemaName` in the ALS — exactly what
`tenant.client` needs. The keystone was over-deferred: it is migratable on the
branch now. What genuinely remains Phase-8 is (a) routing those writes onto the
right Road-B client, (b) fixing the second onboarding path's `studio_template`
hardcode, (c) the **migration fan-out** (new), and (d) DB verification.

---

## 1. Building blocks that ALREADY exist (do not rebuild)

| Piece | Where | Status |
|---|---|---|
| `cloneTenantSchema(targetSchema)` | [auth.service.ts:2017](../backend/src/auth/auth.service.ts#L2017) | Structure clone (`CREATE TABLE ... LIKE ... INCLUDING ALL` per table + FK copy from `information_schema`; identifier + FK-rule allowlists). This IS the "clone, not `prisma migrate`" approach the rearchitecture doc wants. Uses raw `this.prisma` (legacy). |
| `runInTenantContext(schema, fn, gymId)` | [auth.service.ts:2133](../backend/src/auth/auth.service.ts#L2133) | Runs `fn` inside `tenantContext.run({ schemaName, gymId, ... })`. Already sets `schemaName` — so `tenant.client` resolves the target gym inside it. Guards against deriving gymId from schemaName. |
| Two-client split + `TenantClientFactory` | `src/prisma/` | `pub` (registry) + per-schema `tenant.client`; isolation proven. |
| `forEachTenant` / `runForGym` | `src/prisma/tenant-task-runner.ts` | Per-gym execution for context-less jobs (used by crons + reconcilers). |
| Isolation harness | `scripts/_phase6_*` | Two seeded test gyms (A/B), schema_name ≠ studio_<gym_id>. Add probes per new surface. |

---

## 2. Phase-8 work breakdown

### 8.A — Onboarding keystone migration (`auth.service.ts` + `rbac-seed.service.ts`)

The two services still on legacy `PrismaService`. Changes:

1. **`cloneTenantSchema` + `CREATE SCHEMA`** (DDL): `this.prisma.$executeRawUnsafe`/`$queryRawUnsafe` → `this.pub.$executeRawUnsafe`/`$queryRawUnsafe`. Pure DDL on the superuser connection; fully-qualified / search-path-set SQL resolves regardless of the client's default schema. **No behavior change** — lowest-risk part.
2. **Initial register org/branch writes** ([L809-837](../backend/src/auth/auth.service.ts#L809-L837)): inside the existing `runInTenantContext`, `this.prisma.organization.create` → `this.tenant.client.organization.create`, `this.prisma.branch.create` → `this.tenant.client.branch.create`. Schema is in context (step 2 cloned it) → resolves the gym's schema.
3. **`rbac-seed.service.ts`**: `seedPermissions()` (`permission`, registry) → `pub` (runs at `onModuleInit`, no context — pub is fine). `seedStudioRoles()` (`role`/`rolePermission`, tenant) → `tenant.client` — it is already called inside `runInTenantContext(schema, ...)` (step 5), so `schemaName` is set. Inject `pub` + `tenant`.
4. **`assignRole`** already goes through `rbac.service` (migrated 6.21b → `pub.userRole`). No change.

### 8.B — The 5 `SET LOCAL search_path TO "studio_template"` raw sites (the real hazard)

The **branch-setup / continue-onboarding** path ([auth.service.ts:1542-1690](../backend/src/auth/auth.service.ts#L1542-L1690))
resolves `schemaName` from `public.studios` (good) but then writes
organizations + branches via raw `INSERT` after
`SET LOCAL search_path TO "studio_template"` — i.e. it writes into the **template
schema**, not the gym's schema. Under Road B this is a correctness bug post-cutover
(and a drift source). Fix: replace these raw blocks with
`runInTenantContext(schemaName, () => this.tenant.client.organization/branch.create({ ... }), studioId)`
— same data, but routed to the gym's own schema, and no hand-built dynamic SQL.
Sites: L1558, L1570, L1610, L1663, L1675 (orgCheck, org-insert, branch-inserts).
**Audit each of the 19 raw statements** in the file; categorize as (i) DDL/clone → pub, (ii) gym-data write → tenant.client via context, (iii) registry read → pub.

### 8.C — Migration fan-out / drift-proofing (NEW — the core of Phase 8)

Today there is one `studio_template` whose structure is cloned at onboarding. Once
live gyms have their own `studio_<gym>` schemas, **every future schema change must
be applied to `studio_template` AND every live `studio_<gym>`**, or schemas drift
(the known leak/þbreak class). Build:

1. A **`fanOutDdl(sql)` runner** (in a provisioning service) that runs a vetted DDL
   statement against `studio_template` then every `studios.schema_name` (resolve
   from the registry, validate against `^studio_[0-9a-f_]+$`, run in a tx, log
   per-schema success/failure). Reuses the `forEachTenant` enumeration idea but for
   DDL on the `pub` connection.
2. A **migration convention**: tenant-schema migrations are authored as
   schema-agnostic DDL (unqualified names) and applied via `fanOutDdl`, NOT via
   `prisma migrate` (the 48 Prisma migrations are not replayable from zero —
   migration #1 references `user_identity`). `schema.tenant.prisma` stays the
   source of truth for the client; the physical DDL is applied by the fan-out.
3. A **drift checker** (`scripts/_phase8_drift_check.js`): compares column/index/FK
   sets of each `studio_<gym>` against `studio_template`; CI-style guard.
4. A **lint guard** banning the literal `studio_template` in new app code (only the
   provisioning service may name it).

### 8.D — `public.gym_directory` projection (deferred from 6.22, Hybrid strategy)

Build the user-approved Hybrid directory table:

1. Add `model GymDirectory` to `schema.public.prisma` (public-safe cols: tenant_id,
   gym_name, logo_url, branch_id, branch_name, address, city, lat, lng, phone,
   plan summary; indexes on city + a geo index later). Regenerate the public client.
2. `CREATE TABLE public.gym_directory ...` (DDL — **DB-schema HARD STOP**).
3. A `GymDirectoryService` (owns the table): `syncGym(gymId)` rebuilds that gym's
   rows from its branches+plans; `removeGym(gymId)`; `backfill()` = `forEachTenant`
   reconcile (mirrors `member_directory.backfill`).
4. Wire `syncGym` at branch/plan/studio mutation points (fire-and-forget, like
   `member_directory.syncMember`).
5. Rewrite [member-discovery.ts](../backend/src/member/data/member-discovery.service.ts)
   `nearbyGyms` + `gymProfile` to read `public.gym_directory` via `pub` (no
   cross-tenant scan). `gymProfile`-by-id can alternatively `factory.forSchema`.

---

## 3. Sequencing (all DB-gated)

1. **Bring the branch DB up**, rebuild the two test gyms (`bash scripts/_phase6_setup_test_gyms.sh`), and run the full isolation harness against everything migrated in 6.16-6.22 (regression gate for this session's work) BEFORE starting Phase 8.
2. **8.A + 8.B** as one reviewed slice (the onboarding keystone). Verify by running a real register + continue-onboarding against the branch DB and asserting org/branch/roles land in `studio_<newgym>` (NOT `studio_template`), and the new gym is isolated from gyms A/B. Add an onboarding probe to the harness.
3. **8.C** (fan-out + drift checker) — verify by applying a trivial DDL (`ADD COLUMN`) and asserting it appears in `studio_template` + A + B; drift checker green.
4. **8.D** (gym_directory) — create table, backfill, verify nearbyGyms/gymProfile return the seeded gyms; member-app conversion surface unaffected.
5. Then **Phase 9** (live data migration `studio_template` → per-gym, checksums, rehearsed rollback) and **Phase 10** (cutover rehearsal + per-gym e2e + prod runbook). Deploy waits on 10.

---

## 4. Risk register

- **Onboarding is the single most critical flow** (a paying customer signing up). A silently-broken onboarding compiles clean — so 8.A/8.B MUST be verified by running real onboarding against the branch DB, never tsc-only. Keep a revert point per slice.
- **Production split-brain during transition:** once any tenant read/write points at `studio_<gym>`, EXISTING gyms (whose data is still in `studio_template`) read empty schemas. So none of this deploys until Phase 9 migrates existing data AND Phase 10 cutover. Branch-only until then.
- **Fan-out is now load-bearing for isolation:** a missed DDL fan-out = drift = the known cross-gym break class. The drift checker (8.C.3) must run in CI before any tenant migration merges.
- **`rbac.resolvePermissions` (JwtAuthGuard hot path, migrated 6.21b)** now throws without `schemaName` in context — re-verify against a live login during 8.A testing.
- **gym_directory sync coverage:** every branch/plan/studio mutation site must call `syncGym`, else the directory goes stale; `backfill()` is the safety net but hot-path correctness needs the write hooks. Enumerate mutation sites when building 8.D.

---

## 5. What stays on legacy `PrismaService` until when

| Service | Until |
|---|---|
| `auth.service.ts` | end of 8.A/8.B (this phase) |
| `rbac-seed.service.ts` | end of 8.A (this phase) |
| `member-discovery.service.ts` | end of 8.D (this phase) |
| referrals (1, re-check) | next Phase-6 cleanup pass |
| `PrismaService` class itself | Phase 10 cutover (last thing removed) |
