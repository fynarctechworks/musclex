# Staff app — progress log

Running log of autonomous work. Newest entries at the bottom.
Plan: [`docs/STAFF_APP_PLAN.md`](docs/STAFF_APP_PLAN.md) ·
Decisions: [`DECISIONS.md`](DECISIONS.md) ·
Needs you: [`TODO_FOR_ME.md`](TODO_FOR_ME.md)

---

## Done before the autonomous session

- **Phase 0** — plan agreed: full native Expo rewrite, all 10 staff roles, EAS
  builds, iOS first, login-only (no signup), kiosk in scope, front_desk ships first.
- **Phase 1** — `staff-app/` scaffolded: Expo 57 / RN 0.86 / expo-router, strict
  TS, Jest, EAS profiles. Builds and runs on the iOS simulator.
- **Phase 2** — design system: uniwind + React Native Reusables (30 primitives)
  themed to the web app's tokens, plus the MuscleX-specific layer (formatters,
  RowCard, StatTile, SegmentedControl, states, charts, Toast, SwipeActions,
  Sheet/FilterSheet, date pickers, calendar, virtualised DataList).
- **Phase 3a/3b** — session store (SecureStore), ported API client, RBAC
  (`permission_codes`), entitlements, `<Can>` / `<PlanGate>`, auth screens
  (sign-in, 2FA, workspace select, forgot password), role-adaptive tab bar.
- **Test data** — `backend/scripts/seed-staff-app-test.ts` seeds "MuscleX Test
  Gym" with 4 staff logins across roles + 40 members. Verified end to end on a
  simulator: front_desk and accountant get different tab bars from one build.
- **Security** — found and fixed two backend authorisation defects
  (`RolesGuard` owner-tier escalation; unguarded platform referral endpoints).
  See [`docs/SECURITY_FINDINGS_2026-08-26.md`](docs/SECURITY_FINDINGS_2026-08-26.md).

Verification at hand-off: staff-app `tsc` clean, 84 unit tests;
backend `tsc` clean, 36 referral/guard tests.

---

## Autonomous session — 2026-08-26

1. **Committed** the security fixes + phase 3 auth/RBAC (`f177573`).
2. **API layer** — `src/api/types.ts` (shapes captured from the live API, not
   guessed) and `src/api/queries.ts` (React Query hooks for branches/members).
3. **Branch switcher** — `src/features/BranchSwitcher.tsx`. Sets
   `activeBranchId` → `X-Active-Branch-Id`; changing it clears the cache.
4. **More hub** — profile card, branch switcher, role-filtered/plan-locked
   module list, and **sign-out** behind a confirm dialog (the gap found while
   testing: switching accounts previously needed a keychain reset).
5. **Members list** — first screen on live data: server-side search + status
   filter, pull-to-refresh, virtualised, empty/error states.
   Verified on device against the seeded gym: 40 real members rendering.
6. **Fixed a data-fidelity bug found on device** — the list showed "No plan" for
   lapsed members because the API only includes ACTIVE memberships. Now "No
   active plan". See DECISIONS.md.

Tests: staff-app 93 passing (was 84).
7. **Dashboard (Home tab)** — live KPIs, member-trend sparkline, "needs
   attention" alerts and the activity feed, each an independent query with its
   own loading/error state. Pull-to-refresh refetches all four.
8. **Tab IA fixed** — first tab said "Check-in" while showing a dashboard. Home
   is now the dashboard, check-in has its own route, and Money sits ahead of
   Schedule so front desk gets the tab they actually use.
9. **Alert truncation fixed** — `RowCard` gained `titleLines`; alerts no longer
   clip mid-message.

Verified on device as front_desk: Home·Check-in·Members·Money·More, real KPIs
(20 active members, 2 expiring), and full alert text.
Tests: 95 passing.
10. **Member detail** — header, native Call/WhatsApp, contact fields,
    membership, payments and recent visits. Payments/visits sit behind `<Can>`
    so a trainer sees neither. Verified on device with real data
    (₹24,000 UPI payment, Gold plan, visit history).
11. **`scripts/tap-label.sh`** — taps by accessibility label; ends the recurring
    coordinate word-splitting bug in device automation.

