# MuscleX Staff App — Build Plan (full native)

**Status:** Phases 1–5, 5b and 6 complete except the AI advisor (blocked on an LLM key) · **Date:** 2026-08-26

Goal: *a mobile app giving gym staff the same features and options they currently use in
the web admin app (`frontend/`).*

**Decisions taken (2026-08-25):**

| Decision | Choice |
|---|---|
| Architecture | **Full native Expo rewrite** — every workspace route rebuilt in React Native. No WebView fallback. |
| Audience | **All 10 staff roles**, not owners only. |
| Build pipeline | **EAS dev/production builds approved.** Native modules permitted. |
| Signup / onboarding | **Out of v1 — the app is login-only.** New gyms sign up on the web. |
| Platforms | **iOS first.** Android follows once the app is proven. |
| First release train | **`front_desk`** — smallest module set, highest daily usage. |
| Offline | **Read-only in v1.** Writes require connectivity and fail clearly. |
| Face biometric enrolment | **Deferred — enrol on the web in v1.** App shows enrolled status only. |
| Subscription | **Full in-app upgrade via the payment gateway.** IAP risk accepted; mitigations in §10 R5. |
| Kiosk | **In scope.** `/kiosk/[branchSlug]` ships as an iPad tablet mode reusing the check-in module. |

Because it serves every role, this document calls it the **Staff App**, not the Owner App.
This is a plan only. Nothing has been built.

---

## 1. What we are porting (measured, not estimated)

Counted from `master` today.

| Measure | Value |
|---|---|
| Next.js pages total | **113** |
| Pages inside the gym workspace (`app/[gymSlug]/**`) | **84** |
| Lines of TS/TSX in `frontend/src` | **~93,000** |
| Distinct backend endpoint paths called from the web app | **356** |
| Backend controllers available | **111** |
| Permission modules | 13 |
| Staff roles to support | **10** |
| Feature modules in `frontend/src/features` | 33 |

UI code volume by section (`app/[gymSlug]/*`), which is the best proxy for port cost:

```
settings 8.6k   members 5.7k   staff 4.0k   marketing 2.5k   referrals 1.3k
finance 1.3k    classes 1.2k   check-in 1.1k  biometrics 1.1k  dashboard 1.1k
schedule 963    payments 768   ai 689   training 646   store 591   branches 471
memberships 366  crm 312   pos 295   inventory 214   reports 202   visits 135
```

Shared feature modules (`frontend/src/features/*`) that back those pages:

```
checkins 4.3k   inventory 3.9k   plans 2.8k   reports 2.6k   memberships 2.0k
subscription 1.6k  public-portal 1.3k  progress 1.3k  payments 1.1k  entitlements 1.1k
expenses 1.0k   pos 1.0k   automations 969   staff 874   gym-referrals 820   ...
```

**Headline: full native parity means re-implementing ~93,000 lines of UI across 84 routes.**
Section 11 sequences that so useful software ships long before parity is reached.

### Full route inventory

| Group | Routes |
|---|---|
| Dashboard | `/dashboard`, `/dashboard/branches` |
| Members | `/members`, `/members/new`, `/members/[id]`, `/members/[id]/edit`, `/members/[id]/family/add`, `/members/at-risk`, `/members/churn-risk` |
| Memberships | `/memberships`, `/memberships/plans`, `/memberships/plans/new`, `/memberships/plans/[planId]/edit` |
| Check-ins | `/check-in`, `/check-in/history`, `/check-in/devices`, `/biometrics`, `/visits` |
| Classes | `/schedule`, `/classes`, `/classes/new`, `/classes/[id]`, `/classes/sessions`, `/classes/sessions/[id]` |
| Finance | `/finance`, `/finance/payments`, `/finance/payments/new`, `/finance/refunds`, `/finance/expenses`, `/finance/expenses/new`, `/finance/expenses/categories`, `/payments`, `/payments/invoices`, `/payments/invoices/new` |
| Staff | `/staff`, `/staff/new`, `/staff/[id]`, `/staff/shifts`, `/staff/attendance`, `/staff/leaves`, `/staff/payroll`, `/staff/pt-sessions`, `/staff/analytics` |
| Marketing | `/marketing`, `/marketing/campaigns`, `/marketing/campaigns/new`, `/marketing/campaigns/[id]`, `/marketing/leads`, `/marketing/leads/[id]`, `/marketing/templates`, `/marketing/automations`, `/marketing/automation`, `/marketing/whatsapp` |
| Store | `/pos`, `/inventory`, `/store`, `/store/reports` |
| Growth | `/referrals`, `/referrals/programs`, `/referrals/insights`, `/crm` |
| Training | `/training`, `/training/plans`, `/training/exercises` |
| Intelligence | `/reports`, `/ai`, `/ai/briefing` |
| Org | `/branches` |
| Settings | `/settings` + 16 sub-pages: account, profile, security, roles, permissions, plans, subscription, subscription/checkout, integrations, invoices, tax-invoice, templates, loyalty, payment-gateways, referrals |
| Auth / entry | `/login`, `/verify-2fa`, `/forgot-password`, `/reset-password`, `/workspace-select`, `/invite/[token]` |
| Kiosk | `/kiosk/[branchSlug]` — iPad tablet mode |
| Signup / onboarding | `/register`, `/verify-email`, `/onboarding/**` (11 pages) |

