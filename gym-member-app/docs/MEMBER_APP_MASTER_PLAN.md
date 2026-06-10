# MuscleX Member App — Global Fitness Ecosystem Master Plan

> **Purpose.** Translate the "Global #1 Fitness Ecosystem (10-Year Vision)" brief into a
> concrete, buildable plan **for the member app** (`gym-member-app/`), grounded in the
> code that exists today — not aspiration.
>
> **Companion docs.**
> - [`features_list.md`](./features_list.md) — the **living build + test tracker** (updated as each feature ships and passes QA). This plan is the *what/why*; `features_list.md` is the *done/not-done*.
> - [`FEATURE_INVENTORY.md`](./FEATURE_INVENTORY.md) — code-derived snapshot of the 14 current modules.
> - [`../BLUEPRINT.md`](../BLUEPRINT.md) — product blueprint, IA, design system.
> - [`SAMSUNG_HEALTH_INTEGRATION.md`](./SAMSUNG_HEALTH_INTEGRATION.md), [`G3_CROSS_PLAN.md`](./G3_CROSS_PLAN.md) — wearable/native track.
>
> **Scope discipline.** This is a 10-year vision. We build in **reviewable slices**, not
> all at once. Every feature here is classified **MVP · V2 · V3 · Future** so we never
> confuse "planned" with "shipped." Real money + real member data flow through MuscleX —
> tenant isolation and payments correctness gate everything (see [`../../CLAUDE.md`](../../CLAUDE.md)).

---

## 0. The thesis (why we can win)

We are **not** trying to out-WHOOP WHOOP or out-Strava Strava as a standalone tracker.
Standalone trackers fight a brutal retention war because the user has no external reason
to open them. **MuscleX's unfair advantage is the gym attachment + the verified check-in.**

- The member *already* pays a gym. The app is the gym in their pocket → built-in reason to open daily.
- The **verified physical check-in** is a data + trust primitive no consumer app has: real attendance, real location, real trainer relationship, real payments.
- That check-in is the **flywheel**: attendance → streaks → community → trainer accountability → renewals → trainer/nutrition upsell → wearable + AI layered on top.

So the strategy is: **be the best gym-member app on earth first** (a category nobody has
nailed), then layer the WHOOP/Samsung/Strava/HealthifyMe capabilities on top of a user we
already have a daily reason to reach. Consumer-fitness features are the *moat-widening*
layer, not the wedge.

---

## 1. Competitor synthesis — the one idea we steal from each

For each reference app: the single highest-leverage idea to absorb, and the trap to avoid.

| App | Steal this | Avoid this |
|---|---|---|
| **Samsung Health** | Calm, dense daily dashboard; Together challenges; rings as ambient status | Cluttered settings, fragmented sub-apps |
| **WHOOP** | Recovery/Readiness as the *one number* that drives the day; weekly/monthly reports | Hardware lock-in; no free value; coach can feel naggy |
| **Fitbit** | Effortless passive tracking; sleep score legibility | Premium paywall resentment; aging UX |
| **Apple Fitness** | Close-your-rings dopamine; award animations; buttery motion | Apple-only; shallow nutrition |
| **HealthifyMe** | Indian food DB depth; AI photo-meal logging; human coach marketplace | Upsell aggression; noisy notifications |
| **MyFitnessPal** | Massive barcode food DB; frictionless logging habit | Ads, paywalled basics, stale community |
| **Strava** | Social accountability = #1 retention lever; segments/kudos; club identity | Toxic comparison; cardio-only bias |
| **Nike Training Club** | Free premium-quality guided sessions; coach production value | Thin tracking/data; no gym tie-in |
| **Cult.fit** | Class booking + engagement ecosystem; gamified consistency | Heavy ops; India-only depth |
| **Garmin Connect** | Deep multi-sport + training-load science; Body Battery | Intimidating to beginners |
| **Oura** | Readiness storytelling; "why" behind each score; tasteful UX | Ring-only; small surface area |
| **Peloton** | Instructor charisma; live leaderboards; class energy | Equipment dependence |
| **Hevy / Strong** | Best-in-class set logging UX; PR celebration; routine reuse | Lifter-only; no health/recovery |
| **Fitbod** | Recovery-aware auto-generated workouts (muscle freshness) | Black-box algorithm distrust |
| **Centr** | Premium content + lifestyle bundle (train/eat/mind) | Celebrity-brand dependency |
| **Headspace / Calm** | Mindfulness as a habit ritual; streaks; sleep stories; soothing motion | Subscription churn; little "fitness" overlap |

