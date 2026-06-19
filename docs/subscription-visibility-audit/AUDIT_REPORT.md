# Subscription Visibility & Upgrade-Experience Audit

**Scope agreed:** Frontend admin web (`frontend/`) only. Audit-first; **no code shipped** in this slice.
**Date:** 2026-06-19 · **Branch:** `feat/per-gym-schemas` · **Author:** Claude (Principal-architect framing)

> ⚠️ **HARD-STOP NOTICE (CLAUDE.md):** the eventual implementation touches entitlement/plan
> logic. This document is the analysis deliverable only. Nothing here has been executed.
> Implementation requires explicit go-ahead per the gate in CLAUDE.md §"How we work".

---

## 0. Executive summary — the premise is only ⅓ true

The brief assumes "if a module isn't in the plan, it's completely hidden." The codebase is more
nuanced. There are **three independent gating systems**, and only ONE of them hard-hides UI by plan:

| # | System | Gates on | Hides UI today? | Should it hide after refactor? |
|---|--------|----------|-----------------|-------------------------------|
| 1 | **Lifecycle lock** (`active`/`grace_period`/`locked`/`suspended`) | *billing state* (paid vs unpaid) | No — already "visible + read-only + renewal modal" | No change. This is **already** the target pattern, applied to billing. We reuse its plumbing. |
| 2 | **Plan feature map** (`plan.features.<key>`) | *entitlement tier* (free/starter/pro/enterprise) | **YES — this is the only hard-hide** | **No — convert to visible+locked+upsell** |
| 3 | **RBAC permissions** (`can(module,'view')`) | *staff role* | Yes | **Keep hiding** (per your decision — role-hidden stays hidden) |

**Net finding:** the requested "show-everything-but-locked" refactor is **almost entirely a frontend
change to system 2**, plus a thin entitlement context. The backend security you asked to preserve is
**already minimal, clean, and correct** — only **4 enforcement call-sites** exist and none need to
change. There is **no database change required**. This is a far smaller and safer job than the brief implies.

