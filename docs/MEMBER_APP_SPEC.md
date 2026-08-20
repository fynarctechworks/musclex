# MuscleX Member App — Design Spec

Status: draft for build. Anchored on the **Hevy + Strava loop**, extended with the
**gym-aware layer** (the Glofox half) that neither of them can do.

## 1. The thesis

Three products fight for the gym member's home screen:

| | What it nails | What it can't do |
|---|---|---|
| **Hevy** (4.9 iOS) | Fastest set logging on the market. Prefilled last-session values, one-tap set completion, rest timer. | Doesn't know your gym. No booking, no check-in, no trainer. |
| **Strava** (the social layer) | Streaks, kudos, leaderboards, clubs. The reason people come back on rest days. | Barely supports lifting at all. |
| **Glofox / Mindbody** | Knows the gym: booking, membership, check-in, occupancy. | Logging is an afterthought. Members log elsewhere and the gym loses the data. |

**MuscleX member app = Hevy-grade logging inside your gym's own app.**

That positioning is only credible because we own the gym side already. The member
opens one app to log a set, book a class, see how busy the floor is, and message
their trainer. Nobody in this market ships all four well.

## 2. What already exists (verified against the running API)

The Member BFF at `/member/v1/*` exposes **70+ routes**, tested this session at
30/31 GET → 200. Critically:

- `GET /home` is already a **single aggregate for the entire home screen**:
  greeting, membership, streak days, today's activity flags, `streakAtRisk`,
  today's workout, next class, **live occupancy**, nutrition totals. One call.
- `GET /gym/occupancy` returns `{ current, capacity, level, updatedAt }`. The
  Glofox "how busy is the gym right now" feature is **already built**.
- `POST /workouts/:workoutId/logs` logs sets with **idempotency** (`client_key`,
  unique per gym) and **automatic PR detection** (`newPersonalRecords`).
- Community: `/community/leaderboard`, `/challenges`, `/badges`.
- Gym layer: `/checkins`, `/classes`, `/classes/:id/book`, `/membership`,
  `/coach/chat`, `/trainer-chat/*`, `/id` (member QR), `/gym/locations`.

The schema is genuinely well designed for this. `WorkoutLog.client_key` with
`@@unique([gym_id, client_key])` means the **offline outbox was designed in from
the start**, which is exactly the Hevy pattern.

### The two real gaps

1. **No freestyle logging.** `POST /workouts/:workoutId/logs` gates on an
   `AssignedWorkout` owned by the member. A member cannot walk in and start an
   empty workout, which is *the* Hevy core loop. `assigned_workout_id` is already
   nullable, so this needs an endpoint, not a migration.
2. **No per-exercise history.** "Last time: 60kg x 8" prefilled into the set row
   is the single highest-value interaction in Hevy. The data is in
   `workout_set_logs`; nothing reads it back per exercise.

Both are additive. No schema change, no new dependency.

## 3. Information architecture

Five tabs. Resist a sixth.

```
┌─────────┬──────────┬─────────┬──────────┬─────────┐
│  Today  │   Gym    │  [ + ]  │ Progress │   Me    │
└─────────┴──────────┴─────────┴──────────┴─────────┘
```

The centre **[ + ]** is not a tab, it is the log-a-workout action. It is raised,
accent-filled, and always one thumb-reach away. Hevy's entire retention story is
that starting a workout is never more than one tap from anywhere in the app.

### Tab 1 — Today  (`GET /home`, one call)

Vertical card stack, in priority order:

1. **Streak + today's ring.** Days count. If `today.streakAtRisk` is true the card
   turns accent and reads "Keep your 12 day streak alive". This is the Strava
   mechanic and it is already in the payload.
2. **Live gym occupancy.** The differentiator, high on the screen.
   `12 / 40 people in right now` with a fill bar coloured by `level`
   (quiet / moderate / busy). Subtext: "Usually quiet at this hour."
   Polls `/gym/occupancy` every 30s while the tab is focused.
3. **Today's workout.** If a trainer assigned one, "Push Day A, 6 exercises" with
   a primary **Start** button. If not, "No workout assigned. Start an empty one."
4. **Next class.** Title, time, `seatsLeft`. Book / Cancel inline.
5. **Nutrition + water.** Compact totals with a one-tap +250ml water chip.

### Tab 2 — Gym  (the Glofox half)

