# Product Requirements Document (PRD)
## Gym Member App — "Member Super App" on top of your existing Gym SaaS

| | |
|---|---|
| **Product** | Member-facing mobile app (consumer) |
| **Platform context** | New client on an **existing multi-tenant gym SaaS** (shared database) |
| **Owner** | Phanendra |
| **Status** | Draft v1 — for build |
| **Companion doc** | `TRD_Member_App.md` (technical/architecture) |

---

## 0. How to read this document

This PRD defines **what** to build and **why**. The TRD defines **how**. The single most important constraint shaping both:

> You already run a multi-tenant SaaS for many gyms on one shared database. The member app does **not** get its own database. It reads and writes the **same data** as the admin/owner platform, but only through a **dedicated member API layer** (never direct DB access, never admin endpoints).

Everything below is written so that each feature maps to data that already exists (or will be added) in your SaaS, exposed via API.

---

## 1. Vision & Positioning

**Vision:** A daily-use fitness companion that a gym member opens multiple times a day — for check-in, workouts, progress, diet, and motivation — backed live by their gym's real data.

**Why this wins (your unfair advantage):** Standalone apps like HealthifyMe or Samsung Health don't know the member's *actual gym* — their membership, their trainer, their assigned plan, live occupancy, their attendance. **You do.** Your moat is the SaaS data, not the feature checklist. The product strategy is therefore: *be the best at the gym-connected experience first, then match the generic fitness-app features.*

**One-line positioning:** "Your gym, in your pocket — live."

**What we are NOT building (at least not first):** a generic step counter, a generic calorie app, or a clone of Samsung Health's full breadth. We differentiate on *gym connection* + *premium feel*, then expand.

---

## 2. Goals & Success Metrics

A "#1 app" is defined by retention and habit, not feature count. Targets to design toward:

| Goal | Metric | Target |
|---|---|---|
| Habit formation | DAU / MAU (stickiness) | ≥ 0.35 within 6 months |
| Daily utility | Avg. sessions per active user/day | ≥ 2.5 |
| Activation | % new members who complete check-in + log 1 workout in week 1 | ≥ 60% |
| Retention | D30 retention | ≥ 40% |
| Core loop | % members using QR check-in vs. front desk | ≥ 70% within 3 months |
| Renewal impact | Renewal rate of app-active vs. inactive members | +15 percentage points |
| Performance | Cold start | < 2s; screen load < 500ms; 60fps |
| Quality | Crash-free sessions | ≥ 99.5% |
| Rating | App store rating | ≥ 4.6 |

**North-star metric:** *Weekly Active Gym-Connected Members* — members who, in a 7-day window, did at least one gym-connected action (check-in, booked a class, logged an assigned workout, or messaged a trainer). This single metric captures the moat.

---

## 3. Personas

1. **Beginner (Ravi, 26)** — just joined, intimidated, needs guidance, check-in confidence, simple plans, motivation. *Churn risk is highest here.*
2. **Consistent regular (Sneha, 31)** — comes 4×/week, wants fast check-in, workout logging, progress graphs, class booking.
3. **Advanced lifter (Arjun, 29)** — tracks PRs, sets/reps, recovery; hates friction and typing.
4. **Women members (Divya, 34)** — value class booking (yoga/Zumba), privacy, safety, women-only slots, trainer trust.
5. **Trainer (Kiran)** — assigns plans/diets, monitors clients, messages members. *(Trainer features may live in the existing SaaS web/admin or a trainer mode — see scope.)*
6. **Gym owner** — not a member-app user, but the buyer; cares about retention, renewals, attendance data. The member app must feed their SaaS dashboards.

---

## 4. Problem Statement & User Insight

Gym members abandon fitness apps because they are generic, effortful, and disconnected from their real gym life. The jobs members actually hire an app for:

- "Let me **get in fast** without finding my card or queuing."
- "Tell me **what to do today** without thinking."
- "**Show me I'm progressing** so I stay motivated."
- "Let me **book my class** and know if there's space."
- "Let me reach **my trainer** easily."
- "Remind me, reward me, keep me coming back."

**Design rule that overrides everything (from your reference doc, kept):** members do not want complex dashboards, typing, confusing flows, slow loading, or clutter. They want fast actions, motivation, visible progress, easy booking, habit tracking, light gamification, and personalization.

---

## 5. Scope & Phased Roadmap (ruthless prioritization)

The GPT draft listed ~20 modules all as "must have." That's how apps ship late and feel mediocre. A #1 app ships an **excellent core loop** first, then expands. MoSCoW priority is applied per feature in §6.

