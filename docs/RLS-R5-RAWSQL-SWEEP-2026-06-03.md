# RLS R5 — Raw-SQL Tenant-Scoping Sweep (2026-06-03)

**Scope:** every `$queryRaw* / $executeRaw*` site in `backend/src` (28 files). Raw
SQL is NOT covered by the `$use` gym_id auto-injection, so each site is audited
two ways:
1. **Leak today?** — does it filter `gym_id` when reading/writing a
   `studio_template` (tenant) table? (Under the current BYPASSRLS role, an
   unscoped raw read = active cross-tenant leak.)
2. **Breaks at Phase B?** — once the app connects as the non-bypass `fitsync_app`
   role, every tenant query needs the correct `app.gym_id` GUC set (via
   `forTenant`) AND the role needs privileges on the schema it touches. Raw
   queries that don't set the GUC, or touch a schema `fitsync_app` can't reach,
   will **return empty / 42501**, not leak.

**Read-only audit. No code changed.**

---

## Headline result

✅ **No new cross-tenant leak.** Every raw query against a `studio_template` table
filters `gym_id` in its `WHERE`/`WITH CHECK` — verified individually below. The
prior leak class (unscoped raw face-match) is already fixed.

🟠 **The real output is a Phase-B cutover blocker list.** Several raw paths are
correct for *isolation* but will **break** under the non-bypass role unless they
(a) run inside `forTenant` (tx-local `app.gym_id`), or (b) keep a privileged
connection. These MUST be handled before cutover or the features 500/empty out.

---

## A. Tenant reads/writes that are gym-scoped ✅ (need `forTenant` at cutover)

All filter `gym_id` → no leak. All lack their own `app.gym_id` set → must be
wrapped in `forTenant` (or run after a model query on the same connection) once
RLS is enforced, or they return empty.

| Site | Table | Scope |
|---|---|---|
| `dashboard/action-queue.service.ts` (190/301/973/998/1032) | `dashboard_action_receipts/_states` | `WHERE/INSERT gym_id = $1` ✅ |
| `dashboard/briefing.service.ts` (202/241) | `dashboard_briefings` | `gym_id = $1` ✅ |
| `dashboard/kpi-snapshot.service.ts` (121/160) | `dashboard_kpi_snapshots` | `gym_id = $1` ✅ |
| `dashboard/dashboard-pulse.service.ts` (378/436/469/570) | members/payments aggregates | `gymId` bound param ✅ |
| `dashboard/footfall-heatmap.service.ts` (183) | check-ins | `gymId` bound param ✅ |
| `dashboard/push-subscription.service.ts` (39/67) | `push_subscriptions` | `gym_id = $1` ✅ |
| `inventory/inventory.service.ts` (533/542/561) | `inventory` | `gym_id = ${gymId}` ✅ |
| `inventory/batch.service.ts` (199) | `product_batches` | `gym_id = ${gymId}` ✅ |
| `inventory/transfer.service.ts` (152) | `product_batches` | `gym_id = ${args.gymId}` ✅ |
| `members/members.service.ts` (937) | `members` (face_vec) | `id AND gym_id = ${studioId}` ✅ |
| `check-ins/facial/facial-matcher.service.ts` (71) | `members` (pgvector) | `gym_id AND branch_id` ✅ |
| `check-ins/biometric/providers/face-api-pgvector.provider.ts` (83/105) | `members` (face_vec) | `id AND gym_id = ${scope.gym_id}` ✅ |
| `staff/staff-biometrics.service.ts` (committed today) | `staff` (face_vec) | `id AND gym_id` ✅ |

`dashboard/portfolio.service.ts` (398/466) aggregates **across branches of one
gym** — gym-scoped, multi-branch by design ✅.

## B. Non-tenant / control-plane (public + scc + catalog) — isolation N/A

