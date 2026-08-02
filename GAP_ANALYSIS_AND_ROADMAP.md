# MuscleX — Gap Analysis & Roadmap vs MyGymDesk

> Generated 2026-08-02 by a full-codebase audit (5 parallel deep-read agents over `backend/`, `frontend/`, `gym-member-app/`, `saas-control-center/`). Every status below was verified by reading controllers/services/schema/screens — **not** file names. Statuses: ✅ fully wired (API + DB + UI connected) · 🟡 partial (gap stated) · 🔴 stub/dead/misleading code · ❌ missing.
>
> Note: `mygymdesk-competitor-analysis.md` was not present in the repo root; the audit ran against the full checklist embedded in `gym-software-audit-prompt.md`.

---

## Phase 1 — Feature inventory (what MuscleX actually has)

Condensed inventory by domain. Evidence = representative files/endpoints; the Phase 2 table has per-feature detail.

| Domain | Status | Where it lives | Verdict |
|---|---|---|---|
| Member CRUD, profiles, body stats, progress photos | ✅ | `backend/src/members/*` (`/api/v1/members`), `MemberBodyStats`, `MemberProgressPhoto`; `frontend/.../members/*`; member BFF write path too | Production-grade, incl. duplicate-phone guard, soft delete, transfer logs |
| Membership plans, assignment, renewal, expiry, freeze | ✅ | `plans.controller.ts`, `memberships.controller.ts`, `renewals.service.ts` (4 daily crons: expiry, expiring-soon, auto-renew, auto-unfreeze) | Real cron-driven lifecycle. **Bug:** assign dialog calls nonexistent `/members/:id/memberships` → 404 |
| Billing: invoices, GST split, PDF, ledger | ✅ | `payments/billing.service.ts` (CGST/SGST vs IGST by place-of-supply), `documents/templates/invoice-pdf.ts`, `FinancialTransaction` double-entry | Manual-invoice UI never sends `tax_rate_id` → ₹0 GST on hand-made invoices |
| Payments: Razorpay (full), Stripe (backend), per-gym gateway keys, webhooks | ✅/🟡 | `razorpay.service.ts`, `stripe.service.ts`, `PaymentGatewayConfig`, `/payments/webhooks/*` (HMAC, timing-safe) | Stripe has no UI caller; PayPal absent |
| Refunds, partial payments, invoice cancel | 🟡 | `refunds.service.ts`, `billing.service.ts:recalculateInvoiceStatus/cancelInvoice` | All backend-only — zero UI consumers; refunds never call the gateway |
| Check-ins: QR (static+dynamic HMAC), kiosk, policy engine, WS realtime, offline sync | ✅ | `check-ins/*` — `qr-token.service.ts`, `check-in.orchestrator.ts` (8-rule access-policy chain), `check-ins.gateway.ts`, kiosk at `frontend/src/app/kiosk/[branchSlug]` | One of the strongest areas in the product |
| Biometrics: face (pgvector), eSSL/ZKTeco iclock ADMS ingest | ✅/🟡 | `check-ins/facial/`, `biometric/iclock.*`, `/iclock/cdata` | iclock bypasses the policy engine; fingerprint SDK provider is an explicit `NotImplementedException` stub |
| Classes: capacity, waitlists (atomic), recurring sessions, rooms | ✅ | `classes/booking.service.ts` (guarded increment, auto-promote), `scheduling.service.ts` | **Two parallel systems**: new `ClassSession` stack vs legacy `Class`/`ClassEnrollment`; member app books only the legacy one |
| PT: trainer-client assignment, session logging, commission → payroll | 🟡 | `staff/trainer.service.ts`, `payroll.service.ts`, `TrainerRevenue`, `PayrollRecord` | Backend complete; **zero UI**; session rate hardcoded `= 500`; no PT-package model |
| Workout/diet plans + member delivery + logging | ✅ | `plans/*` (`/workout-plans`, `/diet-plans`), member BFF `/member/v1/plans`, `/workouts/today` + set logging + PRs | Exercise catalog has **no seed data and no CRUD** → empty picker on a fresh tenant |
| Nutrition, exercise library, AI coach (member) | ✅/🟡 | `member-nutrition.service.ts`, `member-exercise.controller.ts`, `member-coach.service.ts` (real Anthropic call, server-built context) | Coach is chat-only; no structured plan generation |
| CRM leads + funnel + public join portal | 🟡 | `marketing/leads.*`, `public-portal/*`, `/join/[gymSlug]` | Fixed 5 stages, no follow-ups, no dedupe, no lead→member conversion flow |
| WhatsApp: Meta Cloud provider, per-gym creds, HMAC webhook, shared inbox | ✅ | `whatsapp/*`, `WhatsAppNumberIndex` tenant routing, inbox UI | `sendTemplate` implemented but **never called** — all sends are 24h-window session text |
| Automations + campaigns + email (Resend) + SMS (Twilio via queue) + Expo push | 🟡 | `marketing/automation-dispatcher.service.ts` (expiry, birthday, lead-created fire), `campaign-sender.service.ts` | Receipts manual-only; class reminders absent; campaign `scheduled_at` never dispatched; admin push endpoint writes "sent" without sending |
| Staff: roles, permission matrix, overrides, attendance, leaves | ✅ | `auth/rbac-seed.service.ts`, `rbac.service.ts`, `StaffPermissionOverride`, permissions UI (667-line matrix) | Custom roles creatable but **unassignable** (`staff-invite` rejects non-enterprise roles; `role_id` never written) |
| Payroll + shifts | 🟡 | `payroll.controller.ts`, `StaffShift` routes | Backend real; hooks exist; **no page imports them** |
| Multi-branch: orgs, regions, provisioning, scoping, portfolio dashboard | ✅ | `branches/*`, `branch-scope.util.ts` (fail-closed), `dashboard/portfolio.service.ts` | Branding is org-level only; `BranchSettings` has API but no UI |
| Reports/analytics | 🟡 | `analytics/*`, `dashboard/*` (31 files, role-specific shells, KPI inspector, cohorts, anomaly detection) | **Defect cluster**: `analytics` permission module unregistered (non-owners 403 everywhere); aggregation job filters `Payment.status='completed'` which is never written → revenue analytics permanently 0; complete 8-tab reports UI exists but is mounted by no page |
| Expenses & P&L | ✅ | `payments/expenses/*` — immutable ledger, reversals, intelligence (cashflow prediction, recurring detection), full UI | Strongest reporting area |
| Inventory / POS | ✅ | `inventory/*` — products, batches, suppliers, POs, transfers, bundles, POS sales/returns, thermal receipts, full UI | Competitor weakness we already win |
| Member app (Expo) | ✅/🟡 | 40+ screens: home, membership+renewal, classes, plans, workout logging, nutrition, progress, community, challenges, rewards, steps, health/wearables, AI coach, trainer chat, referrals, mindfulness | Dev-build only; `eas.json submit.production` empty (never store-submitted) |
| Offline mode | ✅ | `gym-member-app/src/offline/` (SQLite outbox, idempotency keys) + server `@Idempotent()`; admin check-in offline queue | Genuinely done, both sides |
| Public/gym-less fitness identity, multi-gym chooser, discovery | ✅ | `member-public.controller.ts`, `app_users`, `choose-gym.tsx`, nearby gyms | Unique — no competitor equivalent |
| Platform webhooks/integrations | 🔴 | `platform/services/webhooks.service.ts` (21-event catalog, HMAC, SSRF guard, delivery log) | **`dispatch()` has zero callers** — no event ever fires; `testIntegration()` always returns ok without contacting anything |
| SaaS subscription billing (gyms paying us) | ✅ | `subscription/*` (proration, GST, invoices PDF, WS gateway, cron) + SCC | Separate from member billing; complete |

