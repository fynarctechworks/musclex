# member-app

The MuscleX member app. A fresh Expo (React Native) app, built against the
design in [`docs/MEMBER_APP_SPEC.md`](../docs/MEMBER_APP_SPEC.md).

It does **not** share code with `gym-member-app/`. That is deliberate.

## Running it

```bash
node --enable-source-maps backend/dist/main   # Member BFF on :4002
npm --prefix member-app run web               # http://localhost:8082
npm --prefix member-app start                 # native (needs a dev build)
```

The backend's `CORS_ORIGINS` must include the web origin. Locally that is
`http://localhost:8082`.

| Env | Purpose |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Member BFF base, including `/member/v1` |
| `EXPO_PUBLIC_DEV_PHONE` | Member to sign in as (dev only) |
| `EXPO_PUBLIC_DEV_TENANT` | Gym to sign in to (dev only) |

## Shape

```
app/
  _layout.tsx        root: query client, session restore, auth gate, outbox flush
  sign-in.tsx        phone -> code
  (tabs)/            Today · Gym · Progress · Me
  session.tsx        the workout session (assigned plan or freestyle)
  classes.tsx        browse, book, cancel, waitlist
  nutrition.tsx      macros, water, meal logging
  community.tsx      leaderboard, challenges, badges
  coach.tsx          AI coach thread
  exercises.tsx      the gym's catalogue
  exercise/[id].tsx  form cues, PR, heaviest-set history
  membership.tsx     current plan and what the gym offers
  messages.tsx       trainer threads
  chat/[trainerId]   one conversation with a trainer
  body.tsx           weight, trend, history
  settings/profile   height, gender, experience
  settings/goals     set and close your own targets
src/
  api/               client, auth, endpoints, typed shapes, query hooks
  offline/           outbox + pluggable store
  features/          ExerciseBlock, RestTimer, PendingBanner, charts, set payload
  lib/               date formatting
  ui/                tokens, primitives, Notice/Confirm
```

**Coach vs Messages.** `/coach` is the AI advisor; `/messages` is a real human
trainer. They are deliberately separate screens — conflating them would make
members expect a person's answer from a model.

## Sign-in

Phone, then the code, and only if the number is registered at more than one gym,
which one. **Members never see a tenant id** — the gym is resolved from the
phone number server-side.

With `EXPO_PUBLIC_SUPABASE_URL` + `ANON_KEY` set, the code is verified by
Supabase and its token is traded with the backend for a gym-scoped session.
Without them the backend's dev bypass is used — a route that 404s in production,
so it cannot become a way in on a real server.

New members are routed into a four-step onboarding before the app opens. Every
step is skippable and each one saves as it advances, so quitting halfway
resumes rather than restarts.

> **`PATCH /me` is the onboarding surface, not `PATCH /me/profile`.** The latter
> accepts `onboardingComplete` in its DTO and silently ignores it, which left
> members stuck in the flow forever. Do not "simplify" onboarding onto
> `/me/profile`.

## Statistics

`GET /workouts/stats?days=30` returns the whole Progress screen in one call:
workouts, sets, exercises, total and average volume, time under tension,
current and longest streak, an active-day series and most-performed exercises —
plus **personal records**.

PRs are in there deliberately. The client used to build its PR wall by fetching
history once per catalogue exercise, which is N requests that grow with the
gym's library; at thirteen exercises it was already tripping the rate limiter
with 429s. One aggregate replaces the fan-out.

Everything is computed from the member's own logs rather than kept as counters:
a counter drifts the moment a log is edited or deleted, and these are read far
less often than sets are written.

**Duration statistics only count sessions that recorded a span.** `started_at`
and `ended_at` are optional, so averaging over sessions that never reported one
would make "average session length" quietly fictional.

## Units

**Storage is always metric** — `weightKg`, `heightCm`, and every logged set.
Units are a display preference converted at the edge (`src/lib/units.ts`),
never a second way to store the same number: storing whatever the member
happened to be using means every aggregate — volume, PRs, trends — has to know
which unit each row was written in, and one missed conversion silently
corrupts history.

