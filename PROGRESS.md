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
