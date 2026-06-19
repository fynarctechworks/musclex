# Module 11 — Global Platform Architecture · Audit Synthesis

**Date:** 2026-06-18 · **Status:** 🟢 AUDITED (cross-cutting synthesis of Modules 1–10)

## 1. Architecture (as-verified)
Monorepo, 4 apps, one Supabase Postgres:
- `backend/` NestJS — gym API + member BFF. **Two Prisma clients in play mid-migration:**
  (a) legacy `PrismaService` (`$use` gym_id injection + ALS search_path, multiSchema)
  and (b) `TenantPrisma` → `TenantClientFactory.forSchema()` binding a client to a
  gym's **physical schema** via connection string (Road B). Services are being
  rewired from (a)→(b); this is the dominant in-flight change on `feat/per-gym-schemas`.
- `frontend/` Next.js admin · `gym-member-app/` Expo · `saas-control-center/` NestJS+Next.

## 2. Tenant isolation — the central invariant
Two regimes coexist right now:
- **TenantPrisma (target):** isolation **by construction** — a client can only reach
  its own `studio_<uuid>` schema; the factory rejects any non-`studio_<uuid>` name.
  By-id reads are safe. Verified in Memberships, Classes, POS, Member BFF, Facial.
- **Legacy PrismaService (R3 risk):** `findUnique`-by-id can't be gym-scoped by the
  `$use` middleware (fails-open), and data currently co-resides in shared
  `studio_template`. This is the **R3 leak class** — found live in Check-ins/QR
  (**fixed this audit, P1-M3-1**) and defended explicitly at the Member BFF
  boundary. Any remaining legacy-prisma by-id read is a candidate leak until rewired.

**Onboarding↔runtime split (P0-1, gated):** onboarding writes branches/plans into
`studio_template` while the TenantPrisma runtime reads `studio_<uuid>` — a
data-visibility gap owned by the migration. Do not patch piecemeal.

## 3. Cross-cutting findings
| ID | Sev | Finding |
|---|---|---|
| **X-1** | 🟠 | **Migration test debt** — services rewired to `TenantPrisma`, mocks not; ~80+ unit tests + several safety-net isolation suites RED. Safety net partially down. Owner/migration-gated. |
| **X-2** | 🟠 | **R3 by-id leak class** — recurring pattern on the legacy client. One instance fixed (P1-M3-1); sweep remaining legacy `findUnique({where:{id}})` reads of tenant data as services migrate. |
| **X-3** | 🟡 | **Concurrency check-then-act** — was present in memberships/classes/payments (all **fixed** this audit via guarded atomic claims). Pattern to watch for in un-audited write paths (POS returns P2-M6-1). |
| **X-4** | 🟡 | **DB hygiene** — 200 tables w/o PK, 1182 unused indexes (schema-clone amplified), `vector` ext in `public`. See DATABASE_AUDIT.md. |

## 4. What's strong (verified)
Signature/HMAC handling (payments + webhooks), member-audience JWT isolation,
SCC fail-closed authz + MFA + audit, RBAC privilege gating, oversell/booking/
payment atomicity (post-fix), facial-match isolation, append-only check-in events.

## 5. See also (final consolidated docs)
`FINAL_PLATFORM_AUDIT.md` · `SECURITY_AUDIT.md` · `DATABASE_AUDIT.md` ·
`PERFORMANCE_AUDIT.md` · `SAAS_UPGRADE_ROADMAP.md` (this folder).
