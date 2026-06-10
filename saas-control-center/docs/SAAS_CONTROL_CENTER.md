# SaaS Control Center — Full Detail Reference

> **Purpose.** A single-document, end-to-end map of what the **MuscleX SaaS Control Center (SCC)** is _today_, so any upgrade plan starts from real ground truth. Every section below is derived from the code in `saas-control-center/` as of **2026-05-30**.
>
> If a row says **VERIFIED**, it was read directly from source. If a row says **UNVERIFIED**, it's a known design intent that I did not re-confirm in this pass.

---

## 1. What it is

The SaaS Control Center is a **standalone NestJS microservice + standalone Next.js admin frontend** that acts as the "God Mode" admin layer over the multi-tenant MuscleX gym SaaS.

- **Backend** (`saas-control-center/`) — NestJS 10 + Prisma 5 + Postgres 16 + Redis 7. Owns its **own database** (separate from the main app DB).
- **Frontend** (`saas-control-center/frontend/`) — Next.js 16 (App Router) + React 19 + TanStack Query + Zustand + Tailwind 4 + shadcn/ui.
- **Boundary** — the SCC is the **source of truth** for tenants, plans, subscriptions, billing records, feature flags, and admin audit. For the **referrals** domain, the SCC is a **read/write proxy** into the main backend (which still owns referral tables).

The SCC is deployed independently from the main MuscleX app. Login is restricted to **SUPER_ADMIN** style accounts only.

---

## 2. Tech stack

### Backend (`saas-control-center/package.json`)
| Concern | Choice |
|---|---|
| Runtime | Node.js + NestJS 10.3 + TypeScript 5.3 |
| ORM | Prisma 5.8 |
| DB | PostgreSQL |
| Cache / lockout / sessions | Redis (ioredis 5) |
| Auth | JWT (access + refresh) via `@nestjs/jwt` + `passport-jwt`; bcrypt 5.1 hashing |
| MFA | TOTP via `otplib` + QR via `qrcode` |
| Scheduling | `@nestjs/schedule` (cron) |
| Validation | `class-validator` + `class-transformer` (`whitelist: true`, `forbidNonWhitelisted: true`) |
| Hardening | Helmet, compression, CORS, `ThrottlerModule` (60 req/min global) |
| Docs | Swagger at `/docs` (Bearer auth) |
| Outbound | `axios` 1.13 (used by `ReferralsProxyService` to call main app) |

### Frontend (`saas-control-center/frontend/package.json`)
| Concern | Choice |
|---|---|
| Framework | **Next.js 16.2** (App Router) + **React 19.2** |
| Data | `@tanstack/react-query` 5 |
| State | `zustand` 5 (auth store) |
| HTTP | `axios` 1.13 with bearer interceptor + 401-refresh-retry |
| Forms | `react-hook-form` 7 |
| Styling | Tailwind v4 + `tw-animate-css`, `class-variance-authority`, `tailwind-merge` |
| UI primitives | shadcn (Base UI under the hood: `@base-ui/react` 1.3) |
| Charts | `recharts` 3 |
| Icons | `lucide-react` |
| Toasts | `sonner` |
| MFA QR | `qrcode` |

---

## 3. Repository layout