**Unified principle:** *WHOOP's "one number," Strava's "social accountability," Hevy's
"logging UX," HealthifyMe's "Indian nutrition + AI," Apple's "ring dopamine," Samsung's
"calm dashboard"* — assembled on top of **our verified check-in**.

---

## 2. Master feature inventory (by domain)

Scoring legend, each **1–5** (5 = highest):
**Ret** retention impact · **Mon** monetization · **AI** AI-readiness/leverage ·
**UX** premium-UX surface · **Scl** scalability cost/risk (5 = easy to scale) ·
**Sec** security/privacy sensitivity (5 = most sensitive).
**Phase:** MVP (now) · V2 (next) · V3 (later) · F (Future/experimental).
**Status** mirrors `features_list.md`: ✅ built · 🟡 partial · ❌ missing.

> Status here is a planning snapshot; the **authoritative, continuously-updated** status
> lives in [`features_list.md`](./features_list.md).

### 2.1 Health & recovery intelligence (Brief §1)

| Feature | Phase | Ret | Mon | AI | UX | Scl | Sec | Status |
|---|---|---|---|---|---|---|---|---|
| Steps / active calories / distance | MVP | 4 | 1 | 2 | 4 | 5 | 2 | 🟡 |
| Activity rings (move/exercise/stand) | MVP | 5 | 1 | 2 | 5 | 5 | 2 | ✅ |
| Heart rate (resting + workout zones) | V2 | 4 | 2 | 3 | 4 | 4 | 3 | 🟡 |
| HRV | V3 | 4 | 3 | 5 | 3 | 4 | 3 | ❌ |
| Sleep stages + sleep score | V2 | 5 | 3 | 4 | 5 | 4 | 3 | 🟡 |
| Recovery / Readiness score (the "one number") | V3 | 5 | 4 | 5 | 5 | 3 | 3 | ❌ |
| Stress / energy score | V3 | 4 | 3 | 5 | 4 | 4 | 3 | ❌ |
| SpO2 / body temp / respiratory rate | V3 | 2 | 2 | 3 | 3 | 4 | 4 | ❌ |
| Blood pressure (device-sourced) | F | 2 | 3 | 3 | 3 | 4 | 5 | ❌ |
| Glucose (CGM partner) | F | 3 | 4 | 4 | 3 | 3 | 5 | ❌ |
| Menstrual / cycle tracking | V3 | 4 | 2 | 4 | 4 | 4 | 5 | ❌ |
| Fertility window | F | 2 | 2 | 3 | 3 | 4 | 5 | ❌ |
| Mood / journaling | V3 | 3 | 2 | 4 | 4 | 5 | 4 | ❌ |
| Hydration tracking | MVP | 4 | 1 | 2 | 4 | 5 | 1 | ✅ |
| Mindfulness / breathing / meditation | V2 | 4 | 3 | 3 | 5 | 5 | 2 | 🟡 |
| Longevity / biological age / immune readiness | F | 3 | 4 | 5 | 4 | 3 | 4 | ❌ |
| Posture / mobility / injury-risk / burnout detection | F | 3 | 3 | 5 | 3 | 2 | 4 | ❌ |

**Implementation note.** The health *platform* (samples / daily / connections + HealthKit /
Health Connect bridge) already exists (`health`, `sleep`, `heart`, `activity`,
`mindfulness` screens). **Native reads are UNVERIFIED** until a device dev-build (post-G3).
Everything above is "ingest the sample, then compute the score" — the keystone is reliable
ingestion, which is exactly the G3 native track.

