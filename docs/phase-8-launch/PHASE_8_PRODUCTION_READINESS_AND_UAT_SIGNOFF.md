# Phase 8 — Production Readiness, UAT Launch Checklist & Go/No-Go

**Date:** 2026-06-07 • **Target:** 1-week UAT across all four apps (not yet a public production deploy).
**This document = Deliverables #1 (Production Readiness), #7 (Beta/UAT Checklist), #8 (Go-Live Recommendation).** The other deliverables are the per-phase reports below.

| # | Deliverable | Report |
|---|---|---|
| 1 | Production Readiness | this document |
| 2 | QA Verification | [PHASE_8.2_MOBILE_QA.md](PHASE_8.2_MOBILE_QA.md) |
| 3 | UI/UX Audit | [PHASE_8.3_8.4_UIUX_A11Y.md](PHASE_8.3_8.4_UIUX_A11Y.md) |
| 4 | Security Audit | [PHASE_8.1_REPOSITORY_AUDIT.md](PHASE_8.1_REPOSITORY_AUDIT.md) + [PHASE_8.8_SECURITY_AUDIT.md](PHASE_8.8_SECURITY_AUDIT.md) |
| 5 | Analytics Validation | [PHASE_8.7_ANALYTICS_VALIDATION.md](PHASE_8.7_ANALYTICS_VALIDATION.md) |
| 6 | Performance Optimization | [PHASE_8.5_PERFORMANCE.md](PHASE_8.5_PERFORMANCE.md) |
| 7+8 | Beta Checklist + Go-Live | this document |
| — | Push + Monitoring | [PHASE_8.6_8.9_PUSH_AND_MONITORING.md](PHASE_8.6_8.9_PUSH_AND_MONITORING.md) |

---

## Executive summary

The platform is **substantially production-grade** and **ready to enter UAT** once a short list of environment/credential items is set. The codebase is disciplined: strong app-layer tenant isolation (single-sourced), production-grade backend security wiring, a robust member-app resilience layer (single-flight token refresh, offline outbox, optimistic mutations), correct analytics math, and a premium, contrast-engineered design system. All five app surfaces typecheck clean.

**One critical, live vulnerability was found AND fixed during this phase**: 24 `public` tables were exposed to the anonymous PostgREST API with full read/write/delete and no RLS — closed via migration `phase8_s1_...` (26 ERROR advisors → 0) plus a default-privileges guard so it can't recur.

**Remaining gaps before relying on the full feature set** (none block a *core-flows* UAT): **push delivery needs EAS/FCM/APNs creds** (all send code — transactional AND the hourly automation engine — is complete and verified). *(Update: the member-app automation engine + per-user cooldown IS implemented in the SCC and verified against the live DB — 7 seeded automations. The earlier "not implemented" note was a search error, now corrected.)*

### Recommendation: **GO for UAT of core flows**, conditional on the "Must-do before UAT" list. **NO-GO for relying on triggered automations / push campaigns** until those gaps are closed.

---

## What was changed during Phase 8 (applied)
1. **DB migration `phase8_s1_close_anon_public_table_exposure`** — REVOKE anon/authenticated on 24 tables + ENABLE RLS + `ALTER DEFAULT PRIVILEGES` guard. *(verified: 0 ERROR advisors, 0 anon grants)*
2. **DB migration `phase8_s2_fk_covering_indexes_and_rls_fn_searchpath`** — 142 covering FK indexes + pinned `enable_tenant_rls` search_path. *(verified: 0 remaining unindexed FKs)*
3. Documentation: this Phase-8 report set under `docs/phase-8-launch/`.

*No application code was modified — all findings were either already handled, or are recommendations/decisions for you. (DB changes were explicitly approved.)*

---

