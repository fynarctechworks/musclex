# FitSync Pro — Frontend Module Map

> Maps every backend API domain to its corresponding Next.js 14 pages, components, and stores.
> Generated: 2025-07-11

---

## Architecture Overview

```
Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
Backend:  NestJS 10 + Prisma 5 + PostgreSQL (Supabase)
Pattern:  /[gymSlug]/module/ → api/v1/module/
Auth:     JWT Bearer tokens, Supabase Auth
```

---

## Route Structure

```
src/app/
├── page.tsx                          # Landing redirect
├── login/page.tsx                    # Login
├── forgot-password/page.tsx          # Password reset
├── onboarding/                       # 4 pages (plans, setup, verify)
├── auth/callback/page.tsx            # OAuth callback
├── landing/                          # Marketing landing page
└── [gymSlug]/                        # ← All authenticated routes
    ├── layout.tsx                    # AppLayout (sidebar + topbar)
    ├── dashboard/                    # KPIs, charts, alerts
    ├── members/                      # Member CRUD + details
    ├── check-in/                     # QR, manual, facial
    ├── finance/                      # Payments + expenses
    ├── classes/                      # Class management
    ├── schedule/                     # Calendar view
    ├── staff/                        # Staff + trainers
    ├── marketing/                    # Campaigns + automation
    ├── ai/                           # AI advisor + briefing
    ├── branches/                     # Branch management
    └── settings/                     # Studio settings
```

---

## Module-by-Module Mapping

### 1. Auth & Onboarding

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/login` | `POST api/v1/auth/login` | ✅ Built |
| `/forgot-password` | `POST api/v1/auth/forgot-password`, `POST api/v1/auth/reset-password` | ✅ Built |
| `/onboarding` | `POST api/v1/auth/register` | ✅ Built |
| `/onboarding/verify` | `POST api/v1/auth/verify-email`, `POST api/v1/auth/resend-verification` | ✅ Built |
| `/onboarding/plans` | `GET api/v1/auth/plans`, `POST api/v1/auth/select-plan` | ✅ Built |
| `/onboarding/setup` | `POST api/v1/auth/setup-studio` | ✅ Built |
| `/auth/callback` | `POST api/v1/auth/refresh` | ✅ Built |

**Backend controllers:** `auth.controller.ts` (13 endpoints), `auth-session.controller.ts` (13), `auth-sso.controller.ts` (6), `auth-api-key.controller.ts` (7)
**Total: 39 auth endpoints**

---

### 2. Dashboard

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/dashboard` | `GET api/v1/dashboard/kpis` | ✅ Built |
| | `GET api/v1/dashboard/revenue-chart` | ✅ Built |
| | `GET api/v1/dashboard/activity-feed` | ✅ Built |
| | `GET api/v1/dashboard/alerts` | ✅ Built |
| `/[gymSlug]/dashboard/branches` | `GET api/v1/dashboard/branch-comparison` | ✅ Built |

**Backend controllers:** `dashboard.controller.ts` (5 endpoints)
**Components needed:** KPICard, revenue chart (Recharts), activity feed list, alerts panel

---

### 3. Members

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/members` | `GET api/v1/members` (list + filters) | ✅ Built |
| `/[gymSlug]/members/new` | `POST api/v1/members` | ✅ Built |
| `/[gymSlug]/members/[id]` | `GET api/v1/members/:id` (profile, body-stats, visits, notes, tags, docs) | ✅ Built |
| `/[gymSlug]/members/[id]/edit` | `PATCH api/v1/members/:id` | ✅ Built |
| `/[gymSlug]/members/churn-risk` | `GET api/v1/members/churn-risk` | ✅ Built |

**Backend controllers:** `members.controller.ts` (32), `plans.controller.ts` (6), `memberships.controller.ts` (12), `member-visits.controller.ts` (3), `family.controller.ts` (5), `corporate.controller.ts` (7)
**Total: 65 member endpoints**
**Components needed:** DataTable, StatusBadge, member profile cards, membership timeline

---

### 4. Check-in

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/check-in` | `GET api/v1/check-ins` (list) | ✅ Built |
| `/[gymSlug]/check-in/qr` | `POST api/v1/check-ins` (method: qr) | ✅ Built |
| `/[gymSlug]/check-in/manual` | `POST api/v1/check-ins` (method: manual) | ✅ Built |
| `/[gymSlug]/check-in/facial` | `POST api/v1/check-ins/facial` | ✅ Built |
| `/[gymSlug]/check-in/history` | `GET api/v1/check-ins`, `GET api/v1/check-ins/heatmap` | ✅ Built |

**Backend controllers:** `check-ins.controller.ts` (5 endpoints)
**Components needed:** QR scanner (html5-qrcode), camera feed (face-api.js), heatmap chart

---

### 5. Finance (Payments & Expenses)

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/finance` | `GET api/v1/financial-reports/dashboard` | ✅ Built |
| `/[gymSlug]/finance/payments` | `GET api/v1/payments` | ✅ Built |
| `/[gymSlug]/finance/payments/new` | `POST api/v1/payments/cash`, `POST api/v1/payments/create-order` | ✅ Built |
| `/[gymSlug]/finance/expenses/new` | `POST api/v1/expenses` | ✅ Built |

**Backend controllers:** `payments.controller.ts` (5), `expenses.controller.ts` (4), `invoices.controller.ts` (5), `refunds.controller.ts` (3), `discounts.controller.ts` (11), `reports.controller.ts` (5)
**Total: 33 payment endpoints**
**Components needed:** Payment forms, invoice PDF (@react-pdf/renderer), financial charts

---

### 6. Classes & Schedule

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/schedule` | `GET api/v1/classes/sessions` (calendar view) | ✅ Built |
| `/[gymSlug]/classes/new` | `POST api/v1/classes` | ✅ Built |
| `/[gymSlug]/classes/[id]` | `GET api/v1/classes/:id`, bookings, attendance | ✅ Built |