Screens take their converters from `useUnits()` rather than importing the raw
functions, so a screen cannot accidentally render kg to someone who set pounds.
`toPayload(blocks, displayUnit)` is the single point where pounds become kilos
on the way in, and it is tested as such.

Weights round to real increments — 0.5 kg or 1 lb — because 137.78924 lb is
precision nobody asked for and can't be loaded onto a bar.

## Exercise media

Illustrations are **self-hosted**, not linked from the dataset's jsDelivr CDN.
Those links resolve to a third party's GitHub repo, which would make the picture
on every exercise depend on someone else's repository staying public, leak
members' IPs to a CDN we do not control, and break behind a restrictive gym
network. The files ship with the repo; there is no reason to borrow them at
runtime.

`backend/scripts/upload-exercise-media.ts` pushes them to a shared **public**
Supabase bucket and rewrites every row to our URLs. The media is
gym-agnostic — the same GIF serves every tenant — so it uploads once rather than
per gym, and it is reference art rather than member data, so a public bucket is
correct and avoids re-signing URLs for assets that never need protecting.

Two URLs per exercise: `media_url` is the animated GIF (~240KB, the animation IS
the form cue) and `thumb_url` a webp still (~16KB). Lists use the thumb; forty
GIFs at 40x40 would pull megabytes to render thumbnails.

## Custom exercises

A gym's catalogue will never cover everything, so a member can add a movement
their gym has not stocked — from inside the picker, straight into the session.

**Personal, not shared.** `exercises.created_by_member_id` is NULL for the gym's
own catalogue and set to a member id for theirs; every read is
`created_by_member_id IS NULL OR = me`. A member must not be able to write into
what every other member and trainer at their gym sees, and another member's
personal exercise is invisible rather than merely unlisted.

Creating one that the gym already stocks is refused with a pointer to the
existing entry, so history and PRs stay on one row instead of splitting across a
duplicate. Deleting deactivates rather than removes: logged sets reference it,
and deleting the row would orphan history the member can still see in their PRs.

## Deep links

`https://app.musclex.infynarc.com/r/<token>` opens a shared routine. Two things
had to be true for that to work:

- `frontend/public/.well-known/` serves the Apple and Google association files.
  Both carry a placeholder only a native build can fill (Team ID, keystore
  SHA-256) — see the README there.
- `frontend/src/middleware.ts` **excludes** `.well-known` from its matcher.
  Apple and Google fetch those files anonymously and follow no redirects; left
  inside the matcher the auth middleware bounced them to `/login` and universal
  links failed silently.

The app's own `musclex://r/<token>` scheme needs none of that and works today,
as does the paste-a-code box in My Routines.

## Adding exercises

`src/features/ExercisePicker.tsx`. Adding exercises sits between deciding to
train and actually training, so it has to stay fast at the size a real gym
catalogue reaches:

- **Filter by muscle** — people plan by body part, not alphabetically.
- **A favourites shelf** — most people rotate the same dozen lifts.
- **Multi-select** — a session is 4-6 exercises; closing the sheet after each
  one turns adding a workout into six round trips.
- **Favourite inline** — curating that shelf never costs you your place.

Muscle and favourites are **server-side** filters (`/exercises?muscle=&
favorites=`), so this stays correct as a catalogue outgrows what is sensible to
hold in memory. Both were supported by the API and unused before.

## Explore

A central, MuscleX-curated workout library (`app/explore/`). Every member at
every gym sees the same set, so it lives in one `public` table — copying it per
tenant would mean N places to update and gyms silently drifting from the
canonical content.

Adding one produces a personal **routine** in the member's own gym. Explore is a
source of routines, not a parallel place workouts can live, so everything below
about repeating and sharing applies to them unchanged.

Workouts store exercise **names**, and resolve through the same
`resolveByName()` the share-link import uses — one matcher, because two would
drift. A name the gym does not stock is reported, never dropped silently.

> `scripts/seed-explore.ts --verify <gymId>` re-checks every name against a real
> gym. A misspelled name is not a crash — the exercise is just quietly absent
> from that workout for every member — so the check is worth running whenever
> the content changes. It caught "Bodyweight Squat", which does not exist in the
> library.

## Routines