```
saas-control-center/
├── docs/
│   ├── ARCHITECTURE_AUDIT.md        # 2026-03-19 deep audit (still useful but partly stale)
│   ├── PROJECT_SUMMARY.md            # earlier short summary
│   └── SAAS_CONTROL_CENTER.md        # ← this document
├── docker/
│   ├── Dockerfile                    # multi-stage build
│   └── docker-compose.yml            # API (4000) + Postgres (5433) + Redis (6380)
├── prisma/
│   ├── schema.prisma                 # see §4
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts                       # bootstrap: helmet, compression, CORS, ValidationPipe,
│   │                                 # GlobalExceptionFilter, ResponseTransformInterceptor, Swagger
│   ├── app.module.ts                 # imports all 11 feature modules + Throttler + Schedule
│   ├── config/redis.module.ts        # global Redis provider (REDIS_CLIENT injection token)
│   ├── database/
│   │   ├── database.module.ts
│   │   └── prisma.service.ts
│   ├── common/
│   │   ├── decorators/                # @Public, @CurrentAdmin
│   │   ├── dto/pagination.dto.ts      # PaginationDto + PaginatedResult<T>
│   │   ├── filters/global-exception.filter.ts
│   │   ├── guards/jwt-auth.guard.ts   # GLOBAL guard, bypassed by @Public()
│   │   └── interceptors/response-transform.interceptor.ts   # wraps in { success, data, meta }
│   └── modules/
│       ├── auth/         # login, MFA (TOTP + recovery codes), refresh, password reset, profile
│       ├── tenant/       # CRUD, suspend/activate, plan change, impersonate, search
│       ├── plans/        # plan CRUD + featured/sort + discounts
│       ├── subscription/ # lifecycle, expiring, cancel
│       ├── billing/      # payments: record, retry, mark-paid, refund
│       ├── feature-flags/# global / plan / tenant overrides + Redis cache
│       ├── dashboard/    # KPI snapshot (Redis 30s)
│       ├── analytics/    # revenue trend, plan distribution, growth, sub breakdown
│       ├── audit-logs/   # mutation log, filtered list
│       ├── referrals/    # **proxy** to main backend (no local tables)
│       └── health/       # /health, public
└── frontend/
    └── src/
        ├── app/
        │   ├── (dashboard)/          # auth-gated layout
        │   │   ├── dashboard/         # KPIs + revenue chart
        │   │   ├── tenants/           # list + add-tenant-modal + detail nav
        │   │   ├── call-center/       # lookup gym by ID / slug (Tier-1 support)
        │   │   ├── plans/             # CRUD + plan-form-modal
        │   │   ├── subscriptions/     # list, filter, cancel
        │   │   ├── billing/           # payments list + actions
        │   │   ├── referrals/         # overview + rules / campaigns / fraud / wallets
        │   │   ├── feature-flags/     # list + toggle
        │   │   ├── analytics/         # charts
        │   │   ├── audit-logs/        # admin action history
        │   │   └── profile/           # admin profile + MFA + password
        │   ├── login/                  # email/password + MFA step
        │   ├── forgot-password/
        │   └── reset-password/
        ├── components/
        │   ├── ui/                    # shadcn primitives (button, card, dialog, table, etc.)
        │   ├── dashboard/             # kpi-card, revenue-chart
        │   ├── layout/                # sidebar, topbar, page-header
        │   └── shared/                # confirm-dialog, status-badge, empty-state, skeleton
        ├── hooks/                     # use-auth, use-tenants, use-plans, use-subscriptions,
        │                              # use-billing, use-feature-flags, use-analytics,
        │                              # use-audit-logs, use-dashboard
        ├── lib/                       # api.ts (axios + refresh), constants.ts, utils.ts
        ├── providers/                 # query-provider.tsx
        ├── stores/                    # auth-store.ts (Zustand, localStorage-persisted)
        └── types/                     # global TS contracts (Admin, Tenant, Plan, etc.)
```

---

## 4. Database schema (`prisma/schema.prisma`) — VERIFIED

PostgreSQL with UUID primary keys, snake_case column names (`@@map`), `created_at` / `updated_at` everywhere.

### 4.1 Enums
| Enum | Values |
|---|---|
| `TenantStatus` | `ACTIVE`, `TRIAL`, `EXPIRED`, `SUSPENDED` |
| `SubscriptionStatus` | `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`, `TRIALING` |
| `PaymentStatus` | `PENDING`, `PAID`, `FAILED`, `REFUNDED` |
| `DiscountType` | `PERCENTAGE`, `FLAT` |
| `AuditAction` | `CREATE`, `UPDATE`, `DELETE`, `SUSPEND`, `ACTIVATE`, `IMPERSONATE`, `LOGIN`, `LOGOUT`, `PLAN_CHANGE`, `PAYMENT_RETRY`, `REFUND`, `FEATURE_TOGGLE` |

### 4.2 Models

