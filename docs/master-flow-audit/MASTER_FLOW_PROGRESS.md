# MASTER FLOW PROGRESS — MuscleX Global SaaS Audit

Mode: **audit-first, fix in reviewable slices, pause at every CLAUDE.md hard gate**
(DB/schema, auth/RLS/tenant-isolation, new deps, billing). Module list = the real
MuscleX gym modules (the original prompt's PoultryOS module list does not apply).

| # | Module | Phase | Status | Report |
|---|---|---|---|---|
| 1 | Auth & Onboarding | P0-2 fixed; rest documented | 🟢 AUDITED + P0-2 FIXED | [report](01-auth-onboarding/MODULE_AUDIT_REPORT.md) |
| 2 | Memberships | P1-M2-2 + P2-M2-1 fixed; cron/FE depth deferred | 🟢 AUDITED + 2 FIXES | [report](02-memberships/MODULE_AUDIT_REPORT.md) |
| 3 | Check-ins | P1-M3-1 isolation fix shipped | 🟢 AUDITED + FIX | [report](03-check-ins/MODULE_AUDIT_REPORT.md) |
| 4 | Classes & Scheduling | P1-M4-1 overbooking fixed; sched/FE deferred | 🟢 AUDITED + FIX | [report](04-classes/MODULE_AUDIT_REPORT.md) |
| 5 | Payments (Razorpay) | P1-M5-1 double-credit fixed | 🟢 AUDITED + FIX | [report](05-payments/MODULE_AUDIT_REPORT.md) |
| 6 | Inventory / POS | healthy; oversell guard confirmed; P2 return-race | 🟢 AUDITED (no P0/P1) | [report](06-inventory-pos/MODULE_AUDIT_REPORT.md) |
| 7 | Staff & Roles (RBAC) | healthy; no priv-esc; P2 dead-code | 🟢 AUDITED (no P0/P1) | [report](07-staff-rbac/MODULE_AUDIT_REPORT.md) |
| 8 | Member BFF (mobile) | code healthy; tests red (migration) | 🟢 AUDITED (no code P0/P1) | [report](08-member-bff/MODULE_AUDIT_REPORT.md) |
| 9 | Billing & Subscription | P1-M9-1 mitigated (app-level dedup); schema follow-up open | 🟢 AUDITED + FIX | [report](09-billing-subscription/MODULE_AUDIT_REPORT.md) |
| 10 | SaaS Control Center | auth/authz strong; no P0/P1 | 🟢 AUDITED | [report](10-saas-control-center/MODULE_AUDIT_REPORT.md) |
| 11 | Global Platform Architecture | synthesis + final docs done | 🟢 AUDITED | [report](11-global-architecture/MODULE_AUDIT_REPORT.md) |

**Final consolidated docs:** [FINAL_PLATFORM_AUDIT](FINAL_PLATFORM_AUDIT.md) ·
[SECURITY_AUDIT](SECURITY_AUDIT.md) · [DATABASE_AUDIT](DATABASE_AUDIT.md) ·
[PERFORMANCE_AUDIT](PERFORMANCE_AUDIT.md) · [SAAS_UPGRADE_ROADMAP](SAAS_UPGRADE_ROADMAP.md)

## ⚠️ Cross-cutting finding (repo-wide) — migration test debt
The in-flight `feat/per-gym-schemas` migration rewired many services to the
`TenantPrisma` accessor (`this.tenant.client.*`) but left their test mocks on the
old `prisma` shape. Result: **broad red across the suite** — Memberships unit
(23), Member BFF (60), and several **safety-net** isolation suites (search,
dashboard-raw-query, metrics, kpi-snapshot, check-out) all fail with
`Cannot read properties of undefined (reading 'member'/'checkIn'/'$queryRawUnsafe')`.
This is **not** product breakage and **not** caused by this audit's fixes (all 6
new safety-net specs pass; tests covering changed code pass). But the safety net is
partially down during the migration — updating these mocks is the migration's
highest-leverage test-harness task. Owner-gated (migration work).

## Fixes shipped this audit (7)
P0-2 reset-password takeover · P1-M2-2 membership txn · P2-M2-1 atomic visit ·
P1-M3-1 check-in/QR cross-tenant · P1-M4-1 class overbooking ·
P1-M5-1 payment double-credit · P1-M9-1 renewal idempotency (app-level).
Each has a passing safety-net spec; all backend `tsc` clean.

## Module 1 headline findings
- **P0-1** onboarding writes branches/plans to `studio_template` but staff to the
  per-gym schema — entangled with the in-flight `feat/per-gym-schemas` migration. Gated.
- **P1-1** register/verify enumerate all Supabase users (perPage 1000) — breaks past 1000 users.
- **P0-2** ✅ FIXED — `reset-password` now server-verifies the Supabase recovery token and derives the user from it (was: account takeover by user-id). Safety-net test added; 5/5 PASS.
- **P1-2** silent verification-email send failure (UI says "check email", nothing arrives).
- Tests: login safety-net 3/3 PASS. Advisors: 39 INFO RLS (by design), 1 WARN extension-in-public.
