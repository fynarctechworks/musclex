# Screen Inventory — Member App

> Every screen: its purpose, primary action, data source (endpoint), build status, and a
> wireframe-level layout. This is the bridge from IA/flows to high-fidelity design and build.
> Endpoint references = `Member api v1.openapi.yaml` / `backend/src/member/`.

Status: ✅ built · 🟡 partial/empty · 🔴 not built · ⛔ blocked
Existing route files live under `gym-member-app/app/`.

---

## Auth & onboarding

### S1. Welcome  ✅ `app/(auth)/welcome.tsx`
- **Purpose:** first impression; set tone (premium, gym-connected).
- **Primary action:** "Get started" → phone.
- **Layout:** mesh hero · logo/tagline ("Your gym, in your pocket — live") · single CTA.
- **Data:** none.

### S2. Phone  ✅ `app/(auth)/phone.tsx`
- **Primary action:** enter phone → request OTP. **Data:** `POST /auth/otp/request`.
- **Layout:** title · phone input (country prefix) · CTA · "we'll text a code" helper.
- **States:** invalid number inline; rate-limited message (throttle exists server-side).

### S3. OTP  ✅ `app/(auth)/otp.tsx`
- **Primary action:** enter 6-digit code → verify. **Data:** `POST /auth/otp/verify` → member token.
- **Layout:** big code input · resend timer · auto-submit on 6th digit.
- **States:** wrong code, expired, resend cooldown.

### S4. Choose gym  ✅ `app/(auth)/choose-gym.tsx`
- **Shown only if** phone maps to >1 gym (from session response).
- **Layout:** list of gym cards (name, location) · tap to select.

### S5. Goal (onboarding)  ✅ `app/(auth)/goal.tsx`
- **Purpose:** capture fitness goal to personalize Home.
- **Layout:** chip/card selection (lose fat / build muscle / general). Big, tappable, no typing.
- **Note:** PRD flags goal-enum mismatch (member model vs OpenAPI) — reconcile before wiring.

---

## Main tabs

### S6. Home  🟡 `app/(app)/home.tsx`
- **Purpose:** daily hub; reason to open multiple times/day.
- **Primary action:** floating QR check-in.
- **Data:** `GET /home` (composed). **Reality:** some widgets return null (no workout authoring / occupancy is derived).
- **Layout (top→bottom):**
  ```
  ┌─────────────────────────────┐
  │ ░░ mesh header ░░           │  greeting "Morning, Ravi" + AI nudge
  │  🔥 Streak: 5 days          │  ← StreakRing (the lead motivator)
  ├─────────────────────────────┤
  │ Today's workout    [Start ▸]│  ← null-safe: EmptyState if none
  │ Gym occupancy  ▓▓▓░░ 62%    │  ← OccupancyCard (derived)
  │ Membership · expires in 12d │  ← MembershipStrip
  │ Upcoming class (P2)         │
  └─────────────────────────────┘
              ( + ) QR
  ```

### S7. Workout (today)  🟡 `app/(app)/workout.tsx`
- **Primary action:** start today's assigned workout.
- **Data:** `GET /workouts/today`. **Reality:** empty until admin authoring exists → EmptyState.
- **Layout:** plan title · exercise list (name, sets×reps target) · "Start workout" CTA · history link.

### S8. Exercise detail / set logging  🟡
- **Primary action:** log + complete sets, one-thumb.
- **Data:** `POST /workouts/{id}/logs` (idempotent). Components: `Stepper`, `RestTimer`, `ExerciseCard`.
- **Layout:** exercise name/animation · set rows (reps/weight Stepper + swipe-to-complete) · rest timer · "next".

### S9. Classes (schedule)  🔴 (Phase 2)
- **Data:** not built. **Layout:** date selector · time-slot list (class, trainer, seats) · tap → detail.

### S10. Class detail  🔴 (Phase 2)
- **Layout:** trainer card · time/duration · seats/waitlist · "Book" / "Join waitlist" CTA · privacy info (women-only badge where relevant).

### S11. Progress  🟡 `app/(app)/progress.tsx`
- **Primary action:** log weight; view trend.
- **Data:** `GET /progress`, `POST /progress/metrics` ✅. Photos ⛔ (`/progress/photos/upload-url` not built).
- **Layout:**
  ```
  Weight  72.4 kg  ▼0.6 this week   ← WeightChart
  [ Before │ After ] slider          ← photos (blocked)
  BMI · Body fat · Measurements
  Weekly report card
  ```

### S12. Community  🔴 (Phase 2–3)
- **Layout:** challenges · leaderboard · badges · (feed P3). Hidden until Phase 2.

---

## Header-reachable (not tabs)

### S13. QR check-in (scanner + success)  ✅ `app/checkin.tsx`
- **Data:** `POST /checkins` (idempotent; reuses admin orchestrator).
- **Layout:** camera viewfinder · manual-code fallback link · **success:** full mesh + haptic + streak.

### S14. Membership  🟡 `app/membership.tsx`
- **Data:** `GET /membership` ✅ (read). Renew ⛔ (Razorpay stub).
- **Layout:** status badge · expiry (urgency color+icon+text) · plan details · invoice history · Renew CTA (P2, disabled/hidden until billing real).

### S15. Notifications  🟡 `app/notifications.tsx`
- **Layout:** grouped by category (IA §5) · each deep-links to its screen · empty state.

### S16. Profile  ✅ `app/(app)/profile.tsx`
- **Data:** `GET /me`. **Layout:** avatar · name/goal · stats summary · links to Settings, AI Coach (P3).

### S17. Settings  🟡
- **Layout:** theme (dark default) · units (kg/lb) · notification prefs · **privacy/consent + data export/delete (DPDP)** · logout.

### S18. AI Coach  🔴 (Phase 3)
- **Layout:** chat/suggestion surface; personalized from real SaaS data (RAG). Header-reachable, not a tab.

---

## Phase 3 / later screens (design later, listed for completeness)
Nutrition logging · food search/barcode · trainer chat · transformation timeline · challenges detail · wearable sync/consent · supplement store. All 🔴 — see PRD §6 for phase assignment.

---

## Screen → endpoint → status summary

| Screen | Endpoint | Status |
|---|---|---|
| Welcome/Phone/OTP/Choose-gym/Goal | `/auth/*` | ✅ |
| Home | `GET /home` | 🟡 null widgets |
| Workout / set logging | `/workouts/*` | 🟡 empty (no authoring) |
| Progress (metrics) | `/progress`, `/progress/metrics` | ✅ |
| Progress (photos) | `/progress/photos/*` | ⛔ storage signing |
| Check-in | `POST /checkins` | ✅ |
| Membership (view) | `GET /membership` | 🟡 |
| Membership (renew) | Razorpay | ⛔ stub |
| Classes / Community / AI Coach / Nutrition | — | 🔴 not built |

**Build-readiness takeaway:** the auth + check-in + progress-metrics spine is real today. The two
things that most make the app *feel* incomplete are (1) no trainer/admin workout authoring → empty
Workout, and (2) Home's null widgets. Both are about **data behind the screens**, not the screens.