A member's own saved workout: personal, repeatable, shareable by link
(`app/routines.tsx`). Distinct from a trainer's assigned plan, which is authored
in the admin app and owned by the gym.

Saving offers itself at the end of a self-built session. A routine stores the
**shape** — which exercises, how many sets — not the weights: carrying today's
loads forward would fight the per-set history prefill, which already knows
better next week.

**Sharing hands over a copy, not a subscription.** `POST /routines/{id}/share`
writes an immutable snapshot to `public.shared_routines` under an unguessable
token; importing re-creates it in the recipient's own gym. Later edits by the
author never reach them, which is what "add it to mine" should mean and stops a
workout changing under someone mid-session.

The snapshot stores exercise **names**, never ids:

- Exercise ids are gym-scoped and gyms hold different catalogues — one gym here
  has 1,334 exercises and another has none — so an id from gym A is meaningless
  in gym B. Names are the only portable key.
- It lives in `public` because resolving a token otherwise means searching every
  `studio_%` schema, which is exactly the cross-tenant traversal this codebase
  exists to avoid.
- It carries no member id, gym id or gym name. A share link reveals a workout,
  never who wrote it or where they train.

Import re-matches by name against the recipient's gym and **reports what it
could not find** rather than silently dropping it: a routine that quietly
arrives with four of its six exercises is worse than one that names the two
that are missing.

> `MemberRoutine` and `MemberRoutineExercise` are registered in
> `backend/src/prisma/tenant-models.ts`. They carry `gym_id`, so without that
> registration the automatic gym scoping would not apply to them. The drift
> guard spec catches this — it failed when they were first added.

## Two ways to train

`session.tsx` serves both, because they are the same act and only differ in who
chose the exercises:

- **`/session?assigned=1`** lays out the workout a trainer set for today, with
  its target sets ready to log. Finishing marks the assignment complete, so the
  trainer's dashboard reflects it.
- **`/session`** is a freestyle session the member builds themselves.

Both write through the same outbox with the same idempotency guarantee.

**Four tabs and a raised centre action.** The centre control is not a tab, it
starts a workout. Starting a session is the most important thing this app does,
so it stays one thumb-reach from every screen.

## The logging loop

Everything else exists to support this:

- Opening an exercise fetches `GET /exercises/{id}/history`. The PREVIOUS column
  and the input placeholders come from the member's **own last session for that
  lift**, per set number, not from a single remembered value.
- Completing a set fills anything left blank from last session, carries the
  values into the next row, starts the rest timer and fires one haptic. One tap.
- A session is client-side until Finish, which posts every completed set in a
  single write with an `Idempotency-Key`. A member can log an entire workout
  through a dead zone; nothing is lost and a retry cannot double-count.
- Personal records come back from the server. The app never computes them.

The rest timer derives from a start timestamp rather than decrementing a
counter, so it stays correct if the JS thread stalls or the app is backgrounded.

## Design

Light. The canvas is faintly grey (`#F5F5F7`) and cards are pure white, so a
card separates by its own lightness plus a hairline and a soft drop — on a
white-on-white page a card can only be held by its border, which reads as a box
rather than a surface.

One saturated accent (MuscleX red `#E10600`) carries actions and nothing else.
Green means *done*, red means *do something* — a completed chip is green,
because on a light canvas red reads as an error. A four-step ink ladder, a 4pt
spacing scale, and weight from size rather than stroke.

Tokens live in `src/ui/theme.ts` and nothing hardcodes a colour outside it. The
palette is shared with the marketing site so the product and the site that sells
it cannot drift apart.

**Type is one sans-serif family.** `System` resolves to San Francisco on iOS and
Roboto on Android — the faces those platforms already hint and kern for their
own UI — with an equivalent stack on web. No font files ship. Every text style
and every input names `font` from the theme, so nothing silently falls back to
a platform form default.

