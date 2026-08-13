# MuscleX Member App — Discovery Report

**Date:** 2026-08-04
**Scope:** `gym-member-app/` (Expo/RN client) + `backend/src/member/` (Member BFF), read against `docs/member-app-ux/` (Product/UX Bible, 25 docs).
**Status:** Discovery only. No code changed.

> **Honesty key.** Every claim below is marked `verified` (read the code this session),
> `doc` (asserted by a project document, not re-verified), or `unverified` (exists but
> never proven at runtime/on a device). The app **cannot run in Expo Go** — it needs a
> dev build — so nothing here carries recent on-device proof.

---

## 0. Three corrections to the brief

The starting brief contains three premises that do not match this repository. Stating
them up front because they change the plan materially.

| Brief says | Reality (`verified`) |
|---|---|
| "Existing **.NET** APIs" | The backend is **NestJS 10 + Prisma 5** on Supabase Postgres (multi-schema). There is no .NET anywhere in the monorepo. |
| Build "the Member Mobile App" (implied greenfield) | `gym-member-app/` **already exists**: 154 TS/TSX files, ~23,100 LOC, 49 route files, ~40 functional screens, a 26-primitive design system, and a live Member BFF. This is a **rebuild/redesign of a working production-adjacent app**, not a new build. |
| Tech stack list (RHF, Zod, MMKV, Victory/Skia) | Of that list only React Query, Reanimated, Gesture Handler, Secure Store, Notifications and SVG are installed. **RHF, Zod, MMKV and Victory/Skia are not.** Adding them is a `CLAUDE.md` HARD STOP (new dependencies) and needs your explicit approval. |

The brief's actual instruction — *understand the existing system, reuse every API, never
invent APIs, work module by module* — is correct and is what this plan follows.

---

## 1. Architecture review

### 1.1 System shape

```
Supabase Postgres  (schemas: public · scc · studio_template · studio_*)
        │
        ├── backend/            NestJS 10 + Prisma 5   ← gym API + MEMBER BFF (/member/v1/*)
        ├── frontend/           Next.js 14             ← gym admin web app
        ├── saas-control-center/ NestJS + Next.js 16   ← internal super-admin
        └── gym-member-app/     Expo 56 / RN 0.85      ← THIS APP
```

The member app talks to **exactly one surface**: `backend/src/member/` — the Member BFF.
It never touches Prisma, the admin API, or Supabase Postgres directly. It does use the
Supabase **Auth** SDK for phone OTP, and only for that. (`verified`)

### 1.2 Client architecture (as built)

```
app/                       expo-router file routes (49 files)
  index.tsx                splash → AuthGate
  (auth)/                  welcome · phone · otp · choose-gym · goal · terms · privacy
  onboarding/              intro (pre-auth) · setup (10-step personalization)
  (app)/                   TAB SHELL: home · search · progress · advice · profile
                           (+ workout · classes · community · rewards · menu — routed, hidden from bar)
  <30 stack routes>        checkin · coach · plan · nutrition · exercises · body · statistic ·
                           health · sleep · heart · activity · mindfulness · membership ·
                           messages · chat/[trainerId] · notifications · referral · tools ·
                           gyms · gym/[tenantId] · locations · id · visits · settings/*

src/
  api/           client.ts (fetch + envelope unwrap + single-flight 401 refresh)
                 endpoints.ts (~70 typed methods), queries.ts (React Query keys),
                 contract.ts (openapi-typescript generated), session-bridge.ts
  auth/          zustand auth-store, secure-store, supabase, use-capabilities
  design-system/ 26 primitives + tokens.ts / theme-vars.ts / theme.ts
  features/      checkin · gym · health · home · locations · notifications ·
                 onboarding · profile · progress · security · steps · workout
  offline/       expo-sqlite outbox (db.ts / db.web.ts platform split)
  navigation/    AuthGate · FitTabBar · ScreenHeader · BackButton
  analytics/ · monitoring/ · realtime/ · lib/ · data/
```

**Assessment.** The layering is sound — a single typed API client, a generated contract,
feature folders, an offline outbox, a token-driven design system. The weaknesses are:

