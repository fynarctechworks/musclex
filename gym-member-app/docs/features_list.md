# MuscleX Member App — Features List (Build + Test Tracker)

> **This is the source of truth for what is actually built and tested.**
> The *vision* and feature rationale live in [`MEMBER_APP_MASTER_PLAN.md`](./MEMBER_APP_MASTER_PLAN.md);
> the code-derived module snapshot lives in [`FEATURE_INVENTORY.md`](./FEATURE_INVENTORY.md).
> **This file** is updated **only when a feature ships and is verified** — per the brief:
> _"update after fully development completed with testing."_
>
> ### Status columns
> - **Build:** ✅ done · 🟡 partial · ❌ not started
> - **Test:** how it was verified — `tsc` (type-checks clean) · `runtime` (ran in web/dev and observed working) · `device` (verified on a native dev-build) · `unit` (Jest, backend only) · `none` (not yet verified) · `n/a` (native-only, cannot verify from here)
> - A feature is only **"fully developed + tested"** when **Build = ✅ AND Test ≠ none**.
>   Native/wearable features need **Test = device** before they count as proven.
>
> ### Update protocol (every slice)
> 1. Build the slice.
> 2. Run `gym-member-app/node_modules/.bin/tsc --noEmit` (no Jest in this app).
> 3. Where possible, verify at runtime (`npm run web`) and/or on a device dev-build.
> 4. Flip the row's **Build**/**Test** cells and date the change in the changelog at the bottom.
> 5. Never mark a row tested on a guess. Unverified = `none`, and say so.
>
> Phases: **MVP** (now) · **V2** (next) · **V3** (later) · **F** (Future/experimental).
> Seeded: **2026-06-03** from `FEATURE_INVENTORY.md` + verified prior session work.

---

## 1. Authentication & onboarding
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Phone OTP login | MVP | ✅ | runtime | `(auth)/phone`, `otp` |
| Dev OTP bypass (7386648648 / 000000) | MVP | ✅ | runtime | prod-gated off |
| Choose gym | MVP | ✅ | runtime | `(auth)/choose-gym` |
| Goal selection | MVP | ✅ | runtime | `(auth)/goal` |
| Onboarding intro / personalization | MVP | 🟡 | runtime | `onboarding/intro` |
| Email login | MVP | ❌ | none | — |
| Google sign-in | V2 | ❌ | none | — |
| Apple sign-in | V2 | ❌ | none | — |
| Biometric (Face/fingerprint) app unlock | V2 | ❌ | none | device-only |

## 2. Home dashboard
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Streak ring | MVP | ✅ | runtime | `(app)/home` |
| Week-ahead chart | MVP | ✅ | runtime | — |
| Live occupancy widget | MVP | ✅ | runtime | — |
| Health card | MVP | ✅ | runtime | — |
| Activity rings | MVP | ✅ | runtime | move/exercise/stand |
| Membership / class widgets | MVP | ✅ | runtime | — |
| AI recommendations widget | V2 | ❌ | none | needs AI Coach |
| Dynamic/personalized widgets | V2 | 🟡 | runtime | — |

## 3. Gym check-in
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| QR scan check-in | MVP | ✅ | runtime | `checkin.tsx` (camera native-only) |
| Live occupancy | MVP | ✅ | runtime | — |
| NFC entry | V3 | ❌ | none | — |
| BLE auto-detect entry | V3 | ❌ | none | — |
| Face verify entry | V3 | ❌ | none | highest security tier |
| Peak-hours / crowd prediction | V2 | ❌ | none | ML feature |

## 4. Workout tracking
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Set/rep/weight logging | MVP | ✅ | runtime | `(app)/workout` |
| Rest timer | MVP | ✅ | runtime | — |
| Trainer-assigned workouts | MVP | ✅ | runtime | — |
| Exercise cards | MVP | ✅ | runtime | — |
| PR tracking + celebration | V2 | 🟡 | none | deeper tracking pending |
| Routine templates / reuse | V2 | 🟡 | none | — |
| Progressive-overload suggestions | V2 | ❌ | none | — |
| Recovery/fatigue-aware workouts | V3 | ❌ | none | needs health scores |
| AI workout generation | V3 | ❌ | none | — |
| HR-zone training | V3 | ❌ | none | needs wearable verify |
| GPS / outdoor / sports tracking | V3 | ❌ | none | — |
| Workout streaks / heatmaps | V2 | 🟡 | runtime | — |

