# Public Fitness Platform — Phase 6 Verification

> Final verification sweep, 2026-06-07. Branch `feat/member-bff-phase0`.
> Covers the brief's 10-point checklist + security. "Verified" = exercised at
> runtime or against the live DB; "tsc-only" = type-checked but needs device QA.

## Build/test matrix
| App | tsc --noEmit | Tests |
|---|---|---|
| backend | ✅ clean | member Jest 108/108 pass **with `TZ=UTC`** (7 streak tests are TZ-dependent — pre-existing, pass under UTC) |
| gym-member-app | ✅ clean | no tests in app (RN) — device/web QA pending |
| saas-control-center (backend) | ✅ clean | n/a (raw-SQL validated live) |
| saas-control-center/frontend | ✅ clean | n/a |

## 10-point checklist
1. **Audit complete repository** — ✅ Phase-0 audit before any code; every phase
   extended existing systems (member BFF, tenant `$use`, analytics facade, SCC
   raw-SQL modules, branch geolocation) — no duplicate architecture.
2. **Backend wiring** — ✅ member BFF routes mapped; auth/guard behaviour correct
   (see §security); SCC `MemberAppAnalyticsModule` registered, routes return 401
   (exist + guarded).
3. **Frontend wiring** — ✅ SCC 7 pages + "Member App" nav group + shared
   UsersTable, all tsc-clean. Member app: dynamic nav/screens (PublicHome,
   PublicProgress, gyms, referral) tsc-clean (device QA pending).
4. **API integration** — ✅ runtime-tested live: `/me/context`, `/me/weight|water|
   goals|health`, `/me/events`, `/me/referral`, `/me/device-tokens`,
   `/me/nearby-gyms`. SCC analytics SQL validated against the live DB.
5. **Analytics tracking** — ✅ funnel emitter (`funnel.ts`) wired (first_app_open,
   first_dashboard_visit, onboarding_*, viewed_nearby_gyms/gym_profile/
   inquiry_click, referral_share); ingest verified; SCC overview/segments/funnel
   SQL validated.
6. **Onboarding tracking** — ✅ `onboarding_state` transitions verified
   (not_started → in_progress → completed; no downgrade).
7. **Segmentation logic** — ✅ segment SQL validated live (member/expired/public +
   lead/inactive/high-engagement). Rules documented in ROADMAP.md (single source).
8. **Notification targeting** — ⚠️ campaign create + segment→users→tokens
   resolution built and tsc-clean; **Expo send not runtime-verified** (needs SCC
   admin token + real device tokens + EAS projectId/FCM creds). Graceful failure
   path (counts failed) in place.
9. **CRM functionality** — ✅ leads + CRM endpoints with search / pagination / CSV
   export; phone numbers masked.
10. **Scalability** — ✅ every new table indexed (app_users ×8, gym_links ×4,
    events/device_tokens/campaigns ×3, tracking ×2); list endpoints paginated;
    aggregations are single raw-SQL queries (no N+1); public schema (gym-less users
    never touch per-studio schemas).

## Security
- **Tenant isolation** — ✅ public token → **403** on every gym endpoint (/me,
  /membership, /classes); no-token → 401; `$use` fails closed on empty gym_id
  (defence-in-depth). Cross-tenant reads (nearby-gyms directory, SCC segment join)
  expose ONLY public-safe gym/branch fields — never member/secret data.
- **PII** — phone numbers masked in SCC leads/CRM UI.
- **RLS advisory (unchanged risk class)** — the new public tables have RLS disabled,
  consistent with the existing `member_directory`/`member_refresh_tokens`
  convention (app connects as a `rolbypassrls` superuser, so RLS is decorative
  here — see [[project_rls_not_loadbearing]]). Same Phase-B keystone caveat as the
  rest of the schema; no new isolation regression.

## Known gaps / follow-ups (carried forward)
- Campaign **Expo send** end-to-end (creds) + scheduling (`scheduled_at` unused).
- **Public onboarding screen** (collect name/city/goals into app_user) — public
  users currently skip the gym setup flow.
- Referral **installs** (pre-registration deep-link attribution).
- Gym-owner-scoped Leads/CRM in the gym admin frontend (SCC is global super-admin).
- "Downloads" KPI uses `first_app_open` as a proxy (real installs need store data).
- BMI/calorie calculators; steps/calorie server-sync for public users.
- All member-app UI is device/web-QA-pending (no tests in that app).