- **`features/` is thin and inconsistent.** Twelve folders, several holding a single file
  (`checkin/submit.ts`, `gym/GymSuspendedBanner.tsx`). Meanwhile ~40 screens carry their
  own data-fetching, layout, and business logic inline — `(app)/home` is 555 lines,
  `nutrition` 437. The feature-first structure the brief asks for is **declared but not
  actually enforced**. (`verified`)
- **No form layer.** No RHF, no Zod, no shared validation. Each screen hand-rolls state
  and validation. (`verified`)
- **Charts are hand-rolled** (`LineChart.tsx` / `BarChart.tsx` over `react-native-svg`) —
  fine and dependency-free, but limited. (`verified`)
- **No test infrastructure at all.** Zero test files, no Jest config, no testing library.
  `typecheck` is the only automated gate. (`verified`)

### 1.3 State management

Three stores, cleanly separated (`verified`):

| Concern | Mechanism |
|---|---|
| Server state | **React Query v5** (`src/lib/query-client.ts`, keys in `api/queries.ts`) |
| Session / auth | **Zustand** (`auth/auth-store.ts`) + `expo-secure-store` for tokens |
| Local prefs / onboarding draft | **Zustand** (`prefs-store.ts`, `onboarding-store.ts`) + AsyncStorage |
| Offline mutations | **expo-sqlite outbox** (`offline/outbox.ts`), drained on foreground |
| On-device steps | Zustand `steps-store.ts` + `expo-sensors` Pedometer daemon (local-only, **no server sync**) |

This is a good foundation and should be **kept**, not replaced.

---

## 2. Folder structure

See §1.2. The material finding: the structure is *organised by type at the top level*
(`api/`, `design-system/`, `features/`) but screens under `app/` hold most of the logic,
so the codebase is effectively **route-first, not feature-first**. `CLAUDE.md` asks for
"group by feature, not type". The rebuild's single largest structural change is moving
screen logic down into `src/features/<module>/` and leaving `app/*.tsx` as thin route
shells.

---

## 3. API inventory — Member BFF (`/member/v1/*`)

**≈74 routes across 15 controllers.** (`verified` — extracted from
`backend/src/member/**/*.controller.ts`.) Every one is consumed by the client via
`src/api/endpoints.ts`.

**Conventions** (`verified`, from `member/decorators/member-data-controller.decorator.ts`
and `member/common/envelope.ts`):

- Success: `{ data, meta: { tenantId?, serverTime, cacheTtl? } }`. Error: `{ error: { code, message, retryable } }`.
- Two decorator stacks: `MemberDataController` (MemberJwtGuard → **GymMemberGuard** → tenant context → idempotency → envelope) for gym-only routes; `PublicMemberDataController` (no GymMemberGuard) for gym-less public users.
- Canonical error codes: `NOT_A_MEMBER`, `MEMBERSHIP_EXPIRED`, `TENANT_CHOICE_REQUIRED`, `IDEMPOTENCY_KEY_REQUIRED`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `VALIDATION_FAILED`, `INVALID_TOKEN`, `MEMBERSHIP_NOT_FOUND`.
- All mutating routes accept `Idempotency-Key`.
- OpenAPI contract: `docs/Member api v1.openapi.yaml` → `npm run gen:api` → `src/api/contract.ts`.

### 3.1 Route map

