# Samsung Health + One UI — Integration Analysis & Roadmap

> Status: **Phase 1 (Analysis) complete.** Phases 2–9 are planned, gated on
> explicit go/no-go decisions (deps, schema, native build, legal). See §7.
> Source reference: [`samsung-health-rn-expo-guide.md`](../samsung-health-rn-expo-guide.md)
> Authored: 2026-06-03 · Scope: `gym-member-app` (Expo/RN) + `backend` BFF.

This document **adapts** Samsung Health's architecture and One UI's principles to
our existing multi-tenant gym SaaS. It does **not** clone Samsung Health, fake
health data, or surface unverified metrics — per the brief and per
[`CLAUDE.md`](../../CLAUDE.md).

---

## 0. Executive summary — the one thing to know

**Most of the guide's "hard" layer already exists in this repo and shipped on
2026-06-03.** The unified health provider, the HealthKit/Health Connect bridge,
idempotent sync, the daily-rollup schema (tenant-scoped, GDPR-aware), and the
Health + Home UI are all live. The two libraries the guide says to `expo install`
are already in `package.json`.

So the work ahead is **not** "build a health platform." It is three distinct,
separable tracks:

| Track | Nature | Risk | Gated? |
|---|---|---|---|
| **A. One UI / premium UX** | Pure RN UI on existing deps | Low | No — safe to start |
| **B. Wider wearable + advanced metrics** | Verify native bridge on-device; extend metric coverage | Medium | Some (device QA, maybe 1 schema add) |
| **C. Samsung-exclusive (ECG/BIA/IHRN/apnea) + Partner Program** | New Kotlin native module + legal | High | **Yes** — deps, native build, 2–6wk legal |

The biggest honest correction to the brief: **you cannot "install everything and
do it all legally" in one pass.** Samsung Partner approval alone is a multi-week
external review needing a release keystore SHA-256, a published privacy policy,
and consent-UX screenshots. The plan below sequences around that reality.

---

## 1. Section-by-section gap analysis

Legend: ✅ implemented · 🟡 partial · ❌ missing · ⭐ high-value add · ▽ low-priority · ⚠️ risky · 🏢 tenant concern · 🐢 perf concern

### Guide §1 — Samsung developer surface (4 SDKs)
| Capability | Status | Notes |
|---|---|---|
| Health Data SDK (phone) | 🟡 | We use **Health Connect** which mirrors ~85% of it. Samsung-only types (ECG/BIA/IHRN/apnea/skin-temp) ❌ — need the native module (§C). |
| Sensor SDK (Wear OS) | ❌ ▽ | Raw PPG/accel from Galaxy Watch. Needs a companion Wear OS app. **Out of scope** for a gym member app — defer to "future research." |
| Accessory SDK | ❌ ▽ | OEM-only (feed hardware *into* Samsung Health). Not relevant. |
| Research stack | ❌ ▽ | Clinical-study tooling. Not relevant. |

### Guide §2 — Integration architecture
| Item | Status | Notes |
|---|---|---|
| Unified TS health service | ✅ | [`provider.ts`](../src/features/health/provider.ts) `HealthBridge` is exactly the guide's `HealthProvider` shape, adapted to our BFF ingest model. |
| iOS HealthKit path | 🟡 ⚠️ | [`provider.native.ts`](../src/features/health/provider.native.ts) reads via `@kingstinct/react-native-healthkit`. **UNVERIFIED on device** (flagged in-file). |
| Android Health Connect path | 🟡 ⚠️ | Same file, `react-native-health-connect`. **UNVERIFIED on device.** |
| Samsung native Expo module | ❌ ⚠️ 🏢 | Guide §2.4 Kotlin module. Big lift + Partner Program. See §C. |
| `expo-build-properties` plugin | ❌ | Needed (minSdk 29) before any native build. Not yet a dep. |
| Permissions in `app.json` | 🟡 | Need Health Connect `READ_*` perms + iOS usage strings wired via config plugins. Verify current `app.config`. |
| Background sync | 🟡 | `syncHealth()` is focus-driven + idempotent. No `expo-background-fetch` / HealthKit `observe` yet (⭐). |

