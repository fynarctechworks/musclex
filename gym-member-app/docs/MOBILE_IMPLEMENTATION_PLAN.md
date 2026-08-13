# MuscleX Member App — Mobile Implementation Plan

**Date:** 2026-08-04 · **Status:** DRAFT — awaiting approval
**Companion:** `MOBILE_DISCOVERY_REPORT.md` (read that first)
**Governs:** `gym-member-app/` only. Backend changes are *proposed*, never assumed.

---

## 0. Strategy: re-architect + redesign, do not rewrite

The discovery found a working app with ~74 BFF routes, a real design-token system, and no
fake data. A from-scratch rewrite would discard proven integration work (auth, tenant
scoping, idempotency, offline outbox, health bridges) and reintroduce solved bugs.

**Therefore: an in-place rebuild in reviewable slices.** Every screen ends up rewritten —
but against a hardened foundation, one module at a time, with the app shippable after
every slice.

### The three non-negotiables that gate everything

1. **Reuse every existing API.** No new endpoint enters the app without being documented in the Discovery Report §10 and approved by you.
2. **No unapproved dependencies.** `CLAUDE.md` HARD STOP. §2 lists every one I'd want, with a justification and a zero-dependency fallback.
3. **Never invent findings.** Anything not run on a device is reported `unverified`.

---

## 1. Project architecture (target)

Keep the repo shape. Restructure *inside* `gym-member-app/`.

```
app/                          ← THIN route shells only. No data fetching, no layout logic.
  <route>.tsx                 → export { WorkoutScreen as default } from '@/features/workout'

src/
  app/                        ← app-wide composition
    providers.tsx             QueryClient · Theme · SafeArea · GestureHandler · ErrorBoundary
    error-boundary.tsx
    deep-links.ts             single registry: route ⇄ musclex:// link ⇄ notification type

  design-system/              ← MDL: the MuscleX Design Language (§4)
    tokens/                   color · type · space · radius · elevation · motion · haptics
    primitives/               Text Button Card Input Icon Avatar Badge Chip ListRow …
    feedback/                 Skeleton EmptyState ErrorState OfflineState Toast Banner
    charts/                   Line Bar Ring ActivityRings Heatmap Calendar
    motion/                   transitions · celebrate · streak · pressable
    layout/                   Screen Section Stack Grid Sheet

  features/<module>/          ← FEATURE-FIRST. One folder per Bible module.
    api.ts                    typed calls (thin wrapper over src/api)
    queries.ts                React Query hooks + keys + cache policy
    model.ts                  types + pure business logic (unit-testable)
    components/               module-private components
    screens/                  the actual screens
    __tests__/

  api/                        transport only: client · contract (generated) · session-bridge
  auth/  offline/  analytics/ monitoring/  realtime/  i18n/  a11y/  lib/
```

**Modules** (mirroring the Bible IA, scoped to what the backend supports):
`auth · onboarding · home · workout · exercises · nutrition · health · recovery ·
progress · gym · classes · membership · trainer · coach · community · challenges ·
notifications · profile · settings · search`

### Rules enforced by the restructure

- A route file is ≤ 5 lines.
- A screen never calls `fetch`/`api.*` directly — only its module's `queries.ts`.
- Business logic lives in `model.ts` as pure functions (that is what gets unit-tested).
- Cross-module imports go through the module's `index.ts` barrel only.

---

## 2. Dependencies — DECIDED 2026-08-04

Approved with the direction *"do the best for a powerful app and be careful with our
existing software."* Everything added is **pure JavaScript or dev-only** — no native
module, so no rebuild is forced and the shipped app cannot regress at runtime.