## 5. Exercise library
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Browse / search | V2 | ✅ | runtime | `exercises.tsx` (seeded 33/gym) |
| Muscle-group filter | V2 | ✅ | runtime | — |
| Exercise detail | V2 | ✅ | runtime | `exercise/[id].tsx` |
| Favorites (optimistic) | V2 | ✅ | runtime | — |
| Video demos | V2 | 🟡 | runtime | static images only |

## 6. Body progress
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Weight / measurements logging | MVP | ✅ | runtime | `(app)/progress`, `body.tsx` |
| Transformation photos | MVP | ✅ | runtime | — |
| Charts | MVP | ✅ | runtime | — |
| Before/after compare | MVP | ✅ | runtime | — |
| BMI / body-fat | V2 | 🟡 | runtime | — |
| AI body insights / forecasting | F | ❌ | none | — |

## 7. Nutrition
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Calorie + macro tracking | V2 | ✅ | runtime | `nutrition.tsx` (V2.1 shipped) |
| Meal logging | V2 | ✅ | runtime | — |
| Water logging | V2 | ✅ | runtime | — |
| Food search + catalog (Indian foods) | V2 | ✅ | runtime | — |
| Goals | V2 | ✅ | runtime | `settings/goals` |
| Barcode scanner | V2 | ❌ | none | — |
| AI photo meal recognition | V3 | ❌ | none | — |
| Diet plans (loss/gain/keto/vegan) | V3 | ❌ | none | — |
| Micronutrients | V3 | ❌ | none | — |
| Intermittent fasting | V3 | ❌ | none | — |
| Supplements | V3 | ❌ | none | — |

## 8. Class booking
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Browse classes | MVP | ✅ | runtime | `(app)/classes` |
| Book | MVP | ✅ | runtime | — |
| Cancel (ConfirmDialog) | MVP | ✅ | runtime | — |
| Waitlist | V2 | ❌ | none | — |
| Recurring booking | V2 | ❌ | none | — |
| Calendar sync | V2 | ❌ | none | — |

## 9. Membership & payments
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Membership details / expiry | MVP | ✅ | runtime | `membership.tsx` |
| Invoices | MVP | ✅ | runtime | — |
| Renew flow (UI) | MVP | 🟡 | runtime | UI only |
| **Real Razorpay payments** | MVP | ❌ | none | ⚠️ **STUB — no money moves. HARD GATE.** |
| Plan upgrade / freeze / auto-renew | V2 | ❌ | none | — |
| Family / multi-member plans | V3 | ❌ | none | — |
| Premium member subscription tier | V2 | ❌ | none | monetizes AI/recovery layer |

## 10. Trainer communication
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| 1:1 text chat (member↔trainer) | V2 | ✅ | runtime | `messages.tsx`, `chat/[trainerId].tsx` |
| Polling refresh | V2 | ✅ | runtime | — |
| Offline-safe optimistic send | V2 | ✅ | runtime | — |
| Voice notes | V2 | ❌ | none | — |
| Image attachments | V2 | ❌ | none | — |
| Real-time WebSocket | V2 | ❌ | none | currently polling |

## 11. AI fitness coach  *(headline gap — entire module absent)*
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| AI coach chat (grounded, explainable) | V2 | ❌ | none | #1 competitive gap |
| Daily fitness / readiness score | V3 | ❌ | none | the "one number" |
| Adaptive / recovery-aware recs | V3 | ❌ | none | — |
| Smart reminders / motivation engine | V2 | ❌ | none | — |
| AI nutritionist | V3 | ❌ | none | — |
| Anomaly / health-alert detection | F | ❌ | none | highest sensitivity |

## 12. Community
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Leaderboard (real check-ins) | V2 | ✅ | runtime | `(app)/community` |
| Challenges (real tables, computed) | V2 | ✅ | runtime | — |
| Badges (computed) | V2 | ✅ | runtime | — |
| XP / levels | V2 | 🟡 | runtime | — |
| Group / team / gym challenges | V3 | 🟡 | none | — |
| Social feed (posts/reactions/comments) | V3 | ❌ | none | — |
| Transformation sharing | V3 | ❌ | none | — |
| In-app referral rewards | V2 | 🟡 | none | backend anti-fraud exists |
| Stories / reels | F | ❌ | none | — |
| Creator / livestream | F | ❌ | none | — |
| Moderation / anti-abuse | V3 | ❌ | none | gates social launch |

