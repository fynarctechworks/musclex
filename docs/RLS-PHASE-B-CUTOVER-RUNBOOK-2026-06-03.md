# RLS Phase B — Keystone Cutover Runbook

**Date:** 2026-06-03 · **Status:** 📋 runbook only — **nothing applied.** Phase B touches DB roles +
auth + the connection string; it requires a maintenance window, a staging rehearsal, and explicit
sign-off (CLAUDE.md #3). Do **not** run any step here ad-hoc.

**Goal:** make RLS actually load-bearing — switch the app from the `postgres` (BYPASSRLS) role to a
dedicated **least-privilege, non-bypass** role, and fix the `app.gym_id` propagation so isolation is
correct under connection pooling. **These two changes must ship together** — half is worse than none.

**Preconditions (met):**
- ✅ Phase A — every gym_id table has RLS enabled + forced (143/143).
- ✅ D4 — app-layer `TENANT_MODELS` registry complete (all 22 models scoped); drift guard in CI.
- ✅ Policy quality — `tenant_isolation` is fail-closed (`NULLIF(current_setting('app.gym_id', true), '')`).

---

## 1. Verified facts this runbook is built on (live, 2026-06-03)
- **Table ownership:** all 143 `studio_template` tables owned by **`postgres`**. A new role inherits
  nothing → needs explicit GRANTs. (FORCE RLS is already on, so even owner-level access is governed.)
- **No app role exists yet** — only `postgres` (BYPASSRLS), `authenticator`, and `supabase_*` admins.
- **Grants in `studio_template`:** only `postgres` holds table privileges; `authenticated`/`anon` hold
  **none** → grants for the new role are greenfield, no conflicts to unwind.
- **Connection:** `.env.example` documents **session-mode pooler (port 5432)** "for Prisma
  compatibility." ⚠️ Confirm the **actual** prod `DATABASE_URL` mode before cutover — session vs
  transaction mode changes the pooling-fix requirements (§3).
- **GUC today:** `$use` sets `set_config('app.gym_id', gymId, false)` (session-scoped) per *model*
  query — [prisma.service.ts:88-104](../backend/src/prisma/prisma.service.ts#L88-L104). Raw queries
  do **not** set it (no `params.model`).

---

## 2. Step 1 — Create the least-privilege role + GRANTs (idempotent SQL)
Run as `postgres`/`supabase_admin`. **No `BYPASSRLS`, no `SUPERUSER`.**

```sql
-- 2a. Role (set a strong password; store in the secret manager, not here)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='musclex_app') THEN
    CREATE ROLE musclex_app LOGIN PASSWORD '<<from-secret-manager>>'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- 2b. Schema usage (studio_template = where all tenant data physically lives; + public for
--     the non-tenant tables the app reads: Studio, UserIdentity, etc.)
GRANT USAGE ON SCHEMA studio_template, public TO musclex_app;

-- 2c. Table DML (NO TRUNCATE/REFERENCES/TRIGGER — app doesn't need them)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA studio_template TO musclex_app;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO musclex_app;   -- tighten later if the app only reads some

-- 2d. Sequences (INSERTs need nextval)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA studio_template, public TO musclex_app;

-- 2e. Future tables/sequences inherit the same grants (so new migrations don't silently 403)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA studio_template
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO musclex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA studio_template
  GRANT USAGE, SELECT ON SEQUENCES TO musclex_app;
-- (repeat 2e for public if migrations add public tables the app uses)
```
> Notably **omit** `TRUNCATE` and table ownership — the app should never need them, and withholding
> them limits blast radius. Migrations keep running as `postgres`, not `musclex_app`.

---

## 3. Step 2 — Fix `app.gym_id` propagation (the hard part; ship WITH step 1)
**Why required:** once `musclex_app` can't bypass RLS, every tenant query must run with the *correct*
`app.gym_id`. Two holes exist today that are harmless under BYPASSRLS but become **mis-scoping bugs**
the moment the role respects RLS:

1. **Raw queries** (`$queryRaw`/`$executeRaw` on tenant tables) never set `app.gym_id` → they'd run
   under whatever value is left on the pooled connection.
2. **Connection reuse:** `set_config(..., false)` persists on a pooled connection across requests; a
   request whose first DB touch is a raw query could inherit the **previous tenant's** gym_id.

Session-mode pooling narrows but does **not** close these (Prisma still reuses connections across
requests within its own pool).

**Recommended fix — transaction-local GUC, set inside the same transaction as the work:**
- Replace `set_config('app.gym_id', gymId, false)` with **`set_config('app.gym_id', gymId, true)`**
  (transaction-local) executed **inside an interactive `$transaction`** that also runs the request's
  queries — so the GUC is guaranteed to match the queries and auto-resets at COMMIT/ROLLBACK.
- Provide a `prisma.forTenant(gymId, cb)` helper (build on the existing `prisma.tenant` extension
  scaffolding) that opens the tx, sets the local GUC, and runs `cb(txClient)`; route tenant request
  handlers through it. Raw queries inside the callback inherit the correct local GUC.
- Belt-and-suspenders: at connection checkout, `RESET app.gym_id` (or set to `''`) so a leaked value
  can never read as a real gym (the policy already treats `''`/NULL as deny).

**Why not the cheap version:** merely keeping the per-query `$use` set is insufficient because it
skips raw queries and has a checkout race. The interactive-transaction approach is the one that is
*correct*, not just usually-correct — appropriate for a security boundary.

> This is the main engineering effort of Phase B and the reason it's not a one-liner. Scope it as a
> real task with its own tests (§5), not a config flip.

---

## 4. Step 3 — Cutover
1. Deploy the §3 code change **first**, still pointing at `postgres` (behavior-neutral — tx-local GUC
   works fine under BYPASSRLS, just unused). Verify app healthy.
2. In the window: repoint `DATABASE_URL` user from `postgres` → `musclex_app` (same host/pooler/db).
3. Restart the backend. Watch logs for permission errors (missing GRANTs surface as `42501`).

---

## 5. Verification gate (must pass before declaring done)
As `musclex_app`, re-run the audit's unauthorized-access simulation — the result must **invert**:
```sql
-- with NO app.gym_id set, as musclex_app:
SELECT count(*) FROM studio_template.members;            -- EXPECT: 0  (was 13 under postgres)
-- with the wrong gym:
SELECT set_config('app.gym_id', '<gymB-uuid>', false);
SELECT count(*) FROM studio_template.members WHERE gym_id = '<gymA-uuid>';  -- EXPECT: 0
-- with the right gym:
SELECT set_config('app.gym_id', '<gymA-uuid>', false);
SELECT count(*) FROM studio_template.members;            -- EXPECT: only gymA's rows
```
Plus application-level: log in as two different gyms and confirm each sees only its own
members/payments/check-ins/workouts. Add a **cross-tenant integration test** (Phase C) that seeds 2
gyms and asserts isolation as `musclex_app` — so this can't regress.

---

## 6. Rollback (fast, low-drama)
- **Primary:** repoint `DATABASE_URL` back to `postgres` and restart → instantly back to today's
  behavior (app-layer `$use` + D4 registry still protect tenants; RLS just goes dormant again).
- The role/GRANTs and the §3 code are safe to leave in place on rollback (tx-local GUC is inert under
  BYPASSRLS). So rollback = one env var + restart; no DB teardown needed.

---

## 7. Staging rehearsal checklist (do before prod)
- [ ] Run §2 on staging; confirm `musclex_app` has exactly the intended grants (`\dp` spot-check).
- [ ] Deploy §3; full regression + the new cross-tenant test green.
- [ ] Cutover on staging; run §5 gate; exercise **every** module (payments, inventory, check-in,
      biometric enroll, reports, dashboards, member app) watching for `42501` permission gaps —
      these reveal any table/sequence the GRANTs missed.
- [ ] Soak under realistic concurrency to flush the connection-reuse race (§3 hole #2).
- [ ] Only then schedule the prod window.

---

## 8. Risks & honest unknowns
- **Missing GRANT → app 500s** on some module (mitigated by §2c blanket grant + §7 module sweep).
- **§3 not fully correct → mis-scoped reads** (mitigated by tx-local + checkout reset + §5/Phase C tests).
- **Unverified:** exact prod pooling mode and whether any background job/raw-SQL path runs *outside*
  a request's tenant context and legitimately needs cross-gym reads (e.g. `scc-sync`, portfolio,
  analytics aggregation) — those must run as a separate privileged path or explicitly set their scope,
  or they'll start returning empty under RLS. **Audit the ~21 raw-SQL sites (audit R5) before cutover.**
- This runbook is **design**; no SQL/role/string here has been executed.
