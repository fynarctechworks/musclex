# Feature Gap Matrix

**Legend:** ✅ shipped & solid · 🟡 partial / basic · ❌ missing · ➖ not applicable to our model
**"Us" = MuscleX / MuscleX member app (verified state, 2026-06-03).**

> Reminder of our model: we are a **gym-attached** app. Some competitor features (own wearable hardware, open-market social) are deliberately **not** our game — flagged ➖ where matching them would be strategically wrong.

---

## A. Core tracking & content

| Feature | Us | Samsung | Healthify | Cult | MFP | Strava | Fitbit | NTC |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Workout session logging | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | 🟡 |
| Exercise library (search/filter) | ✅ | 🟡 | ✅ | 🟡 | ❌ | ❌ | 🟡 | ✅ |
| Guided/structured programs (multi-week) | ❌ | 🟡 | ✅ | ✅ | ❌ | 🟡 | ❌ | ✅ |
| Class booking | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Nutrition / food logging | 🟡 | 🟡 | ✅ | 🟡 | ✅ | ❌ | 🟡 | ❌ |
| Barcode / photo food logging | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Steps / activity tracking | ❌ | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ | 🟡 |
| Sleep tracking | ❌ | ✅ | 🟡 | ❌ | ❌ | 🟡 | ✅ | ❌ |
| GPS / outdoor activity | ❌ | ✅ | ❌ | ❌ | 🟡 | ✅ | ✅ | ➖ |

## B. Health analytics & wearables

| Feature | Us | Samsung | Healthify | Cult | MFP | Strava | Fitbit | NTC |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Wearable sync (Apple Health/Google Fit/Health Connect) | ❌ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | 🟡 |
| Own wearable hardware | ➖ | ✅ | 🟡 | ❌ | ❌ | ❌ | ✅ | ❌ |
| Heart-rate / HR zones | ❌ | ✅ | 🟡 | 🟡 | ❌ | ✅ | ✅ | 🟡 |
| Sleep score / architecture | ❌ | ✅ | 🟡 | ❌ | ❌ | 🟡 | ✅ | ❌ |
| Readiness / recovery score | ❌ | 🟡 | 🟡 | ❌ | ❌ | 🟡 | ✅ | ❌ |
| Body composition / weight trend | 🟡 | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Progress photos / measurements | ✅ | 🟡 | ✅ | ❌ | 🟡 | ❌ | 🟡 | ❌ |

## C. AI & personalization

| Feature | Us | Samsung | Healthify | Cult | MFP | Strava | Fitbit | NTC |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Member-facing conversational AI coach | ❌ | 🟡 | ✅ | ❌ | 🟡 | ❌ | 🟡 | ❌ |
| AI food recognition (photo→macros) | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| AI workout/plan generation | ❌ | 🟡 | ✅ | 🟡 | ❌ | 🟡 | 🟡 | 🟡 |
| Personalized recommendations | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI insight on trends/data | ❌ | ✅ | ✅ | ❌ | ✅ | 🟡 | ✅ | ❌ |
| **(B2B) AI owner advisor** | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |

> Note: We already run an Anthropic/Claude integration in `backend/src/ai/` for gym owners. The model plumbing, conversation storage (`AiConversation`), and feature-gating exist — a **member-facing coach is a reuse, not a greenfield build.** This is the single most leveraged AI opportunity we have.

## D. Engagement, community & gamification

| Feature | Us | Samsung | Healthify | Cult | MFP | Strava | Fitbit | NTC |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Streaks | 🟡 | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 |
| Badges / achievements | ✅ | ✅ | 🟡 | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Leaderboards | ✅ | ✅ | 🟡 | ✅ | ❌ | ✅ | ✅ | ❌ |
| Challenges | ✅ | ✅ | 🟡 | ✅ | ❌ | ✅ | ✅ | ❌ |
| Social feed / following | ❌ | 🟡 | 🟡 | 🟡 | 🟡 | ✅ | 🟡 | ❌ |
| Kudos / reactions / comments | ❌ | ❌ | ❌ | ❌ | 🟡 | ✅ | 🟡 | ❌ |
| Live / in-class leaderboard | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Year-in-review / "Wrapped" | ❌ | 🟡 | ❌ | ❌ | ❌ | ✅ | 🟡 | ❌ |
| Trainer↔member chat | ✅ | ❌ | ✅ | 🟡 | ❌ | ❌ | ❌ | ❌ |

## E. Platform, monetization & ops

| Feature | Us | Samsung | Healthify | Cult | MFP | Strava | Fitbit | NTC |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Real-world check-in (QR/biometric) | ✅ | ❌ | ❌ | 🟡 | ❌ | ❌ | ❌ | ❌ |
| Membership / billing in app | 🟡 | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 |
| In-app payments (working) | ❌ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 |
| Premium member subscription tier | ❌ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ |
| Add-on purchases (PT packs, store) | 🟡 | ➖ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Push notifications | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rich/segmented notification engine | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 |
| Performance / polish | 🟡 | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Verdict buckets

### ✅ Already competitive (defend, don't rebuild)
- **Real-world check-in (QR + facial/pgvector)** — *no consumer competitor has this.* Unique.
- **Class booking** — on par with Cult.fit's core, ahead of everyone else.
- **Trainer↔member chat** — only HealthifyMe (paid coaches) compares; ours is bundled with the gym relationship.
- **Community primitives** (leaderboard/challenges/badges) — present, real-data backed.
- **Progress photos/measurements** — solid.

### 🟡 Partial — close the gap to "great"
- **Nutrition** (logger exists; needs photo logging + macro intelligence).
- **Streaks** (a Home ring exists; needs a system-wide streak economy across check-in/workout/nutrition).
- **Membership/billing** (UI exists; **payments are a stub — blocks monetization**).
- **Push** (device tokens + send exist; needs segmentation, triggers, value-based content).
- **Performance** (dev-compile noise aside, runtime is tuned per memory; needs a deliberate polish pass to hit Samsung/Strava bar).

### ❌ Missing — strategic decisions required
- **Wearable sync** (highest-impact missing capability; software-only, no hardware needed).
- **Member-facing AI** (coach + photo food logging; reuses existing Claude integration).
- **Social graph** (following/kudos/feed on the real gym member base — our biggest *unfair* opportunity).
- **Health analytics** (HR/sleep/readiness — depends on wearable sync).
- **Multi-week structured programs** (trainer-authored).
- **Year-in-review recap.**

### ➖ Deliberately NOT our game
- **Own wearable hardware** — never; integrate instead.
- **Open-market stranger social / global step races** — our social graph should be the *gym*, which is more powerful, not weaker.
- **Building a proprietary food database to rival MFP** — integrate / use AI photo logging instead.
