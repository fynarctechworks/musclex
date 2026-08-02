# Milestone 0 — "Stop the bleeding" changelog

Tracking doc for the M0 bug-fix pass (source: `GAP_ANALYSIS_AND_ROADMAP.md`).
One item per slice; each lands only after review approval.

## ⚠️ Deploy-day steps (run after deploying this milestone)

1. **RBAC resync** (Fix 1): `cd backend && npm run build && npx ts-node scripts/resync-role-permissions.ts`
2. **Analytics backfill** (Fix 2): see Fix 2 entry once landed.

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