### Phase 0 — Foundation (internal)
Auth, member API layer, tenant resolution, design system, navigation shell, analytics, push. No user-visible features yet; this is the platform everything sits on.

### Phase 1 — MVP: "Get in, train, see progress" (the core loop)
The minimum that makes the app open-worthy daily.
- Home dashboard (gym-connected)
- **QR check-in** + attendance (your killer feature, lowest effort, highest frequency)
- Membership status & expiry/renewal visibility
- Workout tracking (assigned plans + simple logging)
- Body progress (weight + photos + basic graphs)
- Profile, notifications, onboarding
- Live gym occupancy (read-only) — cheap to add, very "premium," drives daily opens

### Phase 2 — V1: "Engage & retain"
- Class booking (slots, waitlist, calendar)
- Trainer chat
- Streaks, challenges, leaderboards, badges (gamification)
- Diet/nutrition logging (start with India food DB + macros)
- Water/sleep/steps via wearable sync (Health Connect / HealthKit)

### Phase 3 — V2: "Differentiate & monetize"
- AI fitness coach (suggestions, AI workout/meal plans)
- Community feed, referrals
- Supplement/store, trainer marketplace, premium plans
- Advanced wearable insights (Fitbit/Garmin), face/NFC/BLE check-in

> Rule of thumb: **don't start Phase 2 until Phase 1 hits its activation and D30 targets.** Adding features to a leaky bucket is the #1 way fitness apps fail.

### Explicitly out of scope (for now)
- Owner/admin management features (those stay in your existing SaaS web app).
- Building a food database from scratch (license/integrate instead — see TRD).
- Generic non-gym social network features.

---

## 6. Feature Requirements

Each module lists priority, key user stories, acceptance criteria, and **the SaaS data it touches** (so it maps to your shared DB via API).

### 6.1 Onboarding & Auth — *(Must, Phase 1)*
**Stories**
- As a new member, I sign in with my **phone + OTP** (India-first; email optional) so I don't manage passwords.
- As a member, the app **finds my gym automatically** from my membership so I never pick a tenant manually.
- As a returning user, I unlock with **biometric** (Face/fingerprint) after first login.

**Acceptance criteria**
- OTP login succeeds in < 30s; session persists; biometric re-auth optional.
- On first login, the app resolves the member's `gym_id` (tenant) server-side from their record — never asked from the user.
- Clean 3–4 screen onboarding capturing goal (lose fat / build muscle / general fitness), experience level, and notification permission.

**SaaS data:** `members`, `gyms/tenants`, `memberships`. (Member already exists in your SaaS; app authenticates against it.)

---

### 6.2 Home Dashboard — *(Must, Phase 1)*
Inspired by Samsung Health's *principles* (not its UI): card-based, spacious, rounded, dynamic greeting, dark/light mode.

**Stories**
- As a member, I open the app and instantly see: today's plan, my streak, membership status, upcoming class, gym occupancy now, and a check-in button.
- As a member, I see a personalized greeting and 1 motivational/AI nudge.

**Acceptance criteria**
- Dashboard renders from cache in < 500ms, then live-refreshes.
- Cards are reorderable later; v1 fixed order driven by relevance.
- Membership expiry shows a clear warning at ≤ 7 days.

**SaaS data:** `attendance`, `memberships`, `assigned_workouts`, `class_bookings`, `occupancy` (live), `streaks`.

---

### 6.3 Gym Check-In — *(Must, Phase 1; advanced methods Phase 3)*
Your highest-frequency, highest-value, lowest-effort feature. **Lead with QR.**

**Stories**
- As a member, I tap one floating button, show a **QR**, and I'm checked in — entry logged automatically.
- As a member, I see **live occupancy** and peak-time hints so I can avoid crowds.

**Acceptance criteria**
- QR check-in completes in < 2s end to end; works offline-queued if network drops, syncs on reconnect.
- Entry/exit logged to the same attendance store the owner's SaaS dashboard reads.
- Occupancy updates in near real-time (≤ 10s).
- Phase 3: NFC, BLE beacon auto-detect, fingerprint, face, manual backup.

**SaaS data:** `attendance/check_ins`, `occupancy`, `gym_devices/turnstiles`. *Writes here must appear instantly in the owner SaaS — shared DB makes this native.*

---

### 6.4 Workout Tracking — *(Must, Phase 1; AI recs Phase 3)*
Like Samsung Health + Hevy.

