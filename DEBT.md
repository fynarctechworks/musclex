# Technical debt register

Items acknowledged but deliberately not fixed in the current slice. Each entry
names the blocker it creates and where it came from. Remove entries when paid.

| # | Item | Detail | Origin |
|---|---|---|---|
| 1 | Stale `test/auth/auth.service.spec.ts` DI providers | Suite fails 8/8 at module compile: `AuthService` gained a `PublicPrismaService` constructor dep in the per-gym-schemas work but the spec's provider list was never updated. Until fixed, this suite cannot verify ANY auth change — do not let "pre-existing failure" become the standing excuse. | M0 Fix 1 (2026-08-03) |
| 3 | Phantom role names in `@Roles(...)` repo-wide | ~60 decorator sites across 15 controllers (inventory, marketing/automation, payroll, staff, wallet, compliance, search, referrals, biometric-devices) reference `'manager'`, `'admin'`, or `'staff'` — none of which exist in `ENTERPRISE_ROLES` (real: `branch_manager`, `regional_manager`, `front_desk`, …). Effect: those routes are silently owner-tier-only (admin bypass) even where managers were clearly intended. M0 Fix 5 corrected `roles.controller.ts` only; the sweep needs a per-controller decision on which real roles belong. | M0 Fix 5 (2026-08-03) |
| 2 | `analytics.view` is all-or-nothing | `/api/v1/analytics/*` has no per-role data scoping; one flat permission gates member behavior AND gym-wide revenue. Trainer was excluded from the grant for this reason (see rbac-seed comment). `marketing_manager` keeps `analytics.view` for campaign analytics but can therefore also call `/analytics/revenue` — acceptable-for-now decision, revisit if a finer split (`analytics.view_financial`) is wanted. | M0 Fix 1 (2026-08-03) |

| 4 | Stale payments specs (constructor arity) | `test/payments/razorpay.live.spec.ts` + 3 sibling suites construct `PaymentsService` with 3 args; it now takes 6 (billingService et al. from the per-gym-schemas work). 20 of 47 tests in `test/payments`+`src/payments` fail before any M0 change — verified by stashing. Same root cause as DEBT #1. | M0 Fix 9 (2026-08-03) |
| 5 | No public pricing API | The landing page's plan cards are hand-maintained in `frontend/src/app/landing/components/Pricing.tsx` and must be kept in sync with `backend/src/common/plan-configs.ts` by hand (they had drifted: Pro shown as ₹1,999 vs real ₹2,499, Enterprise as "Custom" vs ₹4,999, Free tier missing entirely). A small public `GET /api/v1/public/plans` would remove the drift class. | M0 Fix 11 (2026-08-03) |