| # | Package | Version | Status |
|---|---|---|---|
| D1 | `zod` | `3.25.76` | **Added.** Runtime validation of API responses + forms |
| D2 | `react-hook-form` + `@hookform/resolvers` | `7.54.2` / `3.10.0` | **Added.** Replaces ~20 hand-rolled forms |
| D3 | `jest` `jest-expo` `@react-native/jest-preset` `@testing-library/react-native` `@types/jest` `react-test-renderer` | `29.7.0` / `56.0.5` / `0.85.3` / `13.2.0` / `29.5.14` / `19.2.3` | **Added (dev).** The app had ZERO tests |
| D4 | `i18next` + `react-i18next` | `24.2.1` / `15.4.0` | **Added.** Localization layer |
| D5 | `@shopify/flash-list` | — | **Deferred.** It is a *native* module; adds native risk to an app that is not yet device-proven. FlatList tuning covers Phases 0–2. Revisit after the dev build is stable |

> **zod version note.** `zod@3.24.1` was installed first and **broke `expo lint`**:
> `zod-validation-error@4.0.2` (via `eslint-plugin-react-hooks`) requires
> `^3.25.0 || ^4.0.0`, npm deduped it onto 3.24.1, and the missing `zod/v4/core`
> export crashed ESLint. Pinned to `3.25.76` — the version Expo's own CLI already
> resolves — so every consumer shares one copy. **Do not downgrade below 3.25.**
> Zod 4 was not chosen because `@hookform/resolvers@3.x` targets the zod 3 line.