---

## Phase 2 — Gap table vs the MyGymDesk checklist

Effort: **S** < 1 day · **M** 1–3 days · **L** ~1–2 weeks · **XL** > 2 weeks.
Priority: **P0** core gym ops · **P1** Indian-market selling points · **P2** growth/retention · **P3** differentiators.

### Member Management

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 1 | Member CRUD + photos + measurements + progress | ✅ | ✅ | `members.controller.ts`, `MemberBodyStats`, `features/progress/*` | — | P0 (done) |
| 2 | Membership status / renewal / expiry tracking | ✅ | ✅ | `renewals.service.ts` crons; `MembershipStatusBadge` · *bug: assign dialog 404s (`features/memberships/api.ts:50`)* | S (bugfix) | P0 |
| 3 | Digital member ID card with QR | ✅ | 🟡 | Signed QR backend ✅ (`qr-token.service.ts`); admin renders raw DB string, no printable card, **member app displays no QR** (it scans instead) | M | **P1** |
| 4 | Custom plans (monthly/quarterly/annual) | ✅ | ✅ | `plans.controller.ts`; 10 plan types incl. class_pack, day_pass, corporate, family | — | P0 (done) |
| 5 | Freeze / pause membership | ✅ | ✅ | `/members/:id/freeze`, `MembershipFreeze`, auto-unfreeze cron extends end_date | — | P0 (done) |
| 6 | Member data import / migration | ✅ | ❌ | Zero import code anywhere (exports only) | M | **P0** — switching gyms can't migrate |