### 2.2 Gym super-app (Brief §2) — *our wedge, score it highest*

| Feature | Phase | Ret | Mon | AI | UX | Scl | Sec | Status |
|---|---|---|---|---|---|---|---|---|
| Membership: details, expiry, invoices | MVP | 4 | 5 | 1 | 3 | 5 | 4 | ✅ |
| Renewals — **real payments (Razorpay live)** | MVP | 5 | 5 | 1 | 3 | 4 | 5 | 🟡 (STUB) |
| Plan upgrade / freeze / auto-renew | V2 | 4 | 5 | 2 | 3 | 4 | 5 | ❌ |
| Family / multi-member plans | V3 | 3 | 4 | 2 | 3 | 4 | 4 | ❌ |
| Referrals (in-app, anti-fraud) | V2 | 4 | 4 | 2 | 4 | 4 | 3 | 🟡 |
| QR check-in | MVP | 5 | 2 | 1 | 4 | 5 | 3 | ✅ |
| NFC / BLE auto-detect entry | V3 | 4 | 2 | 3 | 4 | 3 | 3 | ❌ |
| Face verify entry | V3 | 3 | 2 | 4 | 3 | 3 | 5 | ❌ |
| Smart lockers | F | 2 | 3 | 2 | 3 | 3 | 3 | ❌ |
| Live occupancy | MVP | 4 | 1 | 3 | 4 | 4 | 2 | ✅ |
| Peak-hours / crowd prediction | V2 | 4 | 2 | 5 | 4 | 4 | 2 | ❌ |
| Class booking / cancel | MVP | 5 | 3 | 2 | 4 | 5 | 3 | ✅ |
| Waitlist / recurring booking / calendar sync | V2 | 4 | 3 | 3 | 4 | 4 | 2 | ❌ |
| Trainer assignment + PT booking | V2 | 4 | 5 | 2 | 4 | 4 | 3 | 🟡 |
| Gym discovery / nearest-gym finder | V2 | 3 | 3 | 3 | 4 | 4 | 2 | 🟡 |
| Chain access / branch transfer | V3 | 3 | 3 | 2 | 3 | 4 | 3 | ❌ |
| Loyalty / rewards system | V3 | 4 | 4 | 3 | 4 | 4 | 2 | ❌ |

### 2.3 Workout intelligence (Brief §3)

| Feature | Phase | Ret | Mon | AI | UX | Scl | Sec | Status |
|---|---|---|---|---|---|---|---|---|
| Set/rep/weight logging + rest timer | MVP | 5 | 2 | 2 | 5 | 5 | 2 | ✅ |
| Trainer-assigned workouts | MVP | 5 | 4 | 2 | 4 | 5 | 3 | ✅ |
| PR tracking + celebration | V2 | 5 | 2 | 3 | 5 | 5 | 2 | 🟡 |
| Routine templates / reuse | V2 | 4 | 2 | 3 | 5 | 5 | 2 | 🟡 |
| Progressive-overload suggestions | V2 | 4 | 3 | 5 | 4 | 4 | 2 | ❌ |
| Recovery-aware / fatigue-aware workouts | V3 | 4 | 4 | 5 | 4 | 3 | 3 | ❌ |
| AI workout generation | V3 | 4 | 5 | 5 | 4 | 3 | 3 | ❌ |
| Exercise library (browse/search/filter/detail/favorites) | V2 | 4 | 2 | 3 | 5 | 5 | 1 | ✅ |
| Video demos | V2 | 4 | 3 | 2 | 5 | 4 | 1 | 🟡 (static) |
| HR-zone training (wearable) | V3 | 4 | 3 | 4 | 4 | 4 | 3 | ❌ |
| GPS / outdoor / sports tracking | V3 | 3 | 2 | 3 | 4 | 4 | 3 | ❌ |
| Form / movement analysis (camera/AI) | F | 3 | 4 | 5 | 4 | 2 | 4 | ❌ |
| Workout streaks / heatmaps | V2 | 5 | 1 | 2 | 5 | 5 | 1 | 🟡 |
| Smart equipment / machine integration | F | 2 | 3 | 3 | 3 | 2 | 3 | ❌ |