## 13. Notifications
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Device-token register/delete | MVP | ✅ | runtime | — |
| Expo send capability (server) | MVP | ✅ | unit | backend |
| In-app notifications screen | MVP | ✅ | runtime | `notifications.tsx` |
| Real push delivery | MVP | 🟡 | none | ⚠️ needs FCM creds + EAS projectId |
| Deep-link / badge / preferences | V2 | 🟡 | none | client handlers partial |
| Smart / batched reminders | V2 | ❌ | none | — |

## 14. Health & wearables  *(native reads UNVERIFIED until device build)*
| Feature | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Health platform (samples/daily/connections) | V3 | ✅ | runtime | BFF + facade |
| HealthKit bridge (iOS) | V3 | 🟡 | n/a | ⚠️ **device-unverified** |
| Health Connect bridge (Android) | V3 | 🟡 | n/a | ⚠️ **device-unverified** |
| Health screen | V3 | ✅ | runtime | `health.tsx` |
| Sleep screen / score | V3 | 🟡 | runtime | `sleep.tsx` (UI; data unverified) |
| Heart screen / HR | V3 | 🟡 | runtime | `heart.tsx` |
| Activity screen | V3 | ✅ | runtime | `activity/index.tsx` |
| Mindfulness screen | V2 | 🟡 | runtime | `mindfulness/index.tsx` |
| HRV / stress / readiness score | V3 | ❌ | none | the "one number" |
| Menstrual / cycle tracking | V3 | ❌ | none | highest sensitivity |
| Samsung Health | V3 | ❌ | none | gates G1–G5 planned |
| Fitbit / Garmin / Oura (cloud OAuth) | F | ❌ | none | — |
| Smart scale / BP / glucose / CGM | F | ❌ | none | — |

## 15. Cross-cutting: design system, perf, security
| Item | Phase | Build | Test | Notes |
|---|---|---|---|---|
| Geist dark-first DS tokens + primitives | MVP | ✅ | runtime | `src/design-system` |
| Activity rings + haptics + health accents | MVP | ✅ | runtime | Samsung Phase A slice 1 |
| Charts / bottom-sheet / FAB / chips primitives | MVP | 🟡 | runtime | some pending (BLUEPRINT §6) |
| Celebration moments (PR/ring/streak) | V2 | 🟡 | none | — |
| Accessibility (WCAG AA / dynamic type / reduced-motion) | V2 | ❌ | none | — |
| Web-target stability (sqlite/secure-store splits) | MVP | ✅ | runtime | fixed 2026-06-02 |
| Debounced search + background-poll pause | MVP | ✅ | runtime | perf QA |
| Analytics (PostHog HTTP sink, env-gated) | V3 | ✅ | runtime | no-op without key |
| JS error capture → facade | V3 | ✅ | runtime | — |
| Tenant isolation (member models in tenant-models.ts) | MVP | ✅ | unit | backend, single-sourced |

---

## Summary counts (2026-06-03 seed)
- **Fully developed + tested (✅ build, non-`none` test):** core MVP gym loop — auth, home, QR check-in, workout logging, classes, body progress, nutrition, exercise library, trainer chat, community, design system. (Web `runtime` verified; native-only paths are `n/a`/device-pending.)
- **Partial (🟡):** PR tracking, referrals, push delivery, health/wearable native reads, celebration polish.
- **Not started (❌) — highest priority:** **real payments**, **AI Coach**, readiness "one number", barcode/AI nutrition, social feed, advanced check-in, Samsung/cloud wearables.
- **Cannot be marked proven from here:** anything `Test = n/a` (native/camera/biometric/wearable) — requires a device dev-build (post-G3).

## Changelog
- **2026-06-03** — Tracker created and seeded from `FEATURE_INVENTORY.md` + verified prior-session work. Companion to `MEMBER_APP_MASTER_PLAN.md`. No new code shipped this entry; status reflects existing state only.