| Controller | Routes |
|---|---|
| **auth** (public) | `POST auth/otp/request` · `POST auth/session` · `POST auth/refresh` · `POST auth/dev/session` (dev-only) |
| **core** (gym) | `GET/PATCH me` · `POST me/avatar/upload-url` · `POST me/avatar` · `GET home` · `GET gym/occupancy` · `GET gym/locations` · `GET membership` · `GET membership/plans` · `POST membership/renew` · `GET progress` · `POST progress/metrics` · `POST progress/photos/upload-url` · `POST progress/photos` |
| **public** (gym-less OK) | `GET me/context` · `GET/PATCH me/profile` · `GET me/weekly` · `POST me/tools/compute` · `GET me/gyms/:tenantId` · `GET me/nearby-gyms` · `POST me/events` · `POST/DELETE me/device-tokens` · `POST me/notifications/ack` · `POST me/referral` · `GET/POST me/weight` · `GET/POST me/water` · `GET/POST me/goals` · `PATCH me/goals/:goalId` · `GET/POST me/health/daily` |
| **workout** | `GET workouts/today` · `POST workouts/:workoutId/logs` |
| **exercise** | `GET exercises` · `GET exercises/:id` · `PUT/DELETE exercises/:id/favorite` |
| **nutrition** | `GET nutrition/today` · `GET nutrition/foods` · `POST nutrition/meals` · `POST nutrition/water` · `PUT nutrition/goal` |
| **health** | `POST health/samples` · `GET health/summary` · `GET/POST health/connections` · `DELETE health/connections/:provider` |
| **class** | `GET classes` · `POST classes/:id/book` · `DELETE classes/:id/booking` |
| **checkin** | `POST checkins` |
| **identity** | `GET id` · `GET visits` · `GET visits/summary` |
| **chat** | `GET trainer-chat/threads` · `GET/POST trainer-chat/threads/:trainerId/messages` |
| **coach** | `GET coach` · `POST coach/chat` |
| **community** | `GET community/leaderboard` · `GET community/challenges` · `POST community/challenges/:id/join` · `GET community/badges` |
| **plan** | `GET plans` |
| **notification** | `POST/DELETE notifications/device-tokens` |

---

## 4. Authentication flow (`verified`)

```
Phone entry → Supabase Auth phone OTP → supabase access token
           → POST /member/v1/auth/session { supabaseToken, tenantId? }
           → member access token (HS256, aud=member, iss=musclex-member-bff, ~15 min)
             + opaque refresh token (SHA-256 hash stored server-side, rotating)
```

**Token claims:** `sub` = `appUserId` (the canonical, gym-independent person),
`tenantId` + `memberId` (both `null` for gym-less PUBLIC users), `role: 'member'`.

**Audience separation is real and load-bearing:** member tokens are signed with
`MEMBER_JWT_SECRET` and carry `aud=member`; the admin `JwtAuthGuard` verifies against
`SUPABASE_JWT_SECRET` with a Supabase issuer, so neither token type can cross over.

**Multi-gym:** a member of several gyms gets `TENANT_CHOICE_REQUIRED`; the client routes
to `(auth)/choose-gym` and re-calls `auth/session` with `tenantId`.

**Client side:** `session-bridge.ts` holds tokens; `client.ts` does a **single-flight
refresh** on 401 and one retry, then emits session-expired. Tokens live in
`expo-secure-store`. A dev-only OTP bypass (`auth/dev/session`) is hard-gated off in prod.

**Two user classes drive the entire UX:**
- **Gym member** (`tenantId` present) — full surface.
- **PUBLIC user** (`public.app_users`, phone-keyed, no gym) — gym tiles hide client-side
  via `useCapabilities()`; the server independently 403s gym-only routes. Defence in depth.

---

## 5. Existing features (as built)

`verified` unless noted. ~40 functional screens.

| Domain | Shipped | Notable gaps |
|---|---|---|
| Auth & onboarding | Phone OTP, country picker, multi-gym choose, 10-step personalization funnel, pre-auth intro | Intro still lime-green (pre-rebrand); source photos 8–18 MB each |
| Home | Unified `/home` payload: greeting, streak ring, activity rings, week chart, live occupancy, membership + class widgets, health & nutrition cards | 555-line screen; no readiness score |
| Check-in | QR scan w/ reticle + torch, hybrid QR, live occupancy | Camera path **`unverified`** (native-only) |
| Workout | Today's trainer-assigned workout, set/rep/weight logging, rest timer | No history, no analytics, no PRs, no builder, no templates |
| Exercise library | Browse/search/muscle filter, detail, optimistic favourites, 33 seeded/gym | **Images only — no video** |
| Nutrition | Calories + macros, meal logging, water, Indian food catalog, goals | No barcode, no photo AI, no recipes/meal planner |
| Health & wearables | `health/samples` ingest, summary, connections; HealthKit + Health Connect bridges; on-device pedometer | Bridges **`unverified`** on device; steps never sync to server |
| Progress | Weight/measurements, charts, transformation photos, before/after | — |
| Gym / money | Membership + invoices, real renew flow (Razorpay order → hosted checkout → 5 s polling), nearby-gym discovery, gym profile, branch locations | Gateway keys were returning 401 (`doc`, memory) |
| Classes | Browse w/ live seats, book/cancel, waitlist when full | No recurring booking, no calendar sync |
| Trainer | 1:1 chat (polling), assigned diet plan, smart recommendations | Text only; no voice/image; no WebSocket |
| AI Coach | Single rolling chat thread w/ server history | Not grounded in the member's own data; no proactive brief |
| Community | Leaderboard (real check-ins), challenges w/ computed progress, badges | **No feed, posts, comments, friends** |
| Notifications | Inbox + detail sheet (client-derived), push preference toggles, device-token register/delete | Real push delivery **never proven** (needs FCM creds + EAS projectId) |
| Platform | Offline outbox, PostHog sink, JS error capture → SCC Error Center, biometric app lock, referral | — |

