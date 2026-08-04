# MuscleX — Gap Analysis & Roadmap vs MyGymDesk

> **Originally generated 2026-08-02** by a full-codebase audit.
> **Re-verified 2026-08-04** after 38 commits of remediation (M0 → M3), by 5 parallel agents that
> re-read every row against current `HEAD`. Every status below was checked in two directions:
> **backend route/service exists** AND **a UI actually calls it**. A backend with no caller is
> explicitly marked "UI: none" and does **not** count as done.
>
> Statuses: ✅ fully wired (API + DB + UI connected) · 🟡 partial (gap stated) · 🔴 stub/dead/misleading code · ❌ missing.

---

## Scorecard — 2026-08-02 → 2026-08-04

| Status | Was | Now | Δ |
|---|---|---|---|
| ✅ done | 23 | **35** | **+12** |
| 🟡 partial | 33 | 28 | −5 |
| 🔴 stub/dead | 5 | 7 | +2 ¹ |
| ❌ missing | 14 | 5 | −9 |

¹ 🔴 rose because re-verification **downgraded three rows the original audit was too generous
about** (#21 class credits, #22 instructor notifications, #23 class-system split are dead, not
partial) and #55 / #11 proved to be stubs. Nothing regressed — the original grades were wrong.

**Bug list: 11 of 15 fixed, 1 partial, 3 still open.** 24 **new** defects found during
re-verification, including one **critical data-loss** bug (see below).

---

## 🔴 Critical — fix before the next deploy

