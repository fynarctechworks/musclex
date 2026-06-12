# Per-Gym Schema Re-Architecture — Analysis & Roadmap

**Date:** 2026-06-13
**Status:** Planning only. No code, no schema, no migration in this document.
**Author:** Claude (at developer request, "blocker 4" of the production-deploy plan)
**Decision owner:** Phanendra

> ⚠️ This touches the two most dangerous HARD-STOP areas in the repo
> (DB structure + tenant isolation). Nothing here is implemented until a
> specific phase is explicitly approved.

---

## 1. TL;DR / Recommendation

The "per-gym Postgres schema" feature is **half-built, dead, stale, and not on
the path the codebase is actually taking.** Verified against the live DB
(2026-06-13): all tenant data lives in `studio_template`, keyed by `gym_id`; the
3 per-gym `studio_*` schemas are empty and frozen at old table counts.

The project has **already chosen a different, mutually-exclusive isolation
strategy**: shared `studio_template` + the **Phase B RLS keystone** (non-bypass
`musclex_app` role + 143 `tenant_isolation` policies + `app.gym_id`). That work
is staged and waiting for a cutover window.

**Recommendation (strong): do NOT pursue per-gym physical schemas.**
Finish the Phase B RLS keystone instead — it delivers true database-enforced
isolation on the architecture you already have, in days not weeks, without a
data migration. Then **remove the dead per-gym schema machinery** (separate
slice) so the codebase stops lying about its own design.

Per-gym physical schemas remain a *theoretically* valid model for extreme
scale/compliance isolation, but adopting them means **throwing away the Phase B
keystone**, exiting Prisma `multiSchema`, rewriting 32 raw-SQL sites, and
migrating live data — for a benefit (`gym_id` is already enforced in-app) you do
not need at 3 gyms or 300.

This doc gives you the full options analysis and, if you still choose it, the
real roadmap and risk ledger for per-gym schemas.

---

## 2. Verified current state (live DB, 2026-06-13)

| Fact | Evidence |
|---|---|
| 3 studios registered | `public.studios` → Phani Gym, shiva gym, Musclex |
| All tenant data in `studio_template` | 115 members, 169 memberships, 5 branches, 7 check-ins |
| Data isolated by `gym_id` column | Phani=112 members, shiva=3, Musclex=0 — all in `studio_template` |
| Per-gym schemas exist but are **empty** | each `studio_*` schema: 0 members, 0 branches |
| Per-gym schemas are **stale** | Phani/shiva = 133 tables; template/Musclex = 146 (drifted ~13 tables) |

### Why the per-gym schemas are inert (code)
- `schema.prisma` uses `previewFeatures = ["multiSchema"]` with
  `schemas = ["public", "studio_template"]`. The generated Prisma client emits
  **fully-qualified `"studio_template"."table"`** names — hardcoded at codegen.
