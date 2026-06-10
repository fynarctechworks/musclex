# Public Fitness Platform + SaaS Analytics + Lead Management — Roadmap

> Status: **PLAN — awaiting Phase 1 sign-off (schema + auth = HARD STOP).**
> Created 2026-06-07. Branch: `feat/member-bff-phase0`.
> Owner decision locked: **public-schema `app_user` identity** (Option A).

## Goal
Turn the member app from a gym-only app into a **public fitness platform** that
anyone can install + use (OTP signup, health/weight/water/goal/BMI tracking,
nearby gyms, referrals) while existing gym members keep every membership feature.
The platform auto-segments users (Public / Member / Expired / Lead) and gives SCC
super-admins + gym owners full lifecycle visibility (analytics, leads, CRM,
conversion funnel, segment-targeted campaigns).

## Audited reality (why this needs a foundation, not just features)
- **Identity == gym membership today.** `requestOtp()` only sends an SMS if the
  phone is already in `member_directory`; `createSession` throws `notAMember()`
  with no gym; every JWT carries a required `tenantId`.
  (`backend/src/member/auth/member-auth.service.ts`)
- **All personal tracking data is gym-scoped** (`WaterLog`, `MemberBodyStats`,
  `MemberHealthDaily`, `NutritionGoal`… all carry `gym_id`, live in
  `studio_template`). A gym-less user has nowhere to store data.
- **Reuse, don't rebuild:** `Member.status` already has `lead`; tenant `Lead`/
  `LeadActivity` (gym CRM) exist; branch geolocation + nearest-gym data exists;
  push (`MemberDeviceToken`), campaigns, referral engine, health platform,
  BMI/water/weight screens exist; SCC has cross-tenant analytics + a responsive
  dashboard shell.

## Core architecture decision (LOCKED)
`public.app_users` is the canonical person (phone-keyed). The member JWT carries
`app_user_id`; `tenantId` becomes **optional**. Gym membership is a *link*
(`app_user` ↔ `member_directory`). Public users' personal tracking data lives in
**new public-schema tables keyed by `app_user_id`**, never `gym_id` — so gym-less
users never touch a studio schema and tenant isolation stays intact.

```
JWT: { sub: app_user_id, tenantId: string | null, memberId?: string, role: 'member' }
  tenantId = null  → public / lead experience (gym endpoints 403)
  tenantId = uuid  → full gym-member experience (today's behaviour, unchanged)
```

---

## Phases (each = a reviewable slice, reported before continuing)

### Phase 1 — Identity & data foundation  ⛔ HARD STOP (schema + auth)
- New `public.app_users` (phone unique, name, email?, city?, gender?, dob?,
  referral_source?, onboarding_state, status, timestamps, last_active_at).
- New public-schema personal-tracking tables keyed by `app_user_id`
  (water / body-weight / goals / health-daily) — parallel to gym tables.
- New `public.app_user_gym_link` (or reuse `member_directory`) tying an
  `app_user` to its `(tenant_id, member_id)` gym memberships.
- Auth: `requestOtp` always dispatches (find-or-create app_user); `createSession`
  issues a token with `tenantId=null` for gym-less users; JWT gains `app_user_id`
  + optional `memberId`. `TenantContextInterceptor` tolerates null gym.
- Guard/decorator: `@GymMemberOnly()` vs public-allowed member endpoints.
- Migration via Prisma (forward-only) — **DDL shown for sign-off before apply**.

### Phase 2 — Member app dynamic experience
- `GET member/v1/me/context` → `{ userType, capabilities }`
  (public | member | expired | lead).
- Conditional navigation + screens: hide membership/attendance/classes/trainer/
  schedule/announcements/subscription for public; show health dashboard, weight,
  water, goals, BMI, calorie calc, tips, nearby gyms, referral.
- Expired: previous membership + prominent **Renew** CTA.

### Phase 3 — Onboarding funnel + segmentation  ✅ SHIPPED 2026-06-07
- Funnel events → `public.app_user_events` (append-only) via `POST member/v1/me/events`;
  client emitter `src/analytics/funnel.ts` wires `first_app_open`,
  `first_dashboard_visit`, `onboarding_started/completed`. `onboarding_started/
  completed` also advance `app_users.onboarding_state`; every ingest bumps
  `last_active_at`.