| Model | Purpose | Key fields |
|---|---|---|
| `AdminUser` (`admin_users`) | SCC admin accounts | `email` (unique), `password_hash`, `name`, `is_active`, `last_login_at`, `mfa_enabled`, `mfa_secret`, `mfa_pending_secret`, `mfa_backup_codes string[]` (bcrypt hashes) |
| `PasswordResetToken` (`password_reset_tokens`) | Forgot-password flow | `token_hash` (unique, SHA-256 of plaintext), `expires_at`, `used_at`, FK → admin (cascade) |
| `Tenant` (`tenants`) | Gym tenants | `slug` (unique), `owner_email`, `owner_name`, `status`, `plan_id?`, `max_members`, `max_branches`, `max_staff`, `storage_limit_mb`, `is_active`, `trial_ends_at`, `last_active_at`, `metadata Json?`, `account_type` (default `"gym"`). Indexes on status, plan_id, owner_email, `(is_active, status)` |
| `SubscriptionPlan` (`subscription_plans`) | Plan catalog | `name` (unique), `price_monthly`, `price_yearly`, `features Json`, `limits Json`, `sort_order`, `is_active` |
| `Subscription` (`subscriptions`) | Tenant ↔ plan lifecycle | `tenant_id` **UNIQUE** (one active row per tenant), `plan_id`, `status`, `start_date`, `end_date`, `auto_renew`, `canceled_at` |
| `Payment` (`payments`) | Transaction records | `tenant_id`, `subscription_id?`, `amount`, `currency` (default `INR`, varchar 3), `status`, `gateway`, `gateway_payment_id`, `invoice_url`, `failure_reason`, `retry_count`, `metadata Json?` |
| `Discount` (`discounts`) | Promo codes / sales | `name`, `plan_id?`, `type`, `value`, `code?` (unique), `valid_from`, `valid_to`, `max_uses?`, `used_count`, `is_active` |
| `FeatureFlag` (`feature_flags`) | Global flag registry | `key` (unique), `name`, `description?`, `is_global` |
| `PlanFeatureFlag` (`plan_feature_flags`) | Plan-level flag override | `(plan_id, flag_id)` unique, `enabled` |
| `TenantFeatureFlag` (`tenant_feature_flags`) | Tenant-level override (highest priority) | `(tenant_id, flag_id)` unique, `enabled` |
| `AuditLog` (`audit_logs`) | Every admin mutation | `action`, `admin_id?`, `entity_type`, `entity_id?`, `old_value Json?`, `new_value Json?`, `ip_address`, `user_agent`, `metadata Json?` |

**Notable invariants**
- `Subscription.tenant_id` is `@@unique` — there can be **at most one** subscription row per tenant. Plan change uses an `updateMany` to flip old `ACTIVE`/`TRIALING` rows to `CANCELED` inside the same transaction. (VERIFIED — fixes audit C4.)
- `Tenant.metadata` is `Json?`. Per global memory, when writing JSON nulls go through `Prisma.JsonNull`, not raw `null`.
- All FKs from `Tenant` use `onDelete: Cascade`, so hard-deleting a tenant takes subscriptions, payments, and tenant flag overrides with it. There is no soft delete.

---

## 5. Cross-cutting backend wiring

### 5.1 Bootstrap (`src/main.ts`)
- Global prefix `api/v1` (configurable via `API_PREFIX`).
- `helmet()` + `compression()` middleware.
- CORS from `CORS_ORIGINS` env (comma-separated), `credentials: true`.
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, implicit conversion on.
- `GlobalExceptionFilter` (uniform error shape).
- `ResponseTransformInterceptor` (wraps every response as `{ success, data, meta? }`).
- Swagger at `/docs` with bearer auth.

### 5.2 Auth posture (`src/app.module.ts` + common guards)
- `JwtAuthGuard` is registered as the **global** guard. Routes opt out via `@Public()`.
- `ThrottlerModule` at **60 req/min** is applied via `APP_GUARD`.
- `ScheduleModule.forRoot()` is enabled for cron jobs.
- **No** `RolesGuard` exists — all admins are functionally equal (audit item **H1** still open).

### 5.3 Audit logging
- `AuditLogsService` is exported globally; every mutating service depends on it.
- Each handler builds a `ctx = { admin_id, ip_address, user_agent }` from `@CurrentAdmin()` + `req`, and passes it to the service method.
- Logs include `old_value` / `new_value` (full Prisma objects in some places — audit item **M7** still open).

### 5.4 Response shape (every endpoint)
```json
{ "success": true, "data": <payload>, "meta": { ... } }
```
For paginated lists `data` is itself `{ data: [...], meta: { total, page, limit, total_pages } }`.

---

## 6. Backend modules — feature by feature

### 6.1 `auth/` — VERIFIED, **substantially upgraded since the 2026-03-19 audit**