**Discipline worth preserving: there is no fake/mock data anywhere in the app.**

---

## 6. Reusable components

`src/design-system/` — 26 primitives (`verified`):

`Screen · Text(Txt) · Button · Card · Input · ListRow · Chip · Badge · Avatar · Icon (Iconsax facade) · Logo · BottomSheet · Dialog · SegmentedControl · Stepper · Skeleton · EmptyState · ErrorState · ProgressRing · ActivityRings · LineChart · BarChart` + `tokens.ts`, `theme-vars.ts`, `theme.ts`, `field-focus.ts`.

**Theming.** Clay-orange `#D5650F` on warm cream `#FAF8F5`, light-default with a
hand-derived dark set, runtime-switchable via NativeWind CSS variables. **Three mirrors
must be edited together: `global.css` (source of truth) → `theme-vars.ts` → `tokens.ts`.**
Contrast ratios are documented per token; `mute`/`faint` are explicitly marked
decorative-only (fail AA).

**Gaps against the Bible's component ambitions:** no Tab/Accordion/Toast/Snackbar/Banner/
Tooltip/Slider/Switch/DatePicker/Calendar/Carousel/Sheet-stack, no chart types beyond
line/bar/ring, no motion primitives (shared-element, card-expand, confetti, celebration),
no skeleton variants per card type, no haptics token layer beyond `use-haptics.ts`.

---

## 7. Models

`src/api/types.ts` + generated `src/api/contract.ts` (from the OpenAPI yaml) carry ~60
DTOs: `MemberProfile`, `MeContext`, `HomeDashboard`, `Membership`, `Workout`, `SetLog`,
`ExerciseDetail`, `NutritionDay`, `HealthSummary`, `WearableConnection`, `Progress`,
`BodyMetric`, `ClassList`, `ChatThreadList`, `Leaderboard`, `ChallengeList`, `BadgeList`,
`DigitalId`, `GymProfile`, `WeeklyProgress`, `PublicGoal`, … (`verified`)

Regenerate with `npm run gen:api` — **never hand-edit `contract.ts`**.

---

## 8. Services

**Client:** `api/client.ts` (transport), `api/endpoints.ts` (~70 typed calls),
`offline/outbox.ts`, `features/health/sync.ts`, `features/steps/daemon.ts`,
`features/notifications/push.ts`, `analytics/` (PostHog HTTP sink), `monitoring/`
(error capture), `realtime/` (socket.io), `auth/secure-store.ts`.

**Server (BFF):** 20+ services under `backend/src/member/data/` —
`member-data`, `member-context`, `member-workout`, `member-nutrition`, `member-health`,
`member-class`, `member-checkin`, `member-billing`, `member-chat`, `member-coach`,
`member-community`, `member-exercise`, `member-plan`, `member-progress-photo`,
`member-streak`, `personalization`, `member-discovery`, `member-events`,
`member-identity`, `member-avatar`, `member-public-health`, `member-public-profile`,
`idempotency`, `member-directory`. Several carry `.spec.ts` unit tests. (`verified`)

---

## 9. Business rules (extracted — do not re-derive, do not guess at these)

1. **Tenant isolation is app-layer, not DB-layer.** The backend connects as a superuser
   with `rolbypassrls` — **RLS is decorative**. Real isolation = Prisma `$use` `gym_id`
   injection (single source: `backend/src/prisma/tenant-models.ts`) + JWT-sourced
   `gym_id`. Raw SQL must hand-filter `gym_id`. (`doc`, CLAUDE.md — treat as binding)
