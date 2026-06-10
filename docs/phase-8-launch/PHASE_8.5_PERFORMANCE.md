# Phase 8.5 — Performance & Build Health (Findings Report)

**Date:** 2026-06-07 • **Scope:** build/typecheck health (UAT gate) + DB perf advisors + mobile render notes.

---

## 1. Build health — ✅ GREEN across all five surfaces (the UAT go/no-go)
`tsc --noEmit` run per app; all exit 0:

| Surface | Result |
|---|---|
| `backend/` (NestJS) | ✅ 0 errors |
| `gym-member-app/` (Expo/RN) | ✅ 0 errors |
| `frontend/` (Next.js admin) | ✅ 0 errors |
| `saas-control-center/frontend` (Next.js 16) | ✅ 0 errors |
| `saas-control-center/` (NestJS) | ✅ 0 errors |

All four applications + the SCC backend typecheck clean → nothing blocks a UAT build. (Runtime build, e.g. `next build`, not run to avoid the dev-cache pollution gotcha; `tsc` is the sanctioned verification per CLAUDE.md.)

## 2. DB performance advisors (`get_advisors performance`) — 1,354 lints, triaged

| Lint | Count | Verdict |
|---|---|---|
| `unused_index` | 1045 (INFO) | **Do NOT act now.** DB has ~no traffic (pre-UAT), so "unused" is expected. Re-run after UAT to find genuinely dead indexes. |
| `unindexed_foreign_keys` | 142 (INFO) | **Actionable.** Missing covering indexes on FK columns in `studio_template` + 3 live `studio_*` + `scc`. Fix prepared (§3). |
| `auth_rls_initplan` | 147 (WARN) | Only bites once RLS is load-bearing (Phase-B keystone). Defer to keystone work. |
| `multiple_permissive_policies` | 20 (WARN) | Same — tied to RLS policy design; defer. |

## 3. Fix prepared (PROPOSED — needs approval, DB hard-gate): covering FK indexes
[S2_fk_covering_indexes.sql](S2_fk_covering_indexes.sql) — idempotent, dynamic: finds every FK column lacking a covering index across `studio_template` (so new gyms inherit on clone), existing `studio_*`, and `scc`, and creates a btree index. Tables are near-empty pre-UAT so creation is instant.

**Impact at UAT scale (50–100 users):** modest — FK-index absence mainly hurts under heavier load and on cascade deletes. Worth doing for production-readiness and so `studio_template` is correct for future gyms, but not a UAT blocker.

**Recommendation:** apply S2 to `studio_template` + the live `studio_*` schemas before UAT. Awaiting your go-ahead (DB structure = hard-stop per CLAUDE.md). The prior security fix is the only DB change applied so far.

## 4. N+1 / query profiling — method note (best caught during UAT)
Static N+1 hunting across 150 services is low-yield; the high-signal approach is to **enable query observability during UAT** and let real traffic surface offenders:
- Backend already targets P95 < 2s dashboard / < 1s check-in / < 100ms query (CLAUDE.md).
- **Recommend for UAT:** enable `pg_stat_statements` (Supabase has it) and review top-by-total-time after a few days; optionally turn on Prisma `log: ['query']` in a UAT-only env to catch per-request fan-out. This will produce a real, ranked N+1 list instead of guesses.

## 5. Mobile render (gym-member-app)
Prior prod-QA already addressed the big offenders (per memory): per-keystroke search → debounced; background poll paused via `focusManager`↔`AppState`; PostHog sink is dep-free + env-gated. No new render red-flags from static review (member app is clean: 1 `console.*`, 4 `any`). RN animation/layout perf is **device-only QA** during UAT — not verifiable from here (unverified).

---
*Build health verified by execution. FK-index fix prepared but NOT applied (awaiting approval). No code/DB changed by this slice.*
