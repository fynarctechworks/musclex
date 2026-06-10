# MuscleX — Architecture Review
**Date:** 2026-06-07 · **Branch:** `feat/member-bff-phase0` · **Method:** static structural analysis (module graph, dependency direction, file-size hotspots, config). **Read-only.**

> Evidence-based. Measured numbers are cited; anything not directly measured is **UNVERIFIED**.

---

## Verdict
The architecture is **sound and consistent** for a multi-tenant SaaS: clean feature-modular boundaries, a single drift-proof tenant-isolation source, server-state via react-query, disciplined logging/validation. The material weaknesses are **operational maturity (CI/CD + containerization gaps)**, a few **god-class services**, and **3 managed circular dependencies** in the event subsystem. No critical structural defects.

| Severity | Count |
|---|---:|
| 🔴 Critical | 0 |
| 🟠 Major | 3 |
| 🟡 Minor | 4 |

---

## Module boundaries — ✅ good
- **33 NestJS modules**, grouped **by feature** (auth, members, classes, check-ins, payments, inventory, referrals, dashboard, analytics, member BFF, platform…), matching the CLAUDE.md "group by feature, not type" rule.
- The **Member BFF is cleanly isolated**: guards/interceptors applied **per-controller**, never as global `APP_GUARD`, so admin routes are unaffected (verified in `member.module.ts`). This is a strong boundary.
- Four apps separated by directory with independent build/test. Shared contract types are code-generated from one OpenAPI spec.

## Dependency flow & circular dependencies — 🟠 Major (M1)
**3 circular-dependency pairs**, each resolved with `forwardRef` (6 sites):
- `branches` ↔ `events` (`BranchProvisioningService` ⇄ `EventStoreService`)
- `dashboard` ↔ `events` (`EventProjectorService` ⇄ `DashboardGateway`)
- `staff` ↔ `staff-invite` (`StaffService` ⇄ `StaffInviteService`)

`forwardRef` works but signals tangled ownership in the **event-sourcing subsystem** (EventStore → Projector → Gateway writes back into feature modules). **Recommendation:** decouple via an event-bus/mediator (e.g. emit domain events that projectors subscribe to, rather than mutual injection) so feature modules depend on the bus, not each other. Lowest-risk first: break `staff ↔ staff-invite` (a simple service split).

## Backend architecture — ✅ with SRP hotspots (🟠 Major M2)
- NestJS DI throughout; global `ValidationPipe` + `StripSecretsInterceptor` + `EnhancedThrottlerGuard` + Sentry filter; event-sourcing-ish layer (`DomainEvent`, projectors, WS gateway) for real-time dashboard.
- **God classes (SRP violations):** `auth.service.ts` **2,140 lines**, `subscription.service.ts` 1,232, `action-queue.service.ts` 1,085, `members.service.ts` 1,057. `auth.service` mixes login, onboarding, studio/branch provisioning (raw SQL), and Supabase admin — it should be split (AuthService / OnboardingService / StudioProvisioningService). *(`member-api.types.ts` at 3,437 lines is **generated** — not a god class.)*

## Frontend architecture — ✅ healthy
- Next.js 14 App Router. **Server state via react-query in 104 files** (correct pattern — no hand-rolled fetch caching); only **2 React contexts** and **no zustand in admin** (minimal global state = good). SCC uses a zustand `auth-store`.
- 🟡 Minor (m1): **large page components** — `settings/account/page.tsx` 1,128 lines, `schedule/page.tsx` 947, `app-layout.tsx` 914. Extract sections into components/hooks for testability (ties to the test-coverage gap).
- Design-system migration (Geist/Vercel) is mid-flight (per project memory) — consistency is improving but not uniform.

## Database architecture — ✅ strong, one known ceiling
- **183 Prisma models**, `multiSchema` (`studio_template` template + live `studio_*` + `public` + `scc`), UUID PKs, snake_case, `created_at/updated_at` conventions.
- Tenant isolation is **app-layer** via the single-source `$use` injection (drift-proof). ⚠ **RLS is decorative** (superuser `rolbypassrls`) — the Phase-B keystone is the durable fix and gates multi-gym scale (see SECURITY_AUDIT). This is the one architectural ceiling.
- Query hygiene looks disciplined: **1 `SELECT *`**, **0 `console.log`**, no obvious `await`-in-loop N+1 (heuristic — **UNVERIFIED** for deep N+1).
- 🟡 Minor (m2): index coverage on all WHERE/JOIN/ORDER-BY columns is **UNVERIFIED** — recommend `get_advisors performance` + `pg_stat_statements` review (the S2 FK-covering-index work in `docs/phase-8-launch/` is a start).

## DevOps maturity — 🟠 Major (M3)
- **CI (`.github/workflows/ci.yml`) covers only `backend` + `frontend`** (lint/test/build). **SCC and gym-member-app are NOT in CI** — no SCC build/test, no member-app `tsc` gate. CI triggers only on `main`/`develop` push + PR→`main`.
- **Containerization:** only SCC has a `Dockerfile` + `docker-compose`. **No Dockerfile for backend, frontend, or member-app.**
- **Missing from pipeline:** `prisma migrate status` gate, security scanning (advisors/deps), deploy automation, IaC. No evidence of staging/preview environments.
- **Recommendation (highest ROI):** add SCC + member-app `tsc` jobs to CI; add a migration-status check; containerize the backend. This is the weakest area relative to the otherwise-mature codebase.

## Scalability bottlenecks
- **RLS keystone + connection pooling** must ship before onboarding many live gyms (per project memory + SECURITY_AUDIT) — top priority.
- `auth.service`/`subscription.service` god-classes will slow change velocity as the team grows.
- Real-time path (WS gateway + event projectors) is reasonable but the circular coupling (M1) will complicate horizontal scaling of the dashboard.
- Analytics aggregation job (`metrics-aggregation.job.ts` 731 lines) — verify it's incremental/batched, not full-table scans, before data volume grows (**UNVERIFIED**).

---

## Recommendations (prioritized)
| ID | Sev | Action |
|---|---|---|
| M3 | 🟠 | Bring SCC + member-app into CI (`tsc`/test/build); add migration-status + dep-scan jobs; containerize backend. |
| M1 | 🟠 | Decouple the 3 circular pairs via an event bus; start with `staff ↔ staff-invite`. |
| M2 | 🟠 | Split `auth.service.ts` (2,140 LOC) into Auth / Onboarding / StudioProvisioning. |
| m1 | 🟡 | Decompose 900–1,100-line page components; raises testability. |
| m2 | 🟡 | Verify index coverage via performance advisors. |
| m3 | 🟡 | Confirm analytics jobs are incremental. |
| m4 | 🟡 | Standardize backend tsconfig toward full `strict` (see CODE_QUALITY). |

## Architecture Score: **82 / 100**
Clean module boundaries, strong isolation design, healthy frontend data layer; held back by DevOps/CI maturity, god-class services, and the event-subsystem coupling. None critical.
