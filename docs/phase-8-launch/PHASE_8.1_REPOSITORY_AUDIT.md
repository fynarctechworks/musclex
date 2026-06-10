# Phase 8.1 — Repository Audit (Findings Report)

**Date:** 2026-06-07
**Branch:** `feat/member-bff-phase0`
**Scope:** Full monorepo (backend, frontend, gym-member-app, saas-control-center) + live Supabase DB advisors.
**Method:** Static repo inspection + live Supabase security/performance advisors (`get_advisors`). Where a claim was not measured it is marked **unverified**.

---

> ## ✅ UPDATE 2026-06-07 — BLOCKER RESOLVED
> Slice **S1 applied and verified** (migration `phase8_s1_close_anon_public_table_exposure`): REVOKE-ed all `anon`/`authenticated` grants on the 24 tables, enabled RLS (deny-all) on each, and added an `ALTER DEFAULT PRIVILEGES` guard so future `postgres`-created public tables aren't auto-exposed. Re-probe: **0** anon grants remain, **0** still RLS-disabled. `get_advisors security` dropped from **26 ERROR → 0 ERROR**. The previously-exposed tables now show only the benign `rls_enabled_no_policy` INFO. SQL of record: [S1_anon_exposure_fix.sql](S1_anon_exposure_fix.sql). Remaining: 3 WARN (`vector` ext in public, `enable_tenant_rls` search_path, leaked-password protection) + INFO — all non-blocking, tracked for Phase 8.8.

## 0. Executive summary

The platform is feature-complete and the codebase is, on the whole, **disciplined** — the member app is unusually clean (0 `TODO/FIXME`, 1 `console.*`, 4 `any`-casts across `src/` + `app/`), tenant isolation has a single source of truth, and prior audit debt (R1/R3/D4 registry drift, biometric leak, raw-SQL sweep) has been closed in recent commits.

**However, there is ONE critical, launch-blocking class of finding** that the live DB advisor surfaced:

> ❌ **26 ERROR-level security findings**: 24 tables in the `public` schema are **exposed via the PostgREST data API with RLS disabled**, and 2 of those expose `token` columns. This includes the **entire new public-fitness-platform table set** (`app_users`, `app_user_*`, `app_campaign_*`) shipped today (2026-06-07) and the **referral/wallet** tables.

Because the backend connects as a `rolbypassrls` superuser, RLS being off does **not** affect the NestJS API — but Supabase also exposes the `public` schema through the **anon/public API key**, which the web frontend ships to the browser. If the Supabase Data API is enabled (default), these tables are readable/writable by **anyone holding the public anon key** = cross-tenant PII + device-token + wallet exposure. **This must be resolved before any gym onboards.**

This is a HARD-STOP area (auth/RLS/tenant isolation) per `CLAUDE.md`, so this report **flags and recommends** — it does **not** change RLS. Remediation is proposed in §6 for explicit approval.

---

## 1. Repository inventory (measured)

| App | Surface | Count |
|---|---|---|
| backend | NestJS modules | 31 |
| backend | controllers | 87 |
| backend | services | 150 |
| backend | Jest spec files | 17 |
| backend | runtime deps / dev deps | 44 / 32 |
| frontend (admin) | `page.tsx` routes | 99 |
| saas-control-center/frontend | `page.tsx` routes | 31 |
| gym-member-app | screens (`app/**.tsx`) | 40 |
| gym-member-app | runtime deps | 42 |

**Test-coverage observation (unverified depth):** 17 backend spec files against 150 services ≈ thin automated coverage. Member app has **no tests** by design (per `CLAUDE.md`); verified only via `tsc --noEmit` + device QA. This is acceptable for beta but should be tracked as debt (see §5).

---

## 2. Tenant isolation — STRONG (verified by inspection)

- Single source of truth confirmed: [backend/src/prisma/tenant-models.ts](../../backend/src/prisma/tenant-models.ts) feeds **both** the load-bearing `$use` middleware and the opt-in `$extends` tenant client, so the two model-sets can no longer drift (the historical leak class). ~150 models registered, including the previously-missing D4 set and the biometric models.
- Raw-SQL footprint: **88 `$queryRaw`/`$executeRaw` occurrences across 30 files**. Per the latest commit (`94fe0e7` "R5 raw-SQL tenant-scoping sweep — no leaks"), these were swept for explicit `gym_id` filtering. **Recommend** a spot re-verify of the member-BFF raw queries (`member/data/*`, `member/directory/*`) since this branch is new — listed in §5, not changed here.
- RLS is **decorative for the backend** (superuser bypass) — this is documented and understood. The risk is **not** the backend; it is the **PostgREST/anon surface** (§3).

**Caveat:** App-layer isolation only protects traffic that goes *through the NestJS app*. The Supabase anon API bypasses the app entirely — see §3.

---

## 3. 🔴 CRITICAL — Live DB security advisors (`get_advisors security`)

26 **ERROR**, 3 **WARN**, 13 **INFO**.

### 3a. `rls_disabled_in_public` — ERROR ×24 (launch blocker)
Tables in `public`, exposed via the Data API, **no RLS**:

- **Public fitness platform (shipped today):** `app_users`, `app_user_gym_links`, `app_user_goals`, `app_user_weight_logs`, `app_user_water_logs`, `app_user_health_daily`, `app_user_events`, `app_user_device_tokens`, `app_campaigns`, `app_campaign_deliveries`, `app_campaign_automations`
- **Referral/wallet:** `referrals`, `referral_campaigns`, `referral_reward_rules`, `referral_wallets`, `referral_wallet_entries`, `referral_fraud_signals`, `referral_lifecycle_events`, `reward_logs`
- **Member BFF:** `member_directory`, `member_refresh_tokens`, `member_idempotency_keys`
- **Other:** `subscription_events`, `user_dashboard_layouts`

