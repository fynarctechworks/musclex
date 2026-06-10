# Phase 8.7 — Analytics KPI Validation (Findings Report)

**Date:** 2026-06-07 • **Scope:** KPI calculation correctness + tenant scoping across backend gym analytics, referral analytics, and SCC executive/member-app analytics. **Method:** source inspection of the computation code.

---

## Verdict: KPI calculations are **correct and well-defined**. No wrong formulas found.

### Gym-admin analytics — [backend/src/analytics/services/analytics.service.ts](../../backend/src/analytics/services/analytics.service.ts)
- All reads go through Prisma models → **auto gym-scoped** by the `$use` middleware. ✅
- Campaign rates: `open/click/conversion = metric ÷ sent × 100`, each guarded against divide-by-zero. ✅
- **Live fallback**: when the pre-aggregated `dailyGymMetrics` table is empty, today's metrics + daily trend are recomputed from raw `payment`/`checkIn`/`member` rows — so dashboards aren't blank pre-aggregation (relevant for UAT day 1). ✅
- Revenue/membership/class/trainer/branch-comparison all aggregate the correct projection tables with proper date/branch filters.

### Referral analytics — [backend/src/referrals/referral-analytics.service.ts](../../backend/src/referrals/referral-analytics.service.ts)
- **B2B** (SaaS-admin, intentionally platform-wide): funnel `conversion = rewarded ÷ total`; top-referrers, attributed revenue (`Σ event_payload.amountPaid` on applied reward logs), time-to-reward (avg + median). ✅
- **B2C** (gym owner): **strictly gym-scoped** — `requireGym()` throws without tenant context and `gym_id` is on every query. funnel `conversion = awarded ÷ total`, leaderboard, reward costs, per-member dashboard with computed rank. ✅ (Money-path correctness + tenant safety both good.)

### SCC executive / member-app analytics — [saas-control-center/src/modules/member-app-analytics/member-app-analytics.service.ts](../../saas-control-center/src/modules/member-app-analytics/member-app-analytics.service.ts)
Intentionally **global** (super-admin platform view), reads `public.app_users` + `app_user_events`:
| KPI | Definition | Correct? |
|---|---|---|
| DAU / WAU / MAU | `last_active_at >` now − 1d / 7d / 30d | ✅ standard rolling windows |
| Stickiness | `DAU ÷ MAU` | ✅ |
| Total registrations | `count(app_users)` | ✅ |
| Downloads/installs | `count(distinct first_app_open)` — **documented as a proxy** (real installs need store-console data) | ✅ honest |
| Onboarding started / completed | `onboarding_state IN (in_progress,completed)` / `= completed` | ✅ |
| Completion % vs Rate | `completed÷started` AND `completed÷totalReg` — two denominators, both clearly labeled | ✅ |
| Membership conversion | `withMembership ÷ totalReg` | ✅ |
| Segmentation | public / member / expired / inactive(>30d) / high-engagement(≥3 active days/14) | ✅ sensible thresholds |
| Conversion funnel | registered → onboarding_started → completed → viewed_nearby_gyms → viewed_gym_profile (event-based) | ✅ |
- The membership CTE joins `app_user_gym_links → studio_template.members` on **`m.gym_id = l.tenant_id`** (tenant-correct) and counts active statuses. ✅

---

## Notes / caveats (no fix needed)
1. **"Downloads" is a `first_app_open` proxy** — already documented in code. True install counts require Play/App Store console export; fine for UAT, note it when reading the number.
2. **Pre-traffic = near-zero everywhere.** All KPIs are correct but will read ~0 until UAT generates events. UAT itself is the first real validation of these dashboards — **recommend** spot-checking each KPI against raw counts a few days into UAT.
3. These read paths use the backend/SCC **superuser** connection, so the S1 anon revoke does not affect them. ✅
4. Metrics depend on `last_active_at` + events being written by [member-events.service.ts](../../backend/src/member/data/member-events.service.ts) / app-user service — confirmed those bump `last_active_at`. During UAT, verify events actually flow (client → `app_user_events`).

---
*Validation by source inspection. No code changed by this slice (no defects found).*