Public routes (`@Public()`):
| Verb | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Step 1: email + password. Returns either tokens, or `{ requires_mfa: true, mfa_session_token }` if MFA on. |
| POST | `/auth/mfa/verify-login` | Step 2: completes MFA login with TOTP code. |
| POST | `/auth/mfa/recovery-login` | Step 2 alt: completes MFA login with a one-time recovery code. |
| POST | `/auth/refresh` | Refreshes access token; **validates refresh token against the value stored in Redis** under `refresh_token:<admin_id>` (rotation-friendly, revocable). |
| POST | `/auth/forgot-password` | Issues SHA-256 token, stores hash in `password_reset_tokens` with 30-min TTL. Always returns success (no enumeration). Reset URL is currently **logged**, not emailed (TODO in source). |
| POST | `/auth/reset-password` | Consumes token, hashes new password, **revokes refresh token in Redis**. |

Authenticated routes:
| Verb | Path | Purpose |
|---|---|---|
| GET | `/auth/profile` | Returns id, email, name, `mfa_enabled`, `last_login_at`, `backup_codes_remaining`. |
| PATCH | `/auth/profile` | Update display name. |
| POST | `/auth/change-password` | Requires current password; revokes refresh token. |
| POST | `/auth/mfa/setup/init` | Generates TOTP secret + QR data URL. Pending secret cached in Redis for 10 min. |
| POST | `/auth/mfa/setup/confirm` | Confirms first TOTP code; **returns 8 plaintext backup codes once** (stored as bcrypt hashes). |
| POST | `/auth/mfa/disable` | Requires password; wipes secret + backup codes. |

Other behaviors:
- **Login lockout** — 5 failed attempts ⇒ 15-min lockout via `login_attempts:<email>` Redis counter (graceful: if Redis is down, lockout is skipped with a warning log).
- **Bootstrap admin** — on module init, if `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` env vars are set and no admin exists with that email, one is created.
- **Impersonation** (called from Tenant controller) — `generateImpersonationToken(tenantId)` signs a JWT with `{ sub: admin.id, email: tenant.owner_email, tenant_id, type: 'impersonation' }`, expires in 1h. Currently uses the same `JWT_SECRET` (audit item **M4** still open).

> Audit items already addressed in code: **C6** (refresh tokens are now Redis-stored & revocable) ✅, **M3** (tenant creation now also writes a `TRIALING` `Subscription` row) ✅.

### 6.2 `tenant/` — VERIFIED
Controller paths (`/tenants`):

| Verb | Path | Notes |
|---|---|---|
| GET | `/tenants` | Paginated list, filters from `TenantFilterDto` (status, plan, is_active, search). |
| GET | `/tenants/search?q=` | **Call-center search** — find by id or slug. Used by `/call-center` page. |
| GET | `/tenants/:id` | Full detail incl. subscriptions, payments, feature flag overrides. |
| POST | `/tenants` | Create. Auto-sets a 14-day trial **and creates a `TRIALING` Subscription** when a plan is supplied. |
| PATCH | `/tenants/:id` | Update mutable fields. |
| PATCH | `/tenants/:id/plan` | Change plan. Single `$transaction`: updates tenant, sets `max_*` from plan limits, sets `ACTIVE`, `updateMany` cancels existing `ACTIVE`/`TRIALING` subs, creates new `Subscription`. |
| POST | `/tenants/:id/suspend` | Status ⇒ `SUSPENDED`, audit log. |
| POST | `/tenants/:id/activate` | Status ⇒ `ACTIVE`. |
| POST | `/tenants/:id/impersonate` | Returns short-lived JWT (see auth). |

### 6.3 `plans/` (+ `discount/`) — VERIFIED
| Verb | Path | Notes |
|---|---|---|
| GET | `/plans` | `?include_inactive=` |
| GET | `/plans/:id` | Plan detail + tenant list. |
| POST | `/plans` | Create plan. |
| PUT | `/plans/:id` | Full update. |
| PATCH | `/plans/:id` | Partial update. |
| DELETE | `/plans/:id` | **Soft-delete** (sets `is_active=false`). |
| POST | `/plans/:id/toggle` | Flip `is_active`. |
| PATCH | `/plans/:id/featured` | Toggle "featured". |
| PATCH | `/plans/:id/sort` | Reorder. |

Discounts (`/discounts`):
| Verb | Path | Notes |
|---|---|---|
| GET | `/discounts` | `?include_expired=` |
| GET | `/discounts/price/:planId?cycle=monthly\|yearly` | Effective price after best discount. |
| POST | `/discounts` | Create. |
| PATCH | `/discounts/:id` | Update. |

Behavior:
- Daily cron auto-deactivates expired discounts.
- Discount selection logic still has audit item **M2** open (orders by raw `value`, so 50% can beat ₹4000 flat even when flat saves more) — **UNVERIFIED in this pass**.
- `max_uses` enforcement on apply still has audit item **N7** open — **UNVERIFIED**.