| Site | Target | Note |
|---|---|---|
| `common/middleware/tenant.middleware.ts` (61), `check-ins/devices/device-auth.middleware.ts` (58), `auth.service.ts` (1391/1488/1563) | `public.studios WHERE id = $1` | own-studio lookup ✅ |
| `referrals/reward-processor.service.ts` (262/301/452/463/552/578/593) | `public.studios WHERE id = <studioId>` | B2B billing on a studio's own row ✅ |
| `referrals/referral-wallet.service.ts` (222/253) | `public.referral_wallets/_entries WHERE wallet_id = $1` | SaaS wallet, scoped ✅ |
| `common/services/cron-lock.service.ts` (24/45) | `pg_try_advisory_lock` | no tenant data ✅ |
| `dashboard/system-status.service.ts` (81) | `SELECT 1` | health probe ✅ |
| `common/guards/api-key.guard.ts` (45) | `information_schema.schemata` | existence check ✅ |

## C. Cross-tenant BY DESIGN — confirm gating + privileged path at cutover

| Site | What | Verdict |
|---|---|---|
| `member/directory/member-directory.service.ts` (116) `backfill()` | reads **all** `studio_template.members` (phone→gym directory) | Documented, deliberate maintenance/backfill path. No leak (admin-only backfill). 🟠 **Breaks under RLS** — must run on a privileged connection or be exempted. |
| `referrals/referral-analytics.service.ts` (168) `b2bDailyTrend()` | platform-wide `public.referrals` aggregate (counts only, no PII) | Exposed only via `referral-analytics.controller.ts:48` `@Roles('super_admin')` ✅. **Action:** confirm `b2bDailyTrend` is not also reachable from the `:134` owner-scoped controller. |
| `common/services/scc-sync.service.ts` (58/107/113/129/167/194) | writes `scc.*` (control center) | Control-plane sync, by design. 🟠 **Breaks under RLS role** — `fitsync_app` has NO grants on `scc`. Needs scc grants or a privileged connection. |

## D. Onboarding / provisioning (auth.service.ts) — privileged, breaks at cutover

`auth.service.ts` (646/1260 CREATE SCHEMA; 1831/1853/1861/1913 clone template DDL;
1406–1536 `SET LOCAL search_path` + INSERT organizations/branches/membership_plans
with explicit `gym_id`).

- **Isolation:** writes carry an explicit `gym_id` → no leak ✅.
- 🔴 **Phase-B blocker:** (1) the DDL (`CREATE SCHEMA`, `CREATE TABLE LIKE`,
  `ALTER TABLE ... ADD CONSTRAINT`) needs CREATE privileges `fitsync_app` will
  NOT have (NOCREATEDB, USAGE+DML only). (2) The INSERTs hit RLS `WITH CHECK`
  with no `app.gym_id` set → rejected. **Onboarding/provisioning must keep a
  dedicated privileged connection (postgres) — do NOT route it through
  `fitsync_app`.**

---

## Required before Phase B cutover (added to the runbook §8 unknowns)

1. **Wrap tenant request handlers in `forTenant`** so all §A raw queries inherit
   the tx-local `app.gym_id`. This is the §3 engineering task.
2. **Provisioning stays privileged:** onboarding (auth.service) + the
   `member-directory.backfill()` maintenance path + `scc-sync` run on a
   `postgres`/admin connection, OR `fitsync_app` is granted exactly what each
   needs (scc DML for scc-sync; nothing makes DDL safe for fitsync_app → keep it
   on postgres). Decide per-path; default = privileged connection.
3. **Module sweep under fitsync_app on staging** (runbook §7) to surface any
   `42501` the GRANTs missed.

## Smaller hardening (not cutover-blocking) — NOTED FOR LATER

- `api-key.guard.ts:52` builds `SET search_path TO "${schemaName}", public` by
  **string interpolation**. It checks the schema exists first (parameterized),
  but unlike `device-auth.middleware`/`auth.service` it does **not** assert
  `^studio_[0-9a-f_]+$` before interpolating. Add the regex guard for defense in
  depth (a malicious/odd existing schema name would otherwise reach `SET`).
- `referral-analytics.b2bDailyTrend` — confirm caller gating (see §C).
