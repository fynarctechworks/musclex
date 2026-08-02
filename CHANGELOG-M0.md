# Milestone 0 — "Stop the bleeding" changelog

Tracking doc for the M0 bug-fix pass (source: `GAP_ANALYSIS_AND_ROADMAP.md`).
One item per slice; each lands only after review approval.

## ⚠️ Deploy-day steps (run after deploying this milestone)

1. **RBAC resync** (Fix 1): `cd backend && npm run build && npx ts-node scripts/resync-role-permissions.ts`
2. **Analytics backfill** (Fix 2): `cd backend && npm run build && npx ts-node scripts/backfill-analytics.ts --from <YYYY-MM-DD> --to <YYYY-MM-DD>` (defaults to last 90 days). Run AFTER deploying the fixed job. Point-in-time fields (active counts) reflect run-time state; period-scoped numbers (revenue, visits, signups) are historically accurate.

## Fix 1 — `analytics` permission module registered (APPROVED 2026-08-03)

**Bug:** All 12 routes in `dashboard-analytics.controller.ts` require `analytics.view`, but `analytics` was never in `MODULES_ACTIONS` (`auth/rbac-seed.service.ts`), so the permission was never seeded and no role granted it. Every non-owner role (branch_manager, regional_manager, trainer, accountant, marketing_manager) got 403 on all analytics endpoints; only the owner-tier admin bypass worked.

**Change:**
- `backend/src/auth/rbac-seed.service.ts`
  - Added `analytics: ['view', 'export']` to `MODULES_ACTIONS`.
  - Granted `analytics.view` + `analytics.export` to `regional_manager`, `branch_manager`, `accountant`.
  - Granted `analytics.view` to `marketing_manager`.
  - **Trainer deliberately excluded** (reviewer decision): `/api/v1/analytics/*` has no per-role data scoping, so `analytics.view` would expose gym-wide revenue to trainers. Trainers keep their scoped `/dashboard/trainer-cockpit` surface. See DEBT.md #2.
  - Verified guard/seeder key formats match exactly: both build `module.action` dot codes (`permissions.guard.ts:52` vs `rbac-seed.service.ts:37`).
  - `front_desk` intentionally unchanged (no analytics need); owner-tier roles already receive `ALL_PERMISSIONS`.
- `backend/scripts/resync-role-permissions.ts` (new, **not yet run**)
  - Existing studios don't self-heal: `seedStudioRoles()` only runs at onboarding, and `resolvePermissions()` falls back to `ENTERPRISE_ROLES` only when a role has zero `RolePermission` rows. The script boots the Nest app context and runs `seedPermissions()` + `forEachTenant(seedStudioRoles)` — additive/idempotent.
  - Run after deploy: `cd backend && npm run build && npx ts-node scripts/resync-role-permissions.ts`

**Tests:**
- `backend` `tsc --noEmit` — PASS (exit 0).
- `npx jest test/auth/auth.service.spec.ts` — 8/8 FAIL, **pre-existing**: the suite dies at DI compile with "Nest can't resolve dependencies of the AuthService … PublicPrismaService at index [2]" — the spec's provider list is stale vs the uncommitted per-gym-schemas changes to `auth.service.ts`. Not caused by this fix (constants-only edit, no DI surface). No spec covers `rbac-seed.service.ts` itself.
- `resync-role-permissions.ts` written but **not run** (touches prod DB; run post-deploy).

## Fix 2 — revenue/metrics aggregation job corrected (PENDING APPROVAL)

**Bug (3 defects):** `backend/src/analytics/jobs/metrics-aggregation.job.ts`
1. Filtered `Payment.status: 'completed'` — a value never written anywhere (real values: `pending|paid|refunded`) → `DailyGymMetrics.total_revenue`, `RevenueAnalytics.membership`, `RevenueAnalytics.personal_training` were permanently 0.
2. "PT revenue" summed ALL payments (superset of membership) → double-count; "membership" was filtered by payment METHOD (`card/upi/cash`), a category-by-method mixup.
3. Upserts passed `organization_id: '' `/`plan_id: ''` into nullable `@db.Uuid` compound-unique keys — `''` is invalid uuid input, and Postgres unique treats NULLs as distinct so those upserts could never match NULL-org rows anyway.

**Change:**
- `status: 'paid'` at the 2 payment aggregation sites (daily metrics + membership revenue).
- Membership revenue now = paid payments with `membership_id: { not: null }` (method filter removed).
- PT revenue now sourced from `TrainerRevenue` (branch-scoped, written on session completion) — no overlap with membership. NOTE: TrainerRevenue amounts still derive from the hardcoded ₹500 session rate (separate bug, Milestone 2).
- All 3 upserts replaced with `findFirst` (matching real NULLs) + `update`/`create`; single-writer safe under the existing cron locks.
- New public `backfillDay(day)` on the job + `backend/scripts/backfill-analytics.ts` (**written, NOT run**) — see deploy-day steps.
- POS (`PosSale.status='completed'`) untouched — that default is genuinely `'completed'`.

**Tests:**
- `backend` `tsc --noEmit` — PASS.
- `npx jest test/safety-net/metrics-aggregation-tenant-isolation.spec.ts` — **8/8 PASS** (validates every aggregation body runs under per-tenant scope, including the rewritten findFirst/update/create paths).
- Backfill script not run (touches prod data; run post-deploy).

## Fix 3 — assign-membership 404 (COMMITTED)

**Bug:** `frontend/src/features/memberships/api.ts` called `POST/GET /members/:id/memberships` — routes that don't exist. 404'd `AssignMembershipDialog` (members list + member detail), `useMemberMemberships` consumers (`AccessNetworkCard`, `MemberAccessTab`).

**Change:** `assign` → `POST /memberships/assign/:memberId`, `listByMember` → `GET /memberships/member/:memberId` (real routes in `memberships.controller.ts`). DTO shapes verified identical (plan_id, branch_id, start_date?, auto_renew?, payment_method?).

**Tests:** frontend `tsc --noEmit` PASS. Runtime assign flow needs a manual click-through (no frontend test suite covers it).

## Fix 4 — staff analytics page called a nonexistent route (COMMITTED)

**Bug:** `staff/analytics/page.tsx` queried `GET /analytics/trainer-performance` (no such route) with a fictional shape (`avg_occupancy`, `performance_score`) → page always rendered "No trainer data available".

**Change:** Page now consumes the real `GET /analytics/trainers/leaderboard` (TrainerAnalytics rows: sessions_conducted, members_trained, no_show_rate, revenue_generated + trainer.full_name); chart plots sessions-by-trainer. Permission gate changed from `staff.view` to `analytics.view` — the leaderboard exposes per-trainer revenue, and trainers were deliberately excluded from analytics in Fix 1.

**Tests:** frontend `tsc --noEmit` PASS. Rendering with real rows needs manual check after the Fix-2 backfill populates TrainerAnalytics.
