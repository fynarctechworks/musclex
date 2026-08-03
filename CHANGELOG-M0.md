# Milestone 0 — "Stop the bleeding" changelog

Tracking doc for the M0 bug-fix pass (source: `GAP_ANALYSIS_AND_ROADMAP.md`).
One item per slice; each lands only after review approval.

## ⚠️ Deploy-day steps (run after deploying this milestone)

1. **RBAC resync** (Fix 1): `cd backend && npm run build && npx ts-node scripts/resync-role-permissions.ts`
2. **Analytics backfill** (Fix 2): `cd backend && npm run build && npx ts-node scripts/backfill-analytics.ts --from <YYYY-MM-DD> --to <YYYY-MM-DD>` (defaults to last 90 days). Run AFTER deploying the fixed job. Point-in-time fields (active counts) reflect run-time state; period-scoped numbers (revenue, visits, signups) are historically accurate.

## Fix 1 — `analytics` permission module registered (APPROVED 2026-08-03)

**Bug:** All 12 routes in `dashboard-analytics.controller.ts` require `analytics.view`, but `analytics` was never in `MODULES_ACTIONS` (`auth/rbac-seed.service.ts`), so the permission was never seeded and no role granted it. Every non-owner role (branch_manager, regional_manager, trainer, accountant, marketing_manager) got 403 on all analytics endpoints; only the owner-tier admin bypass worked.

**Change:**
- `backend/src/auth/rbac-seed.service.ts`
  - Added `analytics: ['view', 'export']` to `MODULES_ACTIONS`.
  - Granted `analytics.view` + `analytics.export` to `regional_manager`, `branch_manager`, `accountant`.
  - Granted `analytics.view` to `marketing_manager`.
  - **Trainer deliberately excluded** (reviewer decision): `/api/v1/analytics/*` has no per-role data scoping, so `analytics.view` would expose gym-wide revenue to trainers. Trainers keep their scoped `/dashboard/trainer-cockpit` surface. See DEBT.md #2.
  - Verified guard/seeder key formats match exactly: both build `module.action` dot codes (`permissions.guard.ts:52` vs `rbac-seed.service.ts:37`).
  - `front_desk` intentionally unchanged (no analytics need); owner-tier roles already receive `ALL_PERMISSIONS`.
- `backend/scripts/resync-role-permissions.ts` (new, **not yet run**)
  - Existing studios don't self-heal: `seedStudioRoles()` only runs at onboarding, and `resolvePermissions()` falls back to `ENTERPRISE_ROLES` only when a role has zero `RolePermission` rows. The script boots the Nest app context and runs `seedPermissions()` + `forEachTenant(seedStudioRoles)` — additive/idempotent.
  - Run after deploy: `cd backend && npm run build && npx ts-node scripts/resync-role-permissions.ts`

**Tests:**
- `backend` `tsc --noEmit` — PASS (exit 0).
- `npx jest test/auth/auth.service.spec.ts` — 8/8 FAIL, **pre-existing**: the suite dies at DI compile with "Nest can't resolve dependencies of the AuthService … PublicPrismaService at index [2]" — the spec's provider list is stale vs the uncommitted per-gym-schemas changes to `auth.service.ts`. Not caused by this fix (constants-only edit, no DI surface). No spec covers `rbac-seed.service.ts` itself.
- `resync-role-permissions.ts` written but **not run** (touches prod DB; run post-deploy).

## Fix 2 — revenue/metrics aggregation job corrected (PENDING APPROVAL)

**Bug (3 defects):** `backend/src/analytics/jobs/metrics-aggregation.job.ts`
1. Filtered `Payment.status: 'completed'` — a value never written anywhere (real values: `pending|paid|refunded`) → `DailyGymMetrics.total_revenue`, `RevenueAnalytics.membership`, `RevenueAnalytics.personal_training` were permanently 0.
2. "PT revenue" summed ALL payments (superset of membership) → double-count; "membership" was filtered by payment METHOD (`card/upi/cash`), a category-by-method mixup.
3. Upserts passed `organization_id: '' `/`plan_id: ''` into nullable `@db.Uuid` compound-unique keys — `''` is invalid uuid input, and Postgres unique treats NULLs as distinct so those upserts could never match NULL-org rows anyway.