### Billing & Payments

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 7 | Instant bill + payment collection | ✅ | 🟡 | Both halves exist (`billing.service.ts`, `/payments/cash`) but payment form never sends `invoice_id`; no "Collect" action on invoice rows; invoice UI omits tax/discount | S | **P0** |
| 8 | Razorpay; Stripe/PayPal international | ✅ (Razorpay) | 🟡 | Razorpay ✅ end-to-end; Stripe backend ✅ no UI; PayPal ❌ | M (Stripe UI) | P1 |
| 9 | GST-compliant auto-generated invoices | ✅ | ✅ | `billing.service.ts:102-146` CGST/SGST/IGST by place-of-supply; `invoice-pdf.ts` TAX INVOICE + HSN + amount-in-words · *manual-invoice UI sends no tax_rate → ₹0 GST* | S (UI fix) | P1 |
| 10 | Payment links via WhatsApp | ✅ | 🟡 | Sends invoice **PDF** via WA (`document-delivery.service.ts`); no payable link — `/pay/[orderId]` page exists but is never minted/shared by admin | S–M | **P1** |
| 11 | Recurring billing (member memberships) | ✅ | 🟡 | `auto_renew` cron creates renewal but hardcodes `pending`/`bank_transfer` — **never charges a gateway**; `payment_method_token` never written. (SaaS-level recurring ✅ separately) | L | P1 |
| 12 | Partial payments, refunds, outstanding dues | ✅ | 🟡 | Dues ✅ (dashboard KPI + inspector). Partial: backend-only (unreachable). Refunds: backend + hooks, **no screen**, no gateway refund call | M | **P0** |
| 13 | Invoice cancellation with revenue exclusion | ✅ | 🟡 | `cancelInvoice()` correct (reversing ledger entry; excluded from dues/revenue) — **no UI action**; generic status-PATCH footgun bypasses ledger | S | **P0** |

### Attendance

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 14 | QR check-in / check-out | ✅ | ✅ | HMAC static + 30s dynamic QR, replay nonce, orchestrator, checkout pairing | — | P1 (done) |
| 15 | Front-desk kiosk mode (tablets) | ✅ | ✅ | `/kiosk/[branchSlug]` — QR/Face toggle, idle PIN lock, offline queue · *PIN is client-side localStorage, not `CheckInDevice.pin_hash`* | S (harden) | P1 (done) |
| 16 | Real-time attendance dashboard | ✅ | ✅ | Socket.IO `/check-ins` gateway + live feed/heatmap/occupancy tiles · *`OCCUPANCY_UPDATED` declared but never emitted* | S | P2 (done) |
| 17 | Biometric (fingerprint) device integration | ✅ | 🟡 | Face+pgvector ✅; eSSL/ZKTeco iclock ADMS ingest ✅ (`/iclock/cdata`); direct fingerprint SDK = `NotImplementedException` stub; iclock bypasses policy engine | L | P3 |
| 18 | Staff attendance + shift tracking | ✅ | 🟡 | Attendance + biometric clock + leaves ✅ with UI; **shifts = API+hooks only, no page** | S | P2 |
| 19 | Member attendance calendar, streaks, monthly stats | ✅ | 🟡 | Streaks ✅ (`member-streak.service.ts`); admin shows flat table only; **no member-facing check-in history endpoint or screen**, no calendar | M | **P1** |

### Classes & Scheduling

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 20 | Group classes + capacity + waitlists | ✅ | ✅ | Atomic guarded-increment booking, auto-promotion (`booking.service.ts`) · *duplicated across two class systems* | — | P2 (done) |
| 21 | Session-based class packages | ✅ | 🟡 | `class_pack` plans + `classes_remaining` auto-created on purchase ✅; **credits burn on gym check-in only, never on class booking** | M | P2 |
| 22 | Instructor assignment + schedules + notifications | ✅ | 🟡 | Assignment + conflict detection + trainer schedule routes ✅; **zero notifications** on assign/substitute/cancel | M | P2 |
| 23 | Online class booking by members | ✅ | 🟡 | Works end-to-end (`member-class.service.ts` reuses admin enroll) — but **only against legacy `Class`**; new `ClassSession` stack invisible to members | M–L (unify) | P2 |
| 24 | Class reminders 24h before | ✅ | ❌ | No cron; inbox card is client-derived at render; `class_reminders` pref read by nothing | M | P2 |

### Personal Training

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 25 | Trainer-member assignment + PT packages | ✅ | 🟡 | `TrainerClient` assignment backend ✅ (hooks exist, **no UI**); **PT package model absent entirely** (no sessions_remaining anywhere) | L (schema — hard gate) | P2 |
| 26 | PT session logging with notes | ✅ | 🟡 | `TrainerSession` CRUD + conflict check + notes ✅ backend; **no screen logs a session**; not linked to `WorkoutLog` | M | P2 |
| 27 | PT commission tracking + payouts | ✅ | 🟡 | `TrainerRevenue` → `PayrollRecord` mechanics ✅; **`sessionRate = 500` hardcoded**; payroll hooks have zero UI consumers | M | P2 |

### Workout & Diet Plans

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 28 | Workout plan builder + exercise library | ✅ | 🟡 | Builder + sets/reps/rest editor + assignment ✅; **exercise catalog has no seed data and no CRUD** → unusable on fresh tenant | S | P2 |
| 29 | Diet plans + meals + calorie/macro targets | ✅ | ✅ | `diet-plans.controller.ts`, `MealsEditor.tsx`, per-meal macros | — | P2 (done) |
| 30 | Plans in member app + progress/goal tracking | ✅ | ✅ | `/member/v1/plans`, workout logging + PRs, goals, weight/BMI charts | — | P1 (done) |
| 31 | AI-generated workout/diet plans | ✅ (claimed) | 🟡 | AI coach is real Claude chat with member context; **never writes a structured plan** | M | P3 |

