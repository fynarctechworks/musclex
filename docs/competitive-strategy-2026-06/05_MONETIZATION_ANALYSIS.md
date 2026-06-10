# Monetization & Notification Systems Analysis

> Two systems that the consumer leaders treat as core product, not afterthoughts. Our monetization is structurally different (we're paid by gyms, not members) — which is both a constraint and an opportunity.

---

## PART 1 — MONETIZATION

### 1. How the competitors make money

| Platform | Primary model | Secondary | Notes |
|---|---|---|---|
| Samsung Health | Hardware halo (free app) | — | App exists to sell/retain Galaxy devices |
| HealthifyMe | **Coach subscriptions** | Hardware (scale, CGM) | Human coaching is the premium anchor |
| Cult.fit | **Class memberships** (Pass/Elite) | Per-class, eat.fit, store | Recurring + transactional + ecosystem |
| MyFitnessPal | **Premium subscription** | Ads (free tier) | Paywalls barcode/macros; ad-supported free |
| Strava | **Subscription** | — | Moved segments behind paywall |
| Fitbit | **Premium subscription** | Hardware | Readiness/sleep insights gated |
| Nike Training Club | Free (brand funnel) | — | Drives Nike product + NikePlus |

**Pattern:** the recurring-revenue winners gate either **intelligence** (analytics, readiness, AI, coaching) or **convenience** (barcode, ad removal) — never the core loop.

### 2. Our monetization model (the structural difference)

We are **B2B SaaS** — the gym pays us. The member usually pays the *gym* for membership, not us. So our member-app monetization has **three distinct routes**, in priority order:

#### Route 1 — Make the member app a reason gyms pay us more (B2B value)
This is our *primary* and most defensible monetization. Every retention/engagement feature in this analysis **increases the gym's member retention**, which is the metric gyms care about most. A more engaging member app justifies higher per-seat/per-tier SaaS pricing and reduces gym churn. **The member experience is a B2B revenue multiplier.**

> Strategic implication: features should be scored partly on **"does this help the gym retain its members?"** — because that is what we actually sell. (See `06` scoring — "Business value" captures this.)

#### Route 2 — In-app transactions the gym monetizes (we take a cut / enable)
- **PT (personal training) packs** — sell trainer sessions in-app (we have trainer chat + the relationship).
- **Class packs / drop-ins / premium classes** — Cult-style (we have class booking).
- **Store / supplements / merch** — we have inventory/POS on the backend already.
- **Add-ons** — guest passes, locker rental, event tickets.

> **Blocker:** Razorpay is currently a **stub** (verified, per memory). Route 2 cannot ship until payments are real. This makes "real payments" a **Tier-0 unblocker** in the roadmap.

#### Route 3 — Premium member tier (member pays us/gym for app intelligence)
Mirror the consumer playbook: gate **intelligence**, never the core loop. Candidate premium features:
- AI coach (deep, unlimited) vs. free (limited prompts).
- Advanced health analytics / readiness (post-wearable-sync).
- AI nutrition photo logging beyond a daily quota.
- Year-in-review premium edition, advanced progress analytics.

> Caution: Route 3 competes with the gym's own pricing and must be **gym-configurable** (a gym may want to bundle premium free, or upsell it themselves, or revenue-share). Build it as a **tenant-configurable entitlement**, consistent with our existing `ResourceLimitService` / `checkFeatureAccess` feature-gating pattern already used for the B2B `ai_advisor`.

### 3. Monetization recommendations

| Priority | Move | Rationale |
|---|---|---|
| **P0** | **Make Razorpay real** | Unblocks all in-app commerce (Route 2) and member premium (Route 3) |
| **P0** | Frame engagement features as **B2B retention value** in sales/pricing | Our true monetization; costs nothing, raises ACV |
| **P1** | **PT-pack purchase** in trainer chat | Highest-margin, leans on existing trainer relationship |
| **P1** | **Class packs / premium classes** | Cult-proven; we have the booking rails |
| **P2** | **Tenant-configurable premium member tier** (AI + analytics) | Recurring member revenue; must respect gym pricing autonomy |
| **P2** | Surface store/supplements (existing POS) in member app | Inventory backend already exists; just needs member surface + payments |

> **Anti-pattern to avoid:** do NOT paywall the core loop (check-in, basic logging, class booking, streaks, social). The consumer leaders that paywalled core mechanics (Strava segments) got backlash. Gate *intelligence and convenience*, keep the *habit* free — the habit is what makes the gym's members stick, which is what we're actually selling.

---

## PART 2 — NOTIFICATION SYSTEMS

### 4. How the competitors use notifications

| Type | Example | Why it works |
|---|---|---|
| **Social signal** | Strava "X gave you kudos" | Highest open/return rate — pure dopamine, never feels like nagging |
| **Streak-at-risk** | Duolingo/MFP "keep your streak!" | Loss aversion; time-boxed urgency |
| **Ambient insight** | Fitbit "your sleep score is 82" | Delivers value, not a demand |
| **Scheduled obligation** | Cult "your 6pm class starts in 1h" | Real-world commitment reminder |
| **Re-engagement** | "We miss you — here's what changed" | Win-back lapsed users |
| **Achievement** | "New badge unlocked!" | Variable reward |
| **Human** | HealthifyMe coach message | Personal, high-trust |

### 5. Our notification state (verified)

Per memory (`project_member_push`) and codebase: device-token persistence, register/delete, and **Expo send capability are built and runtime-verified**, but **delivery needs EAS projectId + FCM credentials**, and there is **no segmentation/triggering engine** — it's plumbing, not a campaign system.

So: **transport exists, intelligence does not.**

### 6. Notification recommendations

| Priority | Move | Maps to mechanic |
|---|---|---|
| **P0** | Finish delivery setup (EAS projectId + FCM creds) | Without this nothing sends in prod |
| **P1** | **Trigger engine** — event-driven notifications (streak-at-risk, kudos received, class reminder, badge) tied to the retention loop | Social signal, streak, obligation |
| **P1** | **Notification preferences** per category (member control = trust, avoids opt-out) | Retention / anti-churn |
| **P2** | **Segmentation** — target by attendance pattern, streak state, churn risk (we have the check-in data) | Re-engagement, win-back |
| **P2** | **Trainer-initiated** push (trainer nudge → member) | Human accountability |
| **P2** | **Quiet hours + frequency caps** | Protects the highest-value channel from fatigue |

### 7. Notification quality principle

> **Every push should be a gift or a social signal — never a chore.** Rank notification types by value-to-member: kudos/social > insight > achievement > scheduled reminder > streak-at-risk > generic re-engagement. Send high-value types liberally; send low-value types sparingly and only with strong targeting. We can do better than the consumer apps here because our **check-in data tells us exactly who is slipping** — target the streak-at-risk and win-back pushes at *real* behavioral signals, not blanket sends.

The notification engine and the retention loop are the same system viewed from two ends: the loop defines *what* should trigger a push; the engine *delivers* it. Build them together.