**Change:**
- `status: 'paid'` at the 2 payment aggregation sites (daily metrics + membership revenue).
- Membership revenue now = paid payments with `membership_id: { not: null }` (method filter removed).
- PT revenue now sourced from `TrainerRevenue` (branch-scoped, written on session completion) — no overlap with membership. NOTE: TrainerRevenue amounts still derive from the hardcoded ₹500 session rate (separate bug, Milestone 2).
- All 3 upserts replaced with `findFirst` (matching real NULLs) + `update`/`create`; single-writer safe under the existing cron locks.
- New public `backfillDay(day)` on the job + `backend/scripts/backfill-analytics.ts` (**written, NOT run**) — see deploy-day steps.
- POS (`PosSale.status='completed'`) untouched — that default is genuinely `'completed'`.

**Tests:**
- `backend` `tsc --noEmit` — PASS.
- `npx jest test/safety-net/metrics-aggregation-tenant-isolation.spec.ts` — **8/8 PASS** (validates every aggregation body runs under per-tenant scope, including the rewritten findFirst/update/create paths).
- Backfill script not run (touches prod data; run post-deploy).

## Fix 3 — assign-membership 404 (COMMITTED)

**Bug:** `frontend/src/features/memberships/api.ts` called `POST/GET /members/:id/memberships` — routes that don't exist. 404'd `AssignMembershipDialog` (members list + member detail), `useMemberMemberships` consumers (`AccessNetworkCard`, `MemberAccessTab`).

**Change:** `assign` → `POST /memberships/assign/:memberId`, `listByMember` → `GET /memberships/member/:memberId` (real routes in `memberships.controller.ts`). DTO shapes verified identical (plan_id, branch_id, start_date?, auto_renew?, payment_method?).

**Tests:** frontend `tsc --noEmit` PASS. Runtime assign flow needs a manual click-through (no frontend test suite covers it).

## Fix 4 — staff analytics page called a nonexistent route (COMMITTED)

**Bug:** `staff/analytics/page.tsx` queried `GET /analytics/trainer-performance` (no such route) with a fictional shape (`avg_occupancy`, `performance_score`) → page always rendered "No trainer data available".

**Change:** Page now consumes the real `GET /analytics/trainers/leaderboard` (TrainerAnalytics rows: sessions_conducted, members_trained, no_show_rate, revenue_generated + trainer.full_name); chart plots sessions-by-trainer. Permission gate changed from `staff.view` to `analytics.view` — the leaderboard exposes per-trainer revenue, and trainers were deliberately excluded from analytics in Fix 1.

**Tests:** frontend `tsc --noEmit` PASS. Rendering with real rows needs manual check after the Fix-2 backfill populates TrainerAnalytics.

## Fix 5 — roles API 403'd real managers (COMMITTED)

**Bug:** `roles.controller.ts` read routes required `@Roles('owner', 'manager')` — `'manager'` is not a seeded role (real: `branch_manager`, `regional_manager`), so actual managers got 403 on `GET /api/v1/roles*` despite `DEFAULT_ROLE_PERMISSIONS.branch_manager.roles = ['view']`.

**Change:** The three GET routes now accept `'owner', 'branch_manager', 'regional_manager'`. Write routes stay owner-only. **Found during fix:** the same phantom-role pattern (`'manager'`/`'admin'`/`'staff'`) exists at ~60 more decorator sites across 15 controllers — NOT fixed here (per-controller role mapping is a product decision); logged as DEBT.md #3.

**Tests:** backend `tsc --noEmit` PASS. No spec covers RolesController.

## Fix 6 — outbound webhooks now actually fire (COMMITTED)

**Bug:** `WebhooksService` advertised 21 events (CRUD, HMAC signing, SSRF guard, delivery log, retry) but `dispatch()` had ZERO callers — no business event ever reached a customer webhook.