### CRM & Leads

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 32 | Lead capture (walk-in, phone, website, social) | ✅ | 🟡 | `/leads` CRUD + public `/join` trial form ✅; no `phone` source in enum, no UTM capture, WhatsApp inbox never creates leads | S | P2 |
| 33 | Pipeline custom stages + follow-ups + assignee history | ✅ | 🔴 | 5 hardcoded stages; **no follow-up field/reminder anywhere**; reassignment logged nowhere; no kanban | M | P2 |
| 34 | Duplicate detection + one-tap lead→member conversion | ✅ | ❌ | No dedupe logic; no `/leads/:id/convert`; `converted_member_id` only settable as raw UUID | M | P2 |
| 35 | Lead conversion funnel report | ✅ | ✅ | `GET /leads/funnel` + UI (basic — no stage-to-stage rates) | — | P2 (done) |

### Communication (WhatsApp-first)

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 36 | Official WhatsApp Business API | ✅ | ✅ | Meta Cloud provider, per-gym creds + `WhatsAppNumberIndex` routing, HMAC webhook, shared inbox · *`sendTemplate` never called → cold sends will be rejected by Meta* | M (templates) | **P1** |
| 37 | Automated: receipts, expiry, birthday, class reminders | ✅ | 🟡 | Expiry + birthday + lead-created fire daily ✅; **payment receipts manual-only; class reminders absent**; 2 of 3 seeded "essential rules" have no trigger emitter | M | **P1** |
| 38 | Bulk WhatsApp/email/SMS campaigns | ✅ | 🟡 | Real multi-channel sender (batching, per-row bookkeeping) ✅; **`scheduled_at` never dispatched**; no opt-out/consent; no open/click tracking | M | P1 |
| 39 | Push notification broadcasts | ✅ | 🟡 | Campaign `push` channel genuinely sends via Expo ✅; dedicated `/push-notifications` endpoint writes a row marked "sent" **without calling PushService**; no admin UI | S | P1 |

### Staff & Permissions

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 40 | Roles: Owner/Manager/Receptionist/Trainer/Custom | ✅ | 🟡 | 9 seeded enterprise roles ✅; **custom roles creatable but unassignable** (`staff-invite.service.ts:53` rejects them; `role_id` never written) | S–M | P2 |
| 41 | Granular per-role permissions | ✅ | ✅ | Full RBAC chain + per-staff grant/deny overrides + 667-line matrix UI · *critical bug: `analytics` module unregistered → non-owners 403 on all 12 analytics routes; `@Roles('manager')` mismatch* | S (bugfix) | **P0 (fix)** |
| 42 | Payroll + commission + shift scheduling | ✅ | 🟡 | Complete backend (config, process, records, revenue) — **zero UI pages**; ₹500 hardcoded session rate | M | P2 |