- **Derived (no event needed):** registration = `app_users.created_at`;
  gym_selected = `app_user_gym_links.created_at`; membership_purchased =
  `member_memberships`; activity = `app_users.last_active_at`.

#### Segment rules (computed in SCC, Phase 4 — single source of these definitions)
Given an app_user with links L, memberships M (members.status), events E, and
`last_active_at = LA` (now = N):
- **Member** — any membership active (status ∈ active|trial|expiring_soon|frozen).
- **Expired** — has ≥1 link but no active membership.
- **Public / Lead** — 0 links. (Lead = the CRM view of a Public user; same set.)
- **Inactive** — `LA` older than 30 days (cross-cuts the above).
- **High-engagement** — ≥3 distinct active days in the last 14 (from `app_user_events`
  + tracking-table activity), OR an active member with a recent check-in.
- **New** — `created_at` within today / 7d / 30d windows (registration cohorts).
Funnel (per cohort): registered → onboarding_started → onboarding_completed →
viewed_nearby_gyms → viewed_gym_profile → membership_purchased.

### Phase 4 — SCC dashboards (7 pages)
1. Member App Analytics (downloads/registrations/DAU-WAU-MAU/onboarding %/with-vs-
   without-membership/expired/new-today-week-month)
2. User Segmentation
3. Leads Dashboard (search / filter / export; name, phone, reg date, city, last
   active, usage, onboarding status, nearest gym, referral source)
4. Conversion Funnel (registered→onboarded→viewed gyms→viewed profile→purchased)
5. CRM Dashboard
6. Referral Analytics
7. Notification Campaign Analytics
- New SCC backend module reading `public.app_users` + funnel store + cross-tenant.

### Phase 5 — Conversion engine + campaigns + referral tracking
- Segment-targeted notification campaigns (public / expired / lead / active).
- Nearby-gym conversion tracking (searches, profile views, inquiry clicks).
- Referral funnel (code → invites → installs → registrations → conversions).

### Phase 7 — Product excellence, retention & conversion (in progress)
Mostly **extends gym-member excellence to public users** — minimal new systems.
- **7.1 Premium public onboarding ✅ SHIPPED** — reuses the existing 11-step flow +
  PersonalizationService. New: `app_users` fitness columns (migration
  20260607_public_app_user_fitness_profile); `GET/PATCH /me/profile` (public,
  MemberProfile/UpdateProfile shape, MemberPublicProfileService); onboarding-store
  branches by userType; AuthGate gates public users on `context.onboarding_state`.
  Runtime-verified: profile persists, recommendation computes, state → completed.
- **7.3 + 7.4 (intelligence/tools) — backend mostly DONE** via PersonalizationService
  (BMR/calorie/protein/water/split). Remaining: expose tools UI + BMI.
- **7.2 personalized home** — extend PublicHome with recommendation + weekly progress
  + challenges + tips.
- **7.5 gym profile pages + lead tracking** — extend nearby-gyms (profile endpoint:
  plans/hours/contact; reuse viewed_gym_profile/inquiry_click).
- **7.6 automated campaigns** — triggered sends (welcome/incomplete-onboarding/
  reminders) on app_campaigns + delivery analytics.
- **7.7 retention** — public streaks (from events/water/weight) + weekly progress.
- **7.8 referral revenue**; **7.10 SCC exec metrics** (retention/conversion rates);
  **7.9 UI pass** (device QA); **7.11 perf/prod audit**.

### Phase 6 — Verification
- `tsc --noEmit` (backend, SCC, member app), Jest (auth/segmentation/funnel),
  tenant-isolation re-check, full checklist from the brief.

## Security guardrails (every phase)
- Phone numbers masked in UI; `StripSecretsInterceptor` respected.
- SCC: super-admin = global; gym owner = only their authorized leads/CRM.
- All new public-schema reads are app_user-scoped or admin-only; no new
  cross-tenant leak surface.

## Open sub-decisions (resolve at the relevant phase)
- **Parallel public tracking tables (chosen, lower risk)** vs unifying all
  personal data into public schema for members too (bigger migration; future).
- On gym-join: migrate/merge a public user's tracking history into the gym record
  vs keep personal data in public schema and have the gym read it.