### 6.4 `subscription/` — VERIFIED
| Verb | Path | Notes |
|---|---|---|
| GET | `/subscriptions` | Filter by status / tenant / plan. |
| GET | `/subscriptions/expiring?days=7` | Returns flat list (still no pagination — audit **N2**). |
| POST | `/subscriptions` | Cancels existing active sub for the tenant, then creates new. |
| POST | `/subscriptions/:id/cancel` | Cancels and stamps `canceled_at`. |

Cron:
- Daily midnight job sweeps for `end_date <= now`. If `auto_renew`, extends dates. Otherwise expires the sub + sets tenant `EXPIRED`. **Auto-renew still extends without charging (audit C5 open).**

### 6.5 `billing/` — VERIFIED
| Verb | Path | Notes |
|---|---|---|
| GET | `/billing/payments` | Filter by status / tenant / gateway. |
| POST | `/billing/payments` | Record a manual payment. |
| POST | `/billing/payments/:id/retry` | Bumps `retry_count`; max 3. **No gateway SDK call** — audit **H6** still open. |
| POST | `/billing/payments/:id/mark-paid` | Admin override. |
| POST | `/billing/payments/:id/refund` | Status ⇒ `REFUNDED`. |

No idempotency keys on retry / mark-paid / refund (audit **M5** still open).

### 6.6 `feature-flags/` — VERIFIED
| Verb | Path | Notes |
|---|---|---|
| GET | `/feature-flags` | All flags + plan & tenant overrides. |
| GET | `/feature-flags/resolve/:tenantId` | Resolved map: **tenant override > plan override > `is_global`**. Cached in Redis at `ff:<tenantId>`. |
| POST | `/feature-flags` | Create flag. |
| PATCH | `/feature-flags/:id` | Update flag. |
| POST | `/feature-flags/plan` | Set plan-level override. |
| POST | `/feature-flags/tenant` | Set tenant-level override. |

Cache invalidation on writes uses **`SCAN ... MATCH ff:*`** with `COUNT 100`, not `KEYS` — audit **C3** ✅ fixed.

### 6.7 `dashboard/` — VERIFIED
| Verb | Path | Notes |
|---|---|---|
| GET | `/dashboard/metrics` | KPIs. Cached at `dashboard:metrics` for **30 seconds**. |
| POST | `/dashboard/metrics/refresh` | Force clear cache and recompute. |

The metrics payload (also typed on the frontend as `DashboardMetrics`):
```ts
{
  tenants:      { total, active, trial, suspended, new_last_30d },
  subscriptions:{ active, expiring_soon, churned_last_30d },
  revenue:      { mrr, arr, last_30d },
  churn_rate:   number  // % rounded to 2dp
}
```

> **Still has audit item C1** — MRR is computed by `findMany` + `reduce` in JS rather than a SQL `SUM`/`JOIN`. Fine until the active-subscription count grows large.

### 6.8 `analytics/` — VERIFIED
| Verb | Path | Notes |
|---|---|---|
| GET | `/analytics/revenue-trend?months=12` | Monthly chart. |
| GET | `/analytics/plan-distribution` | Tenants per plan + %. |
| GET | `/analytics/growth?months=12` | Signups + cumulative. |
| GET | `/analytics/subscription-breakdown` | Status histogram. |

> Audit items **C2** (N+1 month loop) and **N1** (no caching on analytics) — **UNVERIFIED in this pass**, but no caching code is evident in the controller.

### 6.9 `audit-logs/` — VERIFIED
| Verb | Path | Notes |
|---|---|---|
| GET | `/audit-logs` | Filters: `action`, `entity_type`, `entity_id`, `admin_id`, `from`, `to`, plus pagination. |

`AuditLogsService.log(...)` is also injected by every other module; that's the write path.

### 6.10 `referrals/` — VERIFIED, **proxy module**
This module does **not** touch the SCC DB. It forwards every request to the main MuscleX backend at:
```
${MAIN_APP_API_URL}/api/v1/internal/referrals/*
```
authenticated with header `x-internal-secret: ${INTERNAL_API_SECRET}`. SCC re-validates DTOs first (so the main app never sees garbage from an admin UI).

