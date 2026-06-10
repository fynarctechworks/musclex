# Phani Gym — Test Data & Test Scenarios

Seeded by [`seed-phani-test.ts`](./seed-phani-test.ts) on 2026-06-08.
**Tenant:** Phani Gym · `gym_id = 55243e01-170e-4346-a7cf-390658780dda` · schema `studio_template`.
Everything is tagged for clean removal — see **Cleanup** at the bottom.

## What was created (verified)

| Thing | Count | Notes |
|---|---|---|
| Members | 100 | codes `PHT-0001`…`PHT-0100`, all `notes = 'SEED:phani-test'` |
| Member profiles | 100 | height/weight/body-fat/goals/activity/experience/blood group/emergency contact |
| Memberships | 154 | across **6 different plans**, 100 different join dates |
| Repeat buyers | 15 | members `PHT-0001`…`PHT-0015` — 3–6 **consecutive monthly** memberships (renew every month; older = `expired`, current = `active`) |
| Trainers (with logins) | 5 | real Supabase auth users + `staff` + RBAC `trainer` role |
| Classes (next 30 days) | 120 | 4/day, rotating across categories/trainers/branches |
| Class sessions (next 30 days) | 120 | mirror of classes, with random `enrolled_count` |

Phones are unique test numbers `9100000001`…`9100000100`. Emails `phani.testNNNN@seed.musclex.test`.
Branches reused: **capital park** and **Branch-2**. Plans reused (branch-specific): Basic Monthly, Premium Quarterly, Personal Training, Annual Plan / Monthly Basic, Quarterly Standard, Annual Premium.

## Trainer logins

All 5 share the password **`Trainer@12345`** — login verified working via Supabase sign-in.

| Email | Name | Branch |
|---|---|---|
| `trainer1@phani-test.musclex.app` | Coach Ramesh | capital park |
| `trainer2@phani-test.musclex.app` | Coach Sneha | Branch-2 |
| `trainer3@phani-test.musclex.app` | Coach Arjun | capital park |
| `trainer4@phani-test.musclex.app` | Coach Priya | Branch-2 |
| `trainer5@phani-test.musclex.app` | Coach Vikram | capital park |

## Test scenarios

1. **Members list & filtering (admin)** — open Members. Expect 100 new + 12 existing = 112. Filter by status (some `inactive`), branch, churn risk (low/medium/high mix). Search by name/phone/`PHT-` code.
2. **Member detail / profile** — open any `PHT-` member. Confirm profile details (height, weight, goals, blood group, emergency contact) and membership history render.
3. **Repeat-buyer / renewals** — open `PHT-0001`…`PHT-0015`. Each shows multiple back-to-back monthly memberships; older ones `expired`, the latest `active`. Good for testing renewal timelines, revenue-per-member, and "expiring soon" surfaces.
4. **Plans / revenue analytics** — dashboard revenue & membership analytics should now have real spread across 6 plans and ~12 months of join dates (not all on one day).
5. **Classes / schedule (admin)** — open the schedule for the next 30 days. Expect 4 classes/day across both branches, each with an assigned trainer. Try booking a member into a class.
6. **Trainer login** — log into the admin/staff app as `trainer1@phani-test.musclex.app` / `Trainer@12345`. Confirm trainer-scoped views (their classes, assigned clients) work and they only see Phani Gym.
7. **Trainer ↔ class linkage** — each class/session has a `trainer_id` pointing at one of the 5 seeded trainers; verify trainer schedules populate.
8. **Tenant isolation (important)** — while logged into another gym, confirm none of the `PHT-` members/trainers/classes are visible. (Verified at the DB level: the other gym's 3 members / 2 classes were untouched.)
9. **Check-in flow** — members have `checkin_method = manual` and a `qr_code`; exercise manual check-in for an active member.
10. **Edge cases** — `inactive` members (every 17th) and `expired` memberships exercise lifecycle/grace logic.

## Re-running

The script is **idempotent** — re-running deletes the prior `PHT-` rows and recreates them; trainer auth users are reused (password reset). From `backend/`:

```
node ./node_modules/typescript/bin/tsc --outDir ./scripts/_dist --skipLibCheck --esModuleInterop \
  --module commonjs --target es2020 --moduleResolution node ./scripts/seed-phani-test.ts
node ./scripts/_dist/seed-phani-test.js
```

## Cleanup (remove everything)

Run [`seed-phani-test-cleanup.sql`](./seed-phani-test-cleanup.sql) against the DB. It removes only the
tagged seed rows (members `PHT-%`, trainers `PHT-TR-%`, their classes/sessions, RBAC rows, and — unless you
comment out that line — the trainer auth logins). Other tenants are never touched.