### Guide §3 — One UI design system
| Item | Status | Notes |
|---|---|---|
| Design tokens | ✅ (ours) | [`tokens.ts`](../src/design-system/tokens.ts) is **Geist/Vercel, dark-first**. **Decision:** keep ours; adopt One UI *principles* (focus blocks, calm surfaces, vibrant small accents), **not** Samsung's light-mode palette. Cloning the palette would fight our brand. |
| Per-category accent colors | ❌ ⭐ | One UI's best idea: each domain (activity=orange, heart=red, sleep=purple…) gets one saturated accent. We currently use `cyan` for *all* health. Worth adding a `health` accent ramp to tokens. |
| Focus block card | ✅ | Our `Card` already is this pattern. |
| Activity ring | 🟡 | [`ProgressRing.tsx`](../src/design-system/ProgressRing.tsx) exists (svg). Guide wants a 3-ring gradient/Skia widget (⭐). Can be done in `react-native-svg` we already have — **no Skia dep required** for v1. |
| Collapsing large-title header | ❌ ⭐ | Signature One UI motion. Doable with installed `react-native-reanimated`. |
| Vital card / metric tile | ✅ | `HealthCard` tiles cover this. |
| Bottom nav (One UI) | ✅ (ours) | [`TabBar.tsx`](../src/navigation/TabBar.tsx). |
| Motion + haptics | 🟡 | `expo-haptics` installed; usage is sparse. ⭐ add Light/Medium/Success/Warning vocabulary. |
| Dark mode | ✅ | App is dark-first already (ahead of the guide). |
| Accessibility (4.5:1, 48dp, font scale, labels) | 🟡 | Partial. ⭐ audit icon-only buttons + font scaling on new widgets. |

### Guide §4–5 — Screens & data recipes
| Screen | Status | Notes |
|---|---|---|
| Permissions/onboarding | 🟡 | Connect flow exists in `health.tsx`; no animated 3-page intro (▽). |
| Today/Home health snapshot | ✅ | `HealthCard` on Home. ⭐ upgrade to rings + readiness. |
| Activity detail (hourly bars) | 🟡 | `BarChart` exists; no dedicated activity screen (⭐). |
| Sleep (stages, score) | ❌ ⭐ | Schema already has `sleep_deep`/`sleep_rem`/`sleep_duration`. UI missing. High retention value. |
| Heart (resting trend, HRV, BP) | 🟡 | Metrics modeled; needs a Heart detail screen (⭐). BP not in our enum (schema add if wanted). |
| Body composition | 🟡 | `body_weight`/`body_fat`/`vo2max` modeled + manual weight log exists. Trend screen missing (⭐). |
| Nutrition | ✅ (separate) | Already shipped as its own module. Don't duplicate. |
| Cycle tracking | ❌ ⚠️ | Sensitive special-category data; not modeled. **V3 + explicit consent/legal review.** |
| Together/goals (social) | ✅ (separate) | Community module already shipped. Reuse, don't rebuild. |

### Guide §6–7 — State, caching, charts
| Item | Status | Notes |
|---|---|---|
| TanStack Query for reads | ✅ | Already the app's data layer. |
| Query persistence | ❌ ▽ | `react-query-persist-client` + mmkv optional. We have offline outbox already. |
| `victory-native` / Skia charts | ❌ | **Not required for v1** — `react-native-svg` covers rings/lines/bars we already ship. Add Skia only if a chart proves too heavy. Avoids 2 heavy deps. |
| `react-native-maps` (GPS routes) | ❌ ▽ | Only if we add outdoor-run routes. Defer. |