2. **Two identities.** `appUserId` = the person (survives leaving a gym);
   `memberId`+`tenantId` = the gym relationship. Public users have the former only.
3. **Gym-only routes 403 for public users** server-side via `GymMemberGuard`; the client
   must *also* hide them (`useCapabilities`) — never rely on only one.
4. **Every mutating call carries an `Idempotency-Key`.**
5. **Secrets never leave the server:** `face_descriptor`, `card_token`, `salary`, 2FA
   secrets are stripped by a global interceptor. Don't defeat it.
6. **Member data physically lives in `studio_template`**, gym_id-filtered — the per-gym
   `studio_*` schemas are empty/legacy. Debug there. (`doc`, memory)
7. **Suspended gym** (`studios.suspended_at`) gates member access via `GymMemberGuard`.
8. **Referral rewards fire on verified payment**, with auto-clawback on cancel/refund.
9. **Renewal is gateway-only** — manual self-service payments are rejected. (`doc`, memory)
10. **`Prisma.JsonNull`, never raw `null`,** for Json columns.

---

## 10. Missing APIs

Endpoints the Bible's screens require that the BFF **does not have**. Per the brief:
documented, not invented. Nothing here should be built without your approval.

### P0 — needed by the redesigned core loop

| # | Proposed endpoint | Business need | Why it can't be client-side |
|---|---|---|---|
| A1 | `GET /member/v1/readiness` | The "one number" (0–100) daily readiness/recovery score — the Home hero of the redesign | Must fuse check-ins + workout load + steps + sleep/HR server-side; needs history the client doesn't hold |
| A2 | `GET /member/v1/workouts/history`, `GET /member/v1/workouts/:id` | Workout History + Detail screens (SCR-WORKOUT-007/002) | Only `workouts/today` exists; history is server data |
| A3 | `GET /member/v1/workouts/analytics`, `GET /member/v1/workouts/prs` | Workout Analytics + Personal Records (SCR-WORKOUT-008/009); progressive-overload suggestions | Aggregation over all logged sets |
| A4 | `GET /member/v1/search?q=` | Global Search — the Bible makes this a primary nav surface | Currently client-side over the exercise list only; cannot span foods/classes/gyms/articles |
| A5 | `GET /member/v1/notifications` (+ `PATCH /:id/read`) | Notification Inbox (SCR-NOTIF) | Inbox is currently **client-derived** with on-device read state — it loses history on reinstall and can't reflect server sends |

### P1 — needed by the full Bible IA

| # | Proposed endpoint | Screen it unblocks |
|---|---|---|
| B1 | `GET/POST/PUT/DELETE /member/v1/workouts/templates` + `/programs` | Workout Builder, Templates, Programs (SCR-WORKOUT-010) |
| B2 | `GET /member/v1/nutrition/barcode/:code` | Barcode Scanner (SCR-NUT-004) |
| B3 | `GET /member/v1/nutrition/recipes`, `/meal-plan`, `/shopping-list` | Recipes, Meal Planner, Shopping List (SCR-NUT-005/006/008) |
| B4 | `GET/POST /member/v1/habits` | Habit engine (Bible §Habits, Phase 2) |
| B5 | `GET /member/v1/calendar` | Calendar module (unified workouts/classes/appointments) |
| B6 | `GET /member/v1/invoices` (+ PDF signed URL) | Invoices screen — currently only embedded in `/membership` |
| B7 | `GET /member/v1/recovery/*` (sleep detail, stress, mood) | Recovery Dashboard, Sleep Analysis (SCR-REC-001/002) |
| B8 | `POST /member/v1/steps` | Persist on-device pedometer data (today it is device-local and lost on reinstall) |

### P2 — large new subsystems (backend does not exist at all)

Social feed / posts / comments / friends · Marketplace & commerce · Corporate wellness ·
Live/video classes · Coach marketplace · Events · Podcasts/learning · Public API/SDK/
webhooks · Women's health · Injury management · Family accounts.

**Each of these is a backend product, not an app screen.** They are in the Bible; none
should enter the app plan until separately scoped and approved.

---

## 11. Missing features (client-side, no new API needed)

