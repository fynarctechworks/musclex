# Information Architecture — Member App

> Defines the app's structure: navigation model, screen map, content hierarchy, and the rules
> for what goes where. Consistent with `PRD_Member_App.md §11` (5-tab bottom nav + floating QR).

---

## 1. Navigation model

**Bottom tab bar (max 5, never more):**

```
┌──────────────────────────────────────────────────────────┐
│                                                            │
│                    [ screen content ]                      │
│                                                            │
│                         ( + )  ← floating QR check-in      │
├──────────────────────────────────────────────────────────┤
│  🏠 Home   🏋 Workout   📅 Classes   📈 Progress   👥 Community │
└──────────────────────────────────────────────────────────┘
```

- **Floating QR check-in button**: persistent, center, always one thumb away. It is the highest-frequency action and the moat feature — it gets the most prominent control in the app.
- **Header (per screen)**: left = contextual title/greeting; right = notifications bell + avatar (→ Profile/Settings/AI Coach). These do **not** earn a bottom-tab slot.

### Progressive disclosure of tabs by phase
Empty tabs feel broken. Reveal tabs as their phase ships:

| Phase | Visible tabs |
|---|---|
| Phase 1 (MVP) | Home · Workout · Progress  (+ floating QR). Classes & Community hidden. |
| Phase 2 | + Classes · Community |
| Phase 3 | (same 5; new features surface *inside* existing tabs + AI Coach in header) |

> Current code already scaffolds Home/Workout/Progress/Profile routes — matches Phase 1.

---

## 2. Screen map (hierarchy)

```
App
├── (auth)                         ← unauthenticated stack
│   ├── welcome
│   ├── phone            (enter phone → request OTP)
│   ├── otp              (verify → mint member token)
│   ├── choose-gym       (if phone maps to >1 gym)
│   └── goal             (onboarding: pick fitness goal)
│
└── (app)                          ← authenticated, tabbed
    ├── Home  ★ default
    │   ├── [floating] QR check-in  → checkin (modal/route)
    │   ├── greeting + AI nudge
    │   ├── today's workout card    → Workout detail
    │   ├── live occupancy card
    │   ├── streak / activity rings
    │   ├── membership status strip → Membership
    │   └── upcoming class (P2)     → Classes
    │
    ├── Workout
    │   ├── today's assigned plan
    │   ├── exercise detail         (sets/reps logging, RestTimer)
    │   ├── workout history
    │   └── PRs
    │
    ├── Classes  (Phase 2)
    │   ├── schedule / slots
    │   ├── class detail            (trainer, seats, waitlist)
    │   └── my bookings
    │
    ├── Progress
    │   ├── weight + measurements   (WeightChart)
    │   ├── transformation photos   (blocked: storage signing)
    │   ├── body metrics (BMI, fat%)
    │   └── weekly report
    │
    ├── Community  (Phase 2–3)
    │   ├── challenges / leaderboards
    │   ├── badges / achievements
    │   └── feed (Phase 3)
    │
    └── [header-reachable, not tabs]
        ├── checkin           (QR scanner + success)
        ├── membership        (status, invoices, renew[P2])
        ├── notifications
        ├── profile
        ├── settings          (theme, units, consent/privacy, logout)
        └── AI Coach          (Phase 3)
```
★ = launch destination. (app) routes already exist in `gym-member-app/app/(app)/`.

---

## 3. Content hierarchy rules (what leads each screen)

The PRD's overriding rule (fast actions, visible progress, low clutter) becomes concrete ordering:

| Screen | Top of screen (first glance) | Middle | Bottom / scroll |
|---|---|---|---|
| **Home** | Greeting + the *one* most motivating signal (streak or today's workout) | Live occupancy, membership strip | Secondary widgets, nudges |
| **Workout** | Today's assigned workout (1 tap to start) | History summary | PRs, browse plans |
| **Progress** | The chart that motivates *this* user (research Q4) | Photos / before-after | Detailed metrics |
| **Membership** | Status + expiry (color-coded urgency) | Renew CTA (P2) | Invoice history |

Rule: **one primary action per screen, above the fold, reachable one-thumbed.** Everything else is secondary.

---

## 4. Global patterns

- **Empty states are designed, not blank.** A workout with no assigned plan shows "Your trainer hasn't assigned a plan yet" + a fallback (browse plans), never an empty list. (Directly addresses the current "workout shows empty" reality.)
- **Loading = skeletons**, never spinners on full screens (Skeleton primitive already exists).
- **Errors = inline + recoverable**, using the BFF's error envelope. Never a raw stack or a dead screen.
- **Offline:** read-cached data shows with a subtle "offline" marker; writes (check-in, set logs) queue via the existing outbox and sync on reconnect.

---

## 5. Notification IA (habit engine)

Notifications are part of the IA because they drive re-entry. Categories + default policy:

| Category | Example | Default | Deep-links to |
|---|---|---|---|
| Habit | "You haven't trained in 3 days" | On | Home / Workout |
| Membership | "Renews in 5 days" | On | Membership |
| Class (P2) | "Your 6 PM Yoga starts in 1h" | On | Class detail |
| Social (P2/3) | "Sneha passed you on the leaderboard" | Opt-in | Community |
| AI Coach (P3) | "Try this recovery tip" | Opt-in | AI Coach |

**Frequency cap** (anti-spam, protects trust): ≤ 1 habit nudge/day, ≤ 1 social/day. Validated in research Q8.

---

## 6. Search & discovery

Phase 1 has **no global search** (deliberate — members navigate, they don't search a 5-tab app).
Add scoped search only where lists grow: exercise library (Workout), food DB (Nutrition, P2).