### 2.4 Nutrition intelligence (Brief §4)

| Feature | Phase | Ret | Mon | AI | UX | Scl | Sec | Status |
|---|---|---|---|---|---|---|---|---|
| Calorie + macro tracking | V2 | 5 | 3 | 3 | 4 | 5 | 2 | ✅ |
| Meal + water logging | V2 | 5 | 2 | 2 | 4 | 5 | 2 | ✅ |
| Food search + catalog (Indian foods) | V2 | 4 | 3 | 3 | 4 | 5 | 1 | ✅ |
| Micronutrients | V3 | 3 | 2 | 3 | 3 | 4 | 2 | ❌ |
| Barcode scan | V2 | 4 | 2 | 2 | 4 | 4 | 1 | ❌ |
| AI photo meal recognition | V3 | 4 | 5 | 5 | 5 | 3 | 3 | ❌ |
| Meal planning / diet plans (loss/gain/keto/vegan) | V3 | 4 | 5 | 5 | 4 | 4 | 2 | ❌ |
| Intermittent fasting tracker | V3 | 3 | 2 | 3 | 4 | 5 | 2 | ❌ |
| Supplements tracker | V3 | 2 | 3 | 2 | 3 | 5 | 2 | ❌ |
| Dietician / nutritionist marketplace | F | 3 | 5 | 3 | 4 | 3 | 4 | ❌ |
| Recovery / hormone-aware nutrition | F | 3 | 4 | 5 | 3 | 3 | 4 | ❌ |
| Restaurant / allergy support | F | 2 | 2 | 3 | 3 | 4 | 3 | ❌ |

### 2.5 Community & social psychology (Brief §5)

| Feature | Phase | Ret | Mon | AI | UX | Scl | Sec | Status |
|---|---|---|---|---|---|---|---|---|
| Leaderboard (real check-ins) | V2 | 5 | 2 | 2 | 4 | 4 | 2 | ✅ |
| Challenges (real tables, computed progress) | V2 | 5 | 3 | 3 | 4 | 4 | 2 | ✅ |
| Badges / XP / levels | V2 | 4 | 2 | 2 | 5 | 5 | 1 | 🟡 |
| Social feed (posts/reactions/comments) | V3 | 5 | 3 | 4 | 4 | 3 | 3 | ❌ |
| Transformation sharing | V3 | 4 | 3 | 3 | 5 | 4 | 4 | ❌ |
| Team / group / gym challenges | V3 | 5 | 3 | 3 | 4 | 4 | 2 | 🟡 |
| Workout sharing | V3 | 4 | 2 | 3 | 4 | 4 | 2 | ❌ |
| Local / gym groups | V3 | 4 | 3 | 3 | 4 | 4 | 3 | ❌ |
| Stories / reels | F | 3 | 3 | 3 | 4 | 3 | 3 | ❌ |
| Creator / influencer / livestream | F | 3 | 5 | 3 | 4 | 2 | 4 | ❌ |
| Moderation + anti-abuse | V3 | 3 | 1 | 4 | 2 | 3 | 5 | ❌ |

### 2.6 AI & intelligence (Brief §6) — *honest AI only*