**Explicitly NOT added** (against the brief's stack list, on purpose):
- **MMKV** — needs a native rebuild and duplicates the working AsyncStorage + SecureStore + SQLite trio. No user-visible benefit here.
- **Victory Native / Skia** — heavy; the existing hand-rolled SVG charts are adequate and dependency-free. Revisit only if a chart type genuinely can't be drawn.

---

## 3. Foundations (cross-cutting, built in Phase 0)

### 3.1 Networking
Keep `client.ts` (envelope unwrap, single-flight 401 refresh). Add: request timeout +
abort, retry-with-backoff on `retryable: true` only, `Idempotency-Key` auto-generated for
every mutation, and typed error → user-message mapping keyed on `MemberErrorCode`.

### 3.2 Caching (React Query policy, per data class)
| Class | staleTime | gcTime | Refetch |
|---|---|---|---|
| Reference (exercises, foods, plans) | 24 h | 7 d | on app update |
| Profile / context / membership | 5 min | 24 h | on foreground |
| Today (home, nutrition, workout) | 60 s | 24 h | on focus + foreground |
| Live (occupancy, class seats) | 15 s | 5 min | polling while visible |
| History (visits, weight, analytics) | 10 min | 7 d | on focus |

### 3.3 Offline strategy
Keep the SQLite outbox. Extend to: persisted React Query cache (read-offline for
home/workout/exercises/membership/progress), a queue for **all** mutations with conflict
policy per type (last-write-wins for logs, server-wins for bookings), a visible sync-status
chip, and drain on foreground + connectivity regain.
Offline-capable per Bible §15: workout history, active workout, templates, saved meals,
progress, downloaded programs.

### 3.4 Images
Downscale the onboarding intro photos (currently ~78 MB, 8–18 MB each → target ≤ 200 KB
each, WebP). Introduce a single `<Img>` wrapper with a blurhash/skeleton placeholder,
explicit dimensions, and signed-URL caching for Supabase Storage (1-hour URLs).

### 3.5 Authentication
No change to the flow — it is correct. Add: biometric unlock reuse on cold start,
graceful `TENANT_CHOICE_REQUIRED` routing, proactive refresh at T-60s, and a single
`SessionExpired` interstitial instead of per-screen handling.

### 3.6 Error handling
Per-route error boundary → `ErrorState` with retry. Global `Toast`/`Banner`. Every error
surface answers: what happened · why · what to do · retry · get help. Never a dead end.

### 3.7 Analytics
Keep the PostHog HTTP sink. Add a **typed event registry** (`analytics/events.ts`) so
every screen and action emits a named, documented event — the Bible requires an analytics
mapping per screen.

### 3.8 Push notifications
Register/delete already works. Needed: FCM credentials + EAS `projectId` (**your action —
external, HARD STOP**), then notification→deep-link routing through `deep-links.ts`, badge
counts, and preference-aware batching. **Cannot be proven without a dev build.**

### 3.9 Accessibility (mandatory, not a phase)
Every slice ships with: labels + roles + states on interactive elements, ≥44×44pt touch
targets, dynamic-type scaling, `prefers-reduced-motion` honoured, logical focus order, and
AA contrast (using the audited tokens — never `mute`/`faint` for text).

### 3.10 Localization
`i18n/` with `en` extracted first. No new hardcoded strings after Phase 0.

### 3.11 Performance targets (Bible §19.01 / CLAUDE.md)
Launch < 2 s · transition < 200 ms · touch feedback < 50 ms · 60 FPS · skeleton immediately.
Measured via a dev-build profiling pass, not asserted.

### 3.12 Testing strategy
- **Unit** — `model.ts` pure logic (streaks, macros, readiness, progressive overload, formatting). Highest ROI.
- **Component** — design-system primitives + every state variant (loading/empty/error/offline).
- **Integration** — feature hooks against a mocked client (envelope + error codes).
- **Contract** — assert `endpoints.ts` matches generated `contract.ts`.
- **Manual/device** — camera, push, HealthKit/Health Connect, pedometer, haptics. `QA_CHECKLIST.md` per module. Explicitly labelled `unverified` until run.

### 3.13 CI/CD
GitHub Actions: `typecheck → lint → test → (EAS build on tag)`. Currently none exists.

### 3.14 Release strategy
EAS channels: `development` → `preview` (internal) → `production`. Semver + a changelog per
slice. OTA for JS-only changes; store submission for native ones.

---

## 4. Design: the MuscleX Design Language (MDL)

The Bible names MDL but **ships no tokens** (`19.02` is a duplicate of `19.01`). The real
tokens are in `gym-member-app/global.css`, contrast-audited.

**Approach:** promote the shipped system to MDL v1, extend it, and write the missing
`19.02_Design_Tokens.md` *from the code* so docs and code stop diverging.

- **Source of truth stays `global.css`**; `theme-vars.ts` + `tokens.ts` are mirrors —
  all three edited together, always.
- **Palette holds:** clay `#D5650F` on cream `#FAF8F5`, light-default + derived dark.
- **Extend with:** a motion scale (durations/easings/spring presets), an elevation scale, a
  haptics map (selection/impact/success/warning/error), domain accent colors the Bible asks
  for (recovery/protein/workout/nutrition/sleep/hydration/AI/premium/gym), and the missing
  primitives (Toast, Banner, Tabs, Switch, Slider, DatePicker, Calendar, Accordion, Sheet stack).
- **Retire** the `theme.cyan` legacy alias across ~20 files during the sweep.
- **Every screen redesign** must express: one dominant action · 3-second comprehension ·
  data-with-meaning (never a bare number) · motivating-not-judging copy · celebration only
  at meaningful moments.

---

## 5. Navigation — DECIDED 2026-08-04: `Home · Workout · FAB · Progress · Profile`

Bible §15 and the shipped app disagree, and §15 forbids changing tabs without approval.

| | Bible §15 | Shipped today |
|---|---|---|
| Tabs | Home · **Workout** · **AI Coach** · **Community** · Profile | Home · **Search** · **Progress** · **Advice** · Profile |
| FAB | Global adaptive quick-action FAB | None (check-in lives on the Home header) |

**My recommendation: adopt the Bible's tabs *with one change*.**

```
Home · Workout · [ FAB ] · Progress · Profile
                   ↑ adaptive quick actions: Check In · Start Workout · Log Meal · Log Water · Ask AI
```

Reasoning: Workout and Progress are the two highest-frequency member destinations and both
are currently buried. AI Coach does not deserve a permanent tab while it is a bare chat
thread — it belongs in the FAB and on Home until Coach v2 (§6, Phase 5) earns promotion.
Community is leaderboard-only today; it moves under Progress until a feed exists. Search
becomes a persistent header affordance on every screen, as the Bible requires, rather than
consuming a tab.

The FAB also resolves the Bible's "universal quick actions" requirement, which has no home
in the current IA.

**APPROVED 2026-08-04 — option (a), the recommendation above.** Phase 2 builds this shell:
`Home · Workout · [FAB] · Progress · Profile`, with Search as a persistent header
affordance, AI Coach in the FAB + on Home until Coach v2 earns a tab, and Community
under Progress until a feed exists.

Also in scope: a **deep-link registry** giving every screen a `musclex://` link (Bible
requirement), driving notification routing, QR codes, and sharing.

---

## 6. Phased plan

Each phase = several reviewable slices. Each slice = one coherent change → report
(WHAT/WHY/TESTS/RISKS/NOTED FOR LATER) → continue. **The app stays shippable throughout.**

### Phase 0 — Foundation & proof (highest priority)
*Nothing else matters if the app can't be verified.*

| Slice | Content |
|---|---|
| 0.1 | ✅ **DONE 2026-08-04.** Jest + jest-expo + RNTL harness, `jest.setup.js` native mocks, first 37 unit tests (steps math, geo), `test`/`test:watch`/`test:coverage` scripts, `tsconfig` types fix, and a `member-app` CI job (typecheck + test blocking, lint reporting). Baseline coverage **1.47%**. |
| 0.2 | MDL token extension (motion, elevation, haptics, domain colors) + write `19.02_Design_Tokens.md` from code |
| 0.3 | Missing DS primitives (Toast, Banner, Tabs, Switch, Slider, DatePicker, Calendar, OfflineState) + state variants |
| 0.4 | `src/app/providers.tsx`, error boundaries, deep-link registry, typed analytics registry |
| 0.5 | Networking/caching/offline policy (§3.1–3.3) + `<Img>` + **onboarding photo downscale (78 MB → <2 MB)** |
| 0.6 | i18n scaffold + `en` extraction. *Gated on D4.* |
| 0.7 | **EAS dev build + device QA pass** → converts ~10 features from `unverified` to proven. **Requires your EAS/FCM credentials.** |

**Exit:** tests run in CI; MDL v1 documented; one device build exists; a real QA matrix replaces guesses.

### Phase 1 — Auth & onboarding rebuild
Feature-first `features/auth` + `features/onboarding`. Redesign to MDL (kills the lime-green intro). Full state matrix, a11y, i18n. Draft preservation + resumable funnel per Bible §17.02.

### Phase 2 — Navigation & Home
Tab shell per §5 decision + FAB quick actions + global search entry + deep links. **Home rebuilt from 555 lines into composed, individually-skeletoned cards** with the Bible's adaptive card system (beginner vs advanced vs gym-member vs home-workout emphasis).

### Phase 3 — The money path (gym core)
`checkin` → `membership` → `classes` → `gym`/`locations` → `id`/`visits`. Redesign + full states. **Verify the Razorpay renew flow end-to-end with live keys** (your action — currently 401ing on test keys). This is the revenue path; it goes early and gets device proof.

### Phase 4 — Training
`workout` (rebuilt), `exercises`, `plan`, `tools`. Adds **progressive overload + PR detection** (Discovery §10 A3 — *needs backend approval*), workout history/detail (A2), celebration moments.

### Phase 5 — Intelligence
`coach` v2 grounded in the member's real workouts/nutrition/check-ins with explained reasoning + a proactive daily brief; **readiness score** (A1 — *needs backend approval*) as the Home hero. This is the #1 tracked competitive gap.

### Phase 6 — Health, recovery & progress
`health`, `activity`, `sleep`, `heart`, `mindfulness`, `progress`, `body`, `statistic`. Server-persist on-device steps (B8). Recovery dashboard (B7). Device-verify the HealthKit/Health Connect bridges.

### Phase 7 — Nutrition
`nutrition` rebuilt; barcode scanner (B2), recipes/meal planner/shopping list (B3) — *all backend-gated*.

### Phase 8 — Community, trainer, notifications, profile & settings
`community`, `challenges`, `messages`/`chat` (WebSocket upgrade — the gateway already exists), server-backed notification inbox (A5), `profile`, `settings/*`.

### Phase 9 — Hardening
Full a11y audit (AA), performance profiling against §3.11 targets, offline matrix verification, release-candidate QA, store assets.

**Explicitly out of scope** until separately approved: marketplace/commerce, corporate
wellness, social feed, live/video classes, coach marketplace, events, learning/podcasts,
public API/SDK, women's health, family accounts, AI vision/voice. Each is a backend
product, not a screen (Discovery §10 P2).

---

## 7. Documentation deliverables

- `MOBILE_DISCOVERY_REPORT.md` ✅ (this session)
- `MOBILE_IMPLEMENTATION_PLAN.md` ✅ (this document)
- `docs/member-app-ux/19.02_Design_Tokens.md` — **write the missing document from code** (Phase 0.2)
- `docs/MISSING_APIS.md` — the Discovery §10 table as a live, approvable backlog
- `docs/adr/` — one ADR per architectural decision (nav IA, no-monorepo, no-MMKV, test stack)
- `docs/QA_CHECKLIST.md` — per module, device-verified rows only
- Reconcile the ~2-month-stale `docs/features_list.md` against reality

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| **No device build → 10 features remain unproven** | Phase 0.7 first; needs your EAS/FCM credentials |
| **Payment keys 401** → members cannot renew | Phase 3 verifies with live keys; escalate immediately if still failing |
| **The Bible's scope is ~6× what the backend supports** | Phases 0–9 cover only what exists or is explicitly approved; everything else is listed and parked |
| **Bible design docs are damaged** (§19.02 duplicated, §18 specs missing, §01 missing) | Treat `global.css` as token truth; write the missing docs from code; flag rather than invent |
| **Tenant-isolation regression** | The app never touches Prisma. Any backend work stays inside the BFF's existing guard stack, and any new endpoint gets a tenant-scoping review — HARD STOP before merge |
| **Large-scale refactor destabilises a working app** | In-place, slice-by-slice, shippable after each; no big-bang rewrite |
| **Uncommitted working tree** (100+ modified files at session start) | Recommend committing or stashing the current state before Phase 0 so slices stay reviewable |

---

## 9. What I need from you before coding starts

| # | Decision | Status |
|---|---|---|
| **Q1** | Dependencies D1–D5 | ✅ **Decided** — see §2. Four added (all pure-JS/dev-only), FlashList deferred |
| **Q2** | Navigation IA (§5) | ✅ **Decided** — `Home · Workout · FAB · Progress · Profile` |
| **Q3** | **Missing APIs** — may I proceed with the P0 set (A1 readiness, A2 workout history, A3 analytics/PRs, A4 search, A5 notification inbox) in `backend/src/member/`? | ⏳ **Open.** BFF-only additions, no schema change — but still backend work. Needed by Phases 4–5 |
| **Q4** | **EAS + FCM credentials** for the dev build and push proof | ⏳ **Open.** External/one-way — HARD STOP per `CLAUDE.md` #4. Needed by Phase 0.7 |
| **Q5** | **Live Razorpay keys** verified | ⏳ **Open.** The renew path is coded but was 401ing. Needed by Phase 3 |
| **Q6** | Confirm **no monorepo restructure** (Bible §19.02 tail) — I recommend against | ⏳ **Open**, low urgency |

Q1/Q2 are cleared, so Phase 0 is underway. Q3–Q5 are needed by Phases 3–5 and can follow.

---

## 10. Standing working agreement

Per `CLAUDE.md`: autonomous execution within a slice, then report; hard stop for schema
migrations, auth/tenant-isolation changes, new dependencies, EAS/native shifts, external
actions, deleting code, and destructive git/DB ops. Real test results only — anything
unmeasured is reported `unverified`.