**Change:**
- `platform/services/webhooks.service.ts`: new `dispatchEvent(event, payload, branchId?)` — resolves the owning organization from the branch when known (branch-less events go to all of the gym's active subscribed webhooks; tenant client scopes the query).
- `events/event-projector.service.ts`: the domain-event funnel now maps `DomainEventType` → public catalog names (`WEBHOOK_EVENT_MAP`: member.created/updated, member.plan_assigned/expired, payment.received/refunded, checkin.completed, class.booked/cancelled, staff.created/updated) and fire-and-forgets `dispatchEvent` for fresh events. Dispatch happens BEFORE the no-metrics-delta early return (so class.booked etc. still fire) and never blocks/fails metrics projection.
- Replay protection: `replay()` → `catchup(skipWebhooks=true)` — rebuilding metrics does NOT re-deliver historical events to customer endpoints; normal catchup (missed events) still dispatches.
- `events.module.ts` imports `PlatformModule` (exports WebhooksService; no cycle).

**Not covered (unchanged from audit):** lead.created / lead.converted / invoice.created / campaign.* have no domain-event emitters yet — they'll wire in when those flows emit to the outbox.

**Tests:** backend `tsc --noEmit` PASS; `test/members/members.service.spec.ts` (only suite touching the projector) 12/12 PASS. No dedicated webhook spec exists; end-to-end delivery needs a real subscribed URL to verify.

## Fix 7 — admin push endpoint actually sends (COMMITTED)

**Bug:** `POST /api/v1/push-notifications` → `AutomationService.sendPushNotification` created a `PushNotification` row with `status:'sent'`, `sent_at:now` **without ever calling PushService** — no device was notified; the status lied.

**Change:** `marketing/automation.service.ts` now injects the global `PushService` and calls `sendToMember(member_id, {title, body, data}, {category:'promos'})` first; the DB row records the truth — `sent` + `sent_at` only when Expo accepted ≥1 device token, else `failed` (PushNotification.status already documents `failed` as a valid value).

**Tests:** backend `tsc --noEmit` PASS. No spec covers AutomationService; real delivery needs a device with a registered Expo token.

## Fix 8 — refunds screen (COMMITTED)

**Bug:** Refund backend (`/api/v1/refunds` — over-refund validation, ledger reversal, cascade to invoice status) and frontend hooks (`useRefunds`/`useProcessRefund`) were complete but no page imported them — refunds were unreachable from the product.

**Change:**
- New `frontend/src/app/[gymSlug]/finance/refunds/page.tsx` — refunds list (receipt, member, refunded vs original amount, reason, processed-by, status, date; status filter chips) + "Process Refund" dialog (paid-payment picker from `/payments?status=paid`, amount with max hint, optional reason) wired to the existing idempotent `POST /refunds`.
- Finance hub now links "View Refunds →" beside "View Expenses →".
- Reuses existing hooks/permissions (`payments.view` to see, backend enforces `payments.create` to process).

**Still true (unchanged):** refunds remain ledger-only — no Razorpay/Stripe gateway refund call (`gateway_refund_id` never populated). That's a Milestone-1+ item, not UI.

**Tests:** frontend `tsc --noEmit` PASS. Flow needs manual click-through (no frontend test suite).

## Fix 9 — invoice UI: tax/discount, collect payment, cancel (COMMITTED)

**Bugs (3):**
1. Manual invoices computed ₹0 GST — the create form never sent `tax_rate_id`/`discount_code` despite the DTO accepting both.
2. Invoice↔payment reconciliation was unreachable: the payment form never sent `invoice_id`, so `recalculateInvoiceStatus` (paid/partial) never ran from the UI, and invoice rows had no "collect" action.
3. `cancelInvoice()` (reversing ledger entry, revenue exclusion) had no UI caller; the generic status-PATCH could set `cancelled` while bypassing the ledger.

**Change:**
- `payments/invoices/new/page.tsx`: new "Tax & Discount" card — tax-rate select (from `GET /tax-rates`, live GST preview on subtotal, empty-state pointing at Settings → Tax & Invoice) + discount-code input with `datalist` of active codes; both now sent on create (server validates/applies).
- `payments/invoices/page.tsx`: row actions gain **Collect payment** (pending/partial only → `/finance/payments/new?invoice_id=…`) and **Cancel** (non-paid/cancelled/refunded only, confirm dialog, calls the ledger-correct `POST /invoices/:id/cancel`).
- `finance/payments/new/page.tsx`: reads `?invoice_id`, fetches the invoice, prefills member + outstanding amount, shows a "collecting against invoice N" banner, and passes `invoice_id` to `/payments/cash` (branch falls back to the invoice's branch). Partial amounts are supported — backend sets `partial`.
- Footgun closed on BOTH sides: `useUpdateInvoiceStatus` and backend `UpdateInvoiceStatusDto` no longer accept `'cancelled'` — cancellation must go through the ledger-writing endpoint.
- New hooks `useCancelInvoice`, `useTaxRates` (+ exports).

**Tests:** frontend + backend `tsc --noEmit` PASS. `jest test/payments src/payments` = 20 failed/27 passed — **verified pre-existing**: re-ran with my DTO change stashed and got the identical 20/27 (stale specs constructing `PaymentsService` with 3 of 6 args, from the in-flight per-gym-schemas refactor). Logged as DEBT #4.

## Fix 10 — gym-wide Reports section mounted (COMMITTED)

**Bug:** `features/reports/components/` contained a complete 8-tab gym analytics UI (Overview, Revenue, Members, Attendance, Trainers, Subscriptions, Marketing, Branches) imported by **no page**; `/reports` was a Store/POS report reachable only inside the Store workspace, and the whole `/api/v1/analytics/*` + `/reports/*` surface had no gym-level UI.

**Change:**
- Store report moved `/reports` → `/store/reports` (page + loading.tsx via `git mv`; it was already titled "Store Reports"). Store workspace nav + mobile tabs updated, so workspace detection still works.
- New `app/[gymSlug]/reports/page.tsx` renders all 8 tabs with a shared start/end date range picker (default last 30 days) and honors `activeBranchId`. Wired to the existing hooks: dashboard, trend, revenue, memberships, churn-risk, classes, trainers, leaderboard, campaigns, branch-comparison, subscription metrics; branch names resolved from `/branches` for the Branches tab.
- Gated on `analytics.view` (matches the backend `@Permissions({ module: 'analytics' })`), so it depends on Fix 1 + the deploy-day resync.
- "Reports" added to the gym Tools nav; `features/reports/index.ts` now re-exports `./components`.

**Tests:** frontend `tsc --noEmit` PASS. Tabs render real numbers only after the Fix-2 backfill runs (analytics tables were zeroed by the `'completed'` bug).

## Fix 11 — landing page reachable + pricing synced (COMMITTED)

**Bug:** `app/page.tsx` was `redirect('/login')` and `app/landing/` has **no `page.tsx`** — so the entire marketing site (Hero/Features/HowItWorks/Pricing/Testimonials/CTA/Footer) was unreachable at any URL, not merely orphaned. Its pricing was also hardcoded and stale: Pro shown as ₹1,999 (real ₹2,499), Enterprise "Custom" (real ₹4,999), and the Free tier missing entirely.

**Change:**
- `app/page.tsx` now renders `<LandingPage />` at `/` (already allowlisted in middleware; Navbar/CTA already link to `/login` + `/onboarding`).
- `Pricing.tsx` rewritten against `backend/src/common/plan-configs.ts`: 4 cards (Free ₹0 / Starter ₹999 / Pro ₹2,499 — marked Most Popular / Enterprise ₹4,999) with real member/branch/staff limits and per-tier feature flags; grid widened to 4 columns; a comment names PLAN_CONFIGS as the source of truth.
- Values are still hand-synced (no public pricing API) — logged as DEBT #5.

**Tests:** frontend `tsc --noEmit` PASS. Visual check of the landing page is manual (no test suite; `next build` deliberately not run — it would poison the dev `.next/` cache per CLAUDE.md).

## Quick wins (COMMITTED)

**QW-A — membership status cards.** `GET /memberships/stats/summary` had no frontend caller. Added `membershipStatsApi` + `useMembershipStats` and four KPI cards (Active / Expiring in 7 days / Frozen / Auto-renew on) to `/memberships/plans`, respecting the page's branch filter.

**QW-C1 — stale member-app copy.** `gym-member-app/app/(app)/workout.tsx` still said "Trainer-assigned plans arrive in a later update" — they've shipped. Now points members at the Plan tab.

**QW-C2 — duplicate automation pages.** `/marketing/automation` (older, raw `workflowsApi`) and `/marketing/automations` (canonical: `features/automations`, LIVE_TRIGGERS, templates tab, sidebar nav) both existed and were linked from different places. Repointed the 3 marketing-hub sub-nav links to the canonical route. **Did NOT delete** the old page (CLAUDE.md HARD STOP #6) — it is now unlinked; see "Awaiting approval" below.

**QW-D — occupancy.** `OCCUPANCY_UPDATED` was declared in `check-in.events.ts` and listened for by `CheckInsGateway` but **never emitted** — the WS occupancy channel was dead. The orchestrator now emits it after a successful check-in (same 4h auto-checkout heuristic as `OccupancyService`, so both agree), fire-and-forget so it can't fail a check-in. Also `CapacityWidget` was hardcoded `max={0}`; the check-in page now reads real capacity from `/dashboard/ops/occupancy` (`BranchSettings.checkin_policy.max_occupancy`), and the widget keeps its honest "set capacity" CTA when unset.

**Tests:** backend + frontend + member-app `tsc --noEmit` all PASS; `jest test/check-ins src/check-ins` **28/28 PASS**.

---

## Skipped — needs your decision

**QW-B — kiosk exit PIN validated against `CheckInDevice.pin_hash`.** Listed as a quick win in the roadmap, but it isn't one. The web kiosk (`/kiosk/[branchSlug]`) authenticates with the **staff JWT** and has no `CheckInDevice` binding at all — `pin_hash` is only ever written as a `pending:<random>` sentinel at device registration (`devices.service.ts:83`) and the column is explicitly documented as "not used by device-token auth". Doing this properly needs: (1) a browser↔device registration/pairing step for the web kiosk, (2) a new PIN set/verify endpoint, (3) a rewrite of `KioskPinLock`. That is a real slice and it lands in **HARD STOP #2 territory (auth/identity)**, so it needs explicit sign-off. Current behaviour is unchanged: SHA-256 of `branch-salt:pin` in `localStorage`, so a wiped browser profile resets the PIN.

**Exercise library seed data.** The roadmap listed "exercise seed" as a quick win. There is genuinely **no exercise seed anywhere** (no `INSERT`, no `createMany`, no `DEFAULT_EXERCISES`) and no admin CRUD (`exercises.controller.ts` is `@Get()`-only) — so a fresh tenant's workout builder has an empty picker. Seeding is a **data migration** plus new write endpoints; both are outside "no schema changes, no new deps". Deferred to Milestone 1 as scoped in the roadmap.

## Awaiting approval — code I did not delete (CLAUDE.md HARD STOP #6)

- `frontend/src/app/[gymSlug]/marketing/automation/page.tsx` (457 lines) — the older duplicate automations page. As of QW-C2 **nothing links to it**; the canonical page is `/marketing/automations` (uses `features/automations`, `LIVE_TRIGGERS`, templates tab, and is the sidebar entry). Safe to delete on your word; left in place for now.

## Not addressed in M0 (roadmap says later, unchanged)

- Refunds are still **ledger-only** — no Razorpay/Stripe gateway refund call (`gateway_refund_id` stays null).
- PT session rate is still hardcoded `₹500` (`staff/trainer.service.ts:247`), so `TrainerRevenue` — and therefore the new PT revenue category from Fix 2 — is internally consistent but not correctly priced. Milestone 2.
- Webhook events `lead.created` / `lead.converted` / `invoice.created` / `campaign.*` still don't fire: they have no domain-event emitter to hook into (Fix 6 covers member/staff/membership/payment/checkin/class).
