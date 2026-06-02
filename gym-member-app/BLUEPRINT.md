# FitSync — Fitness Super App · Master Product Blueprint

> Single source of truth for the member app rebuild. The app is being re-architected
> from the ground up against this blueprint. Design system, typography, spacing, color,
> elevation and motion are governed by [`/design.md`](../design.md) (Vercel/Geist),
> translated to the member app's **dark-first** theme in
> [`src/design-system/tokens.ts`](src/design-system/tokens.ts).
>
> Rules of engagement live in [`/CLAUDE.md`](../CLAUDE.md): one concern per session,
> show diffs and stop, never delete code without flagging first, tenant isolation is
> sacred. This rebuild is incremental — we replace module by module, not all at once.

---

## 1. Product Vision

A premium fitness ecosystem app for gym members — the daily-use fitness companion.
Reference quality bar: Samsung Health, Cult.fit, HealthifyMe, Strava, Nike Training Club.

It must feel: **premium · modern · fast · motivating · clean · smooth · habit-forming.**

Platforms: **Android + iOS** (Expo / React Native, web target for preview only).

Design feel (Samsung Health principles, rendered in the Geist system):
soft cards · rounded components · spacious layout · smooth transitions · modern charts ·
minimal clutter · premium motion design.

---

## 2. Target Users

- **Primary:** gym members — beginners, intermediate, advanced athletes, weight-loss
  users, muscle-building users, group-class users.
- **Secondary:** trainers, nutrition coaches, gym owners.

---

## 3. Goals

Solve: attendance tracking · workout consistency · motivation · progress visualization ·
class scheduling · trainer communication · health tracking · membership management.

Move the needle on: gym retention · engagement · DAU · membership renewals.

---

## 4. Core Modules

| # | Module | MVP / V2 / V3 | Key features |
|---|--------|---------------|--------------|
| 1 | **Authentication** | MVP | Phone OTP (built), Email, Google, Apple, Face ID / biometric unlock. Flow: Splash → Onboarding → Login → Verify → Goal → Personalization |
| 2 | **Home Dashboard** | MVP | Daily summary, calories, streak, water, steps, attendance, upcoming classes, membership expiry, trainer notifications, AI recommendations, transformation progress. Dynamic scroll cards + animated charts + personalized widgets |
| 3 | **Gym Check-in** | MVP | QR scan (built), NFC, fingerprint, BLE auto-detect, optional face verify, manual backup. Auto attendance, entry/exit, live occupancy, peak hours, crowd prediction |
| 4 | **Workout Tracking** | MVP | Trainer-assigned workouts, templates, exercise animations, reps/sets/weight logging, PR tracking, recovery. Large buttons, swipe-to-complete, minimal typing, one-hand |
| 5 | **Exercise Library** | V2 | Video demos, muscle targeting, categories (Chest/Back/Legs/Cardio/HIIT/Yoga/CrossFit), AI recs, search, favorites |
| 6 | **Body Progress** | MVP | Weight, BMI, body-fat, measurements, transformation photos, weekly reports, AI insights. Graphs, progress charts, before/after sliders |
| 7 | **Nutrition** | V2 | Calorie + macro tracking, meal logging, barcode scanner, water, Indian food DB, diet plans (loss/gain/keto/vegan/maintenance) |
| 8 | **Class Booking** | MVP | Live slots, trainer details, booking, waitlist, seat availability, recurring booking, calendar sync. Yoga/Zumba/HIIT/CrossFit/Cardio/PT |
| 9 | **Membership** | MVP | Details, expiry reminders, plan upgrades, freeze, renewals, invoices, auto-renew |
| 10 | **Trainer Communication** | V2 | Chat, voice notes, workout feedback, diet feedback, progress discussions |
| 11 | **AI Fitness Coach** | V2 | Workout/nutrition suggestions, recovery recs, goal planning, daily fitness score, smart reminders, motivation engine |
| 12 | **Community** | V2 | Feed, challenges, leaderboards, badges, referral rewards, group challenges |
| 13 | **Notifications** | MVP | Workout/water/meal reminders, membership alerts, trainer messages, booking reminders |
| 14 | **Wearable Integration** | V3 | Apple HealthKit, Google Health Connect, Samsung Health, Fitbit, Garmin |

---

## 5. Information Architecture

**Bottom navigation (5 tabs):**
1. Home
2. Workout
3. Classes
4. Progress
5. Community

