# Prioritized Roadmap Recommendations

> Prioritized strictly by the five requested criteria. No feature here is bloat — every item maps to a proven retention/engagement mechanic or unblocks one. Items competitors have that *don't fit our gym-attached model* (own hardware, stranger-social) are deliberately excluded.

---

## 1. Scoring model

Each candidate is scored 1–5 on five axes, then combined into a weighted **Priority Score**. Weights reflect the stated goal (retention, habit, premium experience, scalable architecture):

| Axis | Weight | Meaning (5 = best) |
|---|---|---|
| **Retention impact** | ×3 | How much it moves D7/D30 / real attendance |
| **Engagement value** | ×2 | Frequency/depth of daily interaction it drives |
| **Business value** | ×2 | B2B retention multiplier + direct revenue |
| **Scalability** | ×1 | Multi-tenant safe, low per-gym marginal cost |
| **Low complexity** | ×2 | Inverse of effort (5 = cheap/reuse, 1 = large build) |

`Priority = 3·Ret + 2·Eng + 2·Biz + 1·Scale + 2·LowCx` (max = 50).

> Complexity ratings assume our verified reality: payments are a stub, we already run a Claude integration, push transport exists, no wearable layer exists, and we have a multi-tenant Prisma/RLS architecture that any new model must respect.

---

## 2. The scored backlog

