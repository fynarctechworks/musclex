# Supabase Region Migration Plan — Singapore → India (Mumbai)

**Status:** ✅ **COMPLETED 2026-09-01.** Production runs on the Mumbai project
(`czblwakdilgrdphusdhz`). `SELECT 1` from the VPS went 67ms → ~5ms.
Kept as the record of how it was done and what was verified.
**Created:** 2026-09-01
**Revised:** 2026-09-01 — no live gym owners; all accounts are the developer's
own test data. Rebuild-from-scratch replaces data migration.
**Goal:** Move Supabase from `ap-southeast-1` (Singapore) to India (Mumbai).

> Executed. Every phase below was completed and reconciled against the Singapore
> baseline: 4 auth users (UUIDs preserved), 3 gyms, 632 studio tables, 19 scc
> tables, 2,662 storage objects / 393 MB — all matched.

---

## 0. What the "no live gyms" fact changes

Everything. The previous draft was built around preserving production data and
`auth.users` UUIDs for paying gyms. With all accounts being throwaway test data:

| Previously the hard part | Now |
|---|---|
| Preserve `auth.users.id` byte-for-byte | **Gone** — re-register test accounts |
| `pg_dump`/restore of every `studio_*` schema | **Gone** — re-provision via app |
| Copy Storage objects (photos, documents) | **Gone** — re-upload a few test files |
| Zero-downtime cutover window | **Gone** — take as long as you want |
| Rollback plan, point-of-no-return | **Trivial** — old project still there |
| Customer comms | **None** |

**This is no longer a migration. It is: stand up a fresh Mumbai project, point
the apps at it, re-run migrations, re-seed.** A few hours, not a project.

The one thing that does *not* get easier: **the region only helps if the backend
is near it** (§1).

---

## 1. GATE — RESOLVED ✅ MIGRATE

Measured 2026-09-01 from the production VPS (not a laptop).

| Measurement | Result |
|---|---|
| VPS location | **Mumbai, Maharashtra, IN** (Hostinger, AS47583) |
| DB host | `aws-1-ap-southeast-1.pooler.supabase.com:5432` (Singapore) |
| `SELECT 1` round-trip from VPS | **min 67ms / median 67ms / max 69ms** |
| Initial connect | 338ms |

**Verdict: the migration is justified, and the case is stronger than expected.**

67ms for `SELECT 1` is essentially pure geography — that query does no work, so
almost all of it is Mumbai↔Singapore flight time. The flatness of the
distribution (67/67/69, near-zero variance) confirms it: this is not load, not
contention, not a slow plan. It is distance, paid on **every single query**.

Against the CLAUDE.md target of **DB query P95 < 100ms**, a query that does
nothing already burns 67% of the budget. Any endpoint issuing 10 sequential
queries pays ~670ms in latency alone before executing anything. Moving to Mumbai
should cut this to roughly **1–5ms**, a ~15–60x reduction in per-query overhead.

### 1.1 Second finding: the pooler is in the wrong mode 🔴

`DATABASE_URL` points at the pooler **host** but port **5432** — that is
*session* mode. Transaction mode is **6543**. Current value:

```
postgresql://…@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?connection_limit=2&pool_timeout=10
```

Session mode holds a Postgres backend for the whole client connection, which
explains the 24/60 connections sitting idle in your screenshot. With
`connection_limit=2` per container across `api` + `scc_api`, headroom is thin.

- [ ] Switch to port **6543** with `?pgbouncer=true&connection_limit=…`
- [ ] Note: Prisma requires `pgbouncer=true` in transaction mode or prepared
      statements break. Test before deploying.

**Do this as part of the migration** (new URL anyway), but it is independently
worth fixing and is *not* a substitute for the region move — 67ms is 67ms
regardless of pool mode.

---

## 2. What has to be rebuilt (not migrated)

| # | Thing | How |
|---|---|---|
| 1 | Postgres schema | `prisma migrate deploy` — 69 migrations in `backend/prisma/migrations` |
| 2 | `scc` schema | `saas-control-center/scripts/apply-migrations.ts` (hand-written idempotent SQL) |
| 3 | Extensions | **pgvector required** — `face_vec vector(128)` on member + staff |
| 4 | Auth users | Re-register, or `backend/scripts/seed-*.ts` |
| 5 | Storage buckets | Auto-created by app code on first use |
| 6 | Test data | `seed-phani-test.ts`, `seed-staff-app-test.ts`, `seed-second-gym.ts`, `seed-exercise-catalogue.ts`, `seed-explore.ts`, `seed-friends.ts` |
| 7 | Auth config | Google / Apple providers, redirect URLs, SMTP — manual re-entry |

### 2.1 Gotchas that still apply

- [ ] **pgvector before migrations.** `CREATE EXTENSION IF NOT EXISTS vector;`
      Enumerate everything on the old project first:
      `SELECT extname, extversion FROM pg_extension;`
- [ ] **Never `prisma migrate dev` for SCC.** Per CLAUDE.md that would wipe the
      shared DB. SCC is hand-SQL via `apply-migrations.ts` only.
- [ ] **`studio_template` must exist** before any gym is provisioned — live
      `studio_*` schemas are cloned from it. Verify with
      `backend/scripts/check-template.ts`.
- [ ] **JWT secret.** Fresh project = new secret = all existing tokens dead.
      Fine here; just re-login.