- **Check in.** Big QR from `GET /id`, plus `POST /checkins` for QR-scan flow.
- **Occupancy detail.** Current level, plus by-hour bars so the member can pick a
  quiet time. (Needs a small aggregate endpoint later; v1 shows current only.)
- **Classes.** Week strip, list from `GET /classes`, book/cancel inline.
- **Membership.** Plan, expiry, renew via `POST /membership/renew`.
- **Coach.** Thread list, chat.

### Tab 3 — [ + ] Log workout  (the Hevy half)

This is the screen the app lives or dies on. Detailed in section 4.

### Tab 4 — Progress

- PR wall: every exercise's best, from `personal_records`.
- Body weight chart (`/me/weight`), measurements, progress photos.
- Volume per week, visit history (`/visits/summary`).
- **Leaderboard and challenges** live here, not in a separate social tab. Gym
  members care about their own gym's board, which is a small number of people.
  A full Strava-style feed is a v2 decision, not a v1 tab.

### Tab 5 — Me

Profile, goals, health connections, notifications, referral, settings.

## 4. The logging interaction (the thing to get right)

Design rules, in order of importance:

1. **Prefill from last time, always.** Opening an exercise shows the previous
   session's sets as ghost values in the inputs. The member's most common action
   is "same as last time, maybe one more rep". Requires the new history endpoint.
2. **One tap to complete a set.** A checkmark on the right of each set row. Tap
   it and the row commits, the rest timer starts automatically, and the next set
   row prefills from the one just completed. No modals, no save button per set.
3. **Never block on the network.** Every set is written to a local outbox first
   and the UI updates instantly. Sync is background. `client_key` makes replay
   safe, so a flaky gym wifi can never double-log or lose a set. This is why the
   unique constraint matters.
4. **Rest timer is ambient.** Starts on set completion, counts down in a slim bar
   pinned above the tab bar, continues if the member navigates away, fires a
   local notification when it ends.
5. **PRs are celebrated, not announced.** `newPersonalRecords` comes back from the
   log call. A small inline badge on the set row plus one haptic. No full-screen
   takeover.
6. **Finish is a summary, not a form.** Duration, volume, PRs hit, exercises done.
   One share button that renders a card for the gym's leaderboard.

Set row anatomy:

```
 SET   PREVIOUS      KG      REPS         
  1    60 x 8       [60]     [8]      (✓)
  2    60 x 8       [60]     [7]      ( )
  3    ghost         __       __      ( )      + Add set
```

## 5. API work required

Both additive, both against existing tables.

**a) Freestyle workout log**

```
POST /member/v1/workouts/logs
Idempotency-Key: <uuid>
{ "sets": [ { "exerciseId": "...", "setNumber": 1, "reps": 8,
              "weight": 60, "unit": "kg" } ] }
→ 201 { "logId": "...", "newPersonalRecords": [...] }
```

Same body, same idempotency, same PR detection as the assigned variant. Writes
`assigned_workout_id: null`. Reuses `updatePersonalRecords` unchanged.

**b) Per-exercise history**

```
GET /member/v1/exercises/:exerciseId/history?limit=10
→ 200 { "personalRecord": { weight, reps, unit, achievedAt } | null,
        "sessions": [ { "loggedAt": "...", 
                        "sets": [ { setNumber, reps, weight, unit } ] } ] }
```

Member-scoped and gym-scoped by the tenant client. Drives the "PREVIOUS" column
and the exercise detail chart.

## 6. Build order

| Phase | Ships | Why first |
|---|---|---|
| **0** | The two endpoints above | Everything else depends on them |
| **1** | Today tab + occupancy + streak | Proves the gym-aware differentiator with one API call |
| **2** | Log workout: exercise picker, set rows, prefill, rest timer, offline outbox | The retention engine |
| **3** | Gym tab: check-in QR, classes, membership | Replaces the member's reason to open any other app |
| **4** | Progress: PR wall, charts, leaderboard | The Strava pull |
| **5** | Coach chat, nutrition, health connections | Depth |

## 7. Open decisions

- **Social feed scope.** Gym-only leaderboard in v1 (already built). A following
  graph and a kudos feed is a real product decision with moderation cost.
- **Occupancy by hour** needs a small aggregate over `check_ins`. Cheap, high
  perceived value, but not v1.
- **Apple Health / Google Fit** write-back. `/health/connections` exists; the
  native side does not.