**Stories**
- As a member, I see my **trainer-assigned workout** for today and complete it with swipe-to-log sets/reps.
- As a lifter, I track PRs and view history.
- As a member, I can pick a prebuilt plan if none is assigned.

**Acceptance criteria**
- One-thumb interaction; big buttons during workout; minimal typing (steppers, last-value prefill, swipe-to-complete).
- Rest timer with haptics.
- Logged workouts persist offline and sync.
- PR auto-detected and celebrated.

**SaaS data:** `workout_plans`, `assigned_workouts`, `exercises`, `workout_logs`, `personal_records`. Trainer assignment originates in your SaaS; the app reads it and writes back completion.

---

### 6.5 Body Progress — *(Must, Phase 1)*
Psychologically the strongest retention lever. Keep simple but beautiful.

**Stories**
- As a member, I log weight and see a trend graph.
- As a member, I capture transformation photos in a private, consistent way and use a before/after slider.

**Acceptance criteria**
- Weight + BMI auto-calc; graph over time; weekly summary.
- Photos stored privately and securely (see TRD security); never auto-shared.
- Optional measurements (waist, arms) and body-fat % if provided.

**SaaS data:** `body_metrics`, `progress_photos` (references; media in object storage), `goals`.

---

### 6.6 Membership & Billing — *(Must read-only Phase 1; transactions Phase 2)*
**Stories**
- As a member, I see my plan, status, expiry, and invoice history.
- As a member, I renew/upgrade in one tap; freeze membership; manage add-ons/family plans.

**Acceptance criteria**
- Clear expiry warnings and payment reminders.
- One-click renewal via **UPI/Razorpay** (India-first), with auto-renew option.
- Invoices reflect the same billing records as the SaaS.

**SaaS data:** `memberships`, `plans`, `invoices`, `payments`, `addons`. Payments must reconcile with the owner SaaS billing — do not create a parallel billing system.

---

### 6.7 Class Booking — *(Should, Phase 2)*
Inspired by Cult.fit.

**Stories**
- As a member, I see live slots, trainer profiles, seat availability, and book in one tap; join a waitlist; set recurring bookings; add to calendar.

**Acceptance criteria**
- Real-time seat counts; no overbooking (server-side capacity enforcement).
- Booking/cancel reflected instantly to trainers/owner.
- Class types: yoga, CrossFit, Zumba, HIIT, personal training.

**SaaS data:** `classes`, `class_schedule`, `bookings`, `waitlists`, `trainers`.

---

### 6.8 Nutrition & Diet — *(Should, Phase 2)*
Like HealthifyMe, **India-first food DB.**

**Stories**
- As a member, I log meals (search + barcode), track macros/calories/water.
- As a member, I follow my trainer's diet plan; switch modes (weight-loss/muscle-gain/keto/vegan).