**Backend controllers:** `classes.controller.ts` (7), `class-template.controller.ts` (5), `session.controller.ts` (15), `booking.controller.ts` (11)
**Total: 38 class endpoints**
**Components needed:** FullCalendar, class cards, booking/waitlist management

---

### 7. Staff

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/staff` | `GET api/v1/staff` | ✅ Built |
| `/[gymSlug]/staff/new` | `POST api/v1/staff` | ✅ Built |
| `/[gymSlug]/staff/[id]` | `GET api/v1/staff/:id`, profile, attendance, shifts, leaves | ✅ Built |
| `/[gymSlug]/staff/analytics` | `GET api/v1/trainer/performance`, `GET api/v1/payroll/summary` | ✅ Built |

**Backend controllers:** `staff.controller.ts` (20), `trainer.controller.ts` (10), `payroll.controller.ts` (7)
**Total: 37 staff endpoints**
**Components needed:** Staff DataTable, shift calendar, leave request forms, trainer performance charts

---

### 8. Marketing

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/marketing` | `GET api/v1/campaigns`, `GET api/v1/leads` | ✅ Built |
| `/[gymSlug]/marketing/campaigns/new` | `POST api/v1/campaigns` | ✅ Built |
| `/[gymSlug]/marketing/automation` | `GET/POST api/v1/workflows`, `GET/POST api/v1/message-templates` | ✅ Built |

**Backend controllers:** `marketing.controller.ts` (9), `leads.controller.ts` (7), `automation.controller.ts` (20)
**Total: 36 marketing endpoints**
**Components needed:** Campaign builder, lead funnel, automation flow editor, template editor

---

### 9. AI Advisor

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/ai` | `POST api/v1/ai/chat`, `GET api/v1/ai/conversations` | ✅ Built |
| `/[gymSlug]/ai/briefing` | `GET api/v1/ai/daily-briefing` | ✅ Built |

**Backend controllers:** `ai.controller.ts` (3 endpoints)
**Components needed:** Chat interface, briefing card, conversation history

---

### 10. Branches

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/branches` | `GET api/v1/branches` | ✅ Built |

**Backend controllers:** `branches.controller.ts` (7 endpoints)
**Components needed:** Branch cards, branch settings form

---

### 11. Settings

| Frontend Page | Backend Endpoints | Status |
|--------------|-------------------|--------|
| `/[gymSlug]/settings` | `GET/PATCH api/v1/settings/studio` | ✅ Built |
| `/[gymSlug]/settings/account` | `GET/PATCH api/v1/settings/account` | ✅ Built |
| `/[gymSlug]/settings/plans` | `GET api/v1/settings/plans` | ✅ Built |
| `/[gymSlug]/settings/roles` | `GET/POST api/v1/roles` | ✅ Built |
| `/[gymSlug]/settings/integrations` | `GET api/v1/integrations` | ✅ Built |
| `/[gymSlug]/settings/subscription` | `GET api/v1/settings/invoices` | ✅ Built |

**Backend controllers:** `settings.controller.ts` (6), `roles.controller.ts` (6)
**Components needed:** Settings forms, role permission matrix, integration cards

---

## Backend-Only Modules (No Dedicated Frontend Page)

These backend modules serve data to other pages or handle background operations:

| Module | Endpoints | Consumed By |
|--------|-----------|-------------|
| **Analytics** | 18 endpoints | Dashboard, Staff Analytics, Reports |
| **Inventory** | 29 endpoints | Future POS page (Phase 2) |
| **Organization** | 20 endpoints | Settings, Branch management |
| **Platform** | 37 endpoints | Settings/Integrations, Admin panel |
| **Queue** | 0 (internal) | Email, webhooks, notifications |
| **Search** | 2 endpoints | Global search bar (all pages) |
| **Compliance** | 8 endpoints | Settings/Privacy (Phase 2) |
| **Audit** | 3 endpoints | Settings/Activity Log |

---

## Shared Components Matrix

| Component | Used By Pages |
|-----------|--------------|
| **AppLayout** | All `/[gymSlug]/*` pages |
| **DataTable** | Members, Staff, Payments, Classes, Marketing, Audit |
| **StatusBadge** | Members (Active/Expired/Frozen), Payments, Classes |
| **KPICard** | Dashboard, Finance, Staff Analytics |
| **ConfirmDialog** | All delete/destructive actions |
| **EmptyState** | All list pages when no data |
| **LoadingSkeleton** | All pages during loading |
| **FormFields** | All create/edit forms |

---

## Frontend Stores (Zustand)

| Store | Purpose | Endpoints Used |
|-------|---------|---------------|
| **auth-store.ts** | JWT tokens, user info, gym slug | `api/v1/auth/*` |
| *(planned)* member-store | Member list cache | `api/v1/members` |
| *(planned)* ui-store | Sidebar state, theme | Client-only |

---

## API Client Configuration

```
src/lib/api.ts       → Axios instance with JWT interceptor, base URL
src/lib/supabase.ts  → Supabase client for auth + storage
src/lib/types.ts     → Shared TypeScript interfaces
src/lib/utils.ts     → cn() helper, formatters
src/lib/hooks/       → useGymSlug() custom hook
```

---

## Summary

| Metric | Count |
|--------|-------|
| Backend Modules | **22** |
| Backend Controllers | **47** |
| API Endpoints | **~398** |
| Prisma Models | **108** |
| Frontend Pages | **~37** |
| Frontend Components | **27** (15 ui + 7 shared + 5 other) |
| Route Groups | **11** gym-scoped + 4 public |
| Zustand Stores | **1** (auth) |