| Feature | Phase | Ret | Mon | AI | UX | Scl | Sec | Status |
|---|---|---|---|---|---|---|---|---|
| AI coach (chat: workout/nutrition Q&A, grounded) | V2 | 5 | 5 | 5 | 5 | 3 | 4 | ❌ |
| Daily fitness/readiness score (rules → ML) | V3 | 5 | 4 | 5 | 5 | 3 | 3 | ❌ |
| Adaptive / recovery-aware workouts | V3 | 4 | 5 | 5 | 4 | 3 | 3 | ❌ |
| Smart reminders / motivation engine | V2 | 4 | 2 | 4 | 4 | 4 | 3 | ❌ |
| AI nutritionist (meal suggestions) | V3 | 4 | 5 | 5 | 4 | 3 | 3 | ❌ |
| Anomaly / health-alert detection | F | 4 | 3 | 5 | 3 | 3 | 5 | ❌ |
| Occupancy / crowd prediction | V2 | 4 | 2 | 5 | 4 | 4 | 2 | ❌ |
| AI voice assistant | F | 2 | 3 | 4 | 4 | 3 | 4 | ❌ |
| Body-transformation forecasting | F | 3 | 4 | 5 | 4 | 3 | 4 | ❌ |

**Anti-hallucination doctrine.** No "fake AI." Every AI feature must be **grounded** (cite
the member's own data / a retrieved source), **explainable** ("we suggest X because your
HRV dropped 12%"), and **bounded** (never give medical diagnosis; escalate to human
trainer/physio). Start rules-based → graduate to ML only when we have labeled data. AI
that touches health data is the highest security tier (§2.11).

### 2.7 Wearable & IoT (Brief §7)

| Feature | Phase | Ret | Mon | AI | UX | Scl | Sec | Status |
|---|---|---|---|---|---|---|---|---|
| Apple HealthKit | V3 | 4 | 2 | 4 | 4 | 4 | 3 | 🟡 (unverified) |
| Google Health Connect | V3 | 4 | 2 | 4 | 4 | 4 | 3 | 🟡 (unverified) |
| Samsung Health | V3 | 4 | 2 | 4 | 4 | 3 | 3 | ❌ (planned, gates G1–G5) |
| Fitbit / Garmin / Oura (OAuth cloud APIs) | F | 3 | 3 | 4 | 3 | 3 | 4 | ❌ |
| Smart scales / BP / glucose | F | 2 | 3 | 3 | 3 | 3 | 5 | ❌ |
| Smart gym machines / treadmills / sensors | F | 2 | 3 | 3 | 3 | 2 | 3 | ❌ |
| Smart mirror / AR glasses / VR fitness | F | 1 | 3 | 3 | 4 | 2 | 3 | ❌ |

**Sync architecture (target).** Device → native HealthKit/Health Connect bridge → batched
upsert to BFF `health/samples` (idempotent, deduped by source+timestamp) → daily rollups
(`health/daily`) → scores. Cloud wearables (Fitbit/Garmin/Oura) via server-side OAuth +
webhook/poll, normalized into the same sample schema. Battery: passive background sync,
coalesced writes, no foreground polling.

### 2.8 Premium UX & emotional design (Brief §8)

Geist dark-first DS is in place (`src/design-system/tokens.ts`). Emotional layer:

| Feature | Phase | Status |
|---|---|---|
| Activity rings + haptics + health accents | MVP | ✅ |
| Celebration moments (PR, ring-close, streak milestone) | V2 | 🟡 |
| Skeleton loaders / 60fps transitions / micro-interactions | MVP | 🟡 |
| Calm, dense daily dashboard | MVP | ✅ |
| Personalized / dynamic widgets | V2 | 🟡 |
| Onboarding that sets goal + personalization | MVP | 🟡 |
| Smart, batched, non-spammy notifications | V2 | 🟡 |
| Accessibility (WCAG AA, dynamic type, reduced-motion) | V2 | ❌ |
| Voice / gesture interfaces | F | ❌ |
| AI dashboard (insight cards) | V3 | ❌ |

### 2.9 Business & monetization (Brief §9)