Endpoints exposed at `/referrals/...`:
| Verb | Path | Purpose |
|---|---|---|
| GET | `/referrals/overview` | Funnel + rewards + wallet + fraud roll-up. |
| GET | `/referrals/analytics/funnel` | Funnel breakdown. |
| GET | `/referrals/analytics/top-referrers` | Leaderboard. |
| GET | `/referrals/analytics/attributed-revenue` | Revenue attribution. |
| GET | `/referrals/analytics/time-to-reward` | Latency distribution. |
| GET | `/referrals/analytics/wallet-aggregates` | Wallet totals. |
| GET | `/referrals/analytics/daily-trend` | Trend chart. |
| GET | `/referrals/fraud-queue` | Pending fraud signals. |
| POST | `/referrals/fraud-signals/:id/review` | Dismiss or confirm fraud (writes admin id into `actor_id`). |
| GET | `/referrals/wallets/:studio_id` | Wallet ledger. |
| POST | `/referrals/wallets/:studio_id/freeze` | Freeze gym wallet (reason required, ≥5 chars). |
| POST | `/referrals/wallets/:studio_id/unfreeze` | Unfreeze. |
| POST | `/referrals/wallets/manual-adjustment` | Credit/debit; reason required. |
| GET | `/referrals/plans` | Pass-through to main app's plan list, for the rule-condition builder. |
| GET | `/referrals/rules` | List reward rules. |
| GET | `/referrals/rules/:id` | Detail. |
| POST | `/referrals/rules` | Create rule (rich nested DTO: conditions + reward actions). |
| PATCH | `/referrals/rules/:id` | Update. |
| DELETE | `/referrals/rules/:id` | Delete / deactivate. |
| GET | `/referrals/campaigns` | List. |
| POST | `/referrals/campaigns` | Create. |

This is consistent with the project memory note that B2B referrals fire on verified payment with auto-clawback.

### 6.11 `health/` — VERIFIED
| Verb | Path | Notes |
|---|---|---|
| GET | `/health` | Public. Pings DB + Redis. |

---

## 7. Cron jobs (current, VERIFIED from code structure)

| Schedule | Where | What |
|---|---|---|
| Daily midnight | `SubscriptionService` | Iterates due subs. Auto-renews (extends dates **without** charging) or expires + flips tenant to `EXPIRED`. |
| Daily | `DiscountService` | Deactivates discounts whose `valid_to` has passed. |

> **No distributed lock** is acquired before cron execution — if two SCC instances run, both will execute the same job (audit item **H4** still open).

---

## 8. Redis keyspace (current)

| Key pattern | Owner | TTL | Purpose |
|---|---|---|---|
| `login_attempts:<email>` | `auth` | 900 s | Lockout counter. |
| `mfa_session:<token>` | `auth` | 300 s | Short-lived "you passed step 1" session. |
| `mfa_pending:<adminId>` | `auth` | 600 s | TOTP secret pending confirmation. |
| `refresh_token:<adminId>` | `auth` | 7 d | The single live refresh token per admin (rotation+revocation). |
| `ff:<tenantId>` | `feature-flags` | 300 s | Resolved flags. Invalidated on flag/plan/tenant override writes via `SCAN`. |
| `dashboard:metrics` | `dashboard` | 30 s | KPI cache. |

---

## 9. Frontend — VERIFIED

### 9.1 Routing
| Route | Purpose |
|---|---|
| `/` | redirect-style index |
| `/login` | email + password, then MFA TOTP / recovery-code step |
| `/forgot-password` | request reset link |
| `/reset-password?token=…` | set new password |
| `/dashboard` | KPIs + revenue chart |
| `/tenants` | paginated tenant grid, search, status filter, add-modal |
| `/call-center` | lookup gym by ID or slug, see plan/subs/payments inline |
| `/plans` | plan cards + form modal |
| `/subscriptions` | filter, cancel |
| `/billing` | payments table + retry / mark-paid / refund |
| `/referrals` | overview |
| `/referrals/rules` | reward-rule builder |
| `/referrals/campaigns` | campaign list/create |
| `/referrals/wallets` | gym wallet console |
| `/referrals/fraud` | fraud queue + review |
| `/feature-flags` | flag list + toggles |
| `/analytics` | charts |
| `/audit-logs` | history |
| `/profile` | admin profile + change password + MFA enable/disable + backup codes |