**Icons are [Iconsax](https://iconsax.io/)**, behind a semantic layer in
`src/ui/Icon.tsx`. Screens name what an icon MEANS (`plan`, `visits`, `coach`),
never which vendor glyph it is, so swapping sets is one file rather than thirty.
Variant is fixed per usage: filled for the active tab, outline everywhere else.
Mixing weights in a row is what makes an icon set look assembled rather than
chosen.

**No `Alert.alert` anywhere.** It is a no-op on react-native-web, so a failed
booking looked like nothing happened at all. `Notice` and `Confirm` in
`src/ui/Notice.tsx` replace it, and they are better anyway: the message sits
next to the thing it is about instead of stealing the screen.

## The offline outbox

Gyms are basements, so every write that can be queued is:

```
write() -> persist with a client idempotency key
        -> try to send now
        -> on network failure, stay queued and flush later
```

The key is generated **once** and reused on every retry. The server dedupes on
it (`workout_logs.client_key` is unique per gym), so a retry hours later cannot
double-log — that guarantee is the only reason queueing is safe at all. A 4xx is
dropped rather than retried: the request was refused, not lost.

The queue drains on app foreground and when the member taps the pending banner.

**Class booking deliberately does NOT queue.** A seat cannot be reserved while
offline, and queueing one would promise a place that may be gone by the time it
sends.

Storage picks the best backend available and degrades rather than blocking:
SQLite on native, localStorage on web, in-memory if both fail. That fallback is
load-bearing — expo-sqlite loads its WASM lazily on web, so the first write made
while offline could otherwise hang the UI forever.

## Tests

```bash
npm --prefix member-app test
npm --prefix member-app run typecheck
```

48 tests over the parts whose failure actually costs something:

- **`src/ui/__tests__/ui.test.tsx`** — the primitives every screen is built
  from. A disabled or loading `Button` must not fire (that is the guard against
  double-submitting a workout), `Confirm` must keep cancel and confirm on
  separate taps, `Meter` must survive a zero or exceeded goal.

- **`src/offline/__tests__/outbox.test.ts`** — the queue contract. A network
  failure queues rather than throwing; a retry reuses the SAME idempotency key;
  a 4xx is dropped rather than retried forever; flush stops at the first network
  failure instead of hammering a dead link. SQLite is mocked to fail, so these
  also exercise the memory fallback — the path that must hold when the store
  cannot open, which is exactly when a member is offline.
- **`src/api/__tests__/auth.test.ts`** — token shapes. `/auth/session` nests
  tokens under `tokens`; `/auth/refresh` returns them at the top level. Reading
  only one signed members out every 15 minutes.
- **`src/features/__tests__/sets.test.ts`** — only completed sets are sent, set
  numbers close gaps, strings coerce at the boundary.
- **`src/lib/__tests__/datetime.test.ts`** — Today/Tomorrow/weekday.

Screens are verified by driving the running app against the real API, not by
snapshot tests.

## What is not built yet

- **Real auth.** Sign-in calls the backend's dev bypass. The production flow is
  `POST /auth/otp/request` then `POST /auth/session` with a Supabase token,
  which needs `@supabase/supabase-js` and a configured project. `signIn()` keeps
  the signature the real flow will use.
- **Gym selection.** Sign-in asks for a tenant id. Production resolves the gym
  from the phone number via `public.member_directory`; members never see it.
- **Push notifications and camera QR scanning.** Both need a native dev build,
  which is a one-way move to EAS and has not been taken.
- **Apple Health / Google Fit.** `/health/*` exists on the BFF and needs native
  modules.
- **Progress photos.** `/progress/photos` needs an image picker and upload flow.
- **There is no switch-gym endpoint.** `me/gyms/:tenantId` is a public gym
  profile, not a session switch. A member at several gyms picks at sign-in.
  `app/gyms.tsx` is the public directory; it cannot sort by distance until the
  app asks for location permission.
- `me/context` and `me/events` are internal plumbing (session context and
  analytics), not screens.
- **43 of 61 BFF routes wired.** Everything unwired is either native-blocked or
  internal plumbing.

## Payment

Renewal creates a Razorpay order server-side and hands the member to the gym's
hosted checkout (`${EXPO_PUBLIC_PAY_BASE_URL}/pay/<orderId>`). Card details are
never entered in this app, and payment truth is settled by a webhook — a card
form here would be a second place that can be wrong about money, and a PCI
surface with no upside.
