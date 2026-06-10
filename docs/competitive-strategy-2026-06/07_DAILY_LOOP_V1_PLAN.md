# Implementation Plan — "Daily Loop v1"

**Status:** PLAN ONLY. No code written. Some items need your explicit sign-off (flagged ⚠️).
**Goal:** Install the core habit flywheel (ritual + loss-aversion + celebration + trigger) using assets we already own, with **zero schema/payments/auth risk**.

> Grounded in verified code as of 2026-06-03. This slice was chosen because, on inspection, ~70% of it is *surfacing/uniting data we already compute* — not new systems.

---

## 1. Scope (what's in v1, what's explicitly out)

**IN:**
1. Push delivery actually live (finish EAS/FCM config) — *unblocker*.
2. Unified streak (check-in **+** workout-log **+** nutrition-log days).
3. "Today" unified Home hero card (re-renders existing `getHome` payload).
4. Micro-celebrations + haptics (check-in success, streak milestone, badge unlock).
5. Streak-at-risk push (scheduled trigger → existing `sendToMember`).

**OUT (deferred to later tiers — avoids schema/risk in v1):**
- Streak *freeze* (needs a small table/field → schema change → separate sign-off).
- Social feed / kudos (Tier 1 but separate; biggest tenant-isolation surface).
- Member AI coach, wearables, payments.

---

## 2. Item-by-item plan

### 2.1 — Push delivery live ⚠️ (config/secrets, not code)
- **What:** Provision EAS `projectId` + FCM (Android) / APNs (iOS) credentials so `sendToMember`'s Expo calls actually deliver. Transport code is already built and verified ([member-notification.service.ts](backend/src/member/data/member-notification.service.ts)).
- **Why it's first:** every trigger below is inert without it.
- **Risk:** none to code; it's credentials/console setup. ⚠️ Needs your EAS/Firebase account access — I can't provision these.
- **Verify:** register a device token, call the existing send path, confirm receipt on a real device.

### 2.2 — Unified streak (no schema change)
- **Today:** `computeStreakDays(checkIns.map(c => c.checked_in_at))` — check-ins only.
- **Change:** build the day-set from the **union** of check-in dates, `WorkoutLog.logged_at`, and nutrition-log dates (all already queried or trivially queryable; both have `(member_id, logged_at)` indexes).
- **Where:** `computeStreakDays` already takes a `Date[]` — keep it pure; just feed it the unioned array in `member-checkin.service.ts` / `member-data.service.ts` / `member-community.service.ts` (3 call sites). Consider a single `getStreakDates(member)` helper to avoid drift across the 3 sites.
- **Risk:** low. Behavioral change = streaks get *easier* to keep (more qualifying actions) — strictly better for retention. Badge thresholds unchanged.
- **Tenant safety:** all three sources are already member/gym-scoped; no new query patterns. Confirm the workout/nutrition reads go through the tenant-scoped path (they're member-app services, so they do).
- **Tests:** `computeStreakDays` is pure → add unit cases (gap days, mixed-source same-day dedupe, today-not-yet-active). `member-data.service.spec.ts` and `member-workout.service.spec.ts` already exist as patterns.

### 2.3 — "Today" Home hero card (client-mostly)
- **Today:** Home shows a streak ring + week-ahead ([home.tsx](gym-member-app/app/(app)/home.tsx)); `getHome` already returns `{ membership, occupancy, streak, todayWorkout, nextClass, nutrition }`.
- **Change:** add a top "Today" card that answers *"what should I do today & did I do it?"* from the **existing payload** — checklist of: checked in? · logged a workout? · logged a meal? · next class CTA · streak status. No backend change (optionally add a small `today: {...}` rollup to the existing response for cleanliness).
- **Risk:** none (read-only render).
- **Tests:** none cover Home UI today — **state explicitly**; add a render test if we adopt RN testing (we currently have none on the member app per memory).

### 2.4 — Micro-celebrations + haptics (pure client)
- **What:** On check-in success, streak milestone (3/7/30), and badge unlock → confetti/scale animation + `expo-haptics` impact. Reuse the design-system; trigger off existing success states (check-in screen, community badge fetch).
- **Risk:** none (client polish). Confirm `expo-haptics` is already a dep before adding (if not → ⚠️ new dep, ask first per CLAUDE.md rule 7).
- **Tests:** none applicable (animation/UX).

### 2.5 — Streak-at-risk push (scheduled trigger, no schema)
- **What:** A scheduled job (BullMQ repeatable / existing queue layer) that, in the evening per gym timezone, finds members with an **active streak ≥ N** and **no qualifying activity today**, and enqueues a push via existing `sendToMember` ("Your 6-day streak 🔥 — check in before midnight"). Respects the per-category `prefs` already on `memberDeviceToken`.
- **Why:** loss-aversion is the cheapest proven retention lever; we already store everything needed.
- **Risk:** medium-low. ⚠️ **Notification fatigue** is the real risk — gate behind prefs, frequency-cap (max 1/day), and quiet hours. Must be **gym-scoped** in the query (iterate per tenant) — flag for tenant-isolation review since it's a cross-member batch read.
- **Tests:** unit-test the "at-risk" selection predicate (active streak + no activity today) with fixture members.

---

## 3. Sequencing (1 coherent increment)

```
Step 1  Unified streak helper + tests        (backend, no schema)      ← safe, self-contained
Step 2  Today hero card                       (client, read-only)
Step 3  Celebrations + haptics                (client)                 ← verify expo-haptics dep first ⚠️
Step 4  Push delivery live                    (config) ⚠️ needs your creds
Step 5  Streak-at-risk job                    (backend job) ⚠️ tenant-review + fatigue caps
```
Steps 1–3 are fully safe to implement on this branch and demoable without prod creds. Steps 4–5 need your inputs.

---

## 4. What I need from you before coding

| Item | Decision needed |
|---|---|
| 2.1 Push creds | EAS projectId + FCM/APNs setup (account access) — or confirm you'll provision and I build assuming they exist |
| 2.4 Haptics | OK to add `expo-haptics` if not already a dep? (CLAUDE.md rule 7) |
| 2.5 At-risk job | OK to add a scheduled job + the per-tenant batch read? (touches notification policy; wants tenant-isolation review) |
| Streak freeze | Confirm deferred (it's the only piece needing a schema change — out of v1) |

Everything else (unified streak, Today card, celebrations) I can implement now with **no schema, no payments, no auth changes**, full tests on the pure logic, and a diff for your review — consistent with CLAUDE.md's "show me the diff and STOP."

---

## 5. Success metrics (via existing PostHog)

- % of members holding a streak ≥3 (before/after).
- Home → action conversion (does the Today card increase same-session check-in/log rate?).
- Streak-at-risk push → return-within-3h rate.
- D7/D30 retention delta for members exposed to the loop.

> v1 deliberately ships the *measurement* alongside the mechanics so we validate the flywheel before investing in the heavier social/wearable/AI tiers.