### Guide §8 — Privacy/compliance
| Item | Status | Notes |
|---|---|---|
| Consent timestamps | ✅ | `MemberWearableConnection.consented_at` stored. |
| Tenant scoping of health data | ✅ 🏢 | All 3 models `gym_id`-scoped + in `TENANT_MODELS` (see memory `project_member_health_platform`). **Verify** they're in the single source-of-truth `tenant-models.ts` (R1 risk from isolation audit). |
| Export / delete (GDPR) | 🟡 ⭐ | `onDelete: Cascade` on member covers delete; no member-facing **export** (JSON dump) or **per-provider purge** UI yet. Required for GDPR posture. |
| HealthKit "no transmit without opt-in" | ⚠️ | We **do** transmit to our BFF. This is allowed *with* explicit opt-in, which the connect flow provides — but App Store review scrutinizes it. Must be airtight before iOS submission. |
| Samsung Partner Program | ❌ ⚠️ | Required for Samsung-only types in production. Not started. |

---

## 2. Architecture gap analysis

**Strengths (keep):** clean platform-split provider; idempotent sync keyed on
`(member_id, type, source, source_uuid)`; raw-samples + daily-rollup split so
dashboards never scan raw rows; tenant-scoped, consent-aware schema.

**Gaps:**
1. **Derived-metric layer is missing.** Recovery/readiness/consistency/hydration
   scores have no home. They must be **computed, explainable, server-side** (so
   logic is testable + consistent across devices), written into a new
   `member_health_scores` daily table or derived on read. *(schema decision —
   gated.)*
2. **No background sync.** Today's data only refreshes on app focus. Add
   `expo-background-fetch` + HealthKit `observe`/HC change-tokens. *(1 dep.)*
3. **Native bridge unverified.** The whole Android/iOS read path is `⚠️ UNVERIFIED`
   per its own header. Track B step 1 is device QA, before extending.
4. **Samsung-only types need a native module** (§C) — architecturally isolated
   behind the existing `HealthBridge`, so it's additive, not a rewrite.

## 3. UX gap analysis

**Strong base:** dark-first Geist DS, real-data-only discipline, existing
rings/charts primitives. **Adopt from One UI (principles only):**
per-category accent color, collapsing large-title header, the "calm surface +
vibrant small accent" rule, a haptics vocabulary, ring-fill animation. **Avoid:**
Samsung's light palette, feature-bloat screens duplicating Nutrition/Community.

## 4. Wearable-readiness analysis

| Provider | Readiness | Blocker |
|---|---|---|
| Apple HealthKit | 🟡 code-complete, unverified | On-device QA + iOS usage strings + EAS build |
| Google Health Connect | 🟡 code-complete, unverified | On-device QA + Android perms + EAS build |
| Fitbit | ❌ | OAuth web API (no native SDK) — server-side ingestion (V2) |
| Garmin | ❌ | Garmin Health API partner access (V2/V3) |
| Samsung (exclusive types) | ❌ | Native module + Partner Program (§C) |

**Verdict:** we are "leaving Expo Go" the moment wearables must actually read —
already acknowledged in `provider.native.ts`. EAS dev build is the gate for *all*
real wearable QA.

## 5. Health-data readiness analysis

Schema already supports: steps, active/resting calories, distance, active minutes,
heart rate, resting HR, HRV, sleep duration/deep/REM, SpO₂, stress, body weight,
body fat, VO₂max, respiratory rate, mood. **This is already broad.** Missing that
the guide implies: blood pressure, blood glucose, body temperature, skin temp,
hydration/water, BMI, skeletal-muscle-mass, menstruation, ECG/BIA/IHRN/apnea.
Adding any is a **schema change → gated** (hard rule 3), and several
(glucose, BP, menstruation, ECG) carry elevated medical/special-category
sensitivity → legal review before modeling.

---

## 6. Cross-cutting concerns

- **🏢 Tenant isolation:** health is the most sensitive data in the app. Every
  new model/query MUST be `gym_id`-scoped and registered in the single
  source-of-truth tenant model set. Re-audit after any addition (ref isolation
  audit R1). No raw SQL over health tables without a `gym_id` filter (R5).