### 9.2 State & data
- **Zustand `auth-store`** persists `admin`, `access_token`, `refresh_token` in `localStorage`.
- **Axios instance** at `src/lib/api.ts` automatically attaches `Bearer <access_token>`, and on the first 401 hits `/auth/refresh` and retries once. On a second 401 (or refresh failure), it nukes tokens and pushes to `/login`.
- **React Query** (`providers/query-provider.tsx`) wraps the tree. One hook file per domain (`use-tenants.ts`, `use-plans.ts`, etc.).
- **Forms** use `react-hook-form` (e.g. `plan-form-modal.tsx`, `add-tenant-modal.tsx`).
- **Charts** use `recharts` (`components/dashboard/revenue-chart.tsx`).
- **UI primitives** in `components/ui/` are shadcn-style: button, card, dialog, alert-dialog, dropdown-menu, sheet, table, tabs, tooltip, avatar, badge, input, label, select, separator, skeleton, switch.
- **Shared composites**: `confirm-dialog`, `empty-state`, `loading-skeleton`, `status-badge`, `page-header`, `sidebar`, `topbar`, `kpi-card`, `revenue-chart`.

### 9.3 Sidebar nav (source of truth: `components/layout/sidebar.tsx`)
`Dashboard → Tenants → Call Center → Plans → Subscriptions → Billing → Referrals → Feature Flags → Analytics → Audit Logs`. (Profile is reached via topbar, not the sidebar.)

---

## 10. Configuration / env (used by the backend)

| Var | Used in | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma | Postgres URL |
| `PORT` | `main.ts` | default 4000 |
| `API_PREFIX` | `main.ts` | default `api/v1` |
| `CORS_ORIGINS` | `main.ts` | comma-separated list |
| `JWT_SECRET` | `auth` | access token signing |
| `JWT_REFRESH_SECRET` | `auth` | refresh token signing |
| `JWT_REFRESH_EXPIRY` | `auth` | default `7d` |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | `auth` | bootstrap admin on first start |
| `SCC_FRONTEND_URL` | `auth` | used to build reset-password link |
| `MAIN_APP_API_URL` | `referrals` | base for proxy |
| `INTERNAL_API_SECRET` | `referrals` | header `x-internal-secret` |
| Redis connection vars | `config/redis.module.ts` | (verify in that file before deploy) |

---

## 11. Docker setup (`docker/docker-compose.yml`)

- **API** — built from `Dockerfile`, exposed on `4000`.
- **Postgres 16** — exposed on `5433` (host-side) so it doesn't collide with the main app's `5432`. Persistent volume.
- **Redis 7** — exposed on `6380`.
- Postgres password is **hardcoded** in compose (audit item **N5** still open).

---

## 12. Seeded data (`prisma/seed.ts`)

- 1 admin: `admin@musclex.com` (password from `SUPER_ADMIN_PASSWORD`).
- 3 plans: Starter ₹499/mo, Pro ₹1499/mo, Enterprise ₹4999/mo.
- 8 feature flags: `check_in`, `facial_recognition`, `ai_advisor`, `classes`, `marketing`, `multi_branch`, `api_access`, `white_label`.
- 3 sample tenants: Iron Paradise (Pro), FitZone (Trial), MuscleFactory (Enterprise).

---

## 13. Known open issues (from `ARCHITECTURE_AUDIT.md`, re-checked against current code)

Legend: ✅ already addressed in code · ⚠️ partially addressed · ❌ still open · ❓ unverified in this pass.