## ✅ Must-do BEFORE UAT (environment / credentials — your action)
- [ ] Set backend env in UAT: `JWT_SECRET`, `HASH_SECRET`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`, `TWO_FACTOR_ENCRYPTION_KEY`, `RAZORPAY_WEBHOOK_SECRET` (boot fails fast if missing — good).
- [ ] Set `SENTRY_DSN` (backend) + `EXPO_PUBLIC_POSTHOG_KEY` (member app) so errors/events are captured during UAT.
- [ ] Confirm the **member app points at the UAT backend** (`config.apiBaseUrl`) and build a **dev/internal distribution** (Expo Go can't run native modules).
- [ ] Redis available (throttler + check-in cooldown + outbox-adjacent paths use it).
- [ ] Verify Razorpay is in **test mode** for UAT.

## 🟡 Should-do before UAT (small, high-value)
- [ ] **Push:** upload FCM + APNs creds to EAS + set `eas.projectId` → unblocks all push (transactional + campaign).
- [ ] **Automations:** decide — build the trigger engine + per-user cooldown, or **descope triggered automations from UAT** (recommended for week 1).
- [ ] a11y label sweep on ~9 touchable files lacking `accessibilityLabel/Role` (offer stands).
- [ ] Native crash reporting (`@sentry/react-native`) for the member app (JS errors already captured).

## Known limitations during UAT (acceptable, communicate to testers)
- Triggered automations / marketing push may be off (per decision above).
- "Downloads" KPI is a `first_app_open` proxy (real installs need store console).
- RN visual/animation/gesture quality + screen-reader UX are validated during UAT, not before (matrices in the QA + UI/UX reports).

---

## Beta/UAT test plan (1 gym, ~50–100 users)
Run the **end-to-end walkthrough** (Phase 8.11): install → register → onboarding → public features → discover gyms → submit inquiry (lead) → join gym → become member → membership features → generate referral → (push if enabled) → verify it all lands in **SCC analytics + CRM + referral + funnel** dashboards.

**Track daily:** onboarding completion, DAU, retention, referral usage, gym discovery, membership conversion, (campaign open/click if push enabled). Spot-check each KPI against raw row counts a few days in (analytics are correct but unexercised pre-traffic).

**Use the device QA matrices** in [PHASE_8.2](PHASE_8.2_MOBILE_QA.md) (functional) and [PHASE_8.3_8.4](PHASE_8.3_8.4_UIUX_A11Y.md) (visual + a11y).

---

## Post-UAT, before public production
- Re-run `get_advisors` (security + performance) after real traffic; drop genuinely-unused indexes then (not now).
- Enable `pg_stat_statements`, review top queries, fix any real N+1.
- Phase-B RLS keystone (non-bypass role) per `docs/RLS-PHASE-B-CUTOVER-RUNBOOK-2026-06-03.md` before onboarding multiple real gyms.
- Build automation engine + cooldown; native crash reporting; uptime/alerting on `/health`.
- Raise backend automated-test coverage on payment / referral-reward / tenant-isolation paths (currently 17 specs / 150 services).

---

## Go/No-Go scorecard
| Area | Status | UAT-ready? |
|---|---|---|
| Tenant isolation | Strong, single-sourced; anon leak fixed | ✅ |
| Backend security | Production-grade | ✅ |
| Build health (5 surfaces) | All tsc clean | ✅ |
| DB perf (FK indexes) | Fixed | ✅ |
| Analytics correctness | Correct | ✅ |
| Mobile resilience (net/auth/offline) | Production-grade | ✅ |
| Design system / UI consistency | Premium, complete | ✅ (per-screen visual QA in UAT) |
| Accessibility | Strong contrast; labeling gap | 🟡 |
| Transactional push | Code complete | 🟡 needs creds |
| Triggered automations + cooldown | Implemented + verified (SCC, 7 seeded) | 🟡 needs push creds; enable per gym |
| Monitoring | JS+backend errors captured | 🟡 native crash + alerting pending |

**Overall: GO for core-flow UAT** after the Must-do list; treat automations/push as feature-flagged-off until their items are closed.