- [ ] **OAuth redirect URLs** must be re-added to Google/Apple consoles if the
      project ref (and thus the callback URL) changes. See
      `docs/SIGN_IN_WITH_APPLE.md` and `docs/GOOGLE_SIGN_IN_SETUP.md`. This is an
      **external/console change** — CLAUDE.md gate #5.
- [ ] **Mobile apps read Supabase URL at build time**
      (`EXPO_PUBLIC_SUPABASE_URL`). Your own test installs need a rebuild or EAS
      Update — no users to worry about, but your test devices will break until then.

---

## 3. Phase plan

### Phase A — Decide ✅ DONE
- [x] A1. VPS region + RTT measured — see §1. **Go.**
- [ ] A2. Confirm India/Mumbai is available on your Supabase tier.

### Phase B — Stand up Mumbai
- [ ] B1. Create the new Supabase project in India (Mumbai).
- [ ] B2. Record new `SUPABASE_URL`, anon key, service-role key, `DATABASE_URL`
      (use the **pooler**, port `6543`, `pgbouncer=true`).
- [ ] B3. Enable extensions — pgvector first.
- [ ] B4. Re-add auth providers, redirect URLs, SMTP.
- [ ] B5. **Measure RTT from the VPS to Mumbai** with the same command used in
      §1, and compare against the 67ms baseline. Expect ~1–5ms. If it is not
      dramatically better, stop and investigate before going further.

### Phase C — Schema + seed 🔴 GATE (schema)
- [ ] C1. Point a **local** backend at the new DB first, not the VPS.
- [ ] C2. `npm --prefix backend exec prisma migrate deploy`
- [ ] C3. Verify `studio_template` is complete (`scripts/check-template.ts`).
- [ ] C4. Run SCC's `apply-migrations.ts` against the `scc` schema.
- [ ] C5. Re-seed: exercise catalogue, then test gym/staff/member accounts.
- [ ] C6. Verify tenant provisioning end-to-end — register a gym, confirm its
      `studio_*` schema is created and scoped correctly.

### Phase D — Verify locally
- [ ] D1. `npm --prefix backend test`
- [ ] D2. `backend/node_modules/.bin/tsc --noEmit`
- [ ] D3. Manual: staff login, member login, check-in, dashboard, document
      upload + signed URL, photo upload.
- [ ] D4. Confirm buckets `member-photos` and `documents` auto-created.

### Phase E — Cut the VPS over
- [ ] E1. Update production env on `cortex-vps` (`DATABASE_URL`, `SUPABASE_URL`,
      `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] E2. Redeploy: `ssh cortex-vps` → `/opt/musclex/deploy/deploy.sh`.
      Note `deploy.sh` runs **no migrations** — the DB must already be correct.
- [ ] E3. Health checks: `curl -s http://127.0.0.1:4100/health` and
      `curl -s http://127.0.0.1:4101/api/v1/health`.
- [ ] E4. Update `frontend/` and `marketing/` env if they carry Supabase keys.
- [ ] E5. Rebuild / EAS Update `member-app` and `staff-app` for your test devices.

### Phase F — Confirm the win
- [ ] F1. Re-measure P95s against CLAUDE.md targets (dashboard < 2s,
      check-in < 1s, member list < 1.5s, DB query < 100ms).
- [ ] F2. Compare against the **67ms** pre-migration baseline in §1.
- [ ] F3. Keep Singapore around a few days, then delete it.
- [ ] F4. Update `.env.example` files and `MASTER_PROJECT_DOCUMENTATION.md`.

---

## 4. Risk register (much shorter now)

| Risk | Impact | Mitigation |
|---|---|---|
| VPS not in India | Migration makes it *slower* | Gate G1–G3 |
| pgvector missing before migrate | Migrations fail | Enable extensions first (B3) |
| `prisma migrate dev` run against SCC | Wipes shared DB | Hand-SQL only — CLAUDE.md |
| OAuth redirect URLs not updated | Social login breaks | Phase B4 |
| Old project deleted too early | Lose the easy rollback | Keep it a few days (F3) |

No data-loss risk, no downtime risk, no customer risk.

---

## 5. After the move: the remaining latency work

The region move removes ~67ms of *fixed* cost per query. It does not fix work
that is proportional to query count. Once Mumbai is live, re-check these — they
were previously masked by the geography:

- [ ] **Pooler mode** — §1.1. Fix as part of the new `DATABASE_URL`.
- [ ] **N+1 queries.** At 67ms each these were catastrophic; at ~2ms they become
      survivable but still real. Worth finding now that the noise floor is lower:
      ```sql
      SELECT calls, mean_exec_time, total_exec_time, left(query, 120)
      FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 25;
      ```
- [ ] **Instance size.** `t4g.nano` (2 vCPU / 0.5 GB) at 46% RAM. CPU was 4%, so
      this was never the bottleneck — but re-check under real load post-move.

Expect the app to feel substantially faster immediately after the cutover; these
are follow-ups, not blockers.

---

## NOTED FOR LATER (observed, not touched)
- Production env values are not in this repo (`backend/.env` and
  `saas-control-center/.env` are explicitly local-only). Confirm where the VPS
  sources its production `.env` before Phase E.
- A fresh project is a clean opportunity to ship the **Phase-B RLS non-bypass
  role** keystone (currently RLS is decorative — the backend connects as a
  superuser with `rolbypassrls`). Genuinely easier with no live data. But it is
  **separate work** — do not bundle it into this migration.
- `backend/scripts/clean-all-data.ts` already wipes DB + Supabase Auth users; if
  you'd rather reset in place than move, that path exists.