### 3b. `sensitive_columns_exposed` — ERROR ×2
`app_campaign_deliveries.token` and `app_user_device_tokens.token` exposed via API without RLS → push/campaign token theft → notification hijack.

### 3c. WARN ×3
- `function_search_path_mutable`: `public.enable_tenant_rls` has a mutable `search_path` (privilege-escalation hardening gap).
- `extension_in_public`: `vector` extension in `public` (move to dedicated schema).
- `auth_leaked_password_protection`: HaveIBeenPwned check disabled in Supabase Auth.

### 3d. INFO ×13
`rls_enabled_no_policy` on `studios`, `invoices`, `subscription_plans`, `user_*`, `permissions`, etc. — RLS on but zero policies (deny-all to anon, which is safe, but inconsistent with the disabled tables above).

**The single most important question to answer before launch:** *Is the Supabase Data API (PostgREST) reachable with the anon key for this project, and do `anon`/`authenticated` roles hold SELECT/INSERT grants on the §3a tables?*

### 🔴 VERIFIED 2026-06-07 — exposure is LIVE and read/write/destroy
A read-only `role_table_grants` probe confirms the **`anon` role holds `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` (full)** on every §3a table, with **no RLS**. The `anon` key is, by design, shipped to every browser. Therefore, with the Supabase Data API enabled (default), **anyone on the internet with the public anon key can read all member/app-user PII + health data, steal push/campaign `token`s, AND delete or `TRUNCATE` these tables.** This is an active critical confidentiality **and integrity** vulnerability.

Confirmed-affected (probed subset): `app_users`, `app_user_gym_links`, `app_user_goals`, `app_user_weight_logs`, `app_user_water_logs`, `app_user_health_daily`, `app_user_events`, `app_user_device_tokens`, `app_campaigns`, `app_campaign_deliveries`, `app_campaign_automations`, `referrals`, `referral_wallets`, `referral_wallet_entries`, `member_directory`, `member_refresh_tokens`, `member_idempotency_keys` — all show identical full anon grants.

The only residual unknown is whether the project's Data API is toggled off at the platform level; the grants + missing RLS are the smoking gun regardless and must be fixed.

---

## 4. Live DB performance advisors (`get_advisors performance`)

1,354 lints: `unused_index` ×1045 (INFO), `auth_rls_initplan` ×147 (WARN), `unindexed_foreign_keys` ×142 (INFO), `multiple_permissive_policies` ×20 (WARN).

Interpretation (preliminary, full triage deferred to Phase 8.5):
- **1045 unused indexes** is inflated because the DB has near-zero traffic (no live gyms yet), so "unused" is expected — do **not** mass-drop. Re-run after beta traffic.
- **142 unindexed foreign keys** is the actionable list — these cause slow joins/cascades under real load. Triage in Phase 8.5.
- `auth_rls_initplan` ×147 relates to RLS policies re-evaluating `auth.*` per-row — only matters once RLS is load-bearing (Phase-B keystone).

---

## 5. Dead code / debt / hygiene (measured)

- ✅ **Garbage file** `backend/src/dashboard\357\200\242 && cp ...` (a botched-command artifact) is shown **deleted** in working tree — confirm the deletion gets committed.
- ✅ `SAAS_AUDIT_REPORT.md` deleted at root (superseded). Fine.
- Member app debt is **very low**: 0 `TODO/FIXME`, 1 `console.*`, 4 `any`.
- **NOTED FOR LATER (not changed):**
  1. Two divergent `subscription_plans` sources (scc vs public) — known from prior SCC audit; reconcile or document as intentional.
  2. Member-BFF raw queries on this new branch — spot re-verify `gym_id` scoping.
  3. Backend automated-test coverage is thin (17 specs / 150 services); add tests for payment/referral/tenant-isolation critical paths before scaling past beta.
  4. `vector` extension + `enable_tenant_rls` search_path hardening (low sev).

---

## 6. Recommended remediation (REQUIRES APPROVAL — HARD STOP §1/§2)

**Slice S1 (blocker, do first): close the public/anon exposure.** Two viable options — pick one:

- **Option A (fastest, lowest risk): disable the Data API exposure** for the `public` schema and/or revoke `anon`/`authenticated` grants on the §3a tables, so only the backend superuser reaches them. Appropriate because *all* legitimate access already goes through the NestJS API, not the Supabase client. Zero app code change.
- **Option B (defense-in-depth): enable RLS + deny-all (or owner-scoped) policies** on all 24 tables, mirroring the existing `rls_enabled_no_policy` pattern already used on `studios`/`invoices`. More work, aligns with the Phase-B keystone.

I recommend **A now + B as part of the Phase-B keystone** already scoped in `docs/RLS-PHASE-B-CUTOVER-RUNBOOK-2026-06-03.md`.

**Before touching anything:** run the anon-key probe (§3) to confirm the exposure is live and measure blast radius. I can do this read-only if you approve.

---

## 7. Phase-8 slice plan (proposed sequence)

1. **S1 — DB anon/RLS exposure** (this report, §6) — **blocker, needs approval**
2. **8.8 Security** remainder (authz matrix, rate-limit, secret-strip verification) — partially covered here
3. **8.5 Performance** (unindexed FKs, N+1 spot checks, member-app render)
4. **8.6 Push** end-to-end (EAS projectId + FCM creds — external, needs approval)
5. **8.7 Analytics** KPI calculation validation
6. **8.2 Mobile QA** + **8.3 UI/UX** + **8.4 a11y** sweeps
7. **8.9 Monitoring**, **8.10 Beta checklist**, **8.11 Sign-off**

---

*Generated as the Phase 8.1 deliverable. No code or DB state was modified by this audit.*
