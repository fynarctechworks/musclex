# Master Feature Matrix — Complete Inventory, Scoring & Classification

**Date:** 2026-06-03 · **Author:** Claude Code (analysis only — no code/schema changed)

> This is the consolidated, scored, single-table view that the rest of this pack
> (`00`–`07`) deferred to companion docs. It does **not** replace them — read `02`
> for the competitor-by-competitor matrix, `04` for retention mechanics, `06` for the
> phased roadmap. This doc answers: *"For every feature, what is it, do we have it,
> how much does it matter, and how hard is it?"* in one place.
>
> **Grounding rule (CLAUDE.md #8):** every **Status** value is verified against the
> codebase / project memory as of 2026-06-03. Competitor "inspiration" is product
> knowledge as of the Jan-2026 cutoff. Nothing in the Status column is invented; where
> a competitor capability is asserted it is labeled in `01`/`02`, not here.

---

## How to read the scores

Four 1–5 axes per feature. **Higher is always "more / better"** — including complexity,
where 5 = *simplest to build for us* (so every column reads "bigger number = more attractive").

| Axis | 1 | 5 |
|---|---|---|
| **Pri** — strategic priority *for our gym-attached model* | irrelevant to us | do-it-now |
| **Ret** — member retention impact (D7/D30, real attendance) | negligible | category-defining |
| **Scal** — architectural scalability (multi-tenant safe, low marginal cost) | risky / per-gym cost | scales free |
| **Ease** — inverse of build complexity (reuse vs greenfield) | large greenfield | cheap reuse |

**Status legend:** ✅ Built (shipped & verified) · 🟡 Partial · ⬜ Not started · 🔭 Future roadmap · ➖ Unnecessary / not-our-game

**"Build state" classification** (final column): **MVP** (have it or Tier-0/1) · **V2** (Tier-2) · **V3** (Tier-3) · **NO** (deliberately excluded).

> ⚠️ Items marked 🔒 touch **schema / payments / auth** → require explicit confirmation
> + a tenant-isolation review before any implementation (CLAUDE.md #3).

---

## SECTION 1 — Core fitness / health signals (Samsung · Fitbit · Apple · WHOOP)

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Steps / active minutes | Samsung, Fitbit | ⬜ | 4 | 4 | 4 | 2 | V2 | Comes *free* with wearable sync — don't build standalone pedometer |
| Calories burned | Fitbit, Apple | ⬜ | 3 | 3 | 4 | 2 | V2 | Derived from synced HR/activity, not first-party |
| Exercise / workout tracking | all | ✅ | 5 | 5 | 5 | — | MVP | Shipped; our spine |
| Workout history | all | ✅ | 4 | 4 | 5 | — | MVP | Shipped |
| Heart rate / HR zones | Fitbit, WHOOP | ⬜ | 3 | 4 | 4 | 2 | V2 | Sync-dependent |
| Sleep tracking / score | Fitbit, Samsung | ⬜ | 3 | 4 | 4 | 2 | V2 | Sync-dependent; high ambient-retention value |
| Recovery / readiness score | WHOOP, Fitbit | ⬜ | 4 | 4 | 3 | 2 | V2 | The WHOOP moat; needs sleep+HRV → needs sync first |
| HRV / stress tracking | WHOOP, Samsung | ⬜ | 2 | 3 | 3 | 2 | V2 | Bundle into readiness, not standalone |
| SpO₂ / oxygen | Samsung, Fitbit | ⬜ | 1 | 2 | 4 | 2 | 🔭 | Display-only passthrough at best |
| Hydration | Samsung, Healthify | 🟡 | 2 | 3 | 5 | 4 | V2 | Trivial counter; low standalone value, good streak input |
| Menstrual / cycle tracking | Samsung, Apple | ⬜ | 2 | 3 | 4 | 3 | 🔭 | 🔒 sensitive health data — privacy review required |
| Body composition / weight trend | Samsung, MFP | 🟡 | 3 | 3 | 5 | 3 | V2 | Have progress photos/measurements; add weight-trend line + smart-scale sync |
| Mood tracking | Samsung | ⬜ | 2 | 2 | 5 | 4 | 🔭 | Cheap; weak ROI unless tied to AI insight |
| Energy / "body energy" score | Garmin, Samsung | ⬜ | 2 | 3 | 3 | 1 | 🔭 | Composite of everything above — last, not first |
| Recovery recommendations | WHOOP, Fitbit | ⬜ | 3 | 3 | 4 | 2 | V2 | Output of readiness + our AI coach |

**Section verdict:** We track *gym behavior*, not *body signals*. The entire section is
gated on **one** capability — **wearable sync** (Section 8). Build the ingestion layer once;
steps/HR/sleep/readiness/calories all light up together. Do **not** build standalone trackers.

---

## SECTION 2 — Gym management member experience (our home turf)

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Memberships / timeline | — | ✅ | 5 | 4 | 5 | — | MVP | Shipped |
| Renewals | — | ✅ (B2B) | 4 | 3 | 5 | — | MVP | Backend solid; member-side self-renew needs payments 🔒 |
| Attendance / check-in (QR) | — | ✅ | 5 | 5 | 5 | — | MVP | **Unique vs all 7 competitors** |
| Biometric / facial check-in | — | ✅ | 4 | 4 | 4 | — | MVP | pgvector; our deepest moat |
| NFC access | — | ⬜ | 2 | 2 | 4 | 2 | 🔭 | Hardware-dependent per gym; QR already covers the job |
| Gym occupancy (live) | — | ⬜ | 3 | 4 | 3 | 2 | V2 | No occupancy model yet (memory); strong FOMO/utility driver |
| Trainer assignment | — | ✅ | 4 | 4 | 5 | — | MVP | Shipped |
| Class booking | Cult | ✅ | 5 | 4 | 5 | — | MVP | On par with Cult core |
| Waitlists | Cult | 🟡 | 3 | 3 | 4 | 3 | V2 | Verify depth; classic scarcity lever |
| Freeze / pause membership | — | ⬜ | 3 | 3 | 4 | 3 | V2 | 🔒 billing-adjacent |
| Upgrade / change plan | — | 🟡 | 3 | 3 | 4 | 3 | V2 | 🔒 needs payments |
| Invoices | — | ✅ (B2B) | 3 | 2 | 5 | — | MVP | Backend exists |
| Payments (member-facing) | Cult, Healthify | ❌ | 5 | 3 | 4 | 3 | **MVP-blocker** 🔒 | **Razorpay is a stub — blocks ALL member monetization** |
| Referral system | — | ✅ (B2B) | 3 | 3 | 4 | — | MVP | Anti-fraud shipped; expose to members |
| Family / multi-member plans | Cult | ⬜ | 2 | 3 | 3 | 2 | 🔭 | 🔒 schema + billing; defer |

**Section verdict:** This is where we **already win**. Defend it. The one ❌ — real
payments — is the single highest-leverage unblock in the whole product (Tier 0 in `06`).

---

## SECTION 3 — Workout ecosystem (Nike TC · Strong · Hevy · Fitbod)

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Workout logging (sets/reps/weight) | Strong, Hevy | ✅ | 5 | 5 | 5 | — | MVP | Shipped |
| Personal records / PRs | Strong, Hevy | 🟡 | 4 | 4 | 5 | 4 | MVP | High celebration value; confirm PR detection + surfacing |
| Exercise library | NTC, Fitbod | ✅ | 4 | 3 | 5 | — | MVP | ~33 seeded/gym, search/filter/favorites |
| Workout templates (reusable) | Strong, Hevy | 🟡 | 4 | 4 | 5 | 4 | V2 | Hevy's stickiest feature; verify save-as-template exists |
| Trainer-authored workouts | — | 🟡 | 4 | 4 | 4 | 3 | V2 | Chat exists; structured assignment is the gap |
| Multi-week guided programs | NTC, Fitbod | ⬜ | 4 | 4 | 3 | 2 | V3 | Creates *future obligations* = retention; trainer-authored beats generic |
| Guided / video workouts | NTC | ⬜ | 2 | 3 | 3 | 2 | 🔭 | Media-storage heavy; trainer content > stock video |
| At-home / yoga / HIIT / cardio content | NTC, Cult | ⬜ | 2 | 3 | 3 | 2 | 🔭 | Content treadmill; low defensibility for us |
| Rest timer / in-session UX | Strong, Hevy | 🟡 | 3 | 4 | 5 | 4 | MVP | Cheap polish, big in-gym daily-use feel |
| Wearable sync (live HR in workout) | Apple, Fitbit | ⬜ | 3 | 3 | 4 | 2 | V2 | Section 8 dependency |
| Mobility / recovery tracking | Whoop, Apple | ⬜ | 2 | 2 | 4 | 3 | 🔭 | Low priority |

**Section verdict:** Logging is competitive. The two real gaps that map to *our* advantage:
**templates** (Hevy-grade reuse) and **trainer-authored multi-week programs** (no consumer
app has a *real* trainer behind them). Skip the stock-video content arms race.

---

## SECTION 4 — Nutrition ecosystem (HealthifyMe · MyFitnessPal)

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Calorie / macro logging | MFP, Healthify | 🟡 | 4 | 4 | 5 | 3 | MVP→V2 | Logger shipped; macro *intelligence* missing |
| Meal logging + food catalog/search | MFP | ✅ | 3 | 3 | 4 | — | MVP | Shipped with search |
| Barcode scanning | MFP | ⬜ | 3 | 3 | 4 | 3 | V2 | Table-stakes for fast logging |
| AI photo food recognition | Healthify | ⬜ | 4 | 4 | 4 | 2 | V2 | Removes #1 nutrition friction; reuse AI plumbing |
| Indian food database depth | Healthify | 🟡 | 3 | 3 | 4 | 2 | V2 | Healthify's moat; AI photo logging sidesteps DB arms race |
| Water tracking | Samsung, Healthify | 🟡 | 2 | 3 | 5 | 4 | V2 | Good streak input |
| Meal reminders | Healthify | ⬜ | 3 | 4 | 5 | 3 | V2 | Needs notification engine (Section 10) |
| Diet / meal plans | Healthify | ⬜ | 3 | 3 | 3 | 2 | V3 | Trainer + AI hybrid = our angle |
| Macro / coach recommendations | Healthify | ⬜ | 4 | 3 | 4 | 2 | V3 | Needs photo logging data first |
| Fasting tracking | Zero, Healthify | ⬜ | 2 | 3 | 5 | 4 | 🔭 | Cheap; niche |
| Grocery / delivery integration | Healthify | ➖ | 1 | 1 | 2 | 1 | NO | Out of scope; partnership not product |

**Section verdict:** We have a **logger, not intelligence**. Sequenced lift: barcode →
AI photo logging → macro coaching. Don't try to out-database MyFitnessPal; **photo + AI**
leapfrogs the database problem entirely.

---

## SECTION 5 — Community & retention systems (Strava · Fitbit · Cult)

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Streaks (unified) | Cult, Fitbit | 🟡→✅ | 5 | 5 | 5 | 4 | MVP | **Daily Loop v1 shipped** unified streak (check-in+workout+meal) |
| Streak freeze / repair | Snapchat, Duolingo | ⬜ | 4 | 5 | 4 | 3 | V2 | 🔒 needs schema; the loss-aversion clincher |
| Badges / achievements | all | ✅ | 3 | 3 | 5 | — | MVP | Computed, real data |
| XP / levels | Duolingo, NTC | ⬜ | 2 | 3 | 5 | 3 | 🔭 | Streak economy already covers most of this value |
| Leaderboards | Strava, Cult | ✅ | 4 | 4 | 4 | — | MVP | Real check-in data; **gym-scoped (tenant-isolation critical)** |
| Challenges | Strava, Fitbit | ✅ | 4 | 4 | 4 | — | MVP | Real tables, computed progress |
| Gym-local social feed | Strava | ⬜ | 5 | 5 | 4 | 2 | MVP/V1 🔒 | **Highest-leverage unfair borrow**; biggest tenant-isolation risk |
| Kudos / reactions | Strava | ⬜ | 4 | 4 | 4 | 3 | MVP/V1 | The cheap dopamine that makes the feed work |
| Comments | Strava, Fitbit | ⬜ | 3 | 3 | 4 | 3 | V2 | Needs moderation (Section 6) |
| Transformation / progress sharing | Strava | ⬜ | 3 | 3 | 4 | 3 | V2 | Acquisition loop; privacy controls required 🔒 |
| Team / class competitions | Cult, Strava | ⬜ | 3 | 4 | 3 | 2 | V2 | Rides on class booking |
| Live in-class leaderboard | Cult | ⬜ | 3 | 4 | 3 | 2 | V2 | Cult's signature energy moment |
| Seasonal challenges | Strava, Fitbit | ⬜ | 3 | 4 | 4 | 3 | V2 | Variable-reward refresh |
| Year-in-review "Wrapped" | Strava, Spotify | ⬜ | 3 | 3 | 4 | 3 | V3 | Shareable acquisition |

**Section verdict:** Primitives exist; the **social graph on real gym-mates** is the
single biggest *unfair* opportunity in the whole product (Strava psychology, but it's your
actual gym). Feed + kudos = Tier 1. ⚠️ Treat gym-scoping as a **security requirement**, not
a filter — this is our highest cross-tenant leak risk.

---

## SECTION 6 — Trainer ecosystem

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| 1:1 trainer ↔ member chat | Healthify | ✅ | 5 | 4 | 4 | — | MVP | Shipped (polling + WS gateway) |
| Voice notes | Healthify | ⬜ | 3 | 3 | 3 | 2 | V2 | Media-storage architecture needed |
| Video form feedback | — | ⬜ | 3 | 3 | 2 | 2 | V3 | Storage + moderation heavy |
| Trainer accountability nudges | — | ⬜ | 5 | 5 | 4 | 3 | MVP/V1 | **Weaponizes our human-coach asset**; attendance-dip → nudge |
| Progress reviews | Healthify | 🟡 | 3 | 3 | 4 | 3 | V2 | Data exists (workouts/photos); needs trainer view |
| AI-assisted coaching (trainer-side) | Healthify | ⬜ | 3 | 3 | 4 | 3 | V3 | Reuse AI plumbing for draft replies/summaries |
| Trainer dashboards / analytics | — | 🟡 (B2B) | 3 | 2 | 4 | 3 | V2 | Some B2B exists; trainer-scoped member view is the gap |
| Trainer scheduling | Cult | 🟡 | 3 | 3 | 4 | 3 | V2 | Class schedule exists; 1:1 PT booking is the gap |
| Trainer payouts | — | ⬜ | 2 | 1 | 3 | 2 | V3 | 🔒 payments + finance; B2B ops |
| Trainer marketplace | — | ➖ | 1 | 2 | 2 | 1 | NO | Off-thesis; we're gym-attached, not an open marketplace |

**Section verdict:** Chat is live; the highest-ROI add is **trainer accountability nudges**
(human + automation). Media features (voice/video) need a deliberate storage + moderation
architecture before they ship — don't bolt them on.

---

## SECTION 7 — AI & intelligence (WHOOP · Fitbit Premium · HealthifyMe AI)

> **Hard constraint (user + CLAUDE.md #8): no fake AI.** Every item below either reuses the
> real Anthropic integration in `backend/src/ai/` or is explicitly gated on data we don't yet
> collect. Anything we can't ground is marked 🔭 and *not* promised.

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Member-facing conversational coach | Healthify | ⬜ | 4 | 4 | 4 | 3 | MVP/V1 | **Reuse existing Claude integration** — biggest AI leverage we have |
| AI photo food logging | Healthify | ⬜ | 4 | 4 | 4 | 2 | V2 | Vision model; cross-listed Section 4 |
| AI workout/plan generation | Fitbod, Healthify | ⬜ | 3 | 3 | 4 | 3 | V3 | Must respect trainer authority, not replace |
| AI insight on trends | Fitbit Premium | ⬜ | 3 | 3 | 4 | 3 | V2 | Needs enough logged history to be non-trivial |
| AI readiness/recovery reco | WHOOP | ⬜ | 3 | 3 | 3 | 2 | V2 | **Gated on wearable data** — don't fake it |
| Smart nudges / habit analysis | Fitbit | ⬜ | 4 | 4 | 4 | 3 | V1/V2 | Rules-engine first, ML later; honest heuristics ≠ "AI" claims |
| Progress predictions | Healthify | ⬜ | 2 | 3 | 3 | 2 | 🔭 | High hallucination/over-promise risk — defer, require explainability |
| Hallucination guardrails + explainability | — | ⬜ | 5 | 2 | 5 | 3 | V1 | **Non-negotiable cross-cutting** for any member-facing AI |

**Section verdict:** Our AI advantage is **already-paid-for plumbing**. The play is one
member-facing coach (reuse) + photo logging (vision), each shipped with explicit
"why am I seeing this" explainability and confidence bounds. **No predictive/medical claims.**

---

## SECTION 8 — Wearable & device ecosystem

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Apple HealthKit ingest | Apple | ⬜ | 5 | 5 | 4 | 2 | V2 | iOS share of members |
| Google Health Connect ingest | Google | ⬜ | 5 | 5 | 4 | 2 | V2 | New Android standard — target this over legacy Google Fit |
| Samsung Health ingest | Samsung | ⬜ | 3 | 4 | 4 | 2 | V2 | Via Health Connect where possible |
| Fitbit / Garmin API | Fitbit, Garmin | ⬜ | 3 | 4 | 4 | 2 | V3 | Add as providers once ingestion layer exists |
| Smart scale sync | Withings, Samsung | ⬜ | 2 | 3 | 4 | 2 | V3 | Feeds body-composition (Section 1) |
| **Provider-agnostic ingestion layer** | — | ⬜ | 5 | 5 | 4 | 2 | V2 🔒 | **Build this ONCE**; every provider becomes config not rewrite |
| Background sync + battery/conflict mgmt | all | ⬜ | 4 | 3 | 3 | 2 | V2 | Dedupe + last-writer-wins + battery budget = the hard part |
| Own wearable hardware | Fitbit, Samsung | ➖ | 1 | — | 1 | 1 | NO | **Never.** Integrate, don't manufacture |

**Section verdict:** This is the **single largest missing *capability*** and the unlock for
all of Section 1. Architect it as **one normalized ingestion schema** behind HealthKit /
Health Connect adapters. 🔒 New health-data models → tenant-models source of truth +
privacy review.

---

## SECTION 9 — Premium UX & design system (Samsung · Apple · Headspace)

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Dark-first design system | Apple, Linear | ✅ | 4 | 3 | 5 | — | MVP | Shipped (design.md tokens) |
| Micro-celebrations + haptics | Duolingo, Apple | 🟡→✅ | 4 | 4 | 5 | 5 | MVP | Check-in pop + milestone badges shipped (Daily Loop v1) |
| "Today" hero / daily ritual card | Apple Fitness | ✅ | 4 | 4 | 5 | — | MVP | Shipped (Daily Loop v1) |
| Skeleton loaders | all | 🟡 | 3 | 2 | 5 | 4 | MVP | Cheap perceived-perf; sweep for coverage |
| Charts / data viz | Samsung, Fitbit | 🟡 | 3 | 3 | 5 | 3 | V2 | Have basics; trends/heatmap-calendar = perceived sophistication |
| Onboarding flow | Headspace, Cult | 🟡 | 4 | 4 | 4 | 3 | V2 | First-run = D1 retention; aspiration → first win fast |
| Dashboard personalization | Samsung | ⬜ | 2 | 3 | 4 | 2 | 🔭 | Nice-to-have; don't over-invest early |
| Gesture system | Apple | 🟡 | 2 | 2 | 5 | 3 | V2 | Polish-tier |
| Accessibility (a11y) | all | 🟡 | 4 | 2 | 5 | 3 | V2 | Compliance + reach; run an audit pass |
| Animations / transitions | Samsung, Headspace | 🟡 | 3 | 3 | 5 | 4 | V2 | reanimated already a dep; deliberate motion pass |
| Performance polish | Samsung, Strava | 🟡 | 4 | 3 | 4 | 3 | V2 | Runtime tuned per memory; needs a deliberate quality pass to hit the bar |
| Responsive / tablet | — | ⬜ | 1 | 1 | 5 | 3 | 🔭 | Low priority for member phone app |

**Section verdict:** Foundations + the Daily-Loop polish are in. The remaining lift is a
**deliberate quality pass** (motion, charts, skeletons, onboarding, a11y) — "polish as a
feature," Samsung-grade. None of it is schema-risky.

---

## SECTION 10 — Analytics & business intelligence

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Product analytics sink (events) | — | ✅ | 4 | — | 5 | — | MVP | PostHog HTTP sink shipped, env-gated |
| DAU / WAU / MAU | — | 🟡 | 4 | — | 5 | 4 | MVP | Derive from existing events; build the dashboard |
| Retention / cohort analysis | — | ⬜ | 4 | — | 4 | 3 | V2 | The metric that proves the whole thesis |
| Churn prediction | Fitbit, B2B | ⬜ | 4 | 5 | 4 | 2 | V2 | At-risk member → trainer nudge = direct retention $ |
| Workout / nutrition consistency | — | 🟡 | 3 | 3 | 5 | 4 | V2 | Streak data already half-computes this |
| Streak analytics | — | 🟡 | 3 | 3 | 5 | 4 | MVP | MemberStreakService is the source |
| Trainer performance | — | ⬜ | 3 | 2 | 4 | 3 | V2 | B2B retention lever for gyms |
| Gym utilization / occupancy | — | 🟡 (B2B) | 3 | 2 | 4 | 3 | V2 | Dashboard analytics exist B2B-side |
| Notification engine analytics | — | ⬜ | 3 | 3 | 4 | 3 | V2 | Send→open→action attribution |

**Section verdict:** Event plumbing is in (PostHog). The gap is the **BI layer that turns
events into churn/retention dashboards** — and critically, **churn prediction → trainer
nudge** closes the loop between analytics and our human-coach moat.

---

## SECTION 11 — Monetization

| Feature | Inspiration | Status | Pri | Ret | Scal | Ease | Build state | Note |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Real payments (Razorpay) | — | ❌ | 5 | 3 | 4 | 3 | **MVP-blocker** 🔒 | Gates everything below |
| Membership purchase / renewal in-app | Cult | 🟡 | 4 | 3 | 4 | 3 | V2 🔒 | UI exists; needs payments |
| PT-pack / class-pack purchase | Cult | ⬜ | 4 | 3 | 4 | 3 | V2 🔒 | First real member revenue |
| Premium member subscription tier | Healthify, Strava | ⬜ | 3 | 3 | 3 | 2 | V3 🔒 | Tenant-configurable; reuse `checkFeatureAccess` |
| AI coach as premium gate | Healthify | ⬜ | 3 | 3 | 4 | 3 | V3 | Natural paywall once AI coach ships |
| Supplement / store (POS bridge) | — | 🟡 (B2B) | 2 | 2 | 4 | 3 | V3 | Inventory/POS exists B2B; member-side optional |
| In-app purchases (challenges, etc.) | Strava | ⬜ | 2 | 2 | 4 | 3 | 🔭 | After core revenue proven |
| Affiliate / supplement affiliate | — | ➖ | 1 | 1 | 3 | 2 | NO | Brand-risk, off-thesis |
| Trainer marketplace take-rate | — | ➖ | 1 | 2 | 2 | 1 | NO | Off-thesis |

**Section verdict:** **One blocker rules them all** — real payments. Until Razorpay is real,
every monetization row is theoretical. Reuse the existing entitlement pattern
(`ResourceLimitService.checkFeatureAccess`) for gating; don't build a parallel system.

---

## SECTION 12 — Security & compliance

| Concern | Status | Pri | Note |
|---|:--:|:--:|---|
| Multi-tenant isolation (gym scoping) | 🟡 | 5 | 3-layer ($use injection + RLS + JWT gym_id) but **RLS is decorative** (app = bypassrls role) — see `project_rls_not_loadbearing`. **Keystone + pooling fixes must ship before onboarding more gyms** |
| Single tenant-models source of truth | 🟡 | 5 | We've leaked **twice** (biometrics, nutrition). Every new model (social, wearable, health) MUST register here |
| Auth (phone OTP) | ✅ | 4 | Shipped; member-token + tenant-context design in place |
| Biometric data handling | 🟡 | 5 | 🔒 facial/pgvector — gym-scoped after leak fix; treat as special-category data |
| Health data (wearable/menstrual) | ⬜ | 5 | 🔒 Not collected yet — **design privacy-first before ingestion** (consent, retention, deletion) |
| Media privacy (voice/video/photos) | 🟡 | 4 | Progress photos exist; sharing needs explicit per-item privacy controls |
| Encryption (at rest / in transit) | 🟡 | 4 | Verify posture before health-data ingestion |
| GDPR / data export + deletion | ⬜ | 4 | Required before EU/health expansion; "delete my data" must cascade tenant-scoped |
| HIPAA | ➖ | 2 | Not a covered entity in our model; **avoid medical claims** (ties to Section 7 no-fake-AI) |
| Abuse / moderation (social, chat) | ⬜ | 4 | Gates social feed + comments + trainer media — build before, not after |
| Rate limiting / idempotency | ✅ | 3 | Idempotency + tenant-write guard shipped (phase 0) |

**Section verdict:** The load-bearing risk is **not** a missing feature — it's that **RLS is
decorative** and **two model-sets can drift**. Both must be hardened **before** the social /
wearable / health expansion adds high-sensitivity, high-fan-out data. This is the one place
where "ship faster" is the wrong instinct.

---

## Consolidated outputs (your 10 deliverables)

### 1. Feature inventory — *done above* (Sections 1–12)

### 2. Missing-feature matrix (the ❌ / ⬜ that matter)
Payments (blocker) · wearable ingestion layer · gym-local social feed + kudos · member AI
coach · streak freeze · trainer nudges · AI photo food logging · readiness dashboard ·
churn prediction · multi-week programs · Wrapped recap.

### 3. Competitor comparison → see [`02_FEATURE_GAP_MATRIX.md`](02_FEATURE_GAP_MATRIX.md) (7 apps × feature) and [`01_COMPETITOR_PROFILES.md`](01_COMPETITOR_PROFILES.md) (7 × 14 dimensions). Not duplicated here.

### 4 & 5. Priority roadmap + MVP/V2/V3 classification

| Tier | = | Features (status-tagged) |
|---|---|---|
| **MVP / shipped** | have it | check-in (QR+facial), classes, trainer chat, workout/exercise/nutrition logging, community primitives, progress, **Daily Loop v1** (unified streak + Today card + celebrations) |
| **Tier 0 (unblock)** | do first | 🔒 real payments · push delivery live (EAS/FCM) |
| **Tier 1 (habit engine)** | highest ret/effort | streak freeze · notification trigger engine · **gym-local social feed + kudos** · trainer nudges · member AI coach |
| **Tier 2 (health + depth)** | next | **wearable ingestion layer** → steps/HR/sleep/readiness · readiness dashboard · class habit loop · barcode + AI photo food logging · rich viz · churn prediction · onboarding/perf/a11y polish · PT-pack purchase |
| **Tier 3 (defensibility)** | later | trainer multi-week programs · macro coaching · premium tier · Wrapped · challenges marketplace |
| **NO (excluded)** | off-thesis | own hardware · stranger-social/global races · proprietary food DB · grocery delivery · trainer marketplace · affiliate |

### 6. Retention-impact report (highest movers, by Ret score)
Top retention levers, ranked: **unified streak + freeze (5)** → **gym-local social feed/kudos (5)** →
**trainer nudges (5)** → **wearable sync ambient data (5)** → **churn-prediction→nudge (5)** →
push trigger engine (5). Four of these ride on assets we already own (check-in graph, real
trainer, streak service). Full mechanics in [`04_RETENTION_ANALYSIS.md`](04_RETENTION_ANALYSIS.md).

### 7. Monetization-impact report
**Everything gates on real payments.** Order once unblocked: PT/class-pack purchase (highest
intent, lowest friction) → in-app membership renewal → AI-coach premium gate → tenant-configurable
premium tier. Reuse `checkFeatureAccess`. Detail in [`05_MONETIZATION_ANALYSIS.md`](05_MONETIZATION_ANALYSIS.md).

### 8. UX improvement roadmap
Shipped: Today card, celebrations, haptics, dark DS. Next deliberate quality pass (no schema
risk): onboarding first-win, motion pass (reanimated), trend/heatmap charts, skeleton coverage,
a11y audit, performance polish. See [`03_UX_COMPARISON.md`](03_UX_COMPARISON.md).

### 9. Technical complexity report (the genuinely hard builds, Ease ≤ 2)
1. **Wearable ingestion layer** — provider-agnostic normalization, background sync, dedupe/conflict, battery budget. *Build once, correctly.*
2. **Gym-local social feed** — fan-out + the #1 tenant-isolation risk; moderation prerequisite.
3. **AI photo food logging** — vision pipeline + confidence/explainability.
4. **Real payments** — 🔒 billing correctness, idempotency, reconciliation with B2B `scc.payments` sync.
5. **Multi-week programs** — scheduling/state model + trainer authoring UX.

Everything else is reuse or additive on existing models.

### 10. Production-readiness checklist (must clear before scaling member base)
- [ ] 🔒 **RLS hardening + connection pooling** — RLS is currently decorative; fix *before* onboarding more gyms (`project_rls_not_loadbearing`).
- [ ] 🔒 **Single tenant-models source of truth enforced** — audit that every member model is registered (leaked twice).
- [ ] **Push delivery proven end-to-end** — EAS projectId + FCM creds + smoke test.
- [ ] 🔒 **Payments real + reconciled** — Razorpay live, idempotent, synced to `scc.payments`.
- [ ] **Moderation + abuse controls** — before social feed / comments / trainer media.
- [ ] **Privacy-first health-data design** — consent + retention + cascade-delete, before any wearable/health ingestion.
- [ ] **GDPR data export/delete** — tenant-scoped cascade.
- [ ] **AI guardrails** — explainability + confidence + no medical/predictive claims, before member-facing AI.
- [ ] **Perf/quality pass** — to hit the Samsung/Strava bar.
- [ ] **Tests** — member suite is green (85/85 per memory); new high-risk areas (social, payments, wearable) need coverage *as built*, not after.

---

## What I did NOT do (CLAUDE.md transparency)
- **No code, schema, or config changed** — analysis only.
- **Did not duplicate** the existing 9-doc pack; this `08` is the consolidated scored matrix that was missing, cross-linking the rest.
- **Did not invent build-state** — every ✅/🟡 is from verified code/memory; competitor claims live in `01`/`02`, not asserted here.
- **Flagged, did not decide**, every 🔒 schema/payments/auth item — those need your explicit go-ahead per the hard rules.

**Noted for later (not acted on):** branch `feat/member-bff-phase0` has substantial uncommitted
work + a known yaml-vs-committed contract drift (per `project_competitive_strategy_2026-06`) —
worth reconciling before the next feature lands on top of it.