Tests: 98 passing.
12. **Check-in (manual)** — search, confirm dialog naming the member and their
    membership standing, idempotent `POST /check-ins`, cache invalidation.
    QR scanning is blocked on `expo-camera` (TODO_FOR_ME #6).
13. **Fixed: invalid idempotency key** — `crypto.randomUUID` does not exist in
    Hermes, so check-in sent a non-UUID and the API rejected it. Added
    `src/lib/uuid.ts` (RFC 4122 v4) and used it for correlation ids too.
14. **Fixed: confirm-dialog state race** — `AlertDialogAction` closes the dialog
    as part of its press handling, so reading the pending member from state
    raced the close. Held in a ref instead.

Tests: 105 passing.
15. **Money screen** — month revenue + expiring-soon tiles, payment list with
    status filter, all behind `<Can module="payments">` so a deep link cannot
    bypass the hidden tab. Verified live (₹24,000 completed payment rendering).
16. **Schedule** — month calendar, day selection, class list with trainer,
    times and capacity meters. Seeder extended with 4 classes × 52 sessions.
    Verified as `trainer` (tabs: Home·Check-in·Members·Schedule·More).
17. **Fixed: UTC vs local date bug** — the calendar marked one day while listing
    another's classes, making today's sessions show "Done". Added
    `toLocalISODate()` and used it everywhere a calendar date is compared.
18. **Seeder reset made reliable** — guarded `TRUNCATE ... CASCADE` instead of
    ordered deletes that were failing silently.

Tests: 108 passing.
19. **POS** — product list, cart, quantity controls, payment method, sale
    submission (`POST /pos/sales`). Reachable from the More hub, because front
    desk has `inventory.create` but POS never made the 4 primary tab slots.
    Seeder extended with 8 products.
20. **Fixed a backend bug that also breaks the WEB app** —
    `StripSecretsInterceptor` flattened Prisma `Decimal` instances, so prices
    left the API as `{"s":1,"e":3,"d":[1400]}`. The web app's `Number(price)`
    yields NaN on that. Fixed by testing the prototype rather than dodging
    classes by name. See docs/SECURITY_FINDINGS_2026-08-26.md F-3.

Tests: staff-app 112, backend 33 (+ new interceptor regression tests).
21. **Plan updated** — `docs/STAFF_APP_PLAN.md` now reflects real status:
    Phases 1–3 done, Phase 4 partial (offline pending deps), Phase 5
    substantially built.
22. **Verification re-run** — `npm run verify:ui` still passes end to end after
    the navigation changes.
23. **Add member** — short create form gated on `members.create`, navigating to
    the new member on success. **Verified end to end on device:** created a real
    member (40 → 41), API assigned code `FS-20260825-D6649020`, app routed to
    her detail page. This is the first confirmed WRITE from the app.
24. **Check-in mutation confirmed working** — with the confirm step temporarily
    bypassed, a tap recorded a real check-in (59 → 60 rows). The earlier silent
    failure was the Hermes UUID bug. Only the dialog's button tap remains
    unautomatable; the code path is proven. Temporary code removed.
25. **Collect payment** — from the member's page, pre-filled with the plan
    price, method selector, `POST /payments/cash`. **Verified end to end:**
    recorded a real ₹24,000 payment (30 → 31 rows, receipt
    `RCP-20260825-CDA6FB67`).
    Also learned: bottom-SHEET buttons ARE automatable; only AlertDialog
    buttons are not.
26. **POS sale verified end to end** — recorded a real ₹1,400 cash sale from the
    app. The earlier failure was NOT the UI: the seeder created products with no
    `inventory` rows, so the API correctly returned "Insufficient stock". Seeder
    now seeds stock (one product deliberately at zero).
27. **Harness repaired** — the gallery grew enough that `verify:ui`'s scroll
    budget no longer reached the filter sheet. Widened; passing again.

---

## Where things stand

**Verified working on a real device, against the real backend, with seeded data:**

| Flow | Verified how |
|---|---|
| Sign in (4 roles) | Real API; role-adaptive tabs differ per role |
| Role-adaptive nav | front_desk / trainer / accountant each get a different bar |
| Dashboard | Live KPIs, sparkline, alerts, activity feed |
| Members list | 40 live members, server-side search + filter |
| Member detail | Real plan, payments, visits; native Call / WhatsApp |
| **Add member** | **WRITE** — created a real member (40 → 41) |
| **Check-in** | **WRITE** — recorded a real visit (59 → 60) |
| **Collect payment** | **WRITE** — recorded ₹24,000 (receipt RCP-20260825-CDA6FB67) |
| **POS sale** | **WRITE** — recorded ₹1,400 cash |
| Schedule | 4 classes/day from 52 seeded sessions, capacity meters |
| Money | Revenue tiles + payments list |
| More / sign-out | Profile, branch switcher, role-filtered modules |

**Test counts:** staff-app 112 · backend 53 · `verify:ui` device harness passing.

**Bugs found and fixed while building** (each caught by running against the real
API, not by unit tests):

1. `permission_codes`, not `permissions`, is what the API sends — every custom
   role would have fallen back to a role-name default.
2. `crypto.randomUUID` does not exist in Hermes — check-in sent an invalid
   idempotency key and was rejected.
3. `AlertDialogAction` closes the dialog before the confirm handler reads state.
4. `toISOString()` for a calendar date is UTC — the schedule marked one day and
   listed another, making today's classes read "Done".
5. `StripSecretsInterceptor` flattened Prisma `Decimal`s — **this one also
   breaks the web app**, which renders `₹NaN`.
6. POS tab gated on `inventory.view` gave an accountant a till.
7. `/members` returns only ACTIVE memberships, so "No plan" was telling the desk
   a lapsed member had nothing to renew.

Plus two backend authorisation vulnerabilities fixed earlier
(`docs/SECURITY_FINDINGS_2026-08-26.md`).

**What is NOT done:** QR check-in and offline persistence (both blocked on
dependency approval), member edit, and Phases 6–12. See `TODO_FOR_ME.md`.

---

## Session 2 — 2026-08-26 (dependencies approved)

28. **`expo-camera`, `expo-sqlite`, `@tanstack/react-query-persist-client`**
    installed via `npx expo install` (versions match member-app exactly), iOS
    prebuilt and rebuilt.
29. **QR check-in.** Scanning auto-submits, search still confirms. `ScanGate`
    stops a card left in frame from becoming twenty check-ins — `client_event_id`
    cannot help there, since each camera fire is a fresh attempt.
30. **Offline read.** Query cache persisted to SQLite, scoped per session with
    three independent barriers against cross-tenant bleed.
31. **`DataList` precedence fixed** to data > error > empty. It used to blank a
    good list on any error — with a warm cache that discards the best data in
    the building exactly when the network is worst.
32. **Member edit**, sending only changed fields.
33. **Offline check-in queue** against the existing `POST /check-ins/sync`.
34. **Request timeout (12s)** — there was none, so a dead uplink hung forever.
35. **Timeouts no longer retried** — falling back took ~35s, now ~13s.
36. **Offline member roster** — search is server-side, so without it the queue
    was unreachable.
37. **Refused check-ins are announced**, not dropped silently.
38. **Seeder wrote `status: 'completed'`** for payments; every revenue query
    filters `'paid'`. The dashboard was right and the seed data was lying.

**Tests: 234 staff-app passing (24 suites) · 891 backend passing (4 skipped) ·
`verify:ui` device harness passing · tsc clean in both.**

*Correction to an earlier line in this file:* I previously wrote "backend 53
tests". That was the subset of suites covering what I had touched, not the
backend suite. The full suite is 891 passing.

### Verified on device this session, API paused mid-flight

| What | Result |
|---|---|
| Camera permission prompt | Shows our own usage string |
| Scanner UI + fallback | Both render; viewfinder black (Simulator has no camera) |
| Dashboard offline | Rendered from SQLite **through a full app restart** |
| Member search offline | Fell back to on-device roster, found 6 Patels |
| Check-in offline | Queued — "1 check-in waiting to sync" |
| Queue drain | Flushed on foreground; server refused it (cooldown, correctly) |
| Revenue KPI | ₹0 → ₹14.0k after the seeder fix, matching the DB |

### Two things I got wrong, and how

- I reported "camera access is off" as app behaviour. I had actually tapped
  **"Don't Allow"** — my `tap-label.sh` matched "Allow" as a substring. The same
  bug is why the confirm dialog looked un-automatable for a whole session.
- I nearly went hunting for a bug in the revenue KPI query. The query was
  correct; my seed data used a status the product never produces.

Both were caught by checking the database and the coordinates rather than
trusting the screen.

39. **Kiosk mode (Phase 5b)** — unattended lobby tablet. Branch pinned to the
    device in the Keychain, PIN-gated exit with an attempt limit, offline queue
    banner, no staff context on screen. Full lifecycle verified on device.
40. **`headerBackTitle`** — iOS was labelling the back button with the
    expo-router group, so it read a literal "(tabs)".
41. **Fixed a dead button**: `QrScanner`'s `onClose` was mandatory, so kiosk
    passed a no-op and rendered "Search by name" doing nothing.

### Phase status after this session

| Phase | State |
|---|---|
| 4 — Charts, lists & offline | **DONE** (offline read + write both shipped) |
| 5 — Front desk | **DONE** (QR, member edit, offline write were the remainder) |
| 5b — Kiosk | **DONE** (core; verified end to end on device) |
| 6 — Trainer | not started |

### Known, and not a code problem

The session signs out mid-testing because login returns no `refresh_token`, so
a 401 cannot be refreshed silently. Already logged in `TODO_FOR_ME.md`; it
surfaced repeatedly today whenever a token aged out during a long device run.

---

## Phase 6 started — class register

42. **Class register** (`app/class/[id].tsx`) — roster, per-member Present /
    Late / No show, "mark remaining N present". Reached by tapping a class on
    the Schedule.
43. **Fixed: Schedule was unreachable for front desk.** Only 4 tabs fit and
    Schedule sits 5th, so the role had the permission and no route. Now in
    More, with a test asserting the property for every tab rather than the two
    known cases.
44. **Fixed (backend): class attendance and PT sessions were 403 for every
    gym.** Four sites compared a nullable `organization_id` against
    `studio_id`; both are null for single-org gyms, so the check was always
    true. See `docs/SECURITY_FINDINGS_2026-08-26.md` F-4.
45. **Fixed: seeder wrote `enrolled_count` with no bookings behind it.**
46. **Fixed: register rows jumped between fetches** — the API's `booked_at`
    ordering has arbitrary tie-breaks. Sorted by name client-side.

**Tests: 264 staff-app (26 suites) · 895 backend (4 skipped) · tsc clean both ·
`verify:ui` passing.**

### Verified on device

Signed in as the trainer: register opens from the schedule, shows 10 real
booked members, marking persists (confirmed by SQL, not by the screen), the
badge reflects the saved state, and the count drops 10 → 9. Signed in as front
desk: the same screen correctly shows **no** marking controls.

### A false positive I caught in my own checking

I first "confirmed" a mark had landed by asserting the string `Present` was on
screen — but `Present` is also a segment-button label, so it was always there.
The badge still read "Not marked". Re-checked by pairing each badge with its
row's x-position, which is what actually showed the bug.

47. **Schedule fetches the visible month**, not one day. The calendar's caption
    promised dots for days with activity and could only ever mark the selected
    day. Now uses `date_from`/`date_to` — less data than the old `limit: 200`,
    and correct.

---

# OVERALL STATUS — end of 2026-08-26

## Where the app is

| Phase | State |
|---|---|
| 1 — Skeleton | **DONE** (code; signing/branding still outstanding, see TODO) |
| 2 — Design system | **DONE** |
| 3 — Auth, RBAC, shell | **DONE** |
| 4 — Charts, lists, offline | **DONE** — offline read *and* write |
| 5 — Front desk | **DONE** |
| 5b — Kiosk | **DONE** |
| 6 — Trainer | **started** — class register done; PT sessions, plans, AI advisor, member progress remain |
| 7–12 | not started |

**Tests: 269 staff-app (27 suites) · 895 backend (4 skipped) · tsc clean in both
· `verify:ui` device harness passing.**

## What is verified on a real device against the real backend

Sign-in across roles · role-adaptive navigation · dashboard · members list and
detail · **add member** · **check-in** · **collect payment** · **POS sale** ·
schedule · money · **QR scanner UI and permissions** · **offline read through a
full app restart with the API down** · **offline check-in queue and sync** ·
**kiosk mode full lifecycle** · **class register with attendance persisted**.

Every write above was confirmed by querying the database, not by reading the
screen.

## Bugs found and fixed today

**In the product** (these affected real gyms, not just this app):

1. Class attendance and PT-session completion returned **403 for every gym** —
   four sites compared a nullable `organization_id` to `studio_id`. F-4.
2. `StripSecretsInterceptor` flattened Prisma `Decimal`s, so the **web app**
   rendered `₹NaN`.
3. Two authorisation defects (F-1, F-2) fixed earlier.

**In this app:** no request timeout; timeouts retried and doubled the wait;
Schedule unreachable for front desk; scanner's dead "Search by name" button;
back button reading "(tabs)"; register rows reshuffling between fetches;
attendance marks saving but not showing.

**In my own test data:** payments written with a status the product never
produces; `enrolled_count` with no bookings behind it. Both made correct code
look broken.

## What still needs you

`TODO_FOR_ME.md` — branding assets, Apple signing/TestFlight, one QR scan on a
physical device, 2FA/multi-workspace unverified, login returning no
`refresh_token`, and one product question about referral reporting scope.

## Notes for picking this up

- The simulator app is signed in as **Tarun (trainer)**, not the `.env` default
  `fd@mxtest.app`. Sign out from More to switch.
- The simulator has a **kiosk exit PIN of 2468** set from testing.
- staff-app Metro must run on **port 8083** (`npx expo start --port 8083`).
  member-app owns 8081, and the staff dev client will happily load member-app's
  bundle if pointed at it — that cost me a confused ten minutes.

## Phase 6 continued

48. **Class bookings from the register** — book a walk-in (search), remove a
    booking (swipe). Verified in SQL: booked 3 → 4 with `enrolled_count`
    incremented atomically, then cancelled back to 3 as a soft delete.
49. **Member progress & measurements** — weight chart, latest-plus-change per
    metric, record new measurements. Reached from the member page.
50. **Seeder records measurement history** for a third of members, drifting in
    a plausible direction.
51. **Metro moved to the default port 8081** now that member-app's server is
    stopped — removes the wrong-bundle footgun entirely.

**Tests: 286 staff-app (29 suites) · 895 backend · tsc clean · `verify:ui` passing.**

### Honest note on what is verified for measurements

The READ path is verified on device (Neha Patel, 6 readings, Mar → Aug, tints
correct). The WRITE button is gated on `members.edit`, which the trainer role
does not have — correctly, since the backend requires the same permission. So
the write was verified **at the API with the exact payload the app sends**, not
by tapping it. That is a real gap in the device coverage and it is a
permissions question, now item 7 in `TODO_FOR_ME.md`.

## Phase 6 — trainer train (substantially complete)

52. **PT sessions** — Mine/Everyone scope, Upcoming/Done/All filter, settle
    buttons gated on `staff.edit`. Resolves the staff row before filtering by
    "mine", because asking with no `trainer_id` returns the whole gym's list
    labelled as yours.
53. **Training** — plan library and exercise library, with a plan detail that
    reads in performance order with prescriptions.
54. **Seeder + API test data** — PT sessions, 50 exercises (via the product's
    own `seed-defaults`), 3 plans, 9 assignments, measurement histories.

**Tests: 312 staff-app (33 suites) · 895 backend · tsc clean in both.**

### Phase 6 scorecard

| Item | State |
|---|---|
| Classes — sessions, attendance, bookings | **DONE** |
| PT sessions | **DONE** |
| Training plans & exercises | **DONE** (read-only — see below) |
| Member progress | **DONE** |
| AI advisor | **BLOCKED** — no LLM key (TODO item 8) |
| Class *editing* (create/edit a class) | not built — `classes.create` is owner-level |

### The permissions thread running through Phase 6

Three separate features landed read-only for the trainer role, all for the same
reason: the write needs `members.edit` or `staff.edit`, and a trainer has
neither. That is **not a bug** — the app matches the server exactly in each
case, and I verified the permission sets rather than assuming them.

But it means a trainer currently cannot record a measurement, author a plan, or
settle their own PT session. Whether that is right is a business decision, now
`TODO_FOR_ME.md` item 7.

## Phase 8 started — accountant train

55. **Fixed: Money filtered on a payment status that does not exist.** The
    screen used `status=completed`; the canonical set is
    `pending|paid|refunded|failed`. It looked right only because my seed data
    used the same invented value — fixing the seeder silently broke the screen
    (0 of 30 payments, every real one warning-tinted).
56. **Fixed: sheets rendered where they were written.** The branch switcher's
    sheet appeared clipped at the top of the dashboard and its list was
    unreachable. `Sheet` now portals to the app root.
57. **Fixed the harness's scrolling** — it flicked and overshot by ~1000pt,
    which is what broke the Dialog step after the previous "fix".
58. **Expenses** — list, today/month tiles, category breakdown data, and
    recording. Test data created through the public API.

**Tests: 320 staff-app (31 suites) · 895 backend · tsc clean · `verify:ui` PASS.**

### Verified on device as the accountant

Role-adaptive nav (no Check-in, no Schedule, but Reports) · branch switcher
opening correctly after the fix · Expenses list with lakh grouping · tiles
reading ₹2.5L for the month, matching the API · **recording ₹4,500 moved TODAY
from ₹0 to ₹4.5k and the month from 4 to 5 entries.**

### Three mistakes worth recording

- I put an early return above a `useCallback` and crashed the screen. The
  simulator displayed the exact React error; I only saw it once I stopped
  reading harness output and looked at the screen.
- I "fixed" the harness earlier by widening its swipe, which made it overshoot
  and broke a different step. Coarser steps trade one miss for another.
- I twice concluded a feature was broken when the harness had tapped the wrong
  x — Dialog and Popover share a row.

59. **Reports** — replaced the Phase 8 placeholder with the accountant's month:
    revenue, MRR, average member value, refunds, and a branch P&L with expense
    breakdown.
60. **Inventory** — stock levels with out-of-stock / low / untracked
    distinguished. "Untracked" is a setup gap, not a sold-out product; the two
    reading the same is what made the POS failure slow to diagnose.
61. **Found and reported F-5** — the dashboard KPI inspector reads
    `studio_template` instead of the caller's gym. Reported rather than fixed:
    it is gym scoping, which hard-gate #2 reserves for you.

**Tests: 339 staff-app (33 suites) · 895 backend · tsc clean · `verify:ui` PASS.**

### Phase 8 scorecard

| Item | State |
|---|---|
| Payments (Money) | **DONE** — and a real status bug fixed |
| Expenses + categories | **DONE** |
| Reports | **DONE** |
| Inventory (view) | **DONE** |
| Dues | **BLOCKED** — the only metric that reports it reads the wrong schema (F-5) |
| Invoices / refunds list | not built — no data path worth verifying yet |
| Receipt camera on expenses | not built |

### On the dues tile I did not build

Three pending invoices worth ₹22,400 exist in the seeded gym. `GET /invoices`
returns all three. The dashboard metric returns zero, because it reads
`studio_template`. I could have shipped a tile that renders ₹0 and looks
finished — a number on screen that I know is read from the wrong place is worse
than an absent one, so it is in `TODO_FOR_ME.md` item 10 instead.

## Consolidation + Phase 10 start

62. **Staff list** (Phase 10) — read-only, tap-to-call, salary never rendered.
63. **`npm run verify:screens`** — a second device harness that asserts every
    screen MOUNTS, which `verify:ui` never checked.
64. **Fixed: Reports was unreachable for an owner.** More's entry pointed at
    `/more/reports`, a route that never existed. Found by the new harness on
    its first run.
65. **`nav.test.ts` now asserts every built More entry resolves to a real route
    file** — the previous reachability test matched by module, so a wrong href
    slipped through.

**Tests: 349 staff-app (33 suites) · 895 backend · tsc clean ·
`verify:ui` PASS · `verify:screens` PASS.**

66. **Membership plans** (Phase 10) — with the per-month equivalent a desk is
    actually asked for, suppressed when it would just repeat the headline.
67. **Fixed harness cross-contamination** — `verify:screens` run after
    `verify:ui` failed because that harness ends with a sheet open and its
    backdrop ate every tap. Both now relaunch first.

---

# OVERALL STATUS — 2026-08-26 (second session)

## Numbers

**362 staff-app tests (35 suites) · 895 backend tests · tsc clean in both ·
`verify:ui` PASS · `verify:screens` PASS.** 30+ commits on
`staff-app/phase-1-2-foundation`.

## Phases

| Phase | State |
|---|---|
| 1–3 Skeleton, design system, auth/RBAC | **DONE** |
| 4 Charts, lists, offline | **DONE** — offline read *and* write |
| 5 Front desk | **DONE** |
| 5b Kiosk | **DONE** |
| 6 Trainer | **DONE** except the AI advisor (no LLM key — TODO 8) |
| 7 Push & deep links | **BLOCKED** — needs a schema decision (TODO 9) |
| 8 Accountant | Payments, Expenses, Reports, Inventory **DONE**; dues blocked by F-5 |
| 9 Marketing | not started |
| 10 Manager | started — Staff and Membership plans done |
| 11 Owner / settings | not started |
| 12 Hardening & GA | not started |

## Product bugs found and fixed this session

1. **Class attendance and PT completion returned 403 for every gym** — four
   sites compared a nullable `organization_id` to `studio_id` (F-4).
2. **Money filtered on a payment status the product never writes** — `completed`
   vs `paid`. It looked right only because my seed data shared the same
   invented value.
3. **Sheets rendered where they were written** — the branch switcher's list was
   unreachable, clipped against the top of the dashboard.
4. **Schedule was unreachable for front desk**; **Reports was unreachable for
   an owner**. Both now have property tests rather than one-off fixes.
5. **No request timeout**, and **timeouts were retried**, so a dead uplink hung
   forever and then took ~35s to fall back.

## Found and NOT fixed (needs your call)

**F-5 — the dashboard KPI inspector reads `studio_template`, not the caller's
gym.** One line to fix; it changes how a service is gym-scoped, which
hard-gate #2 reserves for you. Full evidence in
`docs/SECURITY_FINDINGS_2026-08-26.md`. I did not build a dues tile on top of
it.

## What I'd tell you if we were talking

The recurring theme this session was **data that agrees with itself while being
wrong**: a seeder and a screen sharing an invented payment status; an
`enrolled_count` with no bookings behind it; a test mocking a column shape
production never produces. Each looked fine until something else moved. The
device harnesses caught what unit tests could not, and the second harness
(`verify:screens`) earned its place by finding an unreachable screen on its
first run.

## Phases 9, 11 and 12 — the rest of the plan

68. **Settings** (Phase 11) — gym details with edit, subscription read-only.
    Seventeen web pages become one phone screen, deliberately.
69. **Leads** (Phase 9) — funnel, next-step advance, conversion rate. Campaigns
    stay on the web; a lead is what gets chased from a phone.
70. **Visits** and **Branches** — completing Phase 10's data surfaces.
71. **Fixed the tenant-isolation e2e suite** (F-6). It says "MUST pass before
    any release" and had not compiled in a long time. Now 12 passing tests.

**Tests: 376 staff-app · 895 backend unit · 12 backend e2e · tsc clean ·
`verify:ui` PASS · `verify:screens` PASS (17 screens).**

### Every More entry is now a real screen

Schedule · POS · Kiosk · PT sessions · Staff · Leads · Inventory · Expenses ·
Reports · Training · Branches · Memberships · Visits · Settings.

The only remaining placeholder is **AI advisor**, blocked on an LLM key.

### F-6 — the regression suite that had stopped running

`tenant-isolation.e2e-spec.ts` opens with *"This test MUST pass before any
release."* It did not compile: `TenantStore` grew three fields and the suite
was never updated. It went unnoticed because **`.e2e-spec.ts` files are not
collected by `npm test`** — the regex wants a literal dot, these use a hyphen —
so `npm test` stayed green while three of four e2e suites failed to run at all.

Both isolation suites now pass. One test is skipped with a reason: it asserts
`search_path` scoping, which `CLAUDE.md` documents as inert under Prisma
multiSchema. Making it pass would mean contradicting the architecture.