| ID | Item | Status |
|---|---|---|
| C1 | MRR loads all active subs into memory | ❌ open |
| C2 | Analytics N+1 month loop | ❓ unverified |
| C3 | `redis.keys('ff:*')` blocks Redis | ✅ fixed (now uses `SCAN`) |
| C4 | `changePlan` doesn't cancel old sub | ✅ fixed (transactional `updateMany` cancels old) |
| C5 | Auto-renew without payment verification | ❌ open |
| C6 | Refresh tokens not revocable | ✅ fixed (Redis-backed `refresh_token:<id>`, rotated on use, wiped on password change/reset) |
| C7 | `sort_by` unbounded string | ❓ unverified |
| M1 | Payments not linked to subscription | ✅ fixed (`Payment.subscription_id?` exists) |
| M2 | Discount "best" logic ignores actual savings | ❓ unverified |
| M3 | No `TRIALING` subscription created on tenant create | ✅ fixed (`tenant.service.ts:115-122`) |
| M4 | Impersonation token uses same JWT secret | ❌ open |
| M5 | No idempotency on billing ops | ❌ open |
| M6 | Slug format not validated | ❓ unverified |
| M7 | Audit logs store full DTOs + Prisma objects | ⚠️ still present in `tenant.service.update` |
| M8 | Global exception filter leaks `err.message` | ❓ unverified |
| N1 | Analytics endpoints uncached | ❌ open |
| N2 | `getExpiringSoon` not paginated | ❌ open |
| N3 | `currency` is free-text varchar(3) | ❌ open |
| N4 | Junction tables missing `updated_at` | ❌ open |
| N5 | Docker compose hardcoded creds | ❌ open |
| N6 | No request correlation ID | ❌ open |
| N7 | Discount `max_uses` not enforced on apply | ❓ unverified |
| H1 | Single admin role model (no RBAC) | ❌ open |
| H2 | Audit log growth unbounded (no TTL / partition) | ❌ open |
| H3 | No webhook/event bus to main app | ❌ open |
| H4 | Crons not distributed (no Redis lock) | ❌ open |
| H5 | No graceful degradation on Redis failure | ⚠️ login/MFA paths catch redis errors; dashboard/FF do not |
| H6 | Payment retry has no gateway integration | ❌ open |
| H7 | No soft delete for tenant | ❌ open |

---

## 14. New capabilities added since the audit (not in the original docs)

These are **net-new** modules / features that weren't in `PROJECT_SUMMARY.md`:

1. **MFA with TOTP + 8 bcrypt-hashed recovery codes** (full setup/disable flow on backend + UI in `/profile` and `/login`).
2. **Password reset by email token** (DB-backed `PasswordResetToken`, SHA-256 token hash, 30-min TTL).
3. **Admin profile management** (display name, change password — revokes refresh token).
4. **Refresh-token rotation/revocation** via Redis.
5. **Trialing subscription auto-creation** on tenant create.
6. **Plan-change atomic transaction** that cancels existing active/trialing subs in the same write.
7. **Plan extras** on the controller: `DELETE` (soft delete), `PATCH /:id/featured`, `PATCH /:id/sort`.
8. **Call-center search** route `GET /tenants/search?q=` + dedicated `/call-center` page (tier-1 support workflow).
9. **Referrals module** — full proxy surface for analytics, fraud queue, wallets, manual adjustments, reward rules, campaigns. Backed by the main app's internal API.
10. **Dashboard refresh endpoint** (`POST /dashboard/metrics/refresh`).

---

## 15. Suggested upgrade priorities (carry forward from audit, refreshed)

For your upgrade pass, the highest-leverage targets — in order — are:

1. **Revenue correctness**
   - Fix C1 (MRR via SQL `SUM`/`JOIN` + cache TTL bump).
   - Fix C5 (auto-renew must charge through a real gateway adapter; on failure ⇒ `PAST_DUE`).
   - Fix M5 (idempotency keys on retry/mark-paid/refund).
2. **Admin safety**
   - Implement H1 (`AdminRole` + `RolesGuard`: SUPER, BILLING, SUPPORT).
   - Fix M4 (impersonation: separate signing secret + audience claim).
   - Fix C7 / M6 (sort_by whitelist + slug regex).
3. **Operational resilience**
   - Fix H4 (Redis `SET NX EX` lock around each cron).
   - Fix H5 (degrade gracefully when Redis is down on dashboard + feature-flag paths — they should fall through to DB, not 500).
   - Add **request correlation ID** (N6) and propagate to the main app on referral proxy calls.
4. **Event bridge to main app** (H3)
   - Webhook outbox table + worker. Emit `tenant.suspended`, `plan.changed`, `payment.paid/failed`, `feature.toggled`.
5. **Real billing gateway** (H6) — Razorpay or Stripe SDK behind a `BillingGatewayService`.
6. **Audit hygiene** (M7, H2) — store a real diff, not full objects. Add monthly partitioning + a 12-month archival policy.
7. **Analytics performance** (C2, N1) — one SQL pass per endpoint with `DATE_TRUNC` + GROUP BY; 5–15 min Redis cache.
8. **Soft delete + data retention** (H7) — `deleted_at` on Tenant, replace `onDelete: Cascade` with a guarded delete service.
9. **Currency enum** (N3) + `updated_at` on junction tables (N4) + Docker compose env-var refactor (N5).

---

**Document status.** All "VERIFIED" sections were read directly from source in this pass. All "UNVERIFIED" / "❓" items are claims from the older audit doc that I did not re-confirm — flag them as known unknowns when you scope the upgrade.