**In scope, added 2026-08-25:** `/kiosk/[branchSlug]` — a locked-down iPad kiosk mode for
unattended check-in at the door. It reuses the Phase 5 check-in module, so it is cheap *if*
built after it and expensive if retrofitted. Two consequences that ripple backwards:
the design system must support **tablet layouts from Phase 2**, and the check-in feature
module must be written kiosk-ready (no assumed nav chrome, no assumed logged-in staff
context on screen) from Phase 5.

**Explicitly out of scope** (documented so it's a decision, not an oversight):
`/join/[gymSlug]` and `/pay/[orderId]` (member/public-facing),
`/admin/referrals/*` (internal platform admin), `/landing`, `/debug/*`.

**Out of scope for v1 — DECIDED 2026-08-25: the app is login-only.**
`/register`, `/verify-email` and the 11 `/onboarding/*` pages are not ported. They are a
one-time, desktop-shaped signup funnel (plan selection, studio setup, subscription payment);
porting them natively would cost ~2 weeks and drag Apple's IAP problem (§10) into the app.
New gyms sign up on the web; the app's entry points are `/login`, `/verify-2fa`,
`/forgot-password`, `/reset-password`, `/workspace-select` and `/invite/[token]`.

Consequence to design for: **a staff member invited from the web must be able to complete
setup in the app.** `/invite/[token]` is therefore in scope and on the critical path for
Phase 3 — without it, every new hire has to touch a desktop before they can use the app.

### Known v1 gaps vs the web app

The stated goal is feature parity. Two deliberate gaps now exist, and they should be tracked
openly rather than discovered by a customer:

| Gap | Why | Removed when |
|---|---|---|
| **Signup / onboarding** (`/register`, `/verify-email`, `/onboarding/*` — 13 pages) | One-time desktop funnel; ~2 wk cost; IAP exposure | Post-v1, if ever — arguably correct permanently |
| **Face biometric enrolment** (`/biometrics`, `EnrollBiometricDialog`, `EnrollStaffFaceDialog`) | `face-api.js` is browser-only with no RN port (§6) | When the server-side descriptor spike lands |

Both mean a staff member occasionally needs a desktop. Both are rare setup tasks, not daily
work, so neither blocks the `front_desk` train. **Face *check-in* is unaffected** — only
*enrolment* is deferred; matching already happens server-side, and QR + manual check-in are
fully native from Phase 5.

---

## 2. What already exists that we build on

**The backend needs almost nothing.** 111 controllers, JWT bearer auth on every route,
`class-validator` DTOs with a global whitelisting `ValidationPipe`, RBAC guards, plan
entitlement gating, and a global `StripSecretsInterceptor`. The staff app is a new *client*
on a complete API. No BFF required (§6).

**Auth is already token-based and portable.** `/auth/login` → `{ access_token,
refresh_token, user, studio }`, plus `/auth/refresh`, `/auth/me`, `/auth/select-workspace`,
and a separate 2FA step. The web client persists this in Zustand
([auth-store.ts](frontend/src/stores/auth-store.ts)) and attaches `Authorization: Bearer`,
`X-Active-Branch-Id` and `X-Correlation-Id`
([api-client.ts](frontend/src/services/api-client.ts)). All of it maps cleanly onto
`expo-secure-store` plus the same fetch wrapper.

**RBAC and entitlements are already fully specified — reuse, don't reinvent.**
`DEFAULT_ROLE_PERMISSIONS` ([default-permissions.ts](backend/src/common/guards/default-permissions.ts))
defines the 10 roles; `frontend/src/features/entitlements/registry.ts` defines plan gating
across free/starter/pro. The web nav encodes one rule that must carry over exactly
([app-layout.tsx](frontend/src/components/layout/app-layout.tsx)):

> **Role-based restriction *hides* the nav item. Plan-based restriction *shows it locked*
> with a `PremiumTag` and opens the upgrade modal.**

Get that backwards and we either leak modules to roles that shouldn't see them, or destroy
the upsell path. It is the single most important behavioural spec in the port.

**A React Native codebase and design language already exist.** `member-app/` runs Expo 57 /
RN 0.86 / expo-router / React Query v5, with `src/api/client.ts`, Supabase, `expo-camera`,
QR helpers, and a UI kit (`src/ui`, ~900 LOC). Patterns and conventions are directly
reusable; the component set is far short of what an admin app needs (§8).

**Native builds are already a solved problem here.** `member-app/` has `ios/`, `android/`,
`eas.json`, `expo-dev-client` and EAS Update wired up. Precedent and config exist.

> ⚠️ **`CLAUDE.md` hard-gate #4 is now stale.** It says the member app must stay on Expo Go /
> Expo web, but `member-app` is already on EAS dev builds and you've approved EAS for the
> staff app. `CLAUDE.md` should be updated to reflect this — I have not touched it.

---

## 3. Consequences of going full native (accepted, with mitigations)

You chose the highest-quality, highest-cost option. Two risks come with it, and the plan is
shaped around mitigating them rather than pretending they don't exist.

**Risk 1 — a long stretch with nothing shippable.** A module-by-module port reaches 100%
in ~8–10 months and is useless before that. **Mitigation: sequence by role persona, not by
module** (§11). Each of the 10 staff roles has a bounded module set; `front_desk` needs 6 modules
and is a *complete, shippable app* long before `owner` parity exists. This turns one
distant release into four useful ones.

**Risk 2 — permanent parity drift.** From day one there are two UIs over one API, and every
future web feature must be built twice or the app silently falls behind. **Mitigation:
governance, not heroics** — a web feature touching a ported module is not "done" until the
RN screen ships, and §10 defines a parity checklist. This is a standing organisational cost
you are taking on, and it should be an explicit decision, not a discovery in month six.

**A note on "no WebView":** one exception is unavoidable. **Payment gateway checkout**
(`/settings/subscription/checkout`) cannot be reimplemented natively — card entry must
happen in the gateway's own web context for PCI reasons. This ships as
`expo-web-browser` (a system in-app browser), which is standard, store-safe practice and
is *not* the WebView-shell architecture you rejected.

---

## 4. Architecture

```
staff-app/                       # new Expo app, sibling to member-app/
├─ app/                          # expo-router
│  ├─ (auth)/                    # login, 2fa, forgot/reset, workspace-select, invite
│  ├─ (tabs)/                    # role-adaptive tab bar (§4.2)
│  ├─ members/…  checkin/…  schedule/…  finance/…
│  ├─ staff/…    marketing/…     pos/…  inventory/…
│  ├─ reports/…  ai/…            settings/…
└─ src/
   ├─ api/          # client.ts ported from frontend/services/api-client.ts
   ├─ auth/         # SecureStore session, refresh, 2FA, workspace + branch switch
   ├─ rbac/         # permission map, entitlement registry, <Can>, <PlanGate>
   ├─ ui/           # admin design system (§8)
   ├─ charts/       # react-native-svg chart set replacing recharts
   ├─ offline/      # React Query persistence + expo-sqlite
   └─ features/     # one dir per module, mirroring frontend/src/features
```

Decisions baked in:

- **A separate app, not a mode inside `member-app/`.** Different audience, different auth
  realm (staff JWT vs member JWT), different release cadence. One binary serving both would
  risk exposing staff surfaces to members — an unacceptable class of bug in a multi-tenant
  product.
- **Mirror `frontend/src/features/*` directory-for-directory.** Parity drift is the top
  long-term risk; making the two trees structurally isomorphic means "is this ported?" and
  "where does this change go?" are answerable by looking, not remembering.
- **Same endpoint paths, same React Query keys/shape** as the web app, so pagination,
  filtering and error semantics match exactly rather than being re-derived.
- **Copy-then-diverge for shared code in v1, not a monorepo package.** Extracting
  `packages/shared` touches `member-app`'s build config and is its own project. Accepted
  duplication: the API client and theme will exist twice. Revisit once the staff app is real.

### 4.2 Role-adaptive navigation

With 10 roles in scope, navigation is a **first-class subsystem**, not a static tab bar. A
`front_desk` user and an `accountant` should open the app to different homes.

| Role | Modules (from `DEFAULT_ROLE_PERMISSIONS`) | Proposed tabs |
|---|---|---|
| `owner`, `brand_owner`, `super_admin` | all 13 | Home · Members · Schedule · Money · More |
| `regional_manager`, `branch_manager`, `manager` | all except some delete/roles | Home · Members · Schedule · Money · More |
| `front_desk` | dashboard, members, check_ins, payments, classes, staff(view), branches, reports, inventory | **Check-in · Members · Schedule · POS · More** |
| `trainer` | dashboard, members(view), check_ins, classes(edit), staff(view), ai, branches, reports, inventory(view) | **Schedule · Members · Check-in · AI · More** |
| `accountant` | dashboard, members(view), payments, branches, reports, inventory(view/export) | **Money · Reports · Members · More** |
| `marketing_manager` | dashboard, members(view/export), marketing, ai, branches, reports | **Marketing · Leads · Reports · More** |

Rules: tabs are derived from the permission map at runtime (never hardcoded per role, since
gyms create custom roles via `/settings/roles`); a role with no permission for a module never
sees it; a *plan* that lacks a feature shows it locked with an upgrade sheet.

---

## 5. Backend work required

Deliberately small — this is a client project.

1. **Staff push device tokens — ⚠️ SCHEMA CHANGE, HARD GATE.**
   Native push needs Expo tokens per staff user. No existing table fits: `MemberDeviceToken`
   is gym-scoped members, `AppUserDeviceToken` is public app users, and the current staff
   push is **Web Push/VAPID** browser endpoints
   ([dashboard-actions.controller.ts:109-137](backend/src/dashboard/dashboard-actions.controller.ts#L109-L137)).
   Two candidate designs — adding a `transport = 'expo' | 'webpush'` discriminator to the
   existing staff subscription store is likely cleaner than a new `StaffDeviceToken` table
   and may avoid a migration entirely. **I will not touch `schema.prisma` without explicit
   approval**; I'll present both options with the diff before Phase 7.
2. **Push send paths + role targeting.** Reuse `PushService`'s Expo transport. Triggers are
   role-aware: `front_desk` gets check-in/payment events, `accountant` gets settlement and
   dues, `owner` gets the daily AI briefing, `trainer` gets session changes.
3. **CORS.** Add the Expo dev origin (`http://localhost:8081` / LAN IP) to `CORS_ORIGINS`,
   exactly as `member-app` needed `:8082`. Dev-only; native release builds don't preflight.
4. **Deep links.** `musclex-staff://` scheme + universal links so a notification opens the
   right member, invoice or session.
5. **Possibly: a couple of aggregate endpoints.** The dashboard is chatty. **Measure first** —
   do not build a BFF speculatively.
6. **Nothing else.** All 356 endpoints the web app calls already exist and are mobile-ready.

---

## 6. Technical gaps: web-only things with no native equivalent

With no WebView fallback, every one of these needs a real answer.

| Web dependency | Used by | Native answer | Difficulty |
|---|---|---|---|
| `face-api.js` | `/biometrics`, member + staff face enrolment, `FaceScanner` | **DECIDED: deferred.** No RN port exists (browser WASM/WebGL). v1 shows enrolled status read-only; enrolment happens in the web admin app. Future path: capture the photo natively and extract the descriptor **server-side**, which also keeps `face_descriptor` off the device. | **Deferred — spike before committing** |
| `@tanstack/react-table` (10 files) | dense admin tables across members/staff/finance/settings | No RN equivalent. Tables must be **redesigned** as card lists / `FlashList` rows with a filter sheet and a detail drill-in. | **High — design problem, not a port** |
| `recharts` (15 files) | dashboard + reports charts | `react-native-svg` (already a `member-app` dep; `Sparkline`/`ActivityChart`/`FormChart` are precedent). Charts get rebuilt, not ported. | Medium |
| `shadcn` + 15 Radix primitives | everything | Rebuild as the design system (§8). | Medium (high volume) |
| `leaflet` / `react-leaflet` | branch location picker | `react-native-maps` — new native dep, needs API keys per platform. **Hard gate.** | Medium |
| `html5-qrcode` | `QRScanner` | `expo-camera` barcode scanning; `member-app/src/lib/qr.ts` is precedent. | Low |
| `socket.io-client`, Supabase realtime | live check-in feed | Both work in RN; `member-app` already ships `@supabase/supabase-js`. | Low |
| `sw.js` + `idb` offline cache | dashboard offline | React Query persistence + `expo-sqlite` (already a `member-app` dep). | Low |
| Payment gateway checkout | subscription checkout | `expo-web-browser` system in-app browser (see §3). | Low |
| CSV export, PDF invoices, receipt printing | reports, invoices, POS | Server-generated file + `expo-sharing` share sheet; `expo-print` for receipts. New deps — hard gate. | Low |
| `country-state-city`, `date-fns`, `zod`, `react-hook-form` | forms everywhere | All platform-agnostic; work in RN as-is. | None |

**New dependencies to approve** (each justified at proposal time, per hard-gate #3):
`expo-secure-store`, `expo-camera`, `expo-notifications`, `expo-local-authentication`,
`expo-web-browser`, `expo-sharing`, `expo-print`, `expo-sqlite`, `@shopify/flash-list`,
`react-native-maps`, `@tanstack/react-query-persist-client`, `@sentry/react-native`.
Most are already proven in `member-app`.

---

## 7. Design system: the phase people underestimate

`member-app/src/ui` exports 9 components (~900 LOC). An admin app serving 10 roles needs
roughly **35–40** before a single business screen exists:

> Data row-card + list section headers · `FlashList` virtualised list · filter bar + filter
> sheet · search field with typeahead · date picker · date-range picker · time picker ·
> calendar (day/week/month) · form field set (text, number, currency, select, multi-select,
> toggle, radio, textarea, photo/file picker) · form validation + error display · bottom
> sheet · modal · confirm dialog · toast · tabs · segmented control · KPI/stat tile · charts
> (line, bar, stacked bar, donut, sparkline) · empty / error / offline states · skeleton
> loaders · infinite scroll · pull-to-refresh · avatar + status badges · currency & date
> formatters · swipe actions · `<Can>` permission gate · `<PlanGate>` + upgrade sheet ·
> branch switcher · workspace switcher.

It must follow [design.md](design.md) and stay coherent with the `member-app` light-first,
one-red-accent language (`#F5F5F7` canvas, `#E10600` accent) while reading as a **tool** rather than a consumer app. Because
kiosk mode is in scope, **every component must also lay out on iPad** — decided now rather
than retrofitted, since responsive breakpoints added late to 40 components is a rewrite. This is the
whole of Phase 2 and underestimating it is the most common way ports like this stall.

### 7a. What the registry covers, and what it does not

**Adopted 2026-08-25:** [React Native Reusables](https://github.com/founded-labs/react-native-reusables)
(shadcn/ui ported to RN) via the shadcn CLI, styled with **uniwind** rather than
NativeWind — uniwind is the only Tailwind-in-RN engine declaring support for
React 19 / RN 0.81+, which is our stack. Registry:
`https://reactnativereusables.com/r/uniwind/{name}.json`.

**Covered by the registry (30 installed):** accordion, alert, alert-dialog,
aspect-ratio, avatar, badge, button, card, checkbox, collapsible, context-menu,
dialog, dropdown-menu, icon, input, label, popover, progress, radio-group,
select, separator, skeleton, switch, tabs, text, textarea, toggle, toggle-group,
tooltip, native-only-animated-view. `hover-card` and `menubar` were deliberately
skipped — hover does not exist on touch and menubar is a desktop pattern.

**Still to hand-build — the MuscleX-specific half of §7:** data row-card,
virtualised list, filter bar + filter sheet, date picker, date-range picker,
time picker, calendar (day/week/month), bottom sheet, toast, segmented control,
KPI/stat tile, the chart set (line, bar, stacked bar, donut, sparkline),
empty/error/offline states, infinite scroll, pull-to-refresh, swipe actions,
`<Can>` permission gate, `<PlanGate>` + upgrade sheet, branch switcher,
workspace switcher, currency/date formatters.

**Net effect on Phase 2:** the registry removes roughly the primitive half of the
work. The remaining half was always going to be bespoke — the table→card-list
pattern and the chart set (§6) are still the two hardest items and are
unaffected by this decision.

**Token mapping — a correction worth recording.** The tokens mirror
`frontend/src/app/globals.css`, **not** `member-app`. The web app maps
`--primary: var(--ink)` (#171717) and reserves red for `--destructive`
(#ee0000), and it defines `--success`/`--warning`, which stock shadcn does not.
An initial mapping of primary → MuscleX red made "Collect payment" and "Delete"
the same colour, and "Active" and "Overdue" the same badge — caught by
screenshotting the gallery, not by typecheck or tests. `success`/`warning` badge
variants were added on top of RNR for the same reason. The staff app is a port
of the web admin app and shares its users, so it follows the web app's palette;
`member-app` keeps its own.

**Cost to be aware of:** RNR's uniwind build shipped two defects we patched
locally (`placeholderClassName` in input/textarea; `Platform.select` typing in
context-menu/dropdown-menu). shadcn's model is copy-into-your-repo, so those
patches are ours to maintain, and **re-pulling a component overwrites them** —
they are marked `NOTE (MuscleX)` in the source.

---

## 8. Multi-tenant & security requirements

Non-negotiable, per `CLAUDE.md`:

- **The mobile client is not a trust boundary.** Every request carries the staff JWT; the
  backend's `gym_id` injection ([tenant-models.ts](backend/src/prisma/tenant-models.ts)) and
  RBAC guards remain the only real isolation. The app must never send a client-supplied
  `gym_id` that the server trusts.
- **Client-side RBAC is UX, not security.** Hiding a tab must never be the only thing
  stopping a `trainer` from reading payroll. Every screen's endpoints must already be guarded
  server-side — worth re-verifying per module as we port, since the app makes it trivially
  easy to hand-craft a request.
- **Workspace switching must fully reset state** — React Query cache, SecureStore session,
  SQLite offline cache. A cache surviving a workspace switch is a cross-tenant leak in the
  UI even with a perfect backend. This gets an explicit automated test.
- **Branch scoping** goes through `X-Active-Branch-Id` only, never by rewriting queries.
- **Tokens in `expo-secure-store`**, never `AsyncStorage`. Biometric app lock via
  `expo-local-authentication`.
- **The offline cache holds member PII and payment data.** Encrypt it, wipe on logout, cap
  its age. A lost unlocked phone must not become a data breach — and a shared front-desk
  phone raises this materially.
- **2FA must work on mobile.** `/verify-2fa` exists and is part of the native flow, not skipped.
- **Respect `StripSecretsInterceptor`.** Never build a screen needing `face_descriptor`,
  `card_token`, or `salary`/`base_salary`/`hourly_rate` outside owner/brand_owner. The
  payroll screens are the live hazard here.

---

## 9. Testing & verification

- **Jest + `@testing-library/react-native` from day one.** `member-app` has no component
  tests; do not repeat that on an app handling payments and payroll. Note `member-app`'s
  `testMatch` only picks up `__tests__/**` — mirror or improve that deliberately.
- **A role-matrix test suite.** With 10 roles × 13 modules, nav derivation and gating get
  table-driven tests asserting each role sees exactly its modules. This is cheap to write and
  the only realistic way to keep the matrix honest.
- **A cross-tenant regression test:** log in as gym A, switch workspace to gym B, assert no
  gym-A data survives in any cache layer.
- **Typecheck via the local binary:** `staff-app/node_modules/.bin/tsc --noEmit`
  (`npx tsc` from the monorepo root fails — known gotcha).
- **Backend:** run the Jest suites covering anything touched (push, auth).
- **Parity checklist** in the definition of done for every ported screen: routes covered,
  filters, empty/error states, permissions, plan gating, offline behaviour.
- **On-device UI verification is automated** via idb
  (`npm --prefix staff-app run verify:ui`): it drives the real app on a simulator and
  asserts on the accessibility tree. Use it for anything needing a tap — forms,
  confirmations, overlays. Synthetic mouse clicks do NOT reach the React Native
  hierarchy, so idb (or a human) is the only option.
- **Not verifiable from here — on-device QA only:** camera/QR scanning, push delivery,
  biometric unlock, background behaviour, print/share sheets, real-device performance on
  long lists, and store review outcomes. Every slice report must say so explicitly.

---

## 10. Risks and open questions

**Risks**

1. **Parity drift** — two UIs over one API, forever. Mitigated by governance (§3), not
   eliminated. This is the largest long-term cost of the choice.
2. **Time to first useful release.** Mitigated by role-persona sequencing (§11); `front_desk`
   ships around week 12 rather than month 8.
3. **Dense tables and settings on a 6" screen.** `settings` (8.6k LOC), `members` (5.7k),
   `staff` (4.0k) are table- and form-heavy. Significant *design* work, not translation.
4. **Face biometrics deferred**, so enrolment needs a desktop until the server-side spike
   lands (§1 gaps table). Acceptable for a rare setup task; must not silently become permanent.
5. **App Store IAP — the largest single external risk, and knowingly accepted.**
   **DECIDED: full in-app subscription upgrade via the payment gateway.** Apple reviews
   first and is the stricter reviewer. Apple's guidelines generally require IAP for digital
   services purchased in-app; the plausible carve-out is the "goods and services used
   outside the app" provision, since a MuscleX subscription operates a physical gym
   business — B2B operational SaaS is the strongest version of that argument.
   **This reading is `unverified`** and must be checked against the current App Review
   Guidelines text before Phase 11, not assumed from this document.
   Mitigations, all cheap if planned and expensive if not:
   - Phase 11 is the **last** train, so the app already has approval history before the
     payment flow is ever submitted. Do not move it earlier.
   - Keep a **read-only build variant behind a feature flag**, so a rejection costs a
     config change and a resubmission rather than a re-architecture.
   - Submit with a reviewer note framing MuscleX as B2B gym-operations software.
   - Treat Android as the unconstrained path — Google's policy here is more permissive.
5b. **iOS-first raises the cost of getting Phase 1 wrong.** Bundle ID, Apple Developer
   account, signing and TestFlight need to exist before Phase 5 can be tested by anyone but
   the developer — earlier than an Android-first plan would demand.
6. **Two design systems** (`member-app/src/ui`, `staff-app/src/ui`) that will drift. Accepted
   for v1.
7. **Estimate confidence.** Every duration below is **unverified** and assumes one
   full-time developer. Treat them as shape, not schedule.

**Open questions**

All plan-shaping questions were answered on 2026-08-25 (see the decisions table at the top).
One delivery item remains outstanding rather than undecided:

- **Branding assets** — app icon, splash screen, App Store screenshots and store copy do not
  yet exist. Needed before TestFlight distribution in Phase 1, not at submission time.

Two items are deliberately deferred rather than open, and should be revisited on a date
rather than when they become urgent:

- **Face biometric enrolment** — server-side descriptor spike (§1 gaps table).
- **Apple IAP position** — verify against the live App Review Guidelines before Phase 11 (R5).

---

## 11. Phased roadmap

Every phase is a reviewable slice per `CLAUDE.md`, reported as WHAT / WHY / TESTS / RISKS /
NOTED FOR LATER. Durations are **unverified estimates**, one full-time developer.

### Foundation — nothing ships to users (~7–9 weeks)

| Phase | Deliverable | Gate |
|---|---|---|
| **0 — Decisions** ✅ **DONE** | All plan-shaping decisions taken 2026-08-25 (table at top). | — |
| **1 — Skeleton** ✅ **code DONE** | `staff-app/` Expo app, expo-router, strict TS, Jest (3 passing), EAS profiles, front-desk placeholder shell. Typecheck + web bundle verified. **STILL OUTSTANDING — not code:** iOS signing, TestFlight internal group, and branding assets (icon, splash, store copy). These block on-device testing by anyone but the developer and are external/asset work, not mine to complete. | Deps approved 2026-08-25 |
| **2 — Design system** ✅ **DONE** | uniwind + RNR (30 primitives) themed to the web app's tokens, plus the MuscleX layer: formatters, RowCard, StatTile, SegmentedControl, states, charts, Toast, SwipeActions, Sheet/FilterSheet, date pickers, ScheduleCalendar, virtualised DataList, Meter. Verified on device. | — |
| **3 — Auth, RBAC & shell** ✅ **DONE** | SecureStore session, ported API client, RBAC from `permission_codes`, entitlements, `<Can>`/`<PlanGate>`, sign-in/2FA/workspace/forgot screens, role-adaptive tabs, branch switcher, sign-out. Verified against the real backend with 4 seeded role accounts. | — |
| **4 — Charts, lists & offline** 🔄 **partial** | Charts and the virtualised list are done. **Offline persistence is NOT built** — it needs `@tanstack/react-query-persist-client` + `expo-sqlite` (new deps, see TODO_FOR_ME.md). | Deps pending |

### Release trains — each ships a complete app for one persona

| Phase | Persona unlocked | Modules ported | Est. |
|---|---|---|---|
| **5 — Front desk** 🔄 **substantially built** | Dashboard, Members list + detail (native call/WhatsApp), manual Check-in, Money, Schedule, POS — all on live data against a seeded gym. **Remaining:** QR check-in (needs expo-camera), member create/edit, offline write. | ~week 12 target |
| **5b — Kiosk mode (iPad)** | *(no persona — a device role)* | `/kiosk/[branchSlug]`: locked-down unattended check-in reusing Phase 5's module. Guided Access / single-app mode, always-on display, branch pinning, offline-tolerant queue for the door. | 1.5–2 wk |
| **6 — Trainer** | `trainer` ✅ | Classes (edit, sessions, attendance, bookings) · PT sessions · Training plans & exercises · AI advisor · Member progress | 2.5–3 wk |
| **7 — Push & deep links** | all shipped roles | Staff device tokens, role-aware triggers, notification→screen deep links | 1–1.5 wk · **DB schema → approval** |
| **8 — Accountant** | `accountant` ✅ | Finance (payments, invoices, refunds, dues) · Expenses + categories + receipt camera · Reports · Store reports · Inventory (view/export) | 3–3.5 wk |
| **9 — Marketing** | `marketing_manager` ✅ | Campaigns · Leads · Templates · Automations · WhatsApp inbox · CRM · Referrals | 3.5–4 wk |
| **10 — Manager** | `manager`, `branch_manager`, `regional_manager` ✅ | Staff (list, profile, shifts, attendance, leaves, analytics) · Memberships & plans · Inventory (full) · Branches · Visits · At-risk & churn-risk | 3.5–4 wk |
| **11 — Owner** | `owner`, `brand_owner`, `super_admin` ✅ **parity, less the §1 gaps** | Settings (17 pages — the single largest section) · Roles & permissions · Subscription (read-only) · Payroll · Biometrics *(status display only)* · Check-in devices | 5–6 wk |
| **12 — Hardening & GA** | — | On-device QA matrix across roles + platforms, accessibility, Sentry, cross-tenant regression suite, store assets, phased rollout | 2–3 wk · store submission → **external action, approval** |

**Totals (unverified):** first shippable app **~week 12**; kiosk at **~week 14**; three
personas covered by **~week 24**; full parity + GA at **~week 36–42 (≈9–10 months)** solo.
The kiosk addition and iPad layout support account for the increase over the pre-decision
estimate. Two developers splitting foundation from release trains would compress this
materially — the trains after Phase 4 are largely independent.

**iOS-first note:** every train's QA is single-platform, which is the main saving. But the
Apple Developer account, bundle ID, signing and TestFlight must be live before Phase 5 can
be tested by anyone but the developer. You have the account and bundle ID; **branding assets
(icon, splash, screenshots, store copy) are still outstanding** and are now a Phase 1
deliverable rather than a Phase 12 scramble.

---

## 12. Recommended immediate next step

Every plan-shaping decision is now made. **Phase 1 is unblocked and is roughly a day of
scaffolding** — `staff-app/` Expo app, expo-router, strict TS, Jest, EAS profiles, CI
typecheck — after which we can have a shell running on a real device, with Phase 2 (the
design system, now including iPad layouts) starting immediately behind it.

Two things to line up in parallel, neither of which blocks me:

1. **Branding assets** (icon, splash, store copy) — needed for TestFlight in Phase 1.
2. **The new-dependency list in §6** — hard-gate #3 means I'll propose these for approval as
   a single batch at the start of Phase 1 rather than drip-feeding them.

Say the word and I'll start Phase 1.