- Therefore `SET search_path` is a **no-op** for every Prisma query
  ([prisma.service.ts:79-87](../backend/src/prisma/prisma.service.ts#L79-L87) says
  so explicitly).
- `runInTenantContext(schema_name, …)` during onboarding
  ([auth.service.ts:804](../backend/src/auth/auth.service.ts#L804)) sets a
  search_path Prisma ignores → org/branch land in `studio_template` anyway.
- **32 raw-SQL sites across 13 files hardcode `studio_template.*`** (members,
  inventory, member BFF, facial match, biometrics). None are schema-dynamic.

**Conclusion:** the per-gym schema creation
([auth.service.ts:788-800](../backend/src/auth/auth.service.ts#L788-L800)) +
`cloneTenantSchema()` is pure write-only dead weight, and it rots (clones freeze
at signup-time table count).

---

## 3. The strategic fork (read before choosing)

There are two coherent isolation models. **You can have one, not both.** The
codebase is already 80% down road A.

### Road A — Shared schema + RLS (the path already chosen)
- One physical schema (`studio_template`), every row carries `gym_id`.
- Isolation layers (today): (1) `$use` middleware auto-injects `gym_id`;
  (2) JWT-sourced `gym_id`; (3) RLS policies — currently **decorative** because
  the app connects as `postgres` (`rolbypassrls=true`).
- **Phase B keystone makes RLS load-bearing:** the staged
  [`musclex_app` role](../backend/prisma/manual/20260603_phase-b_musclex-app-role.sql)
  is `NOBYPASSRLS NOSUPERUSER`; cutover = apply role + switch to tx-local
  `app.gym_id` + repoint `DATABASE_URL`. Runbook already written
  (`docs/RLS-PHASE-B-CUTOVER-RUNBOOK-2026-06-03.md`).
- After Phase B, a missing `gym_id` filter is caught by the **database**, not
  just the app. This is real, defense-in-depth, multi-tenant isolation.

### Road B — Per-gym physical schemas (the "blocker 4 fix")
- Each gym gets `studio_<id>` containing its own tables; isolation is physical
  (queries can only see one gym's schema).
- **Incompatible with Prisma `multiSchema`** (cannot enumerate N dynamic schemas
  in `schema.prisma`). Requires abandoning multiSchema for connection-level
  `search_path` routing, OR per-tenant clients, OR fully schema-dynamic raw SQL.
- **Makes the Phase B RLS keystone moot** — you'd be discarding staged, nearly
  cutover-ready isolation work to build a different model from scratch.

**Key point:** Road B is not "completing blocker 4." It is **changing the
project's isolation architecture** and discarding Road A. That is the real
decision in front of you — not a tidy-up.

---

## 4. Options analysis

| Option | What it is | Effort | Risk | Net for launch |
|---|---|---|---|---|
| **A. Finish Phase B RLS (recommended)** | Cutover the staged non-bypass role on shared schema | ~2–4 days + a maintenance window | Medium (rehearsable; runbook exists) | **True DB-enforced isolation, no data migration** |
| **B1. Per-gym schemas via search_path** | Drop multiSchema; single-client + per-request `SET search_path`; per-tenant pooling | **3–6 weeks** | **Very high** (leak-class; rewrites isolation core) | No launch benefit; defers launch |
| **B2. Per-gym schemas via per-tenant Prisma clients** | One PrismaClient per schema, cached | 2–4 weeks | High + **connection blow-up** (N clients × pool) | Doesn't scale; not recommended at any size |
| **B3. Schema-dynamic raw SQL only** | Parameterize the 32 raw sites by schema | 1–2 weeks | High **and incomplete** — Prisma's generated client still can't be made dynamic, so ORM queries stay on `studio_template`. Hybrid/broken. | Worst of both; do not |
| **C. Defer everything** | Launch on current in-app `gym_id` isolation; revisit later | 0 | Low now (RLS still decorative) | Ships; isolation remains app-layer-only until Phase B |
| **D. Remove dead machinery** | Delete inert clone/search_path code + drop 3 empty schemas | ~half day | Low (no live behavior change) | Cleaner, safer codebase; pairs with A or C |

**Recommended sequence for production:** **D + A** — remove the dead Road-B
code, then finish the Road-A RLS keystone. That gives you the strongest
isolation posture for launch and a codebase that means what it says.

---

## 5. IF you still choose Road B — the real roadmap

Presented for completeness. Recommended only if a future enterprise/compliance
requirement mandates *physical* tenant separation (e.g. per-gym encryption keys,
per-gym backup/restore, data-residency). Variant **B1** (search_path routing) is
the only one that scales; this roadmap is for B1.

### Phase 0 — Decommission the conflicting strategy (prereq)
- Decide explicitly to abandon Phase B RLS keystone. Document why.
- Freeze new tenant tables until the cutover completes (drift is the enemy).

### Phase 1 — Exit Prisma `multiSchema`
- Re-model `schema.prisma` to a single logical tenant schema (no `multiSchema`).
- Regenerate client; the generated names become unqualified, so `search_path`
  becomes load-bearing again. **Every** integration test must re-pass.
- **HARD STOP gate** — schema.prisma change.

### Phase 2 — Connection-level tenant routing + pooling
- Introduce per-request `SET search_path = "studio_<gym>"` on a checked-out
  connection, with a connection pool that **pins** a connection for the request
  (no cross-request leakage). Likely needs a transaction-scoped pool wrapper.
- Replace `getTenantGymId()`-driven `app.gym_id` plumbing with schema routing.
- **HARD STOP gate** — tenant isolation core.

### Phase 3 — Schema-dynamic raw SQL
- Rewrite all **32** hardcoded `studio_template.*` sites (13 files) to use the
  request's schema. Add a lint/guard to ban literal `studio_template` in `src/`.

### Phase 4 — Provisioning that actually works
- Make `cloneTenantSchema` authoritative AND drift-proof: every Prisma migration
  must fan out to all `studio_*` schemas (today it only touches `studio_template`).
  This is a permanent new migration burden — design it before committing.

### Phase 5 — Data migration (the dangerous one)
- For each existing gym, move its `gym_id`-filtered rows out of `studio_template`
  into `studio_<id>`, preserving FKs/sequences. Live data (115 members today).
- Requires: full backup, dry-run on a branch DB, row-count + checksum
  reconciliation, and a **rehearsed rollback**. Maintenance window.
- **HARD STOP gate** — destructive/structural data op.

### Phase 6 — Cutover, verify, decommission
- Flip routing on; verify each gym sees only its own rows (automated isolation
  e2e per gym). Drop `studio_template` tenant rows only after a soak period.

### Effort & risk ledger (Road B / B1)
- **Calendar:** 3–6 weeks focused, plus rehearsal windows.
- **Blast radius:** every read/write path; failure mode = cross-tenant leak
  (the worst outcome per CLAUDE.md).
- **Rollback:** complex once data is split; needs dual-write or a tested restore.
- **Ongoing tax:** every future migration must fan out across N schemas.

---

## 6. Open questions before any Road-B work

1. Is there a concrete requirement forcing *physical* separation (compliance,
   per-gym keys/backups, residency)? If not, Road B has no business case yet.
2. What's the gym-count horizon? `search_path` routing is fine to thousands;
   per-tenant clients are not. Sets the variant.
3. Are we willing to discard the Phase B keystone investment? (It's nearly
   cutover-ready.)
4. Who owns the per-migration fan-out tax long-term?

---

## 7. Recommended decision

1. **Now (for launch):** choose **Option C or D+A**. Do *not* start Road B.
2. **Highest-value isolation work:** finish **Phase B RLS keystone** (Road A).
   Separate, already-scoped effort with its own runbook.
3. **Cleanup slice (independent, low-risk):** remove the dead per-gym schema
   machinery + drop the 3 empty schemas (Option D), so no future reader mistakes
   it for a working feature. Needs HARD-STOP sign-off but changes no live data
   path.
4. **Revisit Road B only** if/when a real physical-isolation requirement appears
   (question 1). Then start at Phase 0 of §5.

---

### Appendix — raw-SQL `studio_template` hotspots (Road B rewrite surface)
32 occurrences / 13 files (from `grep`):
`auth.service.ts` (7), `inventory.service.ts` (5), `member-discovery.service.ts`
(4), `member-context.service.ts` (3), `staff-biometrics.service.ts` (3),
`face-api-pgvector.provider.ts` (2), `batch.service.ts` (2),
`facial-matcher.service.ts` (1), `transfer.service.ts` (1),
`members.service.ts` (1), `member-directory.service.ts` (1),
`tenant-prisma.extension.ts` (1), `prisma.service.ts` (1).