**Floating action button:** QR Check-in (center, raised).

**Profile section (not a tab — accessed from Home header):**
Membership · Nutrition · Settings · Devices · Payments · Notifications.

---

## 6. Design System

Governed entirely by [`/design.md`](../design.md). **Do not introduce new accent colors,
new radii, or new type sizes** outside the token set. Member app is **dark-first**.

- **Color** — `src/design-system/tokens.ts` `colors`. Ink-near-white text on near-black
  canvas. Single accent (`#0070F3`). Mesh gradient is the *only* decoration, hero scale
  only — never miniaturised, never reduced to one color.
- **Typography** — Geist via Inter (`@expo-google-fonts/inter`, weights 400/500/600,
  never 700) + JetBrains Mono for technical labels. Aggressive negative tracking on
  display sizes (`tokens.tracking`). Sentence-case headlines.
- **Spacing** — 4px base unit. `tokens.space` (xxs 4 → 5xl 96). Large gaps between
  sections, tight gaps inside cards.
- **Radius** — `tokens.radius`. 100px pill for primary CTAs, 6–8px for in-app surfaces.
- **Elevation** — `tokens.elevation`. Subtle stacked shadows, never one heavy drop.
- **Motion** — Reanimated. Smooth transitions, skeleton loaders, haptics, swipe
  gestures, pull animations. Target 60fps.

Reusable primitives (in `src/design-system/`): Button · Card · Text · Input · Badge ·
Icon · Screen · Skeleton · EmptyState · ErrorState · MeshGradient · Stepper.
**To build:** Charts (progress ring, activity/line chart), Bottom sheet, Modal,
Tab bar, FAB, Avatar, ListRow, SegmentedControl, Chip.

---

## 7. Critical User Flows

Onboarding · Membership purchase · QR check-in · Book class · Start workout ·
Track progress · Chat trainer · Renew membership.

Every flow: **minimize taps · reduce friction · feel instant.**

---

## 8. Performance Requirements

App launch < 2s · screen load < 500ms · 60fps animations · offline caching ·
lazy loading · optimized API calls. Must feel smooth, responsive, premium.

---

## 9. Tech Stack (mobile)

- **Frontend:** React Native + Expo + TypeScript + NativeWind
- **State:** Zustand + React Query
- **Animation:** Reanimated + Gesture Handler
- **Backend:** NestJS (the Member BFF — `backend/src/member/`)
- **DB:** PostgreSQL (per-gym tenant schema; isolation is sacred)
- **Realtime:** Socket.IO · **Cache:** Redis · **Storage:** Cloudinary
- **Auth:** phone-OTP via Member BFF today; Firebase Auth path for social logins (V2)
- **Push:** FCM (today via expo-notifications) · **Analytics:** Mixpanel · **Crash:** Sentry

> Note: the blueprint names Firebase Auth + FCM. Today auth is phone-OTP through the
> Member BFF with member tokens + tenant-context. Social-login (Google/Apple/Firebase)
> is a V2 addition layered on top, not a replacement of the BFF session model.

---

## 10. Backend Modules (Member BFF)

Authentication · Membership · Attendance · Workout · Nutrition · Booking ·
Notifications · Payments · AI engine · Chat · Analytics.

Architecture: modular + scalable · API versioning (`/member/v1`) · rate limiting ·
RBAC. Member API contract lives in [`docs/Member api v1.openapi.yaml`](../docs/) and is
codegen'd to `src/api/contract.ts` via `npm run gen:api`.

---

## 11. Security

JWT + refresh tokens · role permissions · encrypted storage (expo-secure-store) ·
secure APIs · GDPR-friendly structure · idempotency + tenant-write guard (already on BFF).

---

## 12. Analytics

DAU · retention · workout completion · booking frequency · membership renewal ·
engagement · streaks.

---

## 13. Monetization (future)

Premium subscriptions · AI coach · trainer marketplace · nutrition plans ·
online coaching · supplement marketplace.

---

## 14. Development Phases

- **MVP:** Auth · Dashboard · QR check-in · Workout tracking · Class booking ·
  Membership · Notifications.
- **V2:** Nutrition · AI coach · Wearable sync · Community · Referrals.
- **V3:** Advanced AI · smart analytics · marketplace · smartwatch apps · habit engine.

---

## 15. UX Principles

Reduce cognitive load · increase motivation · encourage consistency · feel rewarding ·
build habits. Avoid clutter, slow loading, complicated forms, overwhelming dashboards.

