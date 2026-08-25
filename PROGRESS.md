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
