# Routine schedules and the missed-day prompt — proposal

**Status: SHIPPED 2026-09-02.** The schema objects below were applied to all
studio schemas via `backend/prisma/migrations/20260902_member_routine_schedule/`.
Approved by the project owner; see `docs/AUDIT_2026-09-02.md` for why it became
urgent (the missing columns were 500-ing `/api/v1/members`).

> Historical note: the plan text below was written before implementation, so it
> reads as a proposal. The schema section is what actually shipped.

This is a HARD STOP item under CLAUDE.md (#1 schema/migrations, and the
tenant-model set). Written so the shape can be corrected before anything
touches the database.

## The two gaps

**1. The home card is permanently dead for self-directed members.**

`Home.todayWorkout` is built from `this.workouts.getTodaySummary(member)`, which
reads `AssignedWorkout` — a trainer-assigned row. A member with no trainer has
no path to a non-null value, so the most prominent card on the home screen reads
"Nothing assigned today" every day, forever. The app's own positioning is that a
gym is a bonus rather than a requirement; this card contradicts it daily.

**2. Nothing can be "missed", because nothing is planned.**

`MemberRoutine` / `AppUserRoutine` carry `name`, `notes` and `exercises`. There
is no weekday, no order, no active flag. A self-directed member has no plan to
fall behind on.

The trainer path *can* already answer this: `AssignedWorkout` has
`scheduled_date` and `status: assigned | completed | skipped`.

## What the data does not currently support

`WorkoutLog` has `assigned_workout_id` and `workout_plan_id` — but **no
`routine_id`**. A finished session does not record which routine it came from.

So today the only answerable question is "did they train at all that day", not
"did they do the scheduled routine". Two consequences:

- a member who trains something ad-hoc on a scheduled day would count as having
  done that day's routine
- with the week SHIFTING on a missed day (the chosen behaviour), the shift needs
  to know what was actually completed and when — "did they train at all" is not
  a strong enough signal to move a whole week's plan

This is why proposal item 3 below exists.

## Proposed changes

Two parallel routine tables exist and both must be served:
`studio_template.member_routines` (gym members, tenant-scoped) and
`public.app_user_routines` (independent users). The schedule mirrors that split.

### 1. `studio_template.member_routine_schedule`

```prisma
model MemberRoutineSchedule {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  gym_id     String   @db.Uuid
  member_id  String   @db.Uuid
  routine_id String   @db.Uuid
  /// 0 = Sunday .. 6 = Saturday. A weekday with NO row is a rest day —
  /// not an error and not something to nag about.
  weekday    Int      @db.SmallInt
  created_at DateTime @default(now()) @db.Timestamptz()
  updated_at DateTime @default(now()) @updatedAt @db.Timestamptz()

  member  Member        @relation(fields: [member_id], references: [id], onDelete: Cascade)
  routine MemberRoutine @relation(fields: [routine_id], references: [id], onDelete: Cascade)

  /// One weekday resolves to exactly one routine. Enforced here rather than in
  /// the app: a weekday[] column on the routine could not express it.
  @@unique([member_id, weekday])
  @@index([gym_id, member_id])
  @@map("member_routine_schedule")
  @@schema("studio_template")
}
```

### 2. `public.app_user_routine_schedule`

The same shape keyed by `app_user_id`, no `gym_id`, unique on
`[app_user_id, weekday]`.

### 3. Routine provenance on a logged workout

`WorkoutLog` gains a nullable `routine_id`, and its `AppUser` counterpart the
same. Nullable because most existing rows have no routine and an ad-hoc session
legitimately has none.

Without this the missed-day logic cannot tell "did leg day" from "went for a
swim", and the chosen shift-the-week behaviour would move a member's whole plan
on the strength of a guess.

### 4. `tenant-models.ts`

`MemberRoutineSchedule` must be added to `backend/src/prisma/tenant-models.ts`.

**Flagged separately and deliberately.** That file is the single source of truth
for which models are gym-scoped, and a model missing from it leaks across gyms.
It is gated on its own in CLAUDE.md even where schema work is not.

`AppUserRoutineSchedule` is public-schema and must NOT be added — it is keyed by
app_user, has no `gym_id`, and adding it would inject a filter for a column that
does not exist.

## Behaviour, as decided

**Today's card.** Resolution order:

1. a trainer-assigned workout for today → as now
2. otherwise the routine scheduled for today's weekday → "Push day · your routine"
3. otherwise, if the member has a schedule but not for today → an explicit rest day
4. otherwise → today's "nothing assigned" copy, which is then honest: it only
   appears for a member who has not set anything up, and it points at the + and
   at building a schedule

**Missed day.** Yesterday only. Shown at most once a day.

Triggers when yesterday had a scheduled routine (or an assigned workout) and no
`WorkoutLog` for that routine exists on that date.

- **Do it now** — starts yesterday's routine, and **the week shifts forward**:
  what was scheduled for each subsequent day moves one day later, so a
  Push/Pull/Legs cycle keeps its order rather than its calendar.
- **Skip to today's** — marks yesterday skipped, today proceeds unchanged.

### The open question in "shift the week"

A weekday→routine map has no notion of an anchor, so "shift by one day" cannot
be expressed by editing the rows without permanently rewriting the member's
chosen days — a Monday person quietly becomes a Tuesday person, and a second
missed day moves them again.

Two ways to hold it, and this needs a decision before implementation:

- **(a) A `schedule_offset_days` integer on the member**, applied when resolving
  weekday → routine. Reversible, does not rewrite what the member chose, and a
  "back to my normal week" control can reset it to 0. One extra column.
- **(b) Rewrite the schedule rows on each shift.** No new column, but the
  member's stated week is destroyed by a missed session, and there is no way
  back to it.

I recommend (a). (b) loses information the member explicitly gave us.

## Not proposed

- No change to how a workout is logged or to the offline outbox.
- No change to `AssignedWorkout`; the trainer path keeps working as it does.
- No RLS or auth changes.
- No backfill: every existing member simply has no schedule, which is the
  correct starting state and reads as "nothing set up yet".

## Migration safety

Three additive changes: two new tables and one nullable column (plus its
app-user counterpart). Nothing altered, nothing dropped, no data rewritten.

Per the repo's own history this fans out across live `studio_*` schemas rather
than landing only in `studio_template` — the `/expenses` outage earlier this
month was exactly a template-only migration that never fanned out. The fan-out
would be guarded and idempotent, and rehearsed with one transaction per file.