The single function responsible for all plan-based hiding is
[`filterByFeatures`](../../frontend/src/components/layout/app-layout.tsx#L127-L129).

---

## 1. How gating actually works today (verified, with file references)

### 1.1 Source of truth for entitlements
- Plan definitions live in [`backend/src/common/plan-configs.ts`](../../backend/src/common/plan-configs.ts).
  Each plan has `features: Record<string, boolean>` + numeric limits (`max_members`, `max_branches`,
  `max_staff`, `storage_limit_gb`, `api_access`). These seed the `public.subscription_plan` table
  (`ensurePlansSeeded`). The DB row is authoritative; `PLAN_CONFIGS` is the fallback.
- The 16 feature keys today: `member_management, check_in, manual_payments, basic_reports,
  multi_branch, staff_management, trainer_management, class_scheduling, payment_gateway,
  marketing_campaigns, ai_advisor, api_access, whatsapp_notifications, email_campaigns,
  custom_roles, audit_logs`.

### 1.2 How the frontend receives entitlements
- `GET /settings/account` → [`SettingsService.getAccountOverview`](../../backend/src/settings/settings.service.ts#L36)
  returns `{ subscription, usage, features }` where `features = planConfig.features`.
- The app shell fetches it once (`queryKey: ["account-overview"]`, 5-min stale) in
  [`app-layout.tsx`](../../frontend/src/components/layout/app-layout.tsx#L487-L495).

### 1.3 The hard-hide (system 2)
```ts
// frontend/src/components/layout/app-layout.tsx:126-129
function filterByFeatures(items, features) {
  return items.filter((item) => !item.feature || features[item.feature] === true);
}
```
Each nav item carries an optional `feature` key (line 85-112). If the plan's flag is `false`, the
item is **removed from the array** → it never renders. Applied to: primary nav, secondary "Tools"
nav, and commerce/Store nav (lines 497-501). This is the entire plan-hiding surface in the web app.

### 1.4 RBAC hide (system 3 — keep as-is)
`filterByPermissions` (line 132) removes items the user's role can't `view`. Per your decision,
this stays. The refactor must therefore distinguish **plan-locked** (→ show locked) from
**role-hidden** (→ stay hidden). Practically: run `filterByPermissions` first, then map the survivors
through an entitlement decorator instead of `filterByFeatures`.

### 1.5 Backend enforcement (system 2 server side) — complete inventory
`ResourceLimitService.checkFeatureAccess(studioId, key)` throws `403` if the plan flag is false.
Call-sites (the **entire** server-side plan-feature enforcement surface):

| File | Line | Feature key |
|------|------|-------------|
| [`staff/staff.service.ts`](../../backend/src/staff/staff.service.ts#L153) | 153 | `staff_management` |
| [`classes/classes.service.ts`](../../backend/src/classes/classes.service.ts#L79) | 79 | `class_scheduling` |
| [`ai/ai.controller.ts`](../../backend/src/ai/ai.controller.ts#L29) | 29, 41 | `ai_advisor` |

Plus numeric limits (not feature flags): `checkMemberLimit` (members.service:291),
`checkBranchLimit` (branches.service:89), `checkStaffLimit` (staff.service:154).

> **Security implication:** these stay exactly as they are. "Show everything but locked" is a UI
> change; the server keeps rejecting writes the plan doesn't entitle. A user who hand-crafts an API
> call to a non-entitled feature still gets `403`. This satisfies the brief's security requirement
> with **zero backend edits**.

### 1.6 Lifecycle lock (system 1 — the pattern to copy)
The billing-state system is already a textbook "visible-but-locked" implementation and is the
blueprint for what we build for entitlements:
- Backend: [`SubscriptionLockGuard`](../../backend/src/common/guards/subscription-lock.guard.ts)
  blocks writes (not reads) with `403 { error_code: 'SUBSCRIPTION_LOCKED' }`.
- Frontend: [`SubscriptionProvider`](../../frontend/src/features/subscription/subscription-provider.tsx)
  polls `/subscription/status`, drives a write-gate in
  [`api-client.ts`](../../frontend/src/services/api-client.ts#L27-L57) (`setMutationAllowed`), and
  auto-opens a renewal modal. [`SubscriptionBanner`](../../frontend/src/features/subscription/subscription-banner.tsx)
  shows a sticky status bar. **Reads stay open; writes are gated; a CTA is always present.**

We will mirror this architecture for entitlements (a parallel `EntitlementProvider` + `FeatureGate`),
**not** invent a new pattern. This is the lowest-risk path and keeps the two concerns separate
(billing-state lock ≠ plan-tier lock; they compose).

---

## 2. Deliverable 1 — Hidden-feature inventory

> Format: File · Component · Feature · Current behavior · Required behavior

### 2.1 Navigation (the only plan-hide today)
| File | Component | Feature key | Current | Required |
|------|-----------|-------------|---------|----------|
| `app-layout.tsx:87` | Sidebar · Members | `member_management` | hidden if false (never false in any plan) | visible (no-op) |
| `app-layout.tsx:92` | Sidebar · Schedule | `class_scheduling` | **removed** on free/—; present starter+ | **visible + lock badge** when false; route loads shell |
| `app-layout.tsx:95` | Sidebar · Marketing | `marketing_campaigns` | **removed** below pro | **visible + lock badge** |
| `app-layout.tsx:94` | Sidebar · Staff | `staff_management` | hidden if false (true in all plans) | visible (no-op) |
| `app-layout.tsx:100` | Tools · Referrals | `marketing_campaigns` | **removed** below pro | **visible + lock badge** |
| `app-layout.tsx:102` | Tools · AI Advisor | `ai_advisor` | **removed** below pro | **visible + lock badge** |
| `app-layout.tsx:111` | Store · Reports | `basic_reports` | hidden if false (true in all plans) | visible (no-op) |

> Note: several keys (`member_management`, `staff_management`, `basic_reports`, `manual_payments`,
> `check_in`) are `true` in **every** plan, so they never actually hide. The features that *do*
> currently disappear by plan are: **`class_scheduling` (free), `marketing_campaigns` (free+starter),
> `ai_advisor` (free+starter)**. That is the real-world hide surface — small and well-bounded.

### 2.2 Routes with NO plan guard (already always-visible — page-shell work only)
Confirmed routes under `frontend/src/app/[gymSlug]/`: `ai, biometrics, branches, check-in, classes,
crm, finance, inventory, marketing, members, memberships, payments, pos, referrals, reports,
schedule, settings, staff, visits`. None of these pages perform their own plan check today — they
rely entirely on the nav hide. So if reached directly by URL, a non-entitled page **currently loads**
(only the write actions 403 server-side). The refactor formalizes this into an explicit locked shell.

### 2.3 Component-level plan checks
A grep for plan/feature gating inside components returns **none** beyond the nav. There are no
`if (features.x)` guards scattered across cards, buttons, or widgets. (The `locked` hits elsewhere
are the kiosk PIN lock and the billing lifecycle lock — unrelated.) **This is good news: the blast
radius is the nav + page shells, not hundreds of components.**

---

## 3. Deliverable 2 — Navigation audit
- **Sidebar (desktop + mobile Sheet):** driven by `gymNavItems`, `gymSecondaryNavItems`,
  `commerceNavItems`. Hide → lock conversion happens here. *Decision applied:* run
  `filterByPermissions` (role) first, then decorate survivors with entitlement state (never drop).
- **Mobile bottom nav** (`mobileNavTabs`, `commerceMobileTabs`, lines 76-120): these carry `module`
  (RBAC) but **no `feature` key** — they're already plan-agnostic. Lowest-priority; add lock badges
  to AI tab for consistency.
- **Dashboard shortcuts / quick actions:** dashboard page exists
  (`[gymSlug]/dashboard/page.tsx`) — audit for premium upsell cards (Deliverable 9).
- **Settings nav:** `/settings/subscription`, `/settings/account`, `/settings/plans` are the upgrade
  destinations and are explicitly **always-allowed** even under billing lock
  (`ALWAYS_ALLOWED_PREFIXES`). Upgrade path is reachable from any lock state.

**Goal state:** no nav item disappears due to *plan*. Each renders one of: nothing (Available),
lock badge + `Premium` tag (Locked). Role-hidden items still don't render.

---

## 4. Deliverable 3 — Page-level audit
Pattern for every plan-gated route: render the page **shell** (header, breadcrumb, layout chrome,
sample/empty state) and overlay a `LockedFeatureCard` where the live content would be; disable all
mutating actions. Reads that are harmless can still render real data (the server already allows GETs
under billing lock; entitlement-gated GETs are case-by-case — default to showing a preview, not real
data, for not-yet-purchased modules to avoid implying the feature is on).

Priority pages (those that actually lock by plan today): **Schedule/Classes, Marketing, Referrals,
AI Advisor**. Secondary (defensive shells, never hidden today but listed in the brief): Reports,
Multi-branch, Staff, Integrations/API, White-label (no route exists yet — see §11 risks).

---

## 5. Deliverable 4 — Component audit
Because there are no scattered component-level plan checks (§2.3), the component work is **additive,
not surgical**: build a small kit and apply at the page-shell + nav level.
- Buttons/actions: wrap "create/upgrade-gated" CTAs in `<FeatureGate feature="x" mode="disable">`.
- Cards/widgets: `LockedFeatureCard` overlay.
- Exports/reports/bulk ops: same gate, `mode="disable"`, click → `UpgradeModal`.

---

## 6. Deliverable 5 — Security audit
| Surface | Finding | Action |
|---------|---------|--------|
| API authorization | `checkFeatureAccess` enforces 3 keys server-side; writes 403 regardless of UI | **Keep.** Add the same guard to any feature we newly *advertise* as upgradeable but that currently has no server check (e.g. marketing endpoints — verify before launch). |
| Lifecycle write-lock | `SubscriptionLockGuard` (global APP_GUARD) blocks all non-exempt writes when unpaid | Keep; compose with entitlement gate. |
| RLS / tenant isolation | Decorative (app = superuser w/ `rolbypassrls`); real isolation = `gym_id` `$use` injection | **Untouched by this work** — pure UI change. No new queries added. |
| Client write-gate | `setMutationAllowed` is UX only; backend is authoritative | Keep; entitlement gate is likewise UX-only. |
| Bypass risk | A user un-hiding nav cannot gain access — server still 403s the 3 gated features | ✅ The brief's "never gain access by bypassing UI" already holds for enforced features. **Gap:** features advertised as premium but lacking a server check would be bypassable. Enumerate before flipping each from hidden→locked. |

**Key security task before launch:** for every feature key we convert from hidden→visible-locked,
confirm a matching server-side `checkFeatureAccess` (or limit) exists. Today only `staff_management`,
`class_scheduling`, `ai_advisor` are enforced. `marketing_campaigns`, `whatsapp_notifications`,
`email_campaigns`, `custom_roles`, `audit_logs`, `api_access` are **advertised but not server-enforced**
— hiding them was their only protection. Converting them to "visible-but-locked" **removes that
protection unless we add the guard.** This is the single most important security item in the whole effort.

---

## 7. Deliverable 6 — Database impact analysis
**No schema change required.** Everything needed already exists:
- `public.subscription_plan.features` (Json) holds the per-plan map.
- Upgrade/pricing metadata (display_name, prices, descriptions) already on the plan row.
- "Upgrade metadata / benefits / ROI / screenshots" requested by the brief is **presentation copy**,
  best kept as a **static frontend feature registry** (`features.ts`) keyed by feature, not new DB
  columns — it's marketing copy, changes with design, and shouldn't require a migration. (If SCC-editable
  copy is later wanted, that's a separate, gated schema discussion — out of scope here.)

This avoids the CLAUDE.md schema hard-stop entirely.

---

## 8. Deliverable 7 — Central feature-gate architecture (proposed, frontend-only)
Single source of truth: `frontend/src/features/entitlements/`.

```
features/entitlements/
  registry.ts            // FEATURE_REGISTRY: key → { name, description, why, requiredPlan,
                         //   benefits[], icon, previewKind } — the marketing/metadata SOT
  plan-resolver.ts       // resolvePlan(account) → { plan, features, limits } from /settings/account
  entitlement-engine.ts  // can(featureKey) / state(featureKey) → 'available'|'locked'
  usage-limit-engine.ts  // usage(resource) → { current, max, percent, atLimit } (from account.usage)
  entitlement-provider.tsx // <EntitlementProvider> context — wraps authed tree (sibling of SubscriptionProvider)
  use-entitlements.ts    // useEntitlement(key), useUsageLimit(resource)
  components/
    FeatureGate.tsx        // <FeatureGate feature mode="hide|disable|lock"> — mode defaults to 'lock'
    LockedFeatureCard.tsx  // visible card w/ lock icon, plan limitation, preview, Upgrade CTA
    UpgradeModal.tsx       // feature name · why · current plan · required plan · benefits · 3 CTAs
    UpgradeBanner.tsx      // inline page banner (distinct from billing SubscriptionBanner)
    UpgradeButton.tsx      // standardized CTA → opens UpgradeModal or routes to /settings/subscription
    PlanComparisonModal.tsx// tier matrix (reuse PlanComparisonView if suitable)
    FeaturePreviewModal.tsx// screenshots / sample data / walkthrough (State 3)
    PremiumTag.tsx         // small "Pro"/"Enterprise" pill for nav
```

**Reuse, don't reinvent:** `EntitlementProvider` mirrors the proven `SubscriptionProvider`; the
upgrade destination is the existing `/settings/subscription`; `PlanComparisonView` already exists
in `features/memberships/components`. The engine reads from the **already-fetched** `/settings/account`
payload (no new endpoint).

---

## 9. Deliverable 8/9/10 — Refactor & implementation roadmap (when authorized)
Built as reviewable slices, each independently shippable:

1. **Slice A — Registry + engine + provider (no UI change yet).** Add `features/entitlements/*`,
   wrap the authed layout in `<EntitlementProvider>`. Verify with `tsc --noEmit`. Zero visual change.
2. **Slice B — Kit components.** `LockedFeatureCard`, `UpgradeModal`, `UpgradeButton`, `PremiumTag`,
   `FeatureGate`. Storybook/manual render. Still no behavior change.
3. **Slice C — Nav conversion.** Replace `filterByFeatures` with entitlement decoration; keep
   `filterByPermissions`. This is the headline change: locked nav items now show with `PremiumTag` +
   lock and route to a shell. **Most visible slice — gets its own review.**
4. **Slice D — Page shells for the 4 real locked routes** (Schedule, Marketing, Referrals, AI):
   render shell + `LockedFeatureCard` when not entitled.
5. **Slice E — Dashboard premium cards** (Deliverable: dashboard enhancements).
6. **Slice F — Security backfill.** Add `checkFeatureAccess` to any advertised-but-unenforced feature
   before it's surfaced as "locked but real-looking" (see §6). **Crosses backend — separate gate.**
7. **Slice G — Analytics events** (Deliverable 11).

**Migration plan:** no data migration. Roll-out is purely code; feature-flag the nav swap
(`NEXT_PUBLIC_ENTITLEMENT_UPSELL=1`) so it can be toggled without redeploy and A/B'd for conversion.

---

## 10. Deliverable 11 — Upgrade UX
`UpgradeModal` content contract (all sourced from `FEATURE_REGISTRY` + `/settings/account`):
Feature name · Why it's useful · Current plan (from account) · Required plan (from registry) ·
Benefits unlocked · **Upgrade CTA** (→ `/settings/subscription`) · **Contact Sales CTA**
(`mailto:` / form) · **Start Trial CTA** (only if trial enabled for that feature — optional State 3).

---

## 11. Deliverable 12 — Mobile (web admin responsive) + 13 Risks/Edge cases
- **Member mobile app is out of scope** (your decision). Note for the record: it uses a *separate*
  capabilities system (`gym-member-app/src/auth/use-capabilities.ts`), not this plan-feature map, so
  it would be a distinct effort if ever requested.
- **Responsive admin:** the locked nav/cards must work in the mobile Sheet sidebar and bottom nav.
  Bottom-nav tabs have no feature key today — minimal change.

**Risks / edge cases:**
- **R1 (highest):** advertised-but-unenforced features (§6) become bypassable the moment we stop
  hiding them. Mitigation: Slice F before Slice C/D ships those features, or keep them `mode="hide"`
  until enforced.
- **R2:** "show everything" must NOT override RBAC — a receptionist seeing a locked "Payroll" upsell
  is confusing and leaks org structure. Mitigation: role filter runs first (decided).
- **R3:** Some "modules" in the brief (White-label, dedicated Integrations, API Access page) have
  **no route or page today**. We can show them as nav teasers but there's no shell to load. Flag as
  "teaser-only until built."
- **R4:** Two model-sets / plan source drift (DB vs `PLAN_CONFIGS`). The engine must read the same
  `/settings/account.features` the backend computes, so client and server agree. Don't hardcode tiers
  in the registry's *access* logic — registry holds *copy*, account holds *truth*.
- **R5:** Billing-lock (system 1) and entitlement-lock (system 2) can both be active. A locked-by-plan
  feature on a billing-locked tenant should show the **billing** renewal modal for writes and the
  **upgrade** modal for the locked module — define precedence (billing lock wins for write actions).

---

## 12. Deliverable 14 — Architecture diagram
```
                       GET /settings/account  (existing, unchanged)
                                │  { subscription, usage, features }
                                ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                    Authenticated layout                        │
   │                                                                │
   │  <SubscriptionProvider>      (system 1: billing state — EXISTS)│
   │     └─ canMutate → api-client write-gate → renewal modal       │
   │                                                                │
   │  <EntitlementProvider>       (system 2: plan tier — NEW)       │
   │     ├─ PlanResolver(account) → { plan, features, limits }      │
   │     ├─ EntitlementEngine.state(key) → available | locked       │
   │     └─ UsageLimitEngine.usage(resource)                        │
   │                                                                │
   │  Nav:  filterByPermissions (RBAC, hides)  ── then ──▶          │
   │        entitlement-decorate (NEVER hides; adds PremiumTag/lock)│
   │                                                                │
   │  Pages/Cards/Buttons: <FeatureGate feature mode="lock">        │
   │        └─ locked → <LockedFeatureCard> → <UpgradeModal>        │
   └──────────────────────────────────────────────────────────────┘
                                │ (UI only — never grants access)
                                ▼
        Backend stays authoritative: checkFeatureAccess() 403s
        non-entitled writes regardless of UI state. (UNCHANGED)
```

---

## 13. What I recommend next
Per your "audit-first, then pause" choice, I'm stopping here. The natural first build step is
**Slice A + B** (registry, engine, provider, kit) — invisible, reversible, no behavior change,
and it crosses no hard-stop. **Slice F (backend security backfill) and any schema discussion remain
gated** and must be confirmed separately.

> **NOTED FOR LATER (out of scope, observed during audit):**
> - `members.service.ts:87` comment says "tenant isolation via search_path" — per CLAUDE.md that's
>   inert under multiSchema; isolation is the `gym_id` injection. Comment is misleading, not a bug.
> - Member mobile app uses a parallel capabilities system; if "show everything" is ever wanted there,
>   it's a separate audit.
> - `marketing_campaigns`, `whatsapp_notifications`, `email_campaigns`, `custom_roles`, `audit_logs`,
>   `api_access` are advertised in plan tiers but have **no server-side `checkFeatureAccess`** — today
>   protected only by nav-hiding. Security-relevant regardless of this refactor.