---

## 16. Final Goal

The best gym-member fitness app — combining gym management, fitness tracking, health
monitoring, AI coaching, community engagement, and a premium UX into a world-class
fitness ecosystem.

---

## Rebuild Plan — Current State → Target

### Folder architecture (target)

```
gym-member-app/
  app/                      # expo-router routes (thin — screens compose features)
    (auth)/                 # splash, welcome, phone, otp, goal, choose-gym
    (app)/                  # tab group: home, workout, classes, progress, community
    checkin.tsx             # FAB modal route
    profile/                # membership, nutrition, settings, devices, payments, notifications
  src/
    design-system/          # primitives ONLY (design.md tokens) — no business logic
    features/<module>/      # one folder per Module 1–14: components + hooks + local state
    api/                    # client, endpoints, queries, generated contract, types
    auth/                   # session, secure-store, stores
    offline/                # outbox + sqlite cache
    lib/                    # format, query-client, uuid, etc.
    navigation/             # AuthGate, tab bar, FAB
```

### Current state (audit, 2026-06-02)

- **Design system is already aligned** to design.md (dark-first Geist tokens). Keep and
  extend — do not rewrite.
- **No image/font assets are tracked** — fonts load from `@expo-google-fonts`. So the
  "remove unwanted images" task is effectively N/A at the asset level; cleanup = dead
  and duplicated code, not files.
- **Built today:** phone-OTP auth, home (occupancy card), workout (exercise card, rest
  timer, submit), **classes (book/waitlist/cancel)**, progress (weight chart, photo
  upload), check-in submit, membership, **gym locations (nearest-branch finder)**,
  notifications, offline outbox.
- **IA — DONE (this session):** tab group is now Home/Workout/Classes/Progress/Community
  via the custom `src/navigation/TabBar.tsx`; Profile moved off the tab bar to a stack
  route opened from the Home header; QR check-in floats as a FAB. Locations is a stack
  route reached from Profile.
- **Missing modules to scaffold:** Community (12) is a placeholder; Exercise Library (5),
  Nutrition (7), Trainer Chat (10), AI Coach (11) not started.
- **Backend reality vs blueprint:** no workout/occupancy models yet, Razorpay is a stub
  (see memory `project_member_bff_phase0`). Blueprint features are gated on BFF support.

### Sequencing (one concern per session)

1. ~~**IA restructure** — tab bar → 5 tabs + FAB; move Profile to a stack route.~~ **DONE.**
2. ~~**Design-system completion** — Avatar, Chip, ListRow, SegmentedControl,
   ProgressRing, BarChart, LineChart, BottomSheet, Dialog (TabBar + FAB done).~~ **DONE.**
3. ~~**Home dashboard** rebuild against blueprint widget set.~~ **DONE (real-data subset):**
   streak ProgressRing + "week ahead" BarChart (classes/day) on top of the existing
   membership / workout / next-class / occupancy cards. **Backend gap:** calories, steps,
   water, and weekly *attendance* history aren't exposed by the BFF, so those Samsung-Health
   widgets are intentionally NOT shown (no fabricated health data). They land when the BFF
   adds the endpoints (and/or wearable sync, Module 14).
4. ~~**Check-in** polish.~~ **DONE:** premium scanner reticle (corner brackets +
   animated scan line via RN `Animated`), torch toggle, and a streak `ProgressRing` on
   the success screen. **Not done (need native/backend):** NFC, BLE auto-detect,
   fingerprint, face verify, peak-hours / crowd prediction.
5. ~~**Workout** rebuild.~~ **DONE:** mesh hero with a live session-progress ring
   (completed/target sets), exercise media thumbnails (`mediaUrl`), and PR celebration via
   the `Dialog` primitive. Existing set logging (steppers) + rest timer kept. **Not done
   (need backend):** prebuilt templates, exercise-library link, recovery tracking.
6. **Classes** module — real screen already shipped as the Classes tab; deeper features
   (recurring booking, calendar sync, trainer detail) remain.
7. **Membership** polish (freeze, upgrades, invoices, auto-renew).
8. **Progress** rebuild (BMI, body-fat, measurements, before/after slider).
9. Then V2 modules (Nutrition, AI Coach, Community, Trainer Chat, Exercise Library).

Each step: build behind the design system, run `tsc --noEmit`, show diff, stop for review.