| Stream | Phase | Mon | Notes |
|---|---|---|---|
| Membership renewals (rev-share / SaaS to gym) | MVP | 5 | **Gated on real Razorpay** |
| Premium member tier (AI coach, advanced analytics, plans) | V2 | 5 | Core consumer ARPU |
| Trainer / PT marketplace | V3 | 5 | Take rate on sessions |
| Nutrition-coach marketplace | F | 4 | HealthifyMe model |
| Challenges / paid events | V3 | 3 | Engagement → revenue |
| Supplement / gear ecommerce + affiliate | F | 4 | Inventory/POS already exists backend-side |
| Wearable / insurance / corporate-wellness partnerships | F | 4 | B2B2C scale |

**Pricing psychology.** Free = gym essentials (check-in, membership, classes, basic
tracking) — never paywall the gym relationship. Premium = the *intelligence* layer (AI
coach, readiness, advanced analytics, diet plans). This keeps the wedge free and monetizes
the moat.

### 2.10 Future tech (Brief §10) — realistic vs experimental

- **Realistic (V3–Future, fundable):** cloud-wearable integrations, ML readiness/occupancy
  models, AI photo-meal recognition, predictive churn/injury signals, digital-twin progress
  forecasting.
- **Experimental (watch, don't build yet):** AR/VR workouts, smart-mirror, genomics,
  ambient sensing, robotics, neural interfaces. Track as R&D; do not let them distort the roadmap.

### 2.11 Security, privacy & trust (Brief §11)

Non-negotiable, cuts across every feature:

- **Tenant isolation (sacred).** Single source of truth = `backend/src/prisma/tenant-models.ts`.
  Any new member-data model **must** be added there. Raw SQL must include explicit `gym_id`.
  (The biometric cross-tenant leak — already fixed — is the cautionary tale.)
- **Health-data tier.** Health/biometric/menstrual data = highest sensitivity. Explicit
  consent per data class, granular revoke, on-device-first where possible, encryption at rest.
- **Payments.** PCI-by-delegation (Razorpay holds card data); we store tokens/refs only.
- **Compliance roadmap.** GDPR (consent, export, delete) → DPDP (India) → HIPAA-grade
  posture for health data → SOC 2 as we scale B2B.
- **Trust systems.** Audit logs, consent center, anti-cheat for challenges/leaderboards,
  moderation + anti-abuse for social, biometric template security.

---

## 3. Roadmap

### Now → next (the honest critical path)
These unblock everything else and close the headline gaps from `FEATURE_INVENTORY.md`:

1. **Real payments** — replace Razorpay stub with live integration (renewals + premium tier). *Money is the flywheel's fuel.* **(HARD GATE: payments — confirm before shipping.)**
2. **Verify wearables on device** — G3 native dev-build; prove HealthKit/Health Connect reads. Unblocks all of §2.1 health scores.
3. **Push delivery** — wire FCM creds + EAS projectId so notifications actually deliver.
4. **AI Coach v1** — the #1 competitive gap. Grounded chat over the member's own data.

### V2 (member intelligence + engagement)
PR tracking + celebrations · barcode scan · readiness-precursors (sleep score, HR zones) ·
crowd prediction · waitlist/recurring classes · referral rewards in-app · smart reminders ·
celebration/motion polish · accessibility pass.

### V3 (the WHOOP/Strava/HealthifyMe layer)
Recovery/Readiness "one number" · HRV/stress · adaptive recovery-aware workouts · AI
photo-meal + diet plans · social feed + transformations · NFC/BLE/face entry · Samsung
Health (G1–G5) · trainer & nutrition marketplaces · loyalty.

### Future (R&D + platform)
Cloud wearables (Fitbit/Garmin/Oura) · CGM/BP partners · longevity/biological-age ·
form-analysis CV · creator/livestream · ecommerce · corporate-wellness B2B2C · AR/VR (watch).

### 5-year vs 10-year
- **5-year:** the definitive gym-member super-app in India + emerging markets — verified
  check-in flywheel, premium AI+recovery tier, wearable-connected, trainer marketplace,
  multi-gym chains. Profitable consumer ARPU on top of SaaS.
- **10-year:** a health/fitness/recovery/community OS — wearable-agnostic intelligence,
  predictive health, longevity, global gym network, B2B2C wellness. The "Samsung Health
  meets Strava meets your gym" category leader.

---

## 4. Strategic reports (condensed)

### 4a. What makes a #1 global fitness platform
1. A **daily reason to open** that isn't willpower (gym tie + verified check-in).
2. **One number** that orients the day (readiness/score), not a wall of charts.
3. **Social accountability** — the single biggest retention lever (Strava's lesson).
4. **Frictionless logging** — workouts and meals in seconds, one-handed.
5. **Honest, explainable AI** that earns trust over months.
6. **Premium emotional UX** — celebration, calm, 60fps, haptics.
7. **Wearable-agnostic** — meet the user on whatever they wear.
8. **Trust** — health-grade privacy + bulletproof tenant isolation.

### 4b. Why current fitness apps fail
- **No reason to open** (standalone trackers) → churn after the novelty.
- **Data dumps, no meaning** — charts without "so what."
- **Paywall the basics** → resentment.
- **Notification spam** → muted, then deleted.
- **Toxic comparison** in social → quiet quitting.
- **Hardware lock-in** (WHOOP/Oura) → narrow TAM.
- **Fake/ungrounded AI** → trust collapse on first wrong answer.
- **Beginner-hostile** complexity (Garmin) → drop-off in week one.

### 4c. How we dominate
Own the **gym-attached** category nobody nailed → use the verified check-in as a data +
trust + habit moat → layer consumer-grade intelligence (AI/recovery/nutrition) on a user
we already reach daily → expand to multi-gym chains and wearable-agnostic health OS. Free
wedge (gym essentials), paid moat (intelligence). Win retention via accountability +
"one number" + celebration, not feature count.

### 4d. Most dangerous architectural mistakes to avoid
1. **Cross-tenant leak** — the worst outcome. Two model-sets drifting; raw SQL without `gym_id`.
2. **Treating RLS as load-bearing** — it's decorative here (superuser bypass). App layer is the guard.
3. **Shipping fake AI** — one confident wrong health claim destroys trust.
4. **Health data without consent tiers** — regulatory + trust landmine.
5. **Building experimental tech (AR/VR/genomics) before the wedge is profitable.**
6. **Payments shortcuts** — the stub must become a real, reconciled, idempotent integration.
7. **Notification spam** as a growth hack — it's a retention *destroyer*.
8. **Native wearable claims unverified on device** — never present unverified as fact.

### 4e. Most important retention systems
Verified check-in streaks · "one number" daily score · social accountability (leaderboard/
challenges/feed) · trainer relationship · smart (not spammy) reminders · celebration
moments · renewal nudges. *Retention is accountability + meaning, not feature count.*

### 4f. Most important wearable systems
Reliable passive ingestion (HealthKit/Health Connect first) · normalized sample schema ·
battery-safe background sync · cloud-wearable OAuth (Fitbit/Garmin/Oura) · graceful
native-unavailable fallbacks (the web-preview caveat).

### 4g. Most important emotional UX systems
Ring-close + PR + streak-milestone celebrations · haptics · 60fps motion · calm dense
dashboard · "one number" framing · personalized widgets · sentence-case, human copy ·
reduced-motion + accessibility respect.

---

## 5. How this plan stays honest

- This file is the **vision + classification**. It does **not** assert anything is shipped.
- [`features_list.md`](./features_list.md) is the **source of truth for build + test status**,
  updated only when a feature actually ships and passes `tsc --noEmit` + (where possible)
  runtime/on-device QA. `gym-member-app` has **no automated tests** — verification is
  `tsc` + on-device QA, and that is stated per-feature.
- Hard gates (payments, schema/migrations, auth/tenant-isolation, native EAS shift, new deps)
  are never crossed without explicit confirmation, per [`../../CLAUDE.md`](../../CLAUDE.md).
- "Unverified" is always labeled as such — never presented as a measured fact.

_Last updated: 2026-06-03._