**Admin offline check-ins are silently destroyed on reconnect.**
`frontend/src/app/[gymSlug]/check-in/page.tsx:140-143` — the auto-sync effect calls
`syncMutation.mutate([], { onSuccess: () => offlineQueue.clear() })`. It posts an **empty array**
(the comment says `// Will be populated by sync handler`; nothing ever populates it) and then wipes
the IndexedDB queue. Every check-in recorded during an outage is lost the instant the browser
comes back online. The manual "Sync Now" path at `:149-166` is correct — but the effect fires
first. Offline mode is listed as a competitive **win** (#71); on the admin side it currently
loses data. Verified by direct code read, not agent report.

Related: the admin replay carries **no idempotency key** (`features/checkins/types.ts:26-34` has no
`client_event_id`) even though the backend dedupes on it (`check-ins.service.ts:139,152`), and
`onSuccess` clears the whole store rather than per-row, so partial failures are discarded too.

---

## Phase 2 — Gap table (re-verified)

Effort: **S** < 1 day · **M** 1–3 days · **L** ~1–2 weeks · **XL** > 2 weeks.
Priority: **P0** core gym ops · **P1** Indian-market selling points · **P2** growth/retention · **P3** differentiators.
"Was" = the 2026-08-02 grade.

### Member Management

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 1 | Member CRUD + photos + measurements + progress | ✅ | ✅ | `members.controller.ts:112,134,197-259`; UI `MemberProgressTab.tsx` | — | done |
| 2 | Membership status / renewal / expiry | 🟡 | ✅ | **404 fixed** — `features/memberships/api.ts:50,54` → `/memberships/assign/:id` (`memberships.controller.ts:28,39`) | — | done |
| 3 | Digital member ID card with QR | 🟡 | ✅ | **Shipped** `14f15cb` — BFF `member-identity.controller.ts:17`, app `id.tsx:31`, admin printable `MemberIdCard.tsx:54` | — | done |
| 4 | Custom plans (monthly/quarterly/annual) | ✅ | ✅ | `plans.service.ts:129`; `PlanForm.tsx:48-51` | — | done |
| 5 | Freeze / pause membership | ✅ | ✅ | `memberships.controller.ts:56,64`; auto-unfreeze cron `renewals.service.ts:207` | — | done |
| 6 | Member data import / migration | ❌ | ❌ | Zero import routes repo-wide; no CSV parser dep; no mapping UI. **Switching gyms still cannot migrate.** | M | **P0** |

### Billing & Payments

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 7 | Instant bill + payment collection | 🟡 | ✅ | Collect button `invoices/page.tsx:279` → posts `invoice_id` to `/payments/cash` · ⚠️ **gateway path drops it — see NEW-1** | — | done |
| 8 | Razorpay / Stripe / PayPal | 🟡 | ✅ | Stripe UI shipped `5a50b98` (`StripeCheckoutDialog.tsx`, CDN-loaded, no new dep). PayPal absent (out of scope) | — | done |
| 9 | GST-compliant invoices | 🟡 | ✅ | `invoices/new/page.tsx:117` now sends `tax_rate_id`; CGST/SGST/IGST `billing.service.ts:106-167` | — | done |
| 10 | Payment links via WhatsApp | 🟡 | ✅ | `payment-links.service.ts:71` + `POST /payments/links`; UI `invoices/page.tsx:265` | — | done |
| 11 | Recurring billing (member auto-charge) | 🟡 | 🔴 | **Unchanged** — `renewals.service.ts:176-186` still writes `pending`/`bank_transfer`, **no gateway call**. Needs stored mandate. | L | P1 |
| 12 | Partial payments, refunds, dues | 🟡 | 🟡 | Refunds **now move real money** (`refunds.service.ts:44-76` calls gateway before DB write, `feae6ae`) + screen. **No AR/aging view** | S | P1 |
| 13 | Invoice cancellation w/ revenue exclusion | 🟡 | ✅ | `POST /invoices/:id/cancel` + reversing ledger entry; UI Cancel `invoices/page.tsx:290` | — | done |

### Attendance

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 14 | QR check-in / check-out | ✅ | ✅ | `qr.controller.ts:44,119`; admin + kiosk + member card all consume | — | done |
| 15 | Front-desk kiosk mode | ✅ | 🟡 | PIN still SHA-256 in `localStorage` (`KioskPinLock.tsx:108`); `pin_hash` written as a throwaway sentinel and never read. Hardened (salt + lockout), not fixed. **HARD STOP #2** | M | P2 |
| 16 | Real-time attendance dashboard | ✅ | ✅ | `OCCUPANCY_UPDATED` **now emitted** `check-in.orchestrator.ts:732` → gateway `:175` · ⚠️ NEW-7 | — | done |
| 17 | Biometric device integration | 🟡 | 🟡 | **Policy bypass fixed** `cd3368e` — iclock routes through `CheckInOrchestrator`. No server→device command channel (`getrequest` returns bare `'OK'`) | L | P3 |
| 18 | Staff attendance + shift tracking | 🟡 | ✅ | **Shifts UI shipped** `fecb69f` — `staff/shifts/page.tsx:34` over real routes | — | done |
| 19 | Member attendance calendar / streaks | 🟡 | 🟡 | Visits + summary shipped `14f15cb`; app screen renders month bars. Backend's per-day `days[]` **has no consumer** — no calendar grid | S | P2 |

### Classes & Scheduling

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 20 | Group classes + capacity + waitlists | ✅ | 🟡 | Correct on **both** stacks, but UI exists only on legacy. `useBookClass`/`useSessionBookings` have **zero importers** | M | P2 |
| 21 | Session-based class packages | 🟡 | 🔴 | **Downgraded.** Credits burn on gym check-in ONLY (`check-in.orchestrator.ts:506-512`); `backend/src/classes/**` never touches `classes_remaining` | M | P2 |
| 22 | Instructor assignment + notifications | 🟡 | 🔴 | **Downgraded.** Assignment works; **zero** notifications. `cancelSession` mass-cancels and hard-deletes the waitlist silently | M | P2 |
| 23 | Online class booking by members | 🟡 | 🔴 | **Downgraded.** `member-class.service.ts:45` still queries legacy `client.class`. Admin-created sessions are **invisible to members** | L | P2 |
| 24 | Class reminders 24h before | ❌ | 🟡 | **Cron shipped** `8b4f523` (hourly, covers both stacks, real delivery) — but **dormant by default**: needs a manual "seed defaults" click, and the trigger is missing from the UI (NEW-8) | S | P1 |

### Personal Training

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 25 | Trainer-member assignment + PT packages | 🟡 | 🟡 | `TrainerClient` backend ✅ but `useAssignClient` has **UI: none**. No `PTPackage` model — **[schema]** | L | P2 |
| 26 | PT session logging with notes | 🟡 | ✅ | **Shipped** `2d27647` — `staff/pt-sessions/page.tsx:68` over real routes | — | done |
| 27 | PT commission + payouts | 🟡 | 🟡 | Payroll UI shipped `fecb69f` (real aggregation, not mocked). **`sessionRate = 500` still hardcoded** (`trainer.service.ts:247`) → every commission figure is wrong | M | P2 |
| 28 | Workout builder + exercise library | 🟡 | 🟡 | CRUD + 51-exercise catalog shipped `46d3d98`. **Seeder not called on tenant creation** (NEW-21); `WorkoutPlanExercise` has no day/week column → no PPL split | S | P2 |

### Workout & Diet

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 29 | Diet plans + meals + macros | ✅ | ✅ | `diet-plans.controller.ts:24-102`; `MealsEditor.tsx` | — | done |
| 30 | Plans in member app + progress | ✅ | ✅ | `plan.tsx`, `progress.tsx`; progress-photo routes confirmed live (old 404 finding is stale) | — | done |
| 31 | AI-generated workout/diet plans | 🟡 | ❌ | **Downgraded.** `ai-tools.ts:12` — "Every tool is a READ". No `generatePlan` anywhere; coach screen has no accept/save | M | P3 |

### CRM & Leads

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 32 | Lead capture (walk-in/phone/web/social) | 🟡 | 🟡 | DTO gained `phone`/`whatsapp`/`other` (`7761ac8`) but **the UI dropdown was never updated** (NEW-10) — the fix is unreachable. No UTM; inbox creates no leads | S | P2 |
| 33 | Custom stages + follow-ups + assignee history | 🔴 | 🟡 | Assignee history shipped `2fbffcd`. No `next_follow_up_at` **[schema]**, stages hardcoded, no kanban | M | P2 |
| 34 | Duplicate detection + lead→member conversion | ❌ | ✅ | **Shipped** `2fbffcd` — `findDuplicates()`/`convertToMember()` + full UI. Gap: create-form doesn't call the dedupe check (NEW-22) | — | done |
| 35 | Lead conversion funnel report | ✅ | ✅ | `/leads/funnel` + UI | — | done |

### Communication

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 36 | Official WhatsApp Business API | ✅ | 🟡 | **`sendTemplate` still has zero callers** (only interface + 2 providers + a mock). Every send is free-form text → **fails outside the 24h WABA window**. Template registry is **[schema]** | M | **P1** |
| 37 | Automated receipts / expiry / birthday / class reminders | 🟡 | 🟡 | **Receipts now automatic** `456d89e` (`@OnEvent(PAYMENT_PAID)`, 5 emit sites). Class reminders shipped but dormant. **2 of 5 seeded workflows have no emitter** (NEW-9) | S | P1 |
| 38 | Bulk campaigns | 🟡 | 🟡 | `scheduled_at` **now dispatched** (5-min cron). **No opt-out/consent check at all** — `ConsentLog` exists and is never read (NEW-5, compliance risk) | M | **P1** |
| 39 | Push broadcasts | 🟡 | 🟡 | Endpoint **now really sends** `b38f547`. **UI: none**; single-member only. Broadcast works via campaigns | S | P2 |

### Staff & Permissions

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 40 | Roles incl. custom | 🟡 | ✅ | **Fixed** `f9102e1` — invites accept custom roles; selector merges them. (Join key is `UserRole.role_name`, not `role_id`) | — | done |
| 41 | Granular per-role permissions | 🟡 | ✅ | **`analytics` registered** `ddb0be5` + granted to 5 roles · ⚠️ **72 phantom `@Roles` sites** remain (NEW-11) | S | P2 |
| 42 | Payroll + commission + shifts | 🟡 | ✅ | **Both screens shipped** `fecb69f` over real aggregation | — | done |

### Multi-Location

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 43 | Multiple branches, one dashboard | ✅ | ✅ | `branches/page.tsx`, portfolio rollup | — | done |
| 44 | Branch-scoped access; per-branch plans/branding | 🟡 | 🟡 | Scoping ✅, per-branch plans ✅. `useBranchSettings` has **UI: none** (no branch detail route). Branding still org-level — **[schema]** | M | P2 |
| 45 | Shared exercise/diet libraries | ✅ | ✅ | Gym-scoped library + CRUD page | — | done |
| 46 | Per-branch + consolidated reports | 🟡 | ✅ | Branch filter + dedicated Branches comparison tab on `/reports` | — | done |

### Reports & Analytics

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 47 | Revenue by category | 🟡 | 🟡 | **Core fix landed** `8616ade` — `status:'paid'`, membership by `membership_id`, PT from `TrainerRevenue` (no double-count), POS included. **No `classes` category**; `/dashboard/revenue-mix` still omits POS | S | P2 |
| 48 | Active/expired/expiring analytics | 🟡 | 🟡 | Stats cards shipped (QW-A). `GET /members/lifecycle` still has **UI: none** | S | P2 |
| 49 | Attendance trends | ✅ | ✅ | `AttendanceTab` on the mounted reports page | — | done |
| 50 | Staff performance | 🟡 | ✅ | **Route fixed** `c5e6ad6` → `/analytics/trainers/leaderboard` | — | done |
| 51 | Retention / churn | ✅ | ✅ | Cohort curves + churn-risk UI | — | done |
| 52 | Income / expense / net profit | ✅ | ✅ | Strongest area | — | done |
| 53 | Daily + monthly report views | 🟡 | 🟡 | **8 tabs mounted** `5645287` at `/reports` + nav entry. `useMonthlyReport` **still orphaned** — no monthly view | S | P2 |

### Member Self-Service

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 54 | Dashboard + in-app renewal/upgrade | 🟡 | ✅ | **Plan picker shipped** `285695c` — `GET /membership/plans` + gym-scoped `planId` validation | — | done |
| 55 | Payment history (member) | 🟡 | 🔴 | **Downgraded.** There is **no** `member/v1/payments|invoices|receipts` route at all. UI: none | M | P1 |
| 56 | Class booking + waitlists in app | ✅ | ✅ | Waitlist position + promotion | — | done |
| 57 | View workout/diet/PT plans | 🟡 | 🟡 | Workout + diet ✅. **PT sessions still have zero BFF exposure** | M | P2 |
| 58 | Log weight; BMI + trends | ✅ | ✅ | Server-computed BMI + series | — | done |
| 59 | Check-in history + digital QR ID | ❌ | ✅ | **Both shipped** `14f15cb` — `/id` (rolling QR) + `/visits` (cursor-paged) + screens | — | done |
| 60 | Health profile (blood group, allergies) | 🟡 | ❌ | **Downgraded.** Columns exist; grep for them across BFF + app = **zero hits**. Not exposed anywhere | S | P2 |
| 61 | Notification inbox; feedback form | 🟡 | 🔴 | No `GET /member/v1/notifications` — inbox is still client-side synthesis. **Feedback: zero code.** Both **[schema]** | M | P2 |

### Platform / Misc

| # | Feature | Was | **Now** | Evidence / what remains | Effort | Pri |
|---|---|---|---|---|---|---|
| 62 | Native iOS + Android | 🟡 | 🟡 | `eas.json` `submit.production` still `{}`, **and no `extra.eas.projectId`/`owner`** — the project isn't linked to EAS at all | L | P1 |
| 63 | WhatsApp OTP; Face ID / Touch ID | 🟡 | 🟡 | **Face ID/Touch ID ✅ shipped** (`biometric.ts`, `AppLock.tsx`, settings toggle). WhatsApp OTP ❌ — `member-auth.service.ts:75-80` hardcodes `channel:'sms'` | M | P2 |
| 64 | Public landing + payment links | 🟡 | ✅ | **Root `/` serves marketing** `58d2d5c`; payment links UI-called. Minor: no admin surface for the `/join/<slug>` share link | — | done |
| 65 | Waiver collection | 🔴 | 🔴 | **Unchanged** — only a `document_type:'waiver'` upload string. No signature capture. **[schema]** | M | P2 |
| 66 | Multi-currency + tax + timezone | 🟡 | 🟡 | `useCurrency` used 23× while **66 files hardcode `₹`**; branch tz read only by the orchestrator; tz is free text not an IANA picker | L | P3 |
| 67 | AI insights + NL analytics | 🟡 | 🟡 | **AI advisor now genuinely tool-grounded** `49cfda3` (8 read-only tenant-bound tools). **Revenue forecast built** `c84235f` but has **zero frontend callers** | S | P3 |
| 68 | Multiple gateways beyond Razorpay | 🟡 | ✅ | Stripe end-to-end + per-gym key config UI. Member app still Razorpay-only | — | done |
| 69 | Open API / webhooks / Zapier | 🔴 | 🟡 | Webhooks **now fire** `c5c42b7` via `dispatchEvent` — but only **5 of 17** mapped events actually emit; `dispatch()` is now dead code; `testIntegration()` still always returns ok; **`ApiKeyGuard` guards zero controllers** | M | P1 |
| 70 | Door/turnstile access control | 🟡 | 🟡 | Policy now evaluated on the iclock path, but denial is **log-only** — no door command channel, so the turnstile already opened | L | P3 |
| 71 | Offline mode with sync | ✅ | 🟡 | **Downgraded.** Member app is genuinely excellent. **Admin side loses data on reconnect** (see Critical); kiosk has no queue at all | S | **P0** |
| 72 | POS / supplement inventory | ✅ | ✅ | Real sales, batches, bundles, thermal receipts — **still a win** | — | market it |
| 73 | Hindi + regional i18n | ❌ | ❌ | Zero matches for any i18n lib across all 5 `package.json`; no locale dirs; 100% hardcoded English | XL | P2 |
| 74 | Website builder / wearables / video library | ❌/✅/❌ | ❌/🟡/🔴 | Wearables pipeline complete but self-flagged **UNVERIFIED — needs on-device QA**. Video library: `video_url` = **0 hits repo-wide**; catalog carries no media | XL | P3 |
| 75 | Free tier / transparent pricing | 🟡 | 🟡 | Prices **now match** `58d2d5c` and Free tier shows. Sync is **comment-enforced only** — no public pricing API, so the next change silently desyncs (DEBT #5) | S | P1 |

---

## What shipped (38 commits, 2026-08-03 → 04)

| Milestone | Delivered |
|---|---|
| **M0** — stop the bleeding | analytics RBAC registration · revenue-aggregation correctness · assign-membership 404 · staff-analytics route · roles-API manager 403 · outbound webhook dispatch · push actually sends · refunds screen · invoice tax/discount/collect/cancel · 8-tab reports mounted · landing at `/` + pricing sync · membership stat cards · occupancy event |
| **M1** — Indian-market parity | member QR ID + visit history · automatic receipts · class-reminder + scheduled-campaign crons · payment links · in-app plan upgrade · Stripe checkout UI · exercise CRUD + 51-item catalog |
| **M2** — growth | payroll + shift screens · PT session logging · lead conversion/dedupe/assignee history · custom roles assignable · data-grounded AI advisor |
| **M3** — final sweep | gateway refunds (real money) · turnstile through the policy engine · revenue forecasting |
| **Correctness** | IST streak bug (`computeStreakDays`) · month-label off-by-one · report jobs fail closed without a gym · check-in core bound to the tenant client · **backend suite 190 failures → 0** (528 passing) |

**Constraint honoured throughout:** zero schema changes, zero new npm dependencies.
`git diff dea6034..HEAD -- prisma/` is empty and `tenant-models.ts` is unchanged — **no new tenant-model drift.**

---

## Original bug list — status

| # | Bug | Status |
|---|---|---|
| 1 | `analytics` module never registered | ✅ **FIXED** `rbac-seed.service.ts:17` |
| 2 | Aggregation filters `status:'completed'` | ✅ **FIXED** `:68-70,187-188` (remaining `'completed'` filters are on PosSale/ClassSession, where correct) |
| 3 | Assign-membership 404 | ✅ **FIXED** `features/memberships/api.ts:50,54` |
| 4 | Outbound webhooks never dispatch | 🟡 **PARTIAL** — `dispatchEvent` live, but only 5 of 17 events emit; `dispatch()` now dead code |
| 5 | `/push-notifications` lies about sending | ✅ **FIXED** `automation.service.ts:461,476` |
| 6 | Staff analytics wrong route | ✅ **FIXED** `staff/analytics/page.tsx:34` |
| 7 | PT rate hardcoded ₹500 | ❌ **OPEN** `trainer.service.ts:247` |
| 8 | Custom roles unassignable | ✅ **FIXED** `staff-invite.service.ts:56-63` |
| 9 | `@Roles('manager')` on roles API | ✅ **FIXED** `roles.controller.ts:21,27,33` |
| 10 | Manual invoices ₹0 GST | ✅ **FIXED** `invoices/new/page.tsx:117` |
| 11 | Kiosk PIN in localStorage | ❌ **OPEN** (hardened w/ salt + lockout; still client-side) |
| 12 | iclock bypasses policy engine | ✅ **FIXED** `iclock.service.ts:144-151` |
| 13 | `OCCUPANCY_UPDATED` never emitted | ✅ **FIXED** `check-in.orchestrator.ts:732` |
| 14 | Invoice-template picker localStorage-only | ❌ **OPEN** — success toast is a lie; no persist route, no column |
| 15 | Dead layers, zero consumers | 🟡 **MOSTLY FIXED** — 8 tabs + payroll/shifts/PT/refunds now mounted. Residual: `useMonthlyReport`, 6 member-app hooks |

---

## NEW defects found during re-verification

Severity is mine; none of these are fixed except NEW-6.

| # | Sev | Defect | Location |
|---|---|---|---|
| **NEW-0** | 🔴 **CRITICAL** | **Offline check-ins destroyed on reconnect** (see top of doc) | `check-in/page.tsx:140-143` |
| NEW-1 | 🔥 High | Gateway "collect payment" **drops `invoice_id`** (DTO accepts it) → invoice stays `pending` forever; also no branch fallback and `plan_id` is required, so the flow likely 400s | `finance/payments/new/page.tsx:166-192` |
| NEW-2 | 🔥 High | Offline replay has **no idempotency key** → double-sync creates duplicate check-ins; `onSuccess` clears all rows, discarding partial failures | `features/checkins/types.ts:26-34` |
| NEW-5 | 🔥 High | **Campaign sender ignores consent entirely** — `ConsentLog` exists, is never read. Bulk WhatsApp/SMS to members who revoked consent | `campaign-sender.service.ts` |
| NEW-7 | 🔥 High | **Occupancy never decrements on check-out** — count uses a 4h window with no `check_out_at` filter, while "who's inside" *does* filter it. The two disagree; kiosk Check Out has no effect | `check-in.orchestrator.ts:718-724`, `occupancy.service.ts:65-69` |
| NEW-8 | 🔥 High | `class_reminder` **missing from the frontend trigger union** → the shipped cron is unreachable from the UI and renders as "not wired to an executor yet" | `features/automations/types.ts:4-10,91-125` |
| NEW-9 | 🔥 High | **2 of 5 seeded starter workflows are dead** — `member_registered` / `member_renewed` seeded `active` with no emitter. Owners believe welcome messages are going out | `automation.service.ts:190-206` |
| NEW-6 | ✅ Fixed | `trainerAnalytics` upsert passed `branch_id ?? ''` into a nullable-uuid compound key — same trap fixed elsewhere in the file. **Fixed this session** | `metrics-aggregation.job.ts:657` |
| NEW-3 | Med | Partial-payment prefill uses `total_amount`, not remaining balance → second collection defaults to the full amount | `finance/payments/new/page.tsx:98` |
| NEW-10 | Med | Lead-source dropdown omits `phone`/`whatsapp`/`other` that the DTO now accepts — commit `7761ac8` is unreachable | `marketing/leads/page.tsx:53-60` |
| NEW-11 | Med | **72 phantom `@Roles` sites** across 19 controllers (`'manager'` ×58, `'admin'` ×18, `'staff'` ×1). No alias expansion in `RolesGuard` → real `branch_manager`s are owner-gated. **Quantifies DEBT #3** | 19 controllers |
| NEW-12 | Med | `getSettings` 404s when the settings row is missing (`findUnique` + throw) while `updateSettings` upserts | `branches.service.ts:250-254` |
| NEW-13 | Med | `memberBehaviorAnalytics.create` runs nightly per member with no upsert → unbounded growth (members × days) | `metrics-aggregation.job.ts:570` |
| NEW-14 | Med | `campaignAnalyticsRecord.create` weekly with no dedupe key → duplicate rows forever | `:726` |
| NEW-15 | Med | `backfillDay` sources PT revenue from `created_at`, not session date — **the deploy doc's "historically accurate" claim is wrong for PT** | `:199-206,281` |
| NEW-16 | Med | Daily `total_revenue` sums only `Payment`; `revenueAnalytics` adds POS on top → the two tables disagree for any POS gym | `:64-73` vs `:208` |
| NEW-17 | Med | Currency **code** rendered as a symbol prefix → a USD studio shows `USD1999/month` | `settings.service.ts:300` |
| NEW-18 | Med | Revenue forecast **fails open on branch scope** — empty `branch_ids` ⇒ all branches (tenant isolation still holds) | `revenue-forecast.service.ts:59-63` |
| NEW-19 | Med | `ApiKeyGuard` is applied to **zero controllers**, yet API keys can be minted — issued keys authenticate nothing | `api-key.guard.ts:17` |
| NEW-20 | Med | `cancelSession` hard-`deleteMany`s the waitlist with no record and no notification | `scheduling.service.ts:280,285` |
| NEW-21 | Med | Exercise starter catalog **not seeded on tenant creation** → fresh gym has an empty plan builder until someone clicks the button | `prisma/seed.ts` |
| NEW-22 | Low | Duplicate check runs only on the lead **detail** page — the create form can still produce the duplicate it was built to prevent | `marketing/leads/page.tsx` |
| NEW-23 | Low | 11 dead entries in `WEBHOOK_EVENT_MAP`; `CHECK_IN_COMPLETED` written to the event store but never inline-projected | `event-projector.service.ts:13-31` |
| NEW-24 | Low | Two orphaned backend surfaces with no caller: `GET /dashboard/revenue-forecast` and the entire `/api/v1/compliance/*` consent API | — |

---

## Phase 3 — What actually remains

Everything buildable **without a schema change or a new dependency is done.** What's left splits three ways.

### A. Not blocked — should be next (no schema, no deps)

| Item | Why it matters | Effort |
|---|---|---|
| **NEW-0 + NEW-2** offline check-in data loss | Losing real check-ins; contradicts a marketed win | S |
| **NEW-1 + NEW-3** gateway invoice collection | Card-collected invoices never close | S |
| **NEW-7** occupancy vs check-out | Two surfaces show contradicting numbers | S |
| **NEW-8 + NEW-9** dormant/dead automations | Shipped features silently not running | S |
| **NEW-5** campaign consent gate | Compliance exposure on bulk messaging | M |
| **#6** member CSV import | **P0** — gyms cannot switch to us | M |
| **#27** PT rate from config | Every commission figure is wrong today | S |
| **NEW-11** phantom `@Roles` sweep | ~72 sites; managers silently owner-gated | M |
| **#67/#53/#48** wire orphaned backends (forecast tile, monthly report, lifecycle) | Built and paid for, not visible | S |
| **#20/#23** class-stack unification | Admin sessions invisible to members | L |

### B. Hard-gated — needs your explicit approval (CLAUDE.md)

| Gate | Items |
|---|---|
| **#1 Schema/migration** | PT packages (#25) · CRM follow-ups (#33) · waiver e-sign (#65) · notification inbox (#61) · WhatsApp templates (#36) · campaign opt-out (#38) · auto-charge mandates (#11) · per-branch branding (#44) — all specced in `SCHEMA_MIGRATION_PLANS.md` |
| **#2 Auth/identity** | Kiosk PIN → server-verified `pin_hash` (#15) |
| **#3 New dependency** | Hindi/regional i18n (#73) |
| **#6 Deleting code** | `frontend/src/app/[gymSlug]/marketing/automation/page.tsx` (457 lines) — unlinked since QW-C2, still present |

### C. External / not code

- **Deploy-day scripts, written but never run:** `resync-role-permissions.ts` (existing gyms stay 403'd on analytics without it) and `backfill-analytics.ts` (note NEW-15 before trusting PT figures).
- `QR_SIGNING_SECRET` unset → tokens die on restart. Razorpay test keys return 401.
- Meta WABA template approval · Razorpay Subscriptions KYC · App Store/Play credentials (EAS project not even linked).
- On-device QA: wearables (`provider.native.ts` self-flags UNVERIFIED), member-app screens, iclock hardware.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Nothing shipped in M0–M3 is runtime-verified** beyond the E2E check-in loop | Typecheck + 528 unit tests pass, but no dev server exercised most endpoints | Manual pass on: Stripe mount, QR data-URI, gateway refunds (need live keys), the 3 new crons |
| **Class reminders send real WhatsApp messages** once a gym activates the workflow | Member-visible mistakes are expensive | Verify template copy before seeding defaults for a live gym |
| **Analytics restatement** after backfill | Historical numbers change | Dashboard has a restatements surface; note NEW-15's PT caveat |
| **Webhooks now fire outward** | Payload over-share to customer URLs | Review each of the 5 live event payloads against `StripSecretsInterceptor` |
| **Per-gym-schemas branch still in flight** (~128 uncommitted files) | Schema work sequenced behind it | Land that branch before any migration; every new tenant model MUST enter `tenant-models.ts` |

---

## Features WE have that MyGymDesk does NOT (protect & market)

Unchanged from the original audit and all re-confirmed: public gym-less fitness identity · member AI coach (now data-grounded) · face-recognition check-in + hybrid signed QR · 8-rule access-policy engine with rule traces · wearables/health platform · community layer · trainer↔member chat + WhatsApp shared inbox · enterprise referral engine · expense intelligence · full inventory/POS · **offline-first member app** (admin side needs NEW-0 fixed first) · Indian food catalog nutrition · corporate/family memberships · DPDP/GDPR module · dashboard KPI provenance inspector.