- **🐢 Performance:** dashboards read `member_health_daily` (pre-aggregated) —
  keep it that way; never chart off raw `member_health_samples`. Skia/victory
  add bundle weight + low-end-device cost — defer until svg proves insufficient.
- **Scalability:** raw samples grow unbounded. Plan a retention/rollup policy
  (e.g. keep raw 90d, daily forever) before high-volume HR streaming lands.
- **Privacy/legal:** export + delete UX is a GDPR gap to close before scaling.

---

## 7. Decision gates (need your go/no-go — per CLAUDE.md hard rules 1, 3, 7)

I will not cross these without an explicit OK:

- **G1 — New dependencies.** For Track A, the only *possibly* new dep is
  `expo-build-properties` (config-only). Charts/rings can ship on existing
  `react-native-svg` → **0 new runtime deps for Phase A.** Skia/victory/maps/
  background-fetch each need a yes, justified individually when proposed.
- **G2 — Schema changes.** Derived `member_health_scores` table, and any new
  metric type (BP, hydration, BMI, …) are schema changes. Each needs sign-off
  and a tenant-isolation re-check. **None done without flagging.**
- **G3 — Native build / leaving Expo Go.** Required for real wearable QA. One-way
  workflow shift; needs your OK + an EAS account.
- **G4 — Samsung native module + Partner Program.** Highest risk. Kotlin module,
  release keystore, published privacy policy, 2–6wk external review. Only start
  if Samsung-exclusive metrics (ECG/BIA/IHRN) are a real product priority.
- **G5 — Sensitive metrics (glucose, BP, menstruation, ECG).** Legal/consent
  review before modeling or surfacing.

---

## 8. Recommended roadmap (sequenced around the gates)

### Phase A — Premium UX on what we already have *(safe; 0 new runtime deps)*
A1. Add a `health` per-category accent ramp to `tokens.ts` (activity/heart/sleep/
   body/nutrition), used as small vibrant accents only.
A2. `ActivityRings` composite (svg, animated via installed reanimated) — replace
   single-cyan tiles with rings on Home + Health header.
A3. Collapsing large-title header primitive (reanimated) for detail screens.
A4. Haptics vocabulary helper (`useHaptics`: tab=Light, toggle=Medium, save=
   Success, anomaly=Warning) wired into existing interactions.
A5. Sleep detail screen (stages bar + 7-day trend) — **data already in schema**,
   surfaced only when real samples exist.
A6. Heart + Body-composition detail screens off existing metrics.
A7. a11y pass (labels, font scaling, contrast) on new widgets.

### Phase B — Wearable hardening *(needs G3; maybe one G2)*
B1. EAS dev build; **verify** `provider.native.ts` on a real iPhone + Android.
B2. Wire iOS usage strings + Health Connect perms via config plugins.
B3. Background sync (`expo-background-fetch` + observe/change-tokens) — G1 (1 dep).
B4. Server-side derived scores (recovery/readiness/consistency/hydration),
   explainable + tested — G2 (`member_health_scores`).
B5. GDPR export + per-provider purge UX.

### Phase C — Advanced & Samsung-exclusive *(needs G2/G4/G5)*
C1. Extend metric coverage (hydration, BMI, BP…) — per-metric G2/G5.
C2. Samsung native Expo module for ECG/BIA/IHRN/apnea — G4.
C3. Submit Samsung Partner request in parallel (it takes weeks).

### Phase D — Intelligence *(after C data exists)*
D1. Readiness scoring model tuning, weekly health summaries, trend insights —
   all computed + explainable, no fabricated numbers.

---

## 9. Explicitly out of scope / rejected from the guide
- Wear OS companion app + Sensor SDK (raw PPG/accel) — not a gym-app need.
- Accessory SDK / Research stack — irrelevant to our product.
- Samsung's light-mode palette — conflicts with our dark-first brand.
- `victory-native` + Skia as a default — avoided unless svg proves insufficient.
- Re-building Nutrition / Community / social — already shipped; reuse.
