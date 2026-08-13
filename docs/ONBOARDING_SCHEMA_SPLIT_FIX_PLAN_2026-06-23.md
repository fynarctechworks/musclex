# Onboarding ↔ Per-Gym Schema Split — Fix Plan (2026-06-23)

Status: **PLAN — no code changed yet.** Scope crosses tenant-isolation +
provisioning (a hard-stop), so this is for review before implementation.

## 1. Symptom
For studio **Mama** (`id 00ca8c7f…`, `schema_name studio_f6ee74be…`):
- `/mama/branches` shows **“No branches yet”**, but Usage & Limits shows **2/5 branches**.
- The branch the user created in-app does not appear.
- (Separately) no invoice + empty billing info — see §7; this is **expected** (trial, unpaid), not a bug.

## 2. Root cause (evidence)
The app is committed to **per-gym physical schemas** (Road B): **110** services read/write
via the per-gym tenant client `TenantPrisma.client` → `factory.forSchema(schema_name)`,
which binds the Postgres schema in the **connection string** (`?schema=studio_<…>`).
Only **6** call-sites still use the legacy global `this.prisma` — and onboarding
(`auth.service`) is one of them.

Two compounding defects:

**D1 — Onboarding writes tenant data to the wrong schema.**
`auth.service` creates org/branch/staff via `this.prisma` (lines 830, 843, 1422, 1742),
which — under Prisma `multiSchema` — maps tenant models to **`studio_template`**
(the `search_path` assumption in the comment at `auth.service.ts:826` is **inert** under
multiSchema). So onboarding data lands in `studio_template`, while the 110 runtime services
read the per-gym schema → onboarding data is invisible.

Observed rows (4 branches across 2 schemas):
| schema | gym_id | org | written by |
|---|---|---|---|
| `studio_template` | `00ca8c7f` ✅ | f8468d9b | onboarding (`this.prisma`) |
| `studio_f6ee74be` (per-gym) | `b41ce140` ❌ phantom | null | a prior studio (stale) |

**D2 — `schema_name` is derived from the OWNER’s user id, not the studio.**
`auth.service.ts:804`: `schema_name = studio_<authData.user.id>`. The same owner
re-onboarding gets the **same** `schema_name`, reusing the previous studio’s physical
schema (`CREATE SCHEMA IF NOT EXISTS` + clone are no-ops when it already exists).
That’s why `studio_f6ee74be` still holds the prior gym’s rows under phantom gym_id
`b41ce140` (which matches no current studio). The earlier “constraint already exists”
log spam was the clone re-running against the pre-existing schema.

The Branches page returning **0** is D1 (rows in the wrong schema) compounded by the
`organization_id` filter in `BranchesService.findAll` (the stale per-gym rows have
`organization_id = null`). **Do NOT** loosen that filter as a quick fix — it would expose
the stale `b41ce140` rows (cross-gym exposure).

## 3. Blast-radius audit
- **Existing data:** only **1** studio exists (Mama, a test studio); its schema is
  owner-derived; **no** `schema_name` collisions. → systemic change is low-risk on prod data.
- **`schema_name` consumers (read from `public.studios`, data-driven — safe):**
  `tenant.middleware.ts:61`, `auth.service.ts:1536/1641/1716`, `check-ins/devices`. Changing
  how NEW schema names are *generated* does not break these — they read the stored value.
- **Onboarding `this.prisma` tenant writes to migrate:** `auth.service.ts` lines
  **830** (org), **843** (branch), **1422** (org, alt path), **1742** (staff); plus reads
  **128** (branch count), **1356** (branch findUnique). The `setup-studio` block at
  790–890 and the staff step at ~1704 are the core.
- **Provisioning:** `cloneTenantSchema()` + `CREATE SCHEMA IF NOT EXISTS` (auth.service
  ~817). Needs a freshness guard (don’t reuse a populated schema).
- **Tenant client write path:** services use `this.tenant.client` which needs tenant
  context (`schemaName`) set. During onboarding the schema is created mid-request, so the
  write must run inside a context bound to the NEW schema (a tenant-task-runner / explicit
  `forSchema` call), not the ambient request context.

## 4. Proposed fix (align onboarding to per-gym schemas)
Implement in reviewable slices:

**Slice A — Unique, studio-scoped schema name.**
- New studios: `schema_name = studio_<studio_id>` (the studio’s own UUID), so a re-onboard
  by the same owner never reuses a schema.
- Add a provisioning guard: if the target schema already exists **with rows**, fail loudly
  (or append a uniqueness suffix) rather than silently reusing it.

**Slice B — Onboarding writes through the per-gym schema.**
- Replace the `this.prisma.{organization,branch,staff}.create` calls with writes bound to
  the newly-provisioned per-gym schema (via `TenantClientFactory.forSchema(schemaName)` /
  the tenant-task-runner), matching the 110 other services.
- Remove the stale `search_path` comment; keep `gym_id = studio_id` on every row.

**Slice C — Provisioning order + idempotency.**
- Ensure: create studio row → derive unique schema → `CREATE SCHEMA` → `cloneTenantSchema`
  → write org/branch/staff into that schema → set `user_metadata.organization_id`.
- Make clone safe to fail-forward; never write tenant data before the clone completes.

**Slice D — Branches.findAll robustness (secondary, after data is consistent).**
- Revisit the implicit `where.organization_id = user.organization_id` so a missing/legacy
  org doesn’t hide a gym’s own branches; gym_id isolation already scopes the tenant.
  (Only safe once D1/D2 are fixed so no foreign-gym rows can appear.)

## 5. Data repair for existing affected studios (Mama)
Mama is a **test** studio, so the cleanest repair is **re-provision clean**:
- Option 1 (recommended for a test gym): delete Mama + its orphaned `studio_f6ee74be`
  schema and re-onboard once the code fix lands.
- Option 2 (preserve): move the onboarding rows from `studio_template`
  (`gym_id 00ca8c7f`) into Mama’s per-gym schema with the correct gym_id, and **purge** the
  stale `b41ce140` rows from `studio_f6ee74be`. Higher touch; needs a careful, scoped script.

A repair/migration script will be needed for any **real** gyms onboarded under the old code
(currently none besides Mama).

## 6. Testing & rollout
- Unit/integration: onboarding creates org/branch/staff; assert they’re readable via
  `this.tenant.client` (per-gym schema) and absent from `studio_template`.
- Manual: onboard a fresh studio → Branches page shows the branch; Usage count matches list.
- Re-onboard with the same owner → gets a **new** schema; no stale data visible.
- Verify Supabase advisors + a tenant-isolation spot check after the change.

## 7. Not a bug: subscription/invoice/billing
`public.studios` for Mama: `subscription_status = trial`, `billing_* = null`. The payment
step was never completed, so by design there’s no invoice and no bound billing info.
Invoices generate on a real paid renewal (`recordRenewal`). If the goal is to test the paid
flow, complete a Razorpay test payment (after the backend restart for the earlier GST +
staff + observability fixes).

## 8. Open questions for sign-off
1. Confirm direction = **align onboarding to per-gym schemas** (not revert to
   `studio_template`-by-gym_id). Code (110 vs 6) implies yes.
2. Mama repair: **re-provision clean** (Option 1) vs **migrate rows** (Option 2)?
3. OK to change `schema_name` generation to `studio_<studio_id>` for new studios?