### Multi-Location

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 43 | Multiple branches, one owner dashboard | ✅ | ✅ | `branches/*`, portfolio rollup (`/dashboard/portfolio`), branch scorecards + map | — | P2 (done) |
| 44 | Branch-scoped staff access; per-branch plans/schedules/branding | ✅ | 🟡 | Access scoping ✅ (fail-closed util + guard); per-branch plans/pricing/schedules ✅; **branding is org-level only** (`WhiteLabelConfig` keyed org); `BranchSettings` has API, no UI | M | P2 |
| 45 | Shared exercise/diet libraries across branches | ✅ | ✅ | `Exercise`/`DietPlan` are gym-wide by design · *no catalog CRUD (see #28)* | — | P2 (done) |
| 46 | Per-branch + consolidated reports; per-branch billing | ✅ | 🟡 | Branch-clamped reports backend ✅ + branch-comparison UI; **gateway config is gym-wide** (no per-branch merchant); report UI gaps (see #53) | M | P2 |

### Reports & Analytics

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 47 | Revenue by category (membership/PT/classes/products) | ✅ | 🟡 | `revenue-mix` tile works (by plan type) but omits POS + real PT; **aggregation job filters `status:'completed'` (never written) → `RevenueAnalytics`/`DailyGymMetrics` permanently 0**; PT category is a superset double-count | M | **P0 (fix)** |
| 48 | Active/expired/expiring-soon analytics | ✅ | 🟡 | Backend complete (`/memberships/stats`, `/members/lifecycle`, cron-maintained statuses); **no UI consumer** beyond list filter + one KPI tile | S | P2 |
| 49 | Attendance trends | ✅ | ✅ | `/visits` charts, 7×24 heatmap with anomaly flags, peak hours | — | P2 (done) |
| 50 | Staff performance | ✅ | 🟡 | Backend ✅ (`/trainer/performance`, leaderboard); **staff analytics page calls nonexistent `/analytics/trainer-performance`** → always empty | S | P2 |
| 51 | Retention / churn | ✅ | ✅ | Real cohort retention curves, nightly engagement/churn-risk scoring, at-risk playbook UI | — | P2 (done) |
| 52 | Income / expense / net profit | ✅ | ✅ | Immutable expense ledger + reversals, P&L, cashflow prediction, full UI — strongest area | — | P0 (done) |
| 53 | Daily + monthly report views | ✅ | 🟡 | Dashboard is excellent (role shells, ~15 tiles); `/reports` page is **Store-only**; a complete 8-tab gym reports UI (`features/reports/components/*Tab.tsx`) is **imported by no page**; `useMonthlyReport` has zero consumers | S–M | **P0** |

### Member Self-Service

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 54 | Dashboard (status/expiry/days-left) + in-app renewal/upgrade | ✅ | 🟡 | Dashboard + renewal ✅ end-to-end (Razorpay hosted `/pay` + webhook polling — the old "orphaned renew" finding is stale); **no upgrade/plan-picker, autoRenew display-only** | M | P1 |
| 55 | Payment history | ✅ | 🟡 | Last 10 invoices inside membership screen; no dedicated screen, pagination, or receipt PDF via BFF | S | P1 |
| 56 | Class booking + waitlists in app | ✅ | ✅ | `classes.tsx` — waitlist join/leave, position badge, promotion toast | — | P1 (done) |
| 57 | View workout/diet/PT plans | ✅ | 🟡 | Workout+diet ✅; **PT sessions have zero BFF exposure** | M | P2 |
| 58 | Log weight; BMI + trend charts | ✅ | ✅ | Server-computed BMI, 365-pt series, range filters, photo compare | — | P1 (done) |
| 59 | Check-in history; digital QR ID in app | ✅ | ❌ | **Neither exists.** App *scans* the gym's QR (inverted vs competitors); no visit-history endpoint/screen | M | **P1** |
| 60 | Health profile (height, blood group, allergies, goals) | ✅ | 🟡 | Fitness profile ✅; `blood_group`/`allergies`/`emergency_contact` exist in schema but are **admin-panel only** — absent from BFF DTO + app | S | P2 |
| 61 | Notification inbox; feedback form | ✅ | 🟡 | Inbox is client-side synthesis (no `GET /notifications` feed, device-local read state); **feedback form: zero code** | M | P2 |

### Platform / Misc

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 62 | Native iOS + Android (owner + member apps) | ✅ | 🟡 | Member app real (Expo 56, dev-build) but **never store-submitted** (`eas.json submit.production: {}`); owner native app ❌ (web only) | L (publish) / XL (owner app) | P1 / P3 |
| 63 | WhatsApp OTP login; Face ID / Touch ID | ✅ | 🟡 | OTP is **SMS via Supabase**, not WhatsApp; biometrics = app-lock overlay on existing session, not an auth factor (that part is fine for parity) | M | P2 |
| 64 | Gym public landing page; payment link generation | ✅ | 🟡 | `/join/[gymSlug]` portal + trial + checkout ✅; SaaS landing orphaned at `/landing` (root redirects to /login); **no admin "generate payment link" flow** | S–M | P1 |
| 65 | Waiver collection | ✅ | 🔴 | Only a `document_type: 'waiver'` upload string — no signature capture, no consent record, no member-app flow | M (schema — hard gate) | P2 |
| 66 | Multi-currency + tax + timezone | ✅ | 🟡 | Timezone ✅ (used in real date math); GST ✅ (India-only); currency nominal — INR hardcoded formatting, no FX | L | P3 |
| 67 | AI insights (forecast, churn) + NL analytics assistant | ✅ (claimed) | 🟡 | Grounded daily briefing ✅; churn scoring ✅ (heuristic); NL assistant is real Claude but **not data-grounded** (can't answer "revenue last month"); revenue forecast ❌ | M–L | P3 |

### Competitor weaknesses — can WE win here?

| # | Feature | Competitor | My status | Evidence | Effort | Priority |
|---|---|---|---|---|---|---|
| 68 | Multiple gateways beyond Razorpay | ❌ | 🟡 → win | Stripe fully implemented backend + per-gym `PaymentGatewayConfig` + settings UI; needs a checkout UI caller; member paths Razorpay-only | M | P2 |
| 69 | Open API / webhooks / Zapier | ❌ | 🔴 | Webhook infra is excellent (21 events, HMAC, SSRF guard, retries) but **`dispatch()` has zero callers — no event ever fires**; no API keys; Zapier is a catalog string; `testIntegration()` always returns ok | S (wire) / L (API keys) | **P1** |
| 70 | Door/turnstile access control (auto-block expired) | ❌ | 🟡 | Policy engine auto-blocks/auto-expires at QR/kiosk ✅; iclock path bypasses it and `getrequest` returns hardcoded `OK` — **no device commands, no door actuation** | L | P3 |
| 71 | Offline mode with sync | ❌ | ✅ **win** | SQLite outbox + idempotent server + kiosk offline queue — already better than competitor | — | market it |
| 72 | POS / supplement inventory | ❌ | ✅ **win** | Full inventory+POS module with batches, POs, transfers, returns, receipts | — | market it |
| 73 | Hindi + regional language UI | ❌ | ❌ | Zero i18n anywhere (no library, hardcoded English) | XL | P2 |
| 74 | Website builder / wearables / workout video library | ❌ | ❌ / ✅ / ❌ | Wearables **win**: HealthKit + Health Connect + HR/HRV/sleep/SpO2 sync (code-complete, on-device QA pending). Builder + video library absent | — / XL | P3 |
| 75 | Free tier / transparent pricing | ❌ | 🟡 | Free tier exists in `plan-configs.ts` + SCC; public pricing page hardcoded, out of sync, hides Free, and orphaned at `/landing` | S | P1 |

### Features WE have that MyGymDesk does NOT (protect & market)

1. **Public "gym-less" fitness platform** — anyone can use the app without a gym; multi-gym identity; nearby-gym discovery funnel (`app_users`, `choose-gym`, `nearby-gyms`). This is a member-acquisition flywheel no gym-admin competitor has.
2. **Member AI Coach** (Claude, context-aware) + staff AI advisor + grounded daily briefing.
3. **Face-recognition check-in** (pgvector cosine search) + hybrid static/dynamic signed QR + kiosk hardening + anti-QR-sharing parallel-session rule.
4. **Access-policy engine** — 8 ordered rules with persisted rule traces, staff override flow, denial catalog.
5. **Wearables/health platform** — HealthKit/Health Connect, HR/HRV/sleep/SpO2/VO2max, on-device step tracker, activity rings.
6. **Community layer** — leaderboard (real check-ins), challenges, badges, streak milestones with haptics.
7. **Trainer↔member realtime chat** + WhatsApp shared team inbox.
8. **Enterprise referral engine** — fraud signals, wallets, clawbacks, attributed-revenue analytics (24 files).
9. **Expense intelligence** — immutable ledger, P&L, cashflow prediction, recurring-expense detection.
10. **Full inventory/POS/supplement retail** with batches, purchase orders, stock transfers, GST receipts.
11. **Offline-first member app + offline kiosk queue** with idempotent sync.
12. **Nutrition tracking with Indian food catalog** + personalized macro targets.
13. **Corporate + family memberships, multi-branch access passes, city access, branch transfer audit.**
14. **DPDP/GDPR compliance module** (consent logs, data export/delete) + SCC error-monitoring pipeline.
15. **Dashboard intelligence** — KPI provenance inspector, anomaly detection, cohort curves, role-specific dashboards.

---

## Phase 3 — Implementation roadmap

Ordering logic: **fix what lies before building what's missing** (broken analytics/permissions poison every demo), then close P0 revenue-ops gaps, then the Indian-market P1 selling points, then growth features. Anything marked **[schema]** touches `schema.prisma`/migrations and is a **HARD-GATE item requiring explicit approval** per CLAUDE.md; same for the two-class-system unification.

### Milestone 0 — "Stop the bleeding" (v-next, ~1 week, mostly S items)

Bug-fix release. No schema changes. Everything here is a quick win (see list below) plus:

| Item | Scope | Effort |
|---|---|---|
| Register `analytics` in `MODULES_ACTIONS` + fix `@Roles('manager')` mismatch | `auth/rbac-seed.service.ts`, `roles.controller.ts` — unblocks all analytics for non-owner roles | S |
| Fix `Payment.status: 'completed'` → `'paid'` in `metrics-aggregation.job.ts` (3 sites) + fix `organization_id: ''` uuid upserts + fix PT-superset double-count | Makes `RevenueAnalytics`/`DailyGymMetrics`/`/reports/*` non-zero; add a backfill re-run | S–M |
| Fix assign-membership 404 (`features/memberships/api.ts` → real routes) | Restores membership assignment from the UI | S |
| Fix staff analytics page route (`/analytics/trainer-performance` → `/analytics/trainers`) | S |
| Mount the orphaned 8-tab reports UI at a gym-level `/reports` route (rename Store report to `/store/reports` or a tab) | Delivers item #53 with already-written code | M |
| Wire `WebhooksService.dispatch()` into member.created / payment.received / checkin.completed / invoice events | Turns the dead integration story real (item #69) | S–M |
| Fix push endpoint to actually call `PushService`; add segment broadcast shape | Item #39 | S |
| Invoice UI: add tax-rate + discount selectors; add "Collect payment" action passing `invoice_id`; add Cancel action calling `POST /invoices/:id/cancel` (and remove the ledger-bypassing status-PATCH path) | Items #7, #9, #13 | M |
| Refunds screen (hooks already exist) | Item #12 | S |
| Root landing: serve `/landing` at `/`, sync pricing with `plan-configs.ts`, show Free tier | Items #64, #75 | S |

### Milestone 1 — "Indian-market parity" (+1 month)

| Item | Scope | Schema | Third-party | Effort |
|---|---|---|---|---|
| **Member QR ID + check-in history** (#3, #19, #59) | BFF: `GET /member/v1/qr` (reuse `qr-token.service`), `GET /member/v1/checkins`; app: QR screen (brightness bump), visits list + calendar; admin: printable ID card using signed token + regenerate button | none | none | M |
| **WhatsApp template layer** (#36) | Template registry synced with Meta, `sendTemplate` wiring in automation dispatcher + campaigns; per-gym template status UI | small [schema] | Meta WABA template approval | M |
| **Automated receipts + class reminders** (#37, #24) | Emit event on payment paid → receipt via WA/email; hourly cron scanning sessions starting in 24h (respect `class_reminders` pref); fire `member_registered`/`member_renewed` triggers that are already seeded | none | WABA | M |
| **Campaign scheduler** (#38) | Cron dispatching `scheduled_at <= now` pending campaigns; opt-out field + consent check | small [schema] | — | S–M |
| **Payment links** (#10) | Admin "Generate & share link" minting a Razorpay order → `/pay/[orderId]` URL → send via existing WA/email delivery; optionally Razorpay Payment Links API for expiry/reminders | none | Razorpay | S–M |
| **Member data import** (#6) | `POST /members/import` CSV (papaparse or manual parse — new dep needs approval), column-mapping UI, dry-run + error report, duplicate-phone handling | none | — | M |
| **In-app plan upgrade** (#54) | Plan picker in `membership.tsx` + BFF renew accepting `planId` (backend `createOrder` already takes plans); proration decision needed | none | — | M |
| **Stripe checkout UI** (#8, #68) | Frontend Elements-free redirect or payment-element flow calling existing `create-stripe-intent` | none | Stripe keys | M |
| **Membership analytics cards** (#48) + monthly report view (#53) | Consume existing `/memberships/stats`, `/members/lifecycle`, `useMonthlyReport` | none | — | S |
| **Exercise library seed + CRUD** (#28) | Seed ~50 exercises per gym template; `POST/PATCH/DELETE /exercises` + admin library page | none (data) | — | S–M |
| **App store publishing** (#62) | EAS production credentials, ASC + Play listings, privacy manifests | none | Apple/Google review | L (elapsed time) |

### Milestone 2 — "Growth & retention" (+3 months)

| Item | Scope | Schema | Third-party | Effort |
|---|---|---|---|---|
| **PT packages + PT UI** (#25–27) | [schema] `PTPackage` + `sessions_remaining` on `TrainerClient` (or package rows); purchase→invoice link; session-rate from package price (kill the ₹500 constant); trainer session-log UI + payroll/commission pages (hooks exist) | **[schema]** | — | L |
| **Payroll + shifts UI** (#42, #18) | Pages over the complete existing backend | none | — | M |
| **CRM upgrade** (#32–34) | [schema] `next_follow_up_at` + follow-up cron/notifications; `POST /leads/:id/convert` (create member, carry contact, link `converted_member_id`); phone-based dedupe warning; kanban board; custom stages if demanded (else keep 5 fixed) | **[schema]** | — | L |
| **Class system unification** (#20–23) | Point member BFF + schedule UI at `ClassSession` stack; migrate/bridge `ClassEnrollment`; decrement class-pack credits on booking; instructor notifications | **[schema/migration — plan first]** | — | L–XL |
| **Recurring auto-charge** (#11) | Razorpay Subscriptions / UPI Autopay mandate at signup; charge on renewal cron; dunning + retry (`PaymentRetryLog` exists) | small [schema] | Razorpay subscriptions KYC | L |
| **Waiver e-sign** (#65) | [schema] `signed_at`/`signature_blob`/`consent_version` on MemberDocument or new model; signature-pad in app + onboarding gate; PDF stamping via existing renderer | **[schema]** | — | M |
| **Custom-role assignment fix** (#40) | Write `role_id` on staff create/invite; allow custom roles in `staff-invite`; role dropdown from `/roles` | none | — | S–M |
| **Notification inbox (server-backed) + feedback** (#61) | `GET /member/v1/notifications` feed persisting automation/campaign/class events; feedback model + form + admin view | **[schema]** | — | M |
| **Hindi i18n foundation** (#73) | i18n library (dep approval), extract member-app strings first (highest leverage), then admin | none | translators | XL (phased) |
| **Data-grounded AI assistant + forecast** (#67) | Tool-use over existing analytics/dashboard services; simple revenue forecast (trailing MRR + seasonality) on the briefing | none | Anthropic | M–L |
| **iclock hardening / door control** (#17, #70) | Route iclock ingest through `CheckInOrchestrator`; implement `getrequest` command queue (user sync, unlock/deny) for supported ADMS devices | none | device firmware testing | L |

### Quick wins (< 1 day each)

1. `analytics` permission module registration (unblocks 12 endpoints for every non-owner role).
2. `'completed'` → `'paid'` in `metrics-aggregation.job.ts` (revenue analytics go from permanently-zero to real).
3. Assign-membership 404 route fix.
4. Staff-analytics wrong-route fix.
5. Refunds page (hooks already written).
6. Invoice **Cancel** action wired to the correct ledger-reversing endpoint.
7. "Collect payment" passing `invoice_id` from the invoice row.
8. Wire `WebhooksService.dispatch()` into 3–4 core events.
9. Fix the lying `/push-notifications` endpoint to call `PushService`.
10. Root `/` → landing page + pricing sync + show Free tier.
11. Exercise seed data (unblocks the whole workout-builder feature).
12. Membership stats cards from existing endpoints.
13. Kiosk PIN validated against `CheckInDevice.pin_hash` instead of localStorage.
14. Remove stale "Trainer-assigned plans arrive in a later update" copy in `workout.tsx`.
15. Delete/merge the duplicate `marketing/automation` vs `marketing/automations` pages.

### Risks & blockers

| Risk | Impact | Mitigation |
|---|---|---|
| **WABA template approval + Meta business verification** | Blocks automated reminders/receipts at scale (session messages get rejected outside 24h window) | Submit templates early in M1; keep email/push fallback channels |
| **Razorpay KYC / live keys** (known open item from prod cutover) + Subscriptions/UPI-Autopay product approval | Blocks payment links in prod + recurring auto-charge | Resolve keys first; mandate flow is a separate Razorpay product application |
| **App Store / Play review** | 1–2+ weeks elapsed; health-data (HealthKit) and payment flows attract extra scrutiny; Apple requires IAP-exemption clarity for physical-services payments | Start listings in M1; keep renewal via external browser (already the design) |
| **Schema changes are hard-gated** | PT packages, CRM follow-ups, waiver, notification feed, WA templates all need migrations — and the **per-gym-schemas rework (`feat/per-gym-schemas`) is in flight with a large uncommitted diff** | Sequence schema work after the tenant-schema branch lands; every new tenant model MUST be added to `backend/src/prisma/tenant-models.ts` (known leak class) |
| **Class-system unification is a data migration** | Member bookings live in `ClassEnrollment`; sessions in `ClassSession` — merging risks double-booking or losing waitlist positions | Plan-first doc; bridge reads before writes; migrate branch-by-branch |
| **Revenue-analytics backfill** | After the `'paid'` fix, historical `DailyGymMetrics`/`RevenueAnalytics` are wrong/empty and need a re-aggregation run | Add an admin backfill job; communicate restated numbers (the dashboard has a restatements surface already) |
| **Webhook enablement is outward-facing** | Firing 21 event types at customer URLs for the first time can leak data if payloads over-share | Review payload shape per event against `StripSecretsInterceptor` rules before enabling |
| **i18n scope creep** | Thousands of hardcoded strings across 4 apps | Member app first; admin later; never big-bang |
| **Wearables + biometric flows are device-QA-only** | `provider.native.ts` self-flags UNVERIFIED; RN behavior not verifiable in CI | Explicit on-device QA pass before marketing these |

---

## Bugs found during audit (fix regardless of roadmap)

| Severity | Bug | Location |
|---|---|---|
| 🔥 High | `analytics` permission module never registered → all analytics 403 for non-owners | `backend/src/auth/rbac-seed.service.ts:15` vs `analytics/controllers/dashboard-analytics.controller.ts` |
| 🔥 High | Aggregation job filters `Payment.status='completed'` (never written; real value `'paid'`) → revenue analytics permanently 0; also `organization_id: ''` into uuid columns; PT revenue = superset double-count | `backend/src/analytics/jobs/metrics-aggregation.job.ts:63,100,178,190,219,314` |
| 🔥 High | Assign-membership dialog calls nonexistent `/members/:id/memberships` → 404 | `frontend/src/features/memberships/api.ts:50,54` |
| High | Outbound webhooks never dispatch (zero callers of `dispatch()`); `testIntegration()` can never fail | `backend/src/platform/services/webhooks.service.ts`, `integrations.service.ts:160` |
| High | `/push-notifications` marks rows `sent` without sending | `backend/src/marketing/automation.service.ts:430-447` |
| High | Staff analytics page queries nonexistent route → always empty | `frontend/src/app/[gymSlug]/staff/analytics/page.tsx:32` |
| Med | PT session rate hardcoded ₹500 → all commission/payroll figures wrong | `backend/src/staff/trainer.service.ts:247` |
| Med | Custom roles unassignable (`role_id` never written; invite rejects them) | `backend/src/staff/staff-invite.service.ts:53` |
| Med | `@Roles('owner','manager')` uses non-existent `manager` role → real managers 403 on roles API | `backend/src/roles/roles.controller.ts` |
| Med | Manual invoices compute ₹0 GST (UI never sends `tax_rate_id`) | `frontend/.../payments/invoices/new/page.tsx` |
| Med | Kiosk exit PIN is client-side localStorage, ignores `CheckInDevice.pin_hash` | `frontend/src/features/checkins/kiosk/KioskPinLock.tsx:107` |
| Med | iclock ingest bypasses policy engine (no freeze/cooldown/credits/WS at turnstile) | `backend/src/check-ins/biometric/iclock.service.ts` |
| Low | `OCCUPANCY_UPDATED` WS event declared, listened, never emitted; `CapacityWidget max={0}` | `check-ins/check-in.events.ts:15`, `check-in/page.tsx:529` |
| Low | Invoice-template picker persists to localStorage only; templates never used by renderer | `frontend/.../settings/invoices/page.tsx:317` |
| Low | Dead layers: 8 reports tabs, payroll/shifts/trainer/refunds hooks, `useMonthlyReport`, 3 member-app query hooks — all zero consumers | various (see Phase 2 rows) |
