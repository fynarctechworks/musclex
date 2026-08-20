# prototype/member-app

A running prototype of the MuscleX member app, built to make the design in
[`docs/MEMBER_APP_SPEC.md`](../../docs/MEMBER_APP_SPEC.md) something you can
actually use rather than read about.

It is **not** the member app. It is a single HTML file that talks to the real
Member BFF, so the interactions and the API contract can be judged before any
React Native work starts.

## Running it

```bash
# 1. backend on :4002 with MEMBER_DEV_OTP set in backend/.env
node --enable-source-maps backend/dist/main

# 2. the prototype
node prototype/member-app/server.mjs      # http://localhost:5199
```

| Env | Default | Purpose |
|---|---|---|
| `PORT` | `5199` | Where the prototype serves |
| `BFF_URL` | `http://localhost:4002` | Member BFF origin |
| `MEMBER_PHONE` | `9877000111` | Member to sign in as |
| `TENANT_ID` | Iron Temple's id | Gym to sign in to |

`server.mjs` mints a member session on boot via `POST /member/v1/auth/dev/session`
and proxies `/member/v1/*` with the token attached. Same-origin, so no CORS entry
is needed on the backend, and the member JWT never reaches the browser.

## What is real and what is not

**Real** — every screen is live API data: `GET /home`, `/gym/occupancy`,
`/exercises`, `/exercises/:id/history`, `/id`, `/visits/summary`,
`/community/leaderboard`, `/me`. Logging a workout really writes to the gym's
own Postgres schema through `POST /workouts/logs`, with an `Idempotency-Key`,
and personal records come back from the server rather than being computed here.
The check-in QR is the actual PNG the API renders, with its real 35-second
rotation.

**Not real** — the floor traffic (seeded check-ins) and the exercise catalogue
are dev data in the local Supabase, because the seed does not create either.
Auth is bypassed. Offline outbox, haptics and local notifications are native
concerns and are not modelled.

## Why one HTML file with no dependencies

The point is to validate the *interaction*, above all the set-logging loop, and
to prove the API can drive it. A build step, a component library or a native
toolchain would all be answering a question nobody has asked yet. When the
interaction is agreed, this gets rebuilt properly in `gym-member-app/`.
