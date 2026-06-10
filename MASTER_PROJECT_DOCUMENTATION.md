# MuscleX (MuscleX) — Master Project Documentation

> **Single source of truth** for the MuscleX monorepo. This document consolidates
> the architecture, module inventory, API surface, data model, setup, and a full
> production-readiness audit (frontend, backend, wiring, gaps, tech debt).
>
> **Generated:** 2026-06-04 · **Method:** direct code inspection (counts, controllers,
> package manifests, env, Prisma schema verified against source). Anything not directly
> verified is marked **(inferred)** or **(unverified)**. Where this doc and older docs
> disagree, **this doc wins** and the older doc is slated for removal/merge (see §13).

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Module Inventory](#4-module-inventory)
5. [Key User Flows](#5-key-user-flows)
6. [API Surface](#6-api-surface)
7. [Database Documentation](#7-database-documentation)
8. [Environment & Setup](#8-environment--setup)
9. [Frontend Audit](#9-frontend-audit)
10. [Backend Audit](#10-backend-audit)
11. [Frontend ↔ Backend Wiring Matrix](#11-frontend--backend-wiring-matrix)
12. [Missing Features & Gap Analysis](#12-missing-features--gap-analysis)
13. [Documentation Cleanup Plan](#13-documentation-cleanup-plan)
14. [Technical Debt Report](#14-technical-debt-report)
15. [Executive Summary](#15-executive-summary)

---

## 1. Project Overview

**MuscleX** is a **production, multi-tenant gym-management SaaS**. Real, paying gyms
("studios") use it; real money and member PII flow through it. Each gym is a tenant and
its data **must** stay isolated — a cross-tenant leak is the worst-case failure mode.

- **Business purpose:** run the full operational stack of a gym chain — memberships,
  check-ins (manual / QR / facial), class scheduling, payments & invoicing, inventory/POS,
  staff & payroll, marketing & CRM, referrals, analytics dashboards, and a member-facing
  mobile super-app.
- **Target users:**
  - **Gym owners / brand owners** — multi-branch oversight, finance, strategy.
  - **Branch managers / front-desk / trainers** — day-to-day operations (branch-scoped).
  - **Members** — mobile app (workouts, nutrition, check-in, trainer chat, community, health).
  - **Platform super-admins** — internal SaaS Control Center (billing, tenants, monitoring).
- **Main goal:** be the #1 gym-attached operations + member-engagement platform; the
  strategic flywheel is the **verified check-in** feeding retention/analytics
  (see [docs/competitive-strategy-2026-06/](docs/competitive-strategy-2026-06/)).

### The four apps (one monorepo, one shared Supabase Postgres)

| Path | App | Stack | Users |
|---|---|---|---|
| [backend/](backend/) | Core gym API + Member BFF | NestJS 10 + Prisma 5 (multiSchema) | service layer for all UIs |
| [frontend/](frontend/) | Gym admin / operations web app | Next.js 14 (App Router) + Supabase | gym staff |
| [gym-member-app/](gym-member-app/) | Member mobile super-app | Expo / React Native (expo-router) | members |
| [saas-control-center/](saas-control-center/) | Internal super-admin (SCC) | NestJS + Next.js | platform admins |

---

## 2. System Architecture

```
                         ┌──────────────────────────────────────────┐
                         │              Supabase Postgres             │
                         │   public schema  +  studio_template schema │
                         │   +  scc schema (control center)           │
                         └──────────────────────────────────────────┘
                                  ▲             ▲            ▲
                          Prisma  │      Prisma │     Prisma │ (hand-SQL)
                                  │             │            │
   ┌─────────────┐        ┌───────────────┐         ┌────────────────────┐
   │  frontend/  │  REST  │   backend/    │         │ saas-control-center│
   │ Next.js 14  │───────▶│  NestJS API   │         │  NestJS + Next.js  │
   │ (gym admin) │  WS    │  /api/v1/*    │         │  (platform admin)  │
   └─────────────┘◀──────▶│  + Member BFF │         └────────────────────┘
                          └───────────────┘
   ┌─────────────┐  REST        ▲   │
   │gym-member-  │──────────────┘   ├──▶ Supabase (auth verify, storage)
   │   app/      │  (member JWT)    ├──▶ Redis / Upstash (throttler, 2FA, BullMQ)
   │ Expo RN     │                  ├──▶ Meilisearch (search)
   └─────────────┘                  ├──▶ Resend (email), Twilio (SMS), Meta WhatsApp
                                    └──▶ Anthropic (AI module)
```

### 2.1 Backend architecture
- **NestJS 10** (Express adapter), API prefix **`/api/v1`**, 31 feature modules.
- **Prisma 5.22** with `multiSchema` preview feature. Two schemas in `schema.prisma`:
  `public` and `studio_template`. **172 models, 0 Prisma enums** (status fields are
  plain strings).
- **Tenant context** carried via `AsyncLocalStorage` (`tenantContext`), populated by
  `TenantMiddleware` from the JWT + `x-active-branch` header.
- **Cross-cutting** (registered in [backend/src/app.module.ts](backend/src/app.module.ts)):
  global throttler (Redis-backed), `SubscriptionLockGuard`, `ActiveBranchInterceptor`,
  `StripSecretsInterceptor`, `CorrelationIdMiddleware`, `TenantMiddleware`, Pino logging,
  Sentry, BullMQ queues, 3 WebSocket gateways (check-ins, dashboard, subscription).
- **Member BFF** ([backend/src/member/](backend/src/member/)) — a separate API surface for
  the mobile app with its **own JWT** (`MEMBER_JWT_SECRET`), member auth (phone+OTP), and
  10 data controllers (core, workout, nutrition, exercise, chat, community, health,
  notification, check-in, class).

### 2.2 Frontend architecture (gym admin)
- **Next.js 14 App Router.** ~98 `page.tsx` routes; **almost all are Client Components**
  (`"use client"`). Tenant routes live under `app/[gymSlug]/...`.
- **Server state:** TanStack React Query (single client; tuned: `staleTime` 3 min, no
  refetch on mount/focus). **Client state:** Zustand (`auth`, `workspace`, `onboarding`,
  `ui` stores, persisted to localStorage). **Forms:** React Hook Form + Zod.
- **All data access goes through one REST client** ([frontend/src/services/api-client.ts](frontend/src/services/api-client.ts))
  to the NestJS backend. Supabase JS is used **only** for auth/storage in a handful of files.
- **27 feature modules** under [frontend/src/features/](frontend/src/features/) (hooks +
  components + types per domain).
- **`middleware.ts`** cookie-gates to `/login` and sets security headers.

### 2.3 Member app architecture
- **Expo / React Native** with **expo-router** (file-based). Route groups `(auth)` and
  `(app)` (5-tab IA: home, workout, classes, progress, community) plus standalone routes
  (chat, exercises, nutrition, health, body, heart, sleep, checkin, locations, membership,
  notifications, profile, settings, mindfulness, activity).
- **Cannot run in Expo Go** (native modules) — needs a dev build (expo-dev-client / EAS).
- Design system = **"Kraken"** (purple, light-first, runtime light/dark via NativeWind)
  per current memory; talks to the backend **Member BFF** over the member JWT.

### 2.4 SCC architecture
- Separate **NestJS** (`saas-control-center/src/`, modules under `modules/`) + **Next.js**
  (`saas-control-center/frontend/`) bundle. 24 admin pages (tenants, billing, subscriptions,
  plans, discounts, referrals, audit-logs, analytics, call-center, feature-flags, and an
  **Error Monitoring Center** under `monitoring/`).
- **Migrations are hand-written idempotent SQL** applied via `apply-migrations.ts` against
  the `scc` schema. **NEVER run `prisma migrate dev`** here (it would wipe the shared DB).

### 2.5 Multi-tenant isolation (read before touching data access)
Isolation is **enforced in the app layer, not the database**. Three layers:
1. **Prisma `$use` middleware** auto-injects `gym_id` into where/data for every tenant
   model. **Single source of truth = [backend/src/prisma/tenant-models.ts](backend/src/prisma/tenant-models.ts).**
   A model missing from it can leak across gyms.
2. **JWT-sourced `gym_id`** + `set_config('app.gym_id', …)` per request.
3. **RLS policies** keyed on `current_setting('app.gym_id')` — **currently decorative**:
   the backend connects as a Postgres superuser with `rolbypassrls=true`, so RLS does not
   bite yet (verified 2026-06-01). A keystone fix (non-bypass role + pooling) is in progress
   on branch `feat/member-bff-phase0` / "Phase B" (see [docs/RLS-PHASE-B-CUTOVER-RUNBOOK-2026-06-03.md](docs/RLS-PHASE-B-CUTOVER-RUNBOOK-2026-06-03.md)).
- **Raw SQL is NOT auto-scoped** — every `$queryRaw` against gym data must include an
  explicit `gym_id` filter.

---

## 3. Technology Stack

### Frontend — [frontend/](frontend/) (44 deps)
| Concern | Choice |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript 5 |
| Styling/UI | Tailwind 3.4, shadcn/ui + Radix |
| Server state | TanStack React Query 5 |
| Client state | Zustand 5 (persisted) |
| Forms | React Hook Form 7 + Zod 4 |
| Charts/biometric | Recharts 3, face-api.js, html5-qrcode, qrcode.react |
| Realtime | socket.io-client 4.8 |
| Auth/storage | Supabase JS 2 (auth + storage only) |
| Errors | Sentry (`@sentry/nextjs`) |
| Tests | Vitest (5 test files only) |
| Scripts | `dev` (turbo), `dev:webpack`, `build`, `test` |

### Backend — [backend/](backend/) (44 deps)
| Concern | Choice |
|---|---|
| Framework | NestJS 10 (Express) |
| ORM/DB | Prisma 5.22 (multiSchema) → PostgreSQL (Supabase) |
| Auth | Supabase Auth (admin), JWT (`@nestjs/jwt`, jose, passport-jwt), Speakeasy 2FA; separate Member JWT |
| Queues/cache | BullMQ 5 + ioredis (Redis / Upstash) |
| Realtime | socket.io 4.8 + `@nestjs/websockets` (3 gateways) |
| Search | Meilisearch 0.55 |
| Email/SMS | Resend, Twilio, Meta WhatsApp Cloud API |
| AI | `@anthropic-ai/sdk` |
| PDF | `@react-pdf/renderer` |
| Obs | Sentry, nestjs-pino, Helmet, Throttler |
| Payments | **Razorpay** (SDK-free, REST via `fetch`) — live + verified vs test API; Stripe removed |
| Tests | Jest (~26 specs, 30% line / 20% branch threshold) |

### Member app — [gym-member-app/](gym-member-app/) (42 deps)
Expo / React Native, expo-router, NativeWind ("Kraken" DS), expo-sensors (pedometer),
HealthKit / Health Connect bridges, PostHog HTTP sink (dep-free), Expo push.
**No tests** — verify with `gym-member-app/node_modules/.bin/tsc --noEmit`; UI behavior is on-device QA.

### SCC — [saas-control-center/](saas-control-center/) (NestJS 29 deps + Next.js 19 deps)
NestJS + Prisma (against `scc` schema, hand-SQL migrations) + Next.js admin frontend +
socket.io (error-center alerts) + Docker compose for local stack.

### Infrastructure
- **DB:** Supabase Postgres (shared). **Hosting (inferred):** backend on Railway, frontends
  on Vercel-class hosts. **CI/CD:** `.github/` present — **not audited in this pass (unverified)**.
- **Redis:** Upstash / ioredis. **Search:** Meilisearch (feature-flagged via `ENABLE_SEARCH`).

---

## 4. Module Inventory

> Status legend: ✅ Complete · 🟡 Partial · 🔴 Missing/stub · 🗑 Deprecated/dead.
> "Complete" = backend + frontend present and wired; it does **not** assert bug-free.

### Backend modules (31) — [backend/src/](backend/src/)
`ai · analytics · audit · auth · branches · check-ins · classes · common · compliance ·
dashboard · documents · events · inventory · invoices · marketing · member (BFF) · members ·
onboarding · organization · payments · platform · prisma · queue · referrals · roles ·
search · settings · staff · subscription · uploads · wallet`

Totals (verified): **86 controllers, 141 services, 172 Prisma models**.

### Domain modules

| Module | Purpose | Frontend | Backend | Status |
|---|---|---|---|---|
| **Auth & 2FA** | Login, register, password reset, TOTP 2FA, SSO, API keys, sessions | `login`, `register`, `forgot/reset-password`, `verify-2fa/email`, `auth/callback`, `features/auth` | `auth/` (5 controllers + two-factor) | ✅ |
| **Onboarding** | New-gym wizard (studio→branch→staff→plans→payment) | 11 `onboarding/*` pages | `onboarding/` (plans + internal) | ✅ (payment step now charges via Razorpay, 2026-06-04) |
| **Members & CRM** | Member records, profiles, body stats, notes, tags, at-risk/churn, family, corporate | `members/*`, `crm` | `members/` (members, family, corporate, visits, membership-access) | ✅ |
| **Memberships/Plans** | Plans, member memberships, freezes, access passes | `memberships/*` | `members/` (plans, memberships) | ✅ |
| **Check-in / Biometric / Kiosk** | Manual/QR/facial check-in, devices, kiosk, pgvector face match | `check-in/*`, `kiosk/[branchSlug]`, `biometrics` | `check-ins/` (check-ins, biometric, qr, devices) + WS gateway | ✅ |
| **Classes & Scheduling** | Templates, sessions, bookings, waitlists, roster, schedule | `classes/*`, `schedule` | `classes/` (classes, sessions, bookings, templates) | ✅ |
| **Staff & Payroll** | Staff directory, attendance, leaves, shifts, payroll, trainer analytics, biometrics | `staff/*` | `staff/` (staff, payroll, trainer, biometrics) | 🟡 (payroll depth — verify) |
| **Payments & Finance** | Payments, expenses, discounts, refunds, finance reports | `finance/*`, `payments/*` | `payments/` (payments, expenses, discounts, refunds, invoices, reports) | 🟡 **manual only — no online gateway** |
| **Invoices/Documents** | Invoice templates, receipt/invoice PDFs | `payments/invoices/*`, `settings/invoices`, `settings/tax-invoice` | `invoices/`, `documents/` | ✅ |
| **Inventory & POS** | Products, categories, stock, suppliers, transfers, bundles, POS sales | `inventory`, `pos` | `inventory/` (products, pos, suppliers, transfers, bundles) | ✅ |
| **Marketing & CRM** | Campaigns, leads, templates, automation workflows | `marketing/*` | `marketing/` (marketing, leads, automation) | 🟡 (channel delivery depends on Twilio/WhatsApp/Resend config) |
| **Referrals** | Member + B2B referral programs, anti-fraud, analytics | `referrals/*`, `admin/referrals/*`, `settings/referrals` | `referrals/` (6 controllers) | ✅ |
| **Dashboard** | KPI/pulse/briefing/cohort/occupancy/heatmap/anomaly tiles | `dashboard`, `dashboard/branches` | `dashboard/` (5 controllers + ~30 services) | ✅ |
| **Analytics/Reports** | Daily metrics, revenue/membership/attendance/trainer analytics, exports | `reports` | `analytics/` (dashboard-analytics, reports) | ✅ |
| **Subscription/Billing-lock** | Tenant lifecycle + write-lock on LOCKED/SUSPENDED | `settings/subscription/*` | `subscription/` + global `SubscriptionLockGuard` | ✅ |
| **AI** | Briefing + business-advisor chat (Anthropic) | `ai`, `ai/briefing` | `ai/` | ✅ (key-gated) |
| **Settings / Org / Branches / Roles** | Profile, account, permissions, roles, branches, regions, franchise, integrations, white-label | `settings/*`, `branches`, `admin/*` | `settings/`, `organization/`, `branches/`, `roles/`, `platform/` | ✅ |
| **Wallet / Loyalty** | Wallet balance + loyalty | `features/wallet` (no dedicated page) | `wallet/` | 🟡 (no top-level route — embedded; verify surface) |
| **Compliance / Audit / Uploads** | GDPR/DPDP data requests, audit log, file uploads | (settings/security) | `compliance/`, `audit/`, `uploads/` | 🟡 (E2E data-export flow unaudited) |
| **Search** | Meilisearch global search | (global search UI) | `search/` | 🟡 (flagged `ENABLE_SEARCH`) |
| **Member BFF (mobile)** | Member-facing API: workouts, nutrition, exercises, chat, community, health, notifications, check-in, classes | `gym-member-app/` | `member/` (auth + 10 data controllers) | ✅ (per module memories; gateway/push delivery pending infra) |

### Member-app feature modules — [gym-member-app/](gym-member-app/)
Auth (phone+OTP, choose-gym, goal), Home, Workout, Classes, Progress, Community
(leaderboard/challenges/badges), Nutrition, Exercise Library, Trainer Chat, Health
(HealthKit/Health Connect + step tracker), Body/Heart/Sleep/Mindfulness/Activity,
Check-in, Locations, Membership, Notifications, Profile, Settings.
Per memories these are **shipped + runtime-verified** on web preview; native bridges are
**device-only QA (unverified here)**.

### SCC modules — [saas-control-center/](saas-control-center/)
Tenants, Subscriptions, Plans, Billing, Discounts, Referrals (campaigns/rules/fraud/wallets),
Audit-logs, Analytics, Call-center, Feature-flags, Error-Monitoring-Center (errors/alerts).
Per memories: billing-sync gap fixed; data sparseness + two divergent `subscription_plans`
tables (scc vs public) are known issues.

---

## 5. Key User Flows

**Gym staff login**
`/(login)` → `POST /api/v1/auth/login` → Supabase verify + (optional) 2FA → JWT issued →
token in Zustand+cookie → `middleware.ts` allows `[gymSlug]/*` → `JwtAuthGuard` +
`TenantMiddleware` bind `gym_id`/branch → React Query loads dashboard.

**New gym onboarding**
`/onboarding/*` wizard (studio info → branch → staff → plans → subscription → payment →
complete). `onboarding_step` is stored in **Supabase user metadata**, not Postgres;
`reconcileOnboardingStep` derives completeness from studio+branch. **Payment step cannot
collect online** (no gateway SDK) → effectively manual/skipped.

**Member check-in (verified-checkin flywheel)**
Manual / QR / facial at `[gymSlug]/check-in` or unauthenticated `kiosk/[branchSlug]` →
`check-ins` controller + WS gateway → `check_ins` row (branch-scoped) → dashboard pulse +
analytics + member-app activity update.

**Record a payment (admin)**
`finance/payments/new` form → `POST /api/v1/payments` → `payments.service` writes
`payments` row + invoice/receipt PDF (documents). **No card capture / gateway charge.**

**Member mobile session**
`(auth)/phone` → OTP (dev bypass `7386648648`/`000000` in non-prod) → member JWT →
`(app)/home` tabs hit Member BFF (`/api/v1/member/*`) for workouts, nutrition, classes,
check-in, chat, community, health.

**Platform admin (SCC)**
SCC `/login` → SCC backend (:4001) → `(dashboard)/*` reads `scc` schema (tenants, billing,
subscriptions) + reaches per-gym data via `tenant.metadata.schema_name`.

---

## 6. API Surface

- **Base prefix:** `/api/v1`. **Public routes:** `auth/*`, `/health`. Everything else passes
  `TenantMiddleware` + `JwtAuthGuard` + `SubscriptionLockGuard` + `PermissionsGuard`.
- **Member BFF:** `/api/v1/member/*` uses the **member JWT** (not the staff JWT).
- **Auth header:** `Authorization: Bearer <jwt>` + `x-active-branch: <branchId>` for
  branch scoping. Secrets are stripped from every response by `StripSecretsInterceptor`.
- **OpenAPI contract:** the Member API has a checked-in spec
  [docs/Member api v1.openapi.yaml](docs/Member%20api%20v1.openapi.yaml); both backend and
  member app codegen types from it (`gen:member-api` / `gen:api`). The **admin** API has
  Swagger decorators but **no enforced contract / drift gate**.

### Controller groups (86 controllers)
| Domain | Controllers |
|---|---|
| auth | auth, auth-api-key, auth-session, auth-sso, two-factor |
| members | members, family, corporate, member-visits, membership-access, memberships, plans |
| check-ins | check-ins, biometric, qr, devices, device-checkin |
| classes | classes, session, booking, class-template |
| payments/finance | payments, expenses, expense-categories, discounts, refunds, invoices, reports |
| inventory/POS | products, pos, suppliers, transfers, bundles |
| staff | staff, payroll, trainer, staff-biometrics |
| marketing | marketing, leads, automation |
| referrals | referrals, referrals-admin, referrals-internal, referral-analytics, member-referrals, member-referrals-admin |
| dashboard | dashboard, dashboard-actions, dashboard-intelligence, dashboard-ops, dashboard-layout |
| analytics | dashboard-analytics, reports |
| org/settings | organization, region, franchise, branches, roles, settings, platform, integrations, webhooks |
| member BFF | member-auth, member-core, member-workout, member-nutrition, member-exercise, member-chat, member-community, member-health, member-notification, member-checkin, member-class |
| misc | ai, audit, compliance, search, subscription, uploads, wallet, documents, invoice-templates, onboarding-plans, onboarding/internal, observability, app(health) |

> **Full per-route table: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)** — **676 routes**
> across all 86 controllers (method + path + handler), auto-extracted from the `@Controller`/
> verb decorators (regenerate with `node scripts/extract-endpoints.js`). The Member BFF uses
> base path **`member/v1/*`** (member JWT), distinct from the staff `api/v1/*` surface.

---

## 7. Database Documentation

- **Engine:** PostgreSQL (Supabase). **ORM:** Prisma 5.22, `multiSchema`.
- **Schemas in `schema.prisma`:** `public`, `studio_template` (+ `scc` managed separately
  by SCC hand-SQL). Live per-gym `studio_*` schemas are the production target but are
  **currently empty/legacy** — Member BFF live data is in `studio_template`, gym-filtered.
- **Scale:** **172 models, 0 Prisma enums** (status columns are strings). Every tenant model
  carries `gym_id`; the authoritative tenant-model set is
  [backend/src/prisma/tenant-models.ts](backend/src/prisma/tenant-models.ts).

### Table groups (by domain, `@@map` names)
- **Tenancy/org:** `studios` (public registry), `organization`, `organization_settings`,
  `regions`, `branches`, `branch_settings`, `roles`, `role_permissions`,
  `staff_permission_overrides`, `feature_flags`, `white_label_configs`.
- **Members:** `members`, `member_profiles`, `member_body_stats`, `member_progress_photos`,
  `member_notes`, `member_tags(+assignments)`, `member_documents`, `member_referrals`,
  `family_memberships`, `family_members`, `corporate_*`.
- **Memberships:** `membership_plans`, `member_memberships`, `membership_freezes`,
  `global_access_passes`.
- **Check-in:** `check_ins`, `check_in_events`, `biometric_enrollments`,
  `staff_biometric_enrollments`, `qr_token_audits`.
- **Classes:** `class_templates`, `classes`, `class_sessions`, `class_bookings`,
  `class_waitlists`, `class_attendance`, `class_enrollments`, `class_recurring_rules`,
  `studio_rooms`, `trainer_assignments`.
- **Staff:** `staff`, `staff_profiles`, `staff_availability`, `staff_attendance`,
  `staff_shifts`, `leave_requests`, `payroll_*`, `trainer_*`.
- **Finance:** `payments`, `expenses`, `expense_categories`, `expense_metrics`,
  `member_invoices`, `invoice_items`, `refunds`, `discounts`, `tax_rates`,
  `financial_transactions`, `payment_retry_log`, `payment_gateway_configs`.
- **Inventory/POS:** `products`, `product_categories`, `product_images`, `inventory`,
  `inventory_transactions`, `suppliers`, `purchase_orders(+items)`, `pos_sales(+items)`,
  `product_returns`, bundles.
- **Marketing:** `campaigns`, `campaign_audience`, `leads`, `lead_activities`,
  `message_templates`, `automation_workflows`, `workflow_actions`, `notification_logs`,
  `push_notifications`, `campaign_analytics_records`.
- **Analytics:** `daily_gym_metrics`, `membership_analytics`, `revenue_analytics`,
  `class_analytics`, `member_behavior_analytics`, `trainer_analytics`, `dashboard_metrics`,
  `domain_events` (event store).
- **Member app (BFF):** workout/nutrition/exercise/chat/community/health tables (in
  `studio_template`, gym-scoped) + device tokens + wearable telemetry (samples/daily/connections).
- **Platform:** `integrations`, `webhooks`, `webhook_deliveries`, `api_keys`, `audit_logs`,
  `consent_logs`, `data_requests`, `ai_conversations`.

**Relationships:** PK is `id` (uuid) per table; tenant tables FK to `studios.id` via `gym_id`;
branch-scoped tables carry `branch_id` (nullable = gym-wide). Detailed FK graph lives in
[backend/prisma/schema.prisma](backend/prisma/schema.prisma) (authoritative).

**Migration policy:** backend uses Prisma migrations (HARD STOP — schema changes need
explicit sign-off). SCC uses **hand-written idempotent SQL** + `apply-migrations.ts` —
never `prisma migrate dev` against the shared DB.

---

## 8. Environment & Setup

### Prerequisites
Node 18+, a Supabase project (Postgres + Auth + Storage), Redis/Upstash, optionally
Meilisearch. For the member app: Expo + an EAS dev build (cannot use Expo Go).

### Install & run
```bash
# Backend
cd backend && npm install
npx prisma generate
npm run start:dev            # http://localhost:3000 (api/v1)

# Frontend (admin)
cd frontend && npm install
npm run dev                  # Next dev (turbo) — do NOT mix `next build` + `next dev` on same .next/

# Member app
cd gym-member-app && npm install
npm run web                  # browser preview; `npm start` needs a dev build for device

# SCC
cd saas-control-center && npm install && npm run start:dev      # :4001
cd saas-control-center/frontend && npm install && npm run dev
```
> Monorepo gotcha: shell cwd resets between steps — use `npm --prefix <app>` or each app's
> local `node_modules/.bin`. `npx tsc` from the repo root fails.

### Environment variables
**Backend** ([backend/.env.example](backend/.env.example)): `DATABASE_URL`, `JWT_SECRET`,
`MEMBER_JWT_SECRET`, `MEMBER_ACCESS_TTL_SECONDS`, `MEMBER_DEV_OTP`, `SUPABASE_URL` /
`SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_*` / `UPSTASH_REDIS_REST_*`,
`ENABLE_REDIS`, `ENABLE_SEARCH`, `MEILISEARCH_HOST/_API_KEY`, `RESEND_API_KEY` /
`RESEND_FROM_EMAIL`, `TWILIO_*`, `META_WA_*`, `ANTHROPIC_API_KEY`, `CORS_ORIGINS`,
`FRONTEND_URL`, `PORT`, `NODE_ENV`. Payment (Razorpay-only): `RAZORPAY_KEY_ID` /
`RAZORPAY_KEY_SECRET` (used by the live REST integration) and `RAZORPAY_WEBHOOK_SECRET`
(used by the async webhook signature-verification path). Stripe env keys were removed.

> `main.ts` also hard-fails at boot without `HASH_SECRET` (always) and, in production,
> `TWO_FACTOR_ENCRYPTION_KEY`, `RAZORPAY_WEBHOOK_SECRET`, `CORS_ORIGINS` — all now present in
> `.env.example`.

**Frontend** ([frontend/.env.example](frontend/.env.example)): `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` (live).

### Verification
- Backend: `npm test` (Jest; 30% line threshold). Run specs covering what you touch.
- Frontend: `npm test` (Vitest — only 5 trivial tests) or `tsc --noEmit`.
- Member app: `gym-member-app/node_modules/.bin/tsc --noEmit` (no tests exist).

---

## 9. Frontend Audit

> Method: route inventory (98 pages) + feature-folder ↔ page correspondence. Per-component
> runtime behavior is **not** verifiable from static inspection; marked (inferred) where so.

| Area | Status | Notes / Issue | Recommendation |
|---|---|---|---|
| Auth (login/register/reset/2FA) | ✅ Implemented | Full page set + `features/auth` + store | — |
| Onboarding (11 pages) | 🟡 Partial | `onboarding/payment` has no working gateway | Make payment step explicitly skippable / mark "manual" |
| Members & CRM | ✅ Implemented | `features/members`, full CRUD pages | — |
| Memberships/Plans | ✅ Implemented | plan CRUD + attach | — |
| Check-in / Kiosk / Biometric | ✅ Implemented | face-api.js + QR + WS | Device QA for facial accuracy (inferred) |
| Classes & Schedule | ✅ Implemented | sessions, roster, waitlist | Schedule view prefs are localStorage-only (server persistence is a follow-up) |
| Staff & Payroll | 🟡 Partial | full staff pages; payroll depth unverified | Verify payroll calc UI end-to-end |
| Finance/Payments | ✅ Razorpay (only) | **All Razorpay flows end-to-end (member payment, SaaS subscription, onboarding)** — real order + key-secret verify + order-notes-authoritative plan + webhook; verified vs test API. Stripe removed entirely | — |
| Inventory/POS | ✅ Implemented | products + POS + reports | — |
| Marketing | 🟡 Partial | campaign/lead/automation UI exists; delivery depends on channel config | Verify automation execution path |
| Referrals (+ admin) | ✅ Implemented | member + admin + fraud + rules pages | — |
| Dashboard | ✅ Implemented | tiles + branch comparison + AI briefing | — |
| Reports | ✅ Implemented | export flows | — |
| Settings (account/roles/permissions/integrations/subscription/loyalty/templates/tax) | ✅ Implemented | large client pages | Split oversized client pages (see §14) |
| Wallet/Loyalty | 🟡 Dead-ish | `features/wallet` with **no dedicated page** | Confirm where it surfaces or remove |
| `debug/sentry-test` | 🗑 Dev-only | Sentry test page shipped in app routes | Remove or gate out of prod build |

**Frontend-wide observations**
- **~96/98 pages are Client Components** — minimal SSR; consider server components for
  read-heavy pages (perf + bundle).
- **Near-zero UI test coverage** (5 trivial Vitest files). Any feature change is untested.
- **No unused-component scan run** here — a `ts-prune`/`knip` pass is recommended (§14) to
  confirm the 27 feature folders have no orphaned exports.

---

## 10. Backend Audit

| Module | Status | Notes |
|---|---|---|
| auth (5 controllers) | ✅ | SSO + API-key + session controllers present; verify SSO is wired to a real IdP (inferred) |
| members / classes / check-ins / inventory / referrals / dashboard / analytics | ✅ | Branch-scoping hardened in 2026-04 audit; tenant `$use` injection active |
| payments | ✅ Razorpay (only) | **Razorpay end-to-end + Stripe fully removed (2026-06-05):** SDK-free `RazorpayService` (REST via `fetch`) creates a real order; `createOrder()` persists `gateway_order_id`; `verifyPayment()` verifies the Checkout handshake with the **key secret**, looks up by `gateway_order_id`; webhook handler matches on `gateway_order_id`; `main.ts` captures `rawBody` for webhook HMAC. Member + subscription + onboarding all charge; verified vs Razorpay test API. Repeatable proof: `RAZORPAY_LIVE_TEST=1 npx jest test/payments/razorpay.live.spec.ts` (4/4 green — real order create/fetch + synthesized Checkout signature run through the real `verifyPayment` → membership; forged signature rejected) |
| marketing | 🟡 | Automation engine present; actual channel delivery (Twilio/WhatsApp/Resend) depends on env + needs runtime verification |
| member BFF (11 controllers) | ✅ | Shipped per memories; push **delivery** needs EAS projectId + FCM creds |
| subscription | ✅ | Lifecycle lock guard global |
| compliance/audit | 🟡 | `data_requests` model + endpoints exist; **GDPR/DPDP export/delete E2E unaudited**; audit-log INSERT-only grant **unconfirmed** |
| search | 🟡 | Meilisearch behind `ENABLE_SEARCH` flag |
| platform/integrations/webhooks | 🟡 | Webhook **HMAC verification not audited** (replay window / timing-safe compare) |
| **DEAD FILE** | 🗑 | `backend/src/dashboard/` contains a 4.5KB file literally named `dashboard" && cp e:Projects…todays-classes.service.ts …` — a botched git-worktree merge artifact. **Not compiled, pure garbage. Remove.** |

**Backend-wide observations (from verified facts + prior audits)**
- **Tenant isolation** is strong at the app layer but **RLS is decorative** until the
  non-bypass DB role + pooling keystone ships (in progress, Phase B). Do not rely on RLS yet.
- **Raw SQL** must be hand-scoped; an R5 sweep (2026-06-03) found no leaks but flagged
  blockers — see [docs/RLS-R5-RAWSQL-SWEEP-2026-06-03.md](docs/RLS-R5-RAWSQL-SWEEP-2026-06-03.md).
- **Idempotency is split:** the **Member BFF has it** (`@Idempotent()` + an interceptor that
  requires an `Idempotency-Key` header, dedupes retries, and replays the original response).
  The **staff financial POSTs (payments/refunds/invoices) do not** — `verifyPayment()` has a
  transactional `status='pending'` double-process guard, but there's no request-level
  idempotency key on order/charge creation.
- **No orphan-endpoint scan** run here; the controller↔feature correspondence (§11) is high,
  so large-scale orphan APIs are unlikely but unconfirmed.

---

## 11. Frontend ↔ Backend Wiring Matrix

> ✅ connected · 🟡 partial · ❌ missing. Based on feature-folder ↔ controller ↔ page
> correspondence; DB column = "tables exist in schema".

| Module | FE page | FE service | API | Controller | DB | Status |
|---|---|---|---|---|---|---|
| Auth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Onboarding | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 (payment) |
| Members/CRM | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Memberships | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Check-in/Kiosk | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Classes/Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Staff/Payroll | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 |
| Payments/Finance | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 **no gateway** |
| Inventory/POS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Marketing | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 (delivery) |
| Referrals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reports/Analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subscription | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (key-gated) |
| Settings/Org/Roles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wallet/Loyalty | ❌ (no page) | ✅ | ✅ | ✅ | ✅ | 🟡 backend-without-UI |
| Search | 🟡 | ✅ | ✅ | ✅ | n/a | 🟡 (flag) |
| Compliance/Data-requests | 🟡 (settings) | 🟡 | ✅ | ✅ | ✅ | 🟡 |
| Member BFF (mobile) | ✅ (member app) | ✅ | ✅ | ✅ | ✅ | ✅ |

**Backend without frontend (admin web):** `wallet`, parts of `compliance` (data export),
`platform/webhooks` admin surface — backend exists, no/limited admin UI.
**Frontend without backend gap:** none material found; the payment **gateway** is the inverse
(UI + DTO exist, integration absent).

---

## 12. Missing Features & Gap Analysis

### 🔴 Critical (block production-grade billing/compliance)
1. **Online payment collection — both Razorpay flows now wired (2026-06-04).** End-to-end on
   Razorpay: (a) **member membership payment** (`payments` module) and (b) **SaaS subscription
   renewal / plan-switch** (`subscription` module). Both use the SDK-free `RazorpayService`
   (REST via `fetch`): real order creation, Checkout signature verified with the key secret,
   and — for subscriptions and onboarding — the plan/cycle/amount are read back from the
   **server-set order notes** (not the client) and the order's `studio_id` note is matched to the
   caller, so a buyer can't pay for a cheap plan and claim a costly one. The **onboarding payment
   step** now charges via Razorpay too (the old fake card form is gone) while preserving the
   onboarding-completion + B2B-referral-reward emission. **Stripe was removed entirely**
   (2026-06-05) — product is Razorpay-only. **Remaining (optional):** set `RAZORPAY_WEBHOOK_SECRET`
   + a dashboard webhook to enable the async confirmation path in production (the synchronous
   Checkout verify already works without it).
2. **RLS not load-bearing yet.** App runs as superuser w/ `rolbypassrls`; isolation depends
   entirely on app-layer `gym_id` injection. The keystone (non-bypass role + pooling) must
   ship before onboarding real gyms onto per-`studio_*` schemas. (In progress, Phase B.)
3. **Idempotency — now on the hottest staff financial POSTs** (2026-06-05): `recordCash`,
   `create-order`, and `refunds.process` honor an `Idempotency-Key` header via a Redis-backed
   store (in-memory fallback), header-optional + fail-open. **Remaining:** invoice POSTs and a
   durable (DB-table) store for multi-instance guarantees beyond the 24h Redis window.

### 🟡 Important
4. **Inbound *integration* webhook verification unaudited** (replay window, timing-safe
   compare) — note the **payment** webhook path *does* use timing-safe HMAC; this gap is the
   `platform/webhooks` / `integrations` surface, not payments.
5. **GDPR/DPDP data export & deletion** — model + endpoints exist; **E2E flow unverified**.
6. **Audit-log immutability** — INSERT-only grant not confirmed (tamper risk).
7. **Marketing channel delivery** (SMS/WhatsApp/email) depends on env config; execution path
   not runtime-verified.
8. **Member push delivery** needs EAS projectId + FCM creds (capability built, delivery not live).
9. **Wallet/loyalty has no admin UI surface** — backend orphan.
10. **SCC sync — audited + reconciled (2026-06-05).** Verified live: all 3 studios → `scc.tenants`
    (0 missing), all plan-linked, 3 subscriptions, 4 plans seeded, 2/2 invoices → `scc.payments`.
    Fixed: seeded the empty `scc.subscription_plans`, ran the `sync:studios` reconcile (backfilled
    the missing `musclex` tenant + subscriptions), and wired `touchLastActive` on login so
    `last_active_at` stays fresh. SaaS billing payments mirror to `scc.payments` via the single
    `recordRenewal` chokepoint; member→gym payments intentionally stay tenant-local. Note: SCC
    keeps its **own** `subscription_plans` (mirrors backend `PLAN_CONFIGS`) — that's by design, not
    a bug; keep them aligned.

### ℹ️ Smaller gaps
- Schedule view prefs are localStorage-only (no server persistence).
- Admin API has **no OpenAPI drift gate**; only the Member API has a checked-in contract.
- `debug/sentry-test` page ships in the app.
- No CI dependency/SAST scan verified.

### APIs without screens / Screens without APIs
- **APIs without admin screens:** wallet, full webhook management, compliance export.
- **Screens without working backend:** payment **collection** (gateway), the two
  `NEXT_PUBLIC_*_KEY` client payment envs.

---

## 13. Documentation Cleanup Plan

**~90 project `.md` files** exist (excluding `.claude/skills/**`, which is tooling and out of
scope). They are categorized below. **No deletions have been made** — execution awaits your
confirmation (deleting files is a HARD STOP per CLAUDE.md). Recommended target: **delete
clearly-dead planning prompts, MERGE overlapping audits/perf docs into this master + a few
living docs, and KEEP foundational specs + active runbooks.**

### KEEP (canonical / living)
| File | Why |
|---|---|
| `CLAUDE.md` | Working rules |
| `design.md` | Admin design language (referenced by CLAUDE.md) |
| `MASTER_PROJECT_DOCUMENTATION.md` (this) | New single source of truth |
| `docs/PRD_v1.0.md`, `docs/TRD_v1.0.md` | Foundational admin specs |
| `docs/PRD_Member_App.md`, `docs/TRD_Member_App.md` | Foundational member specs |
| `docs/Member api v1.openapi.yaml` | Codegen contract (NOT md, but keep) |
| `docs/RLS-PHASE-B-CUTOVER-RUNBOOK-2026-06-03.md` | Active keystone runbook |
| `docs/competitive-strategy-2026-06/**` | Current strategy set (referenced in memory) |
| `docs/screens/**` (PNGs) | Visual reference |
| `gym-member-app/docs/MEMBER_APP_MASTER_PLAN.md`, `features_list.md` | Living member trackers |
| `saas-control-center/docs/SAAS_CONTROL_CENTER.md` | SCC reference |
| per-app `README.md` | Standard entry points |

### MERGE (fold key content into this master or a single living doc, then remove original)
| Files | Merge target |
|---|---|
| `docs/ARCHITECTURE.md` | §2–§7 here (largely already folded) |
| `SAAS_AUDIT_REPORT.md`, `docs/TENANT-ISOLATION-AUDIT.md`, `docs/TENANT-ISOLATION-AUDIT-2026-06-01.md`, `docs/RLS-HARDENING-AUDIT-2026-06-03.md`, `docs/RLS-KEYSTONE-FIX-DESIGN-2026-06-01.md`, `docs/RLS-R5-RAWSQL-SWEEP-2026-06-03.md`, `docs/RLS-D4-REGISTRY-FIX-PLAN-2026-06-03.md` | §2.5/§10/§12 (security) — keep the one active runbook only |
| `docs/backend-performance.md`, `database-performance.md`, `frontend-performance.md`, `bundle-analysis.md`, `performance-audit.md`, `performance-fixes.md`, `PERF-SUSPECTS.md` | one `docs/PERFORMANCE.md` |
| `docs/AGENT_RULES.md`, `CLEANUP_RULES.md`, `DB_RULES.md`, `PERFORMANCE_RULES.md`, `SECURITY_RULES.md`, `docs/MEMORY.md` | `CLAUDE.md` (rules already overlap) |
| `docs/SCREEN_MAP.md`, `docs/member-app/00–05` | §4–§5 + member master plan |
| `saas-control-center/docs/ARCHITECTURE_AUDIT.md`, `PROJECT_SUMMARY.md`, `ERROR_CENTER_ARCHITECTURE.md`, `SCC_DATA_AUDIT_2026-05-30.md` | `SAAS_CONTROL_CENTER.md` |
| `gym-member-app/BLUEPRINT.md`, `mobile-app-design.md`, `docs/FEATURE_INVENTORY.md`, `docs/G3_CROSS_PLAN.md`, `docs/STEP_TRACKER.md`, `docs/WEARABLE_INGESTION.md`, `docs/BACKGROUND_SYNC_PROPOSAL.md`, `samsung-health-rn-expo-guide.md`, `docs/SAMSUNG_HEALTH_INTEGRATION.md` | member master plan |
| `tasks/lessons.md`, `tasks/test-scenarios.md`, `docs/TEST_SCENARIOS.md` | one `docs/TESTING.md` |

### REMOVE (dead planning prompts / completed checklists / point-in-time reports)
| File | Why |
|---|---|
| `COMPLETE_BUILD_PROMPT.md` | One-shot build prompt, superseded |
| `SCC_UPGRADE_PROMPT.md` | One-shot upgrade prompt, superseded |
| `docs/DASHBOARD_WORLD_NO1_UPGRADE.md` | Aspirational planning prompt |
| `docs/Phase1_Build_Checklist.md` | Completed checklist |
| `docs/alignment-report.md` | Point-in-time snapshot |
| `gym-member-app/docs/SESSION_REPORT_2026-06-03.md`, `TEST_REPORT.md`, `QA_CHECKLIST.md`, `PRODUCTION_QA.md`, `RELEASE_CHECKLIST.md` | Session/QA snapshots (fold any open items into master plan first) |
| `tasks/todo.md`, `tasks/Expense.md` | Scratch working files |
| **`backend/src/dashboard/dashboard" && cp …todays-classes.service.ts …`** | **Corrupted git-worktree artifact (a stray file, not a doc) — delete** |

> After merge, originals listed under MERGE are deleted. Net: ~90 → roughly **20 curated
> docs** + this master.

---

## 14. Technical Debt Report

### Backend
- **Hand-maintained tenant-model set** — now single-sourced in `tenant-models.ts` (good),
  but still manual; a codegen from `schema.prisma` (every model with `gym_id`) would prevent drift.
- **Dead file** in `backend/src/dashboard/` (corrupted worktree artifact) — remove.
- **Stub:** payments gateway (DTOs but no SDK/service); `payment_gateway_configs` unused.
- **Idempotency** now on cash/create-order/refund POSTs (Redis-backed, header-optional);
  invoice POSTs + a durable DB-backed store still pending.
- **Webhook HMAC** unaudited; **audit-log immutability** unconfirmed.
- **2 chained Prisma middlewares** on every query — benchmark hot paths (check-in <1s target).
- **Low test coverage** (30% threshold; ~26 specs for 141 services).
- **No OpenAPI drift gate** for the admin API.

### Frontend
- **~96/98 pages are Client Components** — limited SSR; consider server components for
  read-heavy pages.
- **Oversized client pages** in `settings/*` (several ≥20KB) — split.
- **Near-zero UI tests** (5 trivial files).
- **Dead/dev pages:** `debug/sentry-test`; `features/wallet` with no route.
- **Run `knip`/`ts-prune`** to confirm unused exports/components (not run here).

### Member app
- **No tests at all** — only `tsc --noEmit`. Native bridges (HealthKit/Health Connect/push)
  are device-only QA.
- Design-system naming drift: code uses "Kraken"; `design.md`/older docs describe a dark-first
  "Geist" system — reconcile in one place.

### SCC
- **`subscription_plans` lives in both `scc` and `public` by design** (SCC owns its copy,
  mirroring backend `PLAN_CONFIGS`); both now seeded — keep them aligned when plans change.
- Tenant/payment sync reconciled 2026-06-05 (see §12.10). Run `npm --prefix saas-control-center
  run sync:studios` (or the "Sync from app" button) periodically as a safety-net reconcile.
- Missing error-UI states on some SCC pages (minor).

### Cross-cutting
- **~90 markdown files** with heavy overlap (this cleanup).
- **CI/CD `.github/`** not audited — confirm SAST/dependency scanning exist.

---

## 15. Executive Summary

**What MuscleX is:** a broad, genuinely feature-rich multi-tenant gym SaaS — 4 apps,
31 backend modules, 86 controllers, 172 data models, ~98 admin pages, plus a deep member
mobile super-app and an internal control center. Breadth is a real strength.

### Estimated completion (by surface, evidence-based)
| Area | Completion | Confidence |
|---|---|---|
| Gym admin web (operations) | **~90%** | High (routes + controllers + DB all present and wired) |
| Member mobile app | **~85%** | Medium (shipped per memories; native bridges = device QA) |
| Backend service layer | **~85%** | High (structure verified) |
| **Billing / online payments** | **~95%** | High (Razorpay-only; member + subscription + onboarding all charge, verified vs test API; Stripe removed) |
| Tenant-isolation hardening (RLS keystone) | **~70%** | Medium (Phase B in progress) |
| SaaS Control Center | **~75%** | Medium (per memories: data/plan-table issues) |
| Compliance (GDPR/DPDP export/delete) | **~50%** | Low (endpoints exist, E2E unaudited) |
| Test coverage | **~20%** | High (counts verified) |
| **Overall production-readiness** | **~75%** | — |

### Fully complete (build + wire)
Auth/2FA, Members/CRM, Memberships, Check-in/Kiosk/Biometric, Classes/Schedule,
Inventory/POS, Referrals, Dashboard, Analytics/Reports, Subscription-lock, AI, Settings/Org.

### Partial
Staff/Payroll (depth), Marketing (delivery), Compliance, Search, Wallet (no UI),
Member push (delivery).

### Missing / stub
**None for payments** — Stripe was fully removed (2026-06-05; product is Razorpay-only). All
three Razorpay flows (member payment, SaaS subscription, onboarding) are wired end-to-end and
verified against the Razorpay **test API** (order create + fetch + signature round-trip).

### Top risks
1. **Tenant leak class** if a new model is added without registering in `tenant-models.ts`,
   *and* RLS is still non-bearing until Phase B ships. **Ship the RLS keystone before
   onboarding more gyms.**
2. **Billing complete (Razorpay-only)** — member payments, SaaS subscription renewal, and
   onboarding activation all charge end-to-end (verified vs the Razorpay test API). Stripe was
   removed entirely per product decision.
3. **Financial correctness** — request-level idempotency now covers cash/order/refund POSTs
   (invoice POSTs pending); audit-log immutability still unconfirmed (payment webhook HMAC *is*
   implemented).
4. **Very low automated test coverage** across all apps.

### Recommended next actions (priority order)
1. **Ship the RLS keystone** (non-bypass DB role + Supavisor pooling) — Phase B.
2. **Billing done (Razorpay-only):** all flows charge end-to-end and are verified vs the test
   API; Stripe removed. Optional: configure the production webhook secret for the async path.
3. **Idempotency** now on cash/order/refund POSTs; extend to invoice POSTs + audit-log grants.
4. **Codegen the tenant-model set** from `schema.prisma` to kill the drift leak class.
5. **Raise test coverage** on the money paths (payments, check-in, tenant isolation).
6. **Execute this doc-cleanup plan** (§13) and remove the corrupted backend file.
7. **Verify GDPR/DPDP export-delete E2E**; reconcile SCC `subscription_plans` duplication.

---

*End of master document. Authoritative sources: `backend/prisma/schema.prisma`,
`backend/src/prisma/tenant-models.ts`, `backend/src/app.module.ts`,
`frontend/src/services/api-client.ts`, and the per-app `package.json` manifests.*