**Acceptance criteria**
- Indian food database with regional items (license/integrate, don't build from zero).
- Macro rings; water tracker; AI meal suggestions in Phase 3.

**SaaS data:** `diet_plans` (trainer-assigned), `meal_logs`, `nutrition_goals`. Food DB is typically a 3rd-party/external dataset, not your tenant DB.

---

### 6.9 Trainer Communication — *(Should, Phase 2)*
**Stories**
- As a member, I chat with my assigned trainer; receive plan updates and nudges.

**Acceptance criteria**
- Real-time 1:1 chat scoped to the member's gym; trainer identity from SaaS; media support; read receipts.
- Abuse/safety: report/block; trainers limited to their own clients.

**SaaS data:** `trainers`, `trainer_assignments`, `messages/threads`.

---

### 6.10 Community & Gamification — *(Could, Phase 2–3)*
**Stories**
- As a member, I keep streaks, join challenges, climb leaderboards, earn badges, refer friends, and share workouts.

**Acceptance criteria**
- Streak logic tied to check-ins/workouts; leaderboards scoped per gym by default (privacy-safe).
- Referral attribution feeds owner SaaS.

**SaaS data:** `streaks`, `challenges`, `badges`, `referrals`, `leaderboards`.

---

### 6.11 Wearable Integration — *(Should, Phase 2–3)*
**Stories**
- As a member, I sync steps/sleep/heart rate from Health Connect (Android), Apple HealthKit (iOS); later Fitbit/Garmin.

**Acceptance criteria**
- Read steps/sleep/HR/active calories; clear permission UX; graceful when unavailable.
- No raw health data leaves device without explicit consent (see privacy).

**SaaS data:** `wearable_metrics` (mostly device-sourced; store aggregates only).

---

### 6.12 AI Fitness Coach — *(Could, Phase 3 — your USP later)*
**Stories**
- As a member, I get daily suggestions, recovery advice, AI-generated workouts/meals, and a motivation assistant grounded in *my* gym data (plan, attendance, progress).

**Acceptance criteria**
- Suggestions personalized using the member's real SaaS data (RAG/context, not generic).
- Safety guardrails; never gives medical/diagnostic advice; defers to trainers for plan changes.

**SaaS data:** reads `workout_logs`, `body_metrics`, `attendance`, `goals` as context.

---

## 7. Non-Functional Requirements

- **Performance:** cold start < 2s, screen < 500ms, 60fps, lazy loading, offline caching, background sync. *Test on low-end Android (₹10–15k phones), not just flagships — that's your real Indian user.*
- **Offline-first:** check-in, workout logging, meal logging must work offline and sync.
- **Accessibility:** large touch targets, dynamic type, sufficient contrast, screen-reader labels.
- **Localization:** English first; architecture ready for Telugu/Hindi/regional languages.
- **Privacy & compliance:** health data is sensitive personal data under India's **DPDP Act 2023** (and GDPR if you ever serve EU). Explicit consent, data export/delete, encryption. (Details in TRD.)
- **Reliability:** crash-free ≥ 99.5%; graceful degradation when a gym/tenant feature is disabled.
- **Theming:** dark/light; per-gym light branding (logo/accent) since multi-tenant.

---

## 8. Data & Integration Summary (shared-DB reality)

The member app is a **consumer** of your SaaS domain. Conceptually:

- **Read-mostly from SaaS:** gym info, membership, plans, assigned workouts, diet plans, classes, trainers, occupancy.
- **Write back to SaaS:** check-ins, workout logs, body metrics, bookings, meal logs, payments, messages.
- **Device/3rd-party-sourced (not your tenant DB):** wearable raw metrics, food database, push tokens.

Mapping every feature to existing/added SaaS entities (as above) is what keeps the owner dashboards and the member app perfectly in sync — that consistency *is* the premium feel. The **how** (member API layer, multi-tenant scoping, no direct DB access) is the TRD.

---

## 9. Analytics & Instrumentation

Track from day one (you can't optimize retention blind):
- Activation funnel (install → login → first check-in → first workout).
- Core-loop frequency (check-ins, workouts logged, classes booked per week).
- Feature adoption, retention cohorts (D1/D7/D30), churn signals (membership expiring + low app activity).
- Push/notification CTR; AI suggestion acceptance (Phase 3).

Tooling in TRD (e.g., product analytics + crash reporting). Feed key signals back to the owner SaaS so gyms see member engagement.

---

## 10. Monetization (later — don't gate the core loop)

Keep Phase 1 fully free to drive habit; monetize once retention is proven: premium plans, AI coach subscription, supplement store, trainer marketplace, paid nutrition/online coaching, paid challenges. Revenue share with gyms can become a SaaS upsell.

---

## 11. App Structure (navigation)

Bottom nav (5, matching the reference): **Home · Workout · Classes · Progress · Community.** Floating **QR check-in** button persistent on Home (and reachable globally). Profile/Settings/Notifications/AI Coach reachable from Home header/profile, not the bottom bar (keep it to 5).

Phase 1 nav can collapse Classes/Community placeholders until those phases ship — don't show empty tabs.

---

## 12. Risks, Assumptions, Open Questions

**Assumptions**
- Your SaaS already stores members, memberships, attendance, plans, trainers, classes, billing (or these are addable).
- Owner SaaS remains the source of truth; the member app never bypasses it.

**Risks**
- *Scope creep* (the GPT "everything is must-have" trap) → mitigated by phasing.
- *Performance on low-end Android* → mitigated by framework choice + perf budget (TRD).
- *Health-data compliance* → mitigated by consent + DPDP alignment (TRD).
- *Multi-tenant data leaks* → the single biggest technical risk; mitigated by server-side tenant scoping (TRD §multi-tenancy).

**Open questions (please confirm — they affect the TRD)**
1. Current SaaS **backend stack** (Node/NestJS? something else?) and DB (the draft assumed PostgreSQL).
2. Member app **framework**: the draft assumed React Native; you're an Angular dev — see the TRD's Framework Decision and tell me your preference.
3. Existing **auth** in your SaaS (JWT? sessions?) and whether members already have accounts.
4. Payments provider already integrated (Razorpay/Stripe/other?).

---

*Build the Phase-1 core loop superbly. Connection to real gym data + speed + visible progress is what makes it #1 — not the length of the feature list.*