1. **No test infrastructure whatsoever** — zero tests, no runner. The Bible demands 80% coverage on core modules.
2. **No accessibility pass** — no dynamic-type support, no reduced-motion handling, no audited screen-reader order, touch targets unaudited. Store-review risk.
3. **No localization layer** — every string is hardcoded English. The Bible wants 100+ locales.
4. **No deep-link registry** — `scheme: 'musclex'` is configured, but there is no route→link map and no notification→destination routing table. The Bible requires a unique deep link per screen.
5. **No error boundaries per route**, no standard offline banner, no global toast/snackbar.
6. **State coverage is inconsistent** — several screens lack skeleton/empty/error/offline variants.
7. **No CI/CD** — no workflow file, no automated typecheck/lint/build gate.
8. **No shared form/validation layer.**
9. **No motion system** — no shared transitions, no celebration/PR/streak animations.
10. **Screen logic lives in routes**, not features (§2).

---

## 12. Potential improvements & risks

### Conflicts between the Bible and the built app (**you need to decide these**)

| # | Conflict | Detail |
|---|---|---|
| C1 | **Tab bar composition** | Bible §15 mandates **Home · Workout · AI Coach · Community · Profile + a global FAB**, and says "never change their order". The app ships **Home · Search · Progress · Advice · Profile, no FAB**. These are incompatible. |
| C2 | **Monorepo restructure** | Bible §19.02 tail prescribes `apps/mobile` + `packages/design-system|ui|api|…` and a microservice backend (`gateway/users/workouts/…`). The real repo is 4 apps + one NestJS monolith. Following the Bible here would be a multi-week re-platform with no user-facing value. **Recommend: do not.** |
| C3 | **Scope** | The Bible's Feature Catalog runs to ~200 documents including marketplace, corporate, podcasts, VR, smart mirror. The backend supports maybe 15% of it. |

### Damaged / incomplete source documents (found while reading `docs/member-app-ux/`)

| File | Problem |
|---|---|
| `01_*` | **Missing entirely** — the sequence jumps 00 → 02 |
| `10.2_Weight_Loss_Persona.md` | **0 bytes** |
| `19.02_Design_Tokens.md` | **Verbatim duplicate of `19.01_Design_Principles.md`** — no design tokens are actually defined anywhere in the Bible |
| `18` | Not a document — an unnamed file containing a *folder listing* plus notes. The ~15 screen-spec documents it indexes **do not exist** |
| `16_Feature_Catalog.md` | Truncated at the head — begins mid-list at "Wearable Ecosystem" |
| `17.02_User_Flows.md,` | Trailing comma in the filename |
| `19.03`–`19.30` | All 28 design-system documents are referenced but **do not exist** |

**Consequence:** the Bible gives strong *principles, IA, and screen names* but **no
implementable screen specs and no design tokens**. The only real, contrast-audited token
system in the project is the shipped one in `gym-member-app/global.css`. The rebuild
should treat `global.css` as the token source of truth and *write* the missing
`19.02_Design_Tokens.md` from it, rather than waiting on the Bible.

### Technical debt worth naming

- 555-line and 437-line screens with inline data + layout + logic.
- `theme.cyan` legacy alias still used across ~20 files (aliased to `secondary`, harmless but confusing).
- Onboarding intro ships ~78 MB of un-downscaled photos and pre-rebrand lime accents.
- `docs/features_list.md` is ~2 months stale and contradicts the code.
- Zero device proof for: camera check-in, push delivery, HealthKit/Health Connect, pedometer, haptics.

---

## 13. Bottom line

The foundation is **better than the brief assumes** and should be extended, not replaced:
a clean BFF with 74 typed routes, real tenant isolation, envelope + idempotency
conventions, a generated contract, React Query + Zustand + an offline outbox, and a
contrast-audited token system.

What is genuinely missing is **depth, proof, and polish**: no tests, no a11y, no i18n, no
CI, no device verification, screen logic in routes, and a visual language that is defined
in tokens but not yet expressed in any screen.

The rebuild should therefore be a **staged re-architecture + redesign of an existing app**
— feature-first restructure, design-language expression, state/a11y/offline completeness,
then the differentiating features — **not** a from-scratch rewrite.

The implementation plan follows in `MOBILE_IMPLEMENTATION_PLAN.md`.
