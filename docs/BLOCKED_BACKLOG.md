# Blocked backlog — Strava-parity programme

Everything buildable without crossing a rule in `CLAUDE.md` is done. What
remains is listed here because each item needs a **decision or an action from
the product owner**, not more engineering. Nothing below is started.

Last reviewed: 2026-08-24

---

## ~~0. Routines and meals for gym-less members~~ — DONE 2026-08-24

Approved and shipped. Five additive `public` tables
(`app_user_exercises`, `app_user_routines`, `app_user_routine_exercises`,
`app_user_meal_logs`, `app_user_meal_log_items`), a 45-exercise global
catalogue, and `me/routines` / `me/meals` / `me/exercises` on the **public**
controller stack.

No existing table was altered. None of the new tables has a `gym_id`, so all
five stay out of `TENANT_MODELS` and the drift guard still passes.

SQL is in `backend/prisma/manual-migrations/2026-08-24-*.sql`, applied to the
**local** database only — see item 7.

The app is wired to it: `useRoutines`, `useNutrition`, `useExercises`,
`useLogMeal`, `useCreateRoutine` and `useCreateCustomExercise` each pick their
surface from `/me/context` and normalise the personal shape to the gym one, so
every screen stayed a single screen.

Still open on this: personal routines and meals are kept SEPARATE from gym
ones, so a member who later joins a gym has two histories. Merging them is a
product decision, not a bug — a gym would then see food logged before the
member joined.

---

## 1. Saved routes and the route builder
**Blocked by:** HARD STOP 1 — database schema / migrations.

Needs new tables (`app_user_route`, and a join for "routes I follow"). Public
schema, gym-less, same shape as `app_user_activity`. The drawing and projection
layer this would sit on already exists and is tested
(`member-app/src/lib/route.ts`, `tiles.ts`).

**To unblock:** approve a migration adding the route tables.

---

## 2. Measured maximum heart rate
**Blocked by:** HARD STOP 1 — database schema / migrations.

Heart-rate zones currently assume `hrMax 190 / hrRest 60`
(`backend/src/member/data/training-load.ts`). Time spent in each band is
measured; the **band edges are an estimate**, and the activity screen says so.
Storing a per-member maximum would make them real.

**To unblock:** approve adding `hr_max` / `hr_rest` to the member profile.

---

## 3. BLE heart-rate straps and power meters
**Blocked by:** HARD STOP 3 (new dependency) **and** HARD STOP 4 (native module,
ends Expo Go for `member-app/`).

**To unblock:** confirm the member app may become native-build-only, and approve
a BLE package.

---

## 4. Garmin / Fitbit / Wahoo import
**Blocked by:** HARD STOP 5 — external and legal actions.

Each requires registering as a partner, agreeing to their developer terms, and
holding OAuth client secrets. GPX import already works and covers most of the
practical need.

**To unblock:** register with each partner and provide credentials.

---

## 5. Production map tile provider
**Blocked by:** HARD STOP 5 — external commitment. **This one gates release.**

The basemap defaults to `tile.openstreetmap.org`, whose usage policy
**explicitly forbids distributing an app that uses it**. Fine in development, a
licence breach in production. Already swappable with no code change via
`EXPO_PUBLIC_MAP_TILE_URL` / `EXPO_PUBLIC_MAP_ATTRIBUTION`.

Also worth noting: tile requests disclose roughly where a member has been to
whichever host is chosen. Tiles are opt-in per screen for that reason (feed and
activity lists fetch none), but this likely needs a line in the privacy policy.

**To unblock:** choose a provider with terms that permit commercial use, set the
two environment variables, and update the privacy policy.

---

## 6. Store listings and background-location review packs
**Blocked by:** HARD STOP 5 — external submissions.

Apple and Google both require written justification for background location.
The feature is built and guarded but its continuation **has never been verified
on a real device**.

**To unblock:** on-device QA, then submission.

---

## Also outstanding (not blocked, just not done)

- **`api.heartRateZones` has no UI.** Built and tested; the per-activity zone
  breakdown ended up being the useful surface instead.
- **Background GPS continuation is unverified.** Built and guarded, never proven
  on hardware.
- **`backend/login.json` is still in public git history.** A secret pasted into
  a chat earlier in development should be treated as disclosed and rotated.
## 7. Remote migration of the gym-less tables
**Blocked by:** HARD STOP 7 / deliberate act — production carries real paying gyms.

The two SQL files above are additive and idempotent (`CREATE TABLE IF NOT
EXISTS`, no `DROP`, no `ALTER`), so they are safe to replay, but they have run
on the LOCAL database only.

**To unblock:** explicit go-ahead to run them against production Supabase.

---

## Also outstanding (not blocked, just not done)

- **Remote Supabase migrations are outstanding.** Every migration this programme
  produced was applied to the **local** database only. Production carries real
  paying gyms and is a separate, deliberate act.
