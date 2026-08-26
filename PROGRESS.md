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