| # | Feature | Ret | Eng | Biz | Scale | LowCx | **Score** | Tier |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | **Real payments (Razorpay)** — unblocker | 3 | 2 | 5 | 4 | 3 | **35** | 0 |
| 2 | **Push delivery live (EAS + FCM)** — unblocker | 5 | 4 | 3 | 4 | 4 | **45** | 0 |
| 3 | **Unified streak economy** (check-in+workout+nutrition, freeze, milestones) | 5 | 5 | 4 | 5 | 4 | **48** | 1 |
| 4 | **Notification trigger engine** (streak-at-risk, class, badge, kudos) | 5 | 4 | 4 | 4 | 3 | **45** | 1 |
| 5 | **Gym-local social feed + kudos + follow** | 5 | 5 | 4 | 4 | 2 | **45** | 1 |
| 6 | **"Today" unified Home hero card** | 4 | 5 | 3 | 5 | 4 | **43** | 1 |
| 7 | **Micro-celebrations + haptics** (check-in/PR/streak) | 3 | 4 | 2 | 5 | 5 | **40** | 1 |
| 8 | **Member-facing AI coach** (reuse Claude integration) | 4 | 4 | 4 | 4 | 3 | **41** | 1 |
| 9 | **Wearable sync** (Apple Health / Google Fit / Health Connect) | 5 | 4 | 4 | 4 | 2 | **44** | 2 |
| 10 | **Trainer accountability nudges** (streak/attendance dip → nudge) | 5 | 3 | 5 | 4 | 3 | **44** | 1 |
| 11 | **Class-attendance habit loop** (class streaks, live leaderboard, FOMO) | 4 | 4 | 4 | 4 | 3 | **40** | 2 |
| 12 | **AI photo food logging** (Snap-style) | 4 | 4 | 3 | 4 | 2 | **37** | 2 |
| 13 | **Health/readiness dashboard** (needs #9) | 4 | 4 | 3 | 4 | 2 | **37** | 2 |
| 14 | **Rich progress visualizations** (trends, heatmap calendar) | 3 | 4 | 3 | 5 | 3 | **37** | 2 |
| 15 | **PT-pack / class-pack purchase** (needs #1) | 3 | 2 | 5 | 4 | 3 | **35** | 2 |
| 16 | **Trainer-authored multi-week programs** | 4 | 4 | 4 | 3 | 2 | **37** | 3 |
| 17 | **Year-in-fitness "Wrapped" recap** | 3 | 3 | 3 | 4 | 3 | **34** | 3 |
| 18 | **Tenant-configurable premium member tier** (needs #1, #8) | 3 | 2 | 5 | 3 | 2 | **31** | 3 |
| 19 | **Macro coaching / nutrition intelligence** (needs #12) | 4 | 3 | 3 | 4 | 2 | **34** | 3 |
| 20 | **Challenges marketplace / advanced gamification** | 3 | 4 | 3 | 4 | 2 | **34** | 3 |

(Items sorted into tiers below, not strictly by raw score, because some high scorers are *unblockers* and some depend on prerequisites.)

---

## 3. Phased roadmap

### Tier 0 — Unblockers (do first, in parallel)
These gate other work and carry low retention value alone, but everything waits on them.
- **#1 Real payments (Razorpay)** — blocks all member commerce & premium tier. ⚠️ Touches billing — flag before schema/payment-flow changes per CLAUDE.md.
- **#2 Push delivery live** — transport is built; needs EAS projectId + FCM creds + a delivery smoke test.

### Tier 1 — The habit engine (highest retention-per-effort)
The core flywheel from `04_RETENTION_ANALYSIS.md`. Ship as one coherent program, not scattered features.
- **#3 Unified streak economy** ← the loss-aversion spine.
- **#6 "Today" hero card** ← the daily ritual surface (no backend; aggregates existing data).
- **#7 Micro-celebrations + haptics** ← cheap perceived-quality lift.
- **#4 Notification trigger engine** ← powers the loop's triggers.
- **#5 Gym-local social feed + kudos** ← our highest-leverage *unfair* borrow (Strava psychology on real gym-mates).
- **#10 Trainer accountability nudges** ← weaponizes our human-coach asset.
- **#8 Member-facing AI coach** ← reuse existing Claude plumbing; gate via existing `checkFeatureAccess`.

> Tier 1 alone should move D30 retention meaningfully because it installs mechanics #2, #4, #6 (social, streak, variable reward) and activates #1 (human) — four of the seven strongest retention levers, all on assets we already own.

### Tier 2 — Health intelligence & premium depth
- **#9 Wearable sync** ← biggest *missing capability*; unlocks ambient-data retention + health analytics. Software-only.
- **#13 Health/readiness dashboard** ← Fitbit/Samsung-grade analytics, our design language.
- **#11 Class habit loop** ← Cult mechanics on our existing booking.
- **#12 AI photo food logging** ← removes the #1 friction in nutrition.
- **#14 Rich progress viz** ← perceived sophistication.
- **#15 PT/class-pack purchase** ← first real member revenue (needs #1).

### Tier 3 — Defensibility & monetization maturity
- **#16 Trainer-authored programs** ← scheduled future obligations; differentiated by *real* trainer.
- **#19 Nutrition intelligence / macro coaching** ← HealthifyMe-grade (needs #12).
- **#17 Year-in-fitness recap** ← shareable acquisition loop.
- **#18 Premium member tier** ← recurring member revenue (tenant-configurable).
- **#20 Challenges marketplace** ← engagement depth.

---

## 4. Mapping back to the north-star vision

The stated goal — "Samsung Health quality + HealthifyMe nutrition intelligence + Cult engagement + Strava community + Fitbit analytics, without sacrificing performance":

| Vision component | Delivered by | Tier |
|---|---|---|
| Samsung Health **quality** | #6 Today card, #7 celebrations, perf pass, #14 viz | 1–2 |
| HealthifyMe **nutrition intelligence** | #12 photo logging, #19 macro coaching | 2–3 |
| Cult.fit **engagement** | #3 streaks, #11 class loop, #20 challenges | 1–2–3 |
| Strava **community psychology** | #5 social feed + kudos, #17 Wrapped | 1, 3 |
| Fitbit **health analytics** | #9 wearable sync, #13 readiness dashboard | 2 |
| AI layer (cross-cutting) | #8 member AI coach, #12 photo AI | 1–2 |

Every vision component is covered, and the **cheapest, highest-retention components (Cult engagement + Strava community) land first** because they ride on assets we uniquely own (verified check-in, real trainer, real gym graph).

---

## 5. Architectural guardrails (so this stays scalable)

Per CLAUDE.md and our verified multi-tenant reality (`project_tenant_isolation_audit`, `project_rls_not_loadbearing`):

1. **Every new member-data model MUST be added to the single tenant-models source of truth** (`src/prisma/tenant-models.ts`) and respect gym scoping — we have already had cross-tenant leaks (biometrics, nutrition) from models missing from the tenant set. Social feed + wearable data are high-risk here.
2. **Social feed is the biggest tenant-isolation risk in this roadmap** — a member must *only* ever see their own gym's feed/leaderboard. Treat gym-scoping as a security requirement, not a filter.
3. **Premium gating reuses the existing pattern** (`ResourceLimitService.checkFeatureAccess`) — don't invent a parallel entitlement system.
4. **AI coach reuses `backend/src/ai/`** infrastructure (Anthropic client, conversation storage, throttling) — new member endpoints, same plumbing.
5. **Wearable sync should be a normalized ingestion layer** (provider-agnostic: Health Connect / HealthKit / Google Fit → one internal schema) so adding Garmin/Fitbit later is config, not a rewrite.
6. **Notifications + retention triggers belong in the existing queue/processor layer** (`backend/src/queue/processors/notification.processor.ts` exists) — event-driven, not cron-spam.

> ⚠️ Per CLAUDE.md hard rules: items touching **schema, payments, or auth** (#1 payments, #5 social models, #9 wearable models, #18 premium gating) require **explicit confirmation before implementation** and a tenant-isolation review. This document is analysis only — no schema or code was changed.

---

## 6. Suggested first execution slice (if/when greenlit)

A single coherent, shippable increment that proves the thesis with minimal risk:

> **"The Daily Loop v1"** = #2 (push live) + #3 (unified streak) + #6 (Today card) + #7 (celebrations) + the streak-at-risk slice of #4.

No schema-risky social or payment work; reuses existing check-in/workout/nutrition data; installs the loss-aversion + ritual + celebration mechanics; measurable via existing PostHog. It's the lowest-risk, highest-retention-per-effort starting point and validates the flywheel before investing in the heavier social/wearable/AI tiers.
