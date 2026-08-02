# Technical debt register

Items acknowledged but deliberately not fixed in the current slice. Each entry
names the blocker it creates and where it came from. Remove entries when paid.

| # | Item | Detail | Origin |
|---|---|---|---|
| 1 | Stale `test/auth/auth.service.spec.ts` DI providers | Suite fails 8/8 at module compile: `AuthService` gained a `PublicPrismaService` constructor dep in the per-gym-schemas work but the spec's provider list was never updated. Until fixed, this suite cannot verify ANY auth change — do not let "pre-existing failure" become the standing excuse. | M0 Fix 1 (2026-08-03) |
| 2 | `analytics.view` is all-or-nothing | `/api/v1/analytics/*` has no per-role data scoping; one flat permission gates member behavior AND gym-wide revenue. Trainer was excluded from the grant for this reason (see rbac-seed comment). `marketing_manager` keeps `analytics.view` for campaign analytics but can therefore also call `/analytics/revenue` — acceptable-for-now decision, revisit if a finer split (`analytics.view_financial`) is wanted. | M0 Fix 1 (2026-08-03) |
