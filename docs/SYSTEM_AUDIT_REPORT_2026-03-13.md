# System Architecture & Feature Audit Report

**Date:** March 13, 2026  
**Prepared by:** Architecture Review Board  
**Project:** FitSync Pro — AI-Powered Gym Management SaaS Platform  
**Version:** 1.0 (Pre-Production)

---

## Table of Contents

1. [Project Overview](#section-1--project-overview)
2. [Tech Stack Detection](#section-2--tech-stack-detection)
3. [Full Project Folder Structure](#section-3--full-project-folder-structure)
4. [Feature Inventory](#section-4--feature-inventory)
5. [Complete User Flows](#section-5--complete-user-flows)
6. [Database Audit](#section-6--database-audit)
7. [Schema Relationship Map](#section-7--schema-relationship-map)
8. [API Endpoint Documentation](#section-8--api-endpoint-documentation)
9. [Security Audit](#section-9--security-audit)
10. [Performance Audit](#section-10--performance-audit)
11. [SaaS Multi-Tenant Readiness](#section-11--saas-multi-tenant-readiness)
12. [Code Quality Review](#section-12--code-quality-review)
13. [Missing Features](#section-13--missing-features)
14. [Scalability Review](#section-14--scalability-review)
15. [Architecture Diagram](#section-15--architecture-diagram-text-based)
16. [Final System Summary](#section-16--final-system-summary)

---

# SECTION 1 — PROJECT OVERVIEW

## What This System Is

FitSync Pro is a cloud-native, multi-tenant SaaS platform designed as an all-in-one operating system for fitness studio owners. It replaces fragmented tools (spreadsheets, WhatsApp groups, paper registers) with a single intelligent management platform.

## Core Product Purpose

Provide gym and fitness studio owners with a comprehensive digital platform to manage members, track attendance, process payments, schedule classes, manage staff, run marketing campaigns, and receive AI-powered business intelligence — all from one dashboard.

## Target Users

| User Role | Description |
|-----------|-------------|
| **Studio Owner** | Primary decision maker; full administrative access across all branches |
| **Manager** | Day-to-day operations; most permissions except destructive actions |
| **Trainer** | Class management, member interactions, personal schedule |
| **Front Desk** | Check-ins, member registration, payment collection |

## High-Level Product Concept

FitSync Pro operates as a B2B SaaS product with tiered pricing (Free → Starter → Pro → Enterprise). Each subscribing studio receives an isolated data environment (PostgreSQL schema-per-tenant). The platform encompasses 11 functional modules: Authentication, Member Management, Check-in System (QR/Facial/Manual), Payments & Finance, Dashboard Analytics, Class Scheduling, Staff Management, Marketing Campaigns, AI Business Advisor, Branch Management, and Settings/Configuration.

---

# SECTION 2 — TECH STACK DETECTION

## Frontend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | Next.js (App Router) | 14.2.35 | Server & client rendering, file-based routing |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.4.x | Utility-first CSS |
| Component Library | shadcn/ui + Radix UI | Latest | Pre-built accessible UI primitives |
| State Management | Zustand | 5.0.x | Global auth state with localStorage persistence |
| Data Fetching | @tanstack/react-query | 5.90.x | Server state caching, refetching, mutations |
| Forms | react-hook-form | 7.71.x | Performant form management |
| Charts | Recharts | 3.8.x | Dashboard visualizations |
| Tables | @tanstack/react-table | 8.21.x | Advanced table with sorting, filtering, pagination |
| Icons | lucide-react | 0.577.x | Consistent iconography |
| Toasts | sonner | 2.0.x | Notification toasts |
| QR Scanning | html5-qrcode | 2.3.x | Camera-based QR code reader |
| Date Handling | date-fns | 4.1.x | Date formatting & manipulation |
| Schema Validation | zod | 4.3.x | Runtime type validation |
| Auth Client | @supabase/supabase-js | 2.99.x | Direct Supabase auth (signup, verify, OAuth) |

**How it works:** Next.js 14 App Router serves all pages as client components (`"use client"`). Dynamic routing via `[gymSlug]` parameter places all authenticated pages under `/{studio-slug}/...`. React Query handles all API communication with automatic caching and background refetching. Zustand persists auth state (user, studio, tokens) to localStorage with a companion `auth-token` cookie for middleware-level route protection.

## Backend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | NestJS | 10.x | Modular API server with dependency injection |
| Language | TypeScript | 5.x | Type safety |
| ORM | Prisma Client | 5.22.x | Type-safe database queries |
| Validation | class-validator + class-transformer | 0.15.x + 0.5.x | DTO validation with decorators |
| Auth | Supabase Auth (via @supabase/supabase-js) | 2.99.x | JWT issuance, user management, password reset |
| Rate Limiting | @nestjs/throttler | 6.5.x | Global request throttling (2-tier) |
| Security Headers | helmet | 8.1.x | XSS/clickjacking/MIME protection |
| WebSockets | @nestjs/websockets + socket.io | 10.x + 4.8.x | Real-time capability (not yet wired) |
| Job Queues | @nestjs/bullmq + bullmq | 11.x + 5.70.x | Background task processing (declared, not used) |
| Scheduling | @nestjs/schedule | 6.1.x | Cron jobs (declared, not implemented) |
| Email | resend | 6.9.x | Transactional email delivery |

**How it works:** NestJS modular architecture with 14 feature modules. Each module has its own controller (routes), service (business logic), and DTOs (validation). A global `JwtAuthGuard` validates all protected routes by calling Supabase's `auth.getUser()`. Multi-tenancy is enforced via `TenantMiddleware` that sets the PostgreSQL `search_path` to the studio's dedicated schema before every database query.

## Database

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Engine | PostgreSQL (via Supabase) | Primary data store |
| Multi-Tenancy | Schema-per-tenant | Data isolation via `studio_{uuid}` schemas |
| Public Schema | Cross-tenant data | Studios registry, subscription plans, invoices, pending registrations |
| Template Schema | `studio_template` | Cloned for each new tenant at onboarding |
| Migrations | Raw SQL (Supabase CLI) | Single migration file |

## Infrastructure Assumptions

| Aspect | Technology | Notes |
|--------|-----------|-------|
| Database Hosting | Supabase | Managed PostgreSQL + Auth + Storage |
| Frontend Hosting | Vercel (planned) | Not yet deployed |
| Backend Hosting | Railway (planned) | Not yet deployed |
| Redis | Upstash (planned) | Referenced in TRD but not configured |
| Monitoring | Sentry + PostHog (planned) | Not integrated |

## API Architecture

REST API with consistent conventions:
- **Base path:** `/api/v1/`
- **Auth:** Bearer JWT tokens via Supabase
- **Validation:** Global ValidationPipe with whitelist + forbidNonWhitelisted
- **Rate limiting:** 10 req/sec (short burst), 100 req/min (sustained)
- **Request size:** 1MB max for JSON/URL-encoded bodies
- **CORS:** Configurable via `CORS_ORIGINS` environment variable

---

# SECTION 3 — FULL PROJECT FOLDER STRUCTURE

```
fitsync-pro/
├── CLAUDE.md                          # Project instructions & conventions
├── docs/                              # Documentation
│   ├── PRD_v1.0.md                    # Product Requirements Document
│   ├── TRD_v1.0.md                    # Technical Requirements Document
│   ├── alignment-report.md            # Screen vs. TRD mismatches
│   ├── SCREEN_MAP.md                  # PNG filename → screen ID mapping
│   ├── code-audit.md                  # Previous audit
│   ├── database-audit.md              # Previous DB audit
│   ├── security-audit.md              # Previous security review
│   ├── system-architecture.md         # Architecture overview
│   ├── testing-scenarios.md           # Test plans
│   ├── user-flows.md                  # User journey documentation
│   └── screens/                       # Figma PNG exports
│       ├── ai/                        # AI advisor screen mockups
│       ├── auth/                      # Login/signup screens
│       ├── checkins/                  # Check-in screens
│       ├── classes/                   # Class scheduling screens
│       ├── dashboard/                 # Dashboard screens
│       ├── finance/                   # Payment/expense screens
│       ├── marketing/                 # Campaign screens
│       ├── members/                   # Member management screens
│       ├── settings/                  # Settings screens
│       └── staff/                     # Staff management screens
├── tasks/
│   ├── todo.md                        # Build plan with checkboxes
│   └── lessons.md                     # Lessons learned log
├── backend/
│   ├── package.json                   # NestJS dependencies
│   ├── nest-cli.json                  # NestJS CLI config
│   ├── tsconfig.json                  # TypeScript config
│   ├── tsconfig.build.json            # Build-specific TS config
│   ├── prisma/
│   │   └── schema.prisma             # Complete database schema (public + studio_template)
│   ├── supabase/
│   │   └── migrations/
│   │       └── 20240101000000_initial_schema.sql  # Single migration file
│   ├── src/
│   │   ├── main.ts                    # Bootstrap: Helmet, CORS, ValidationPipe, port 4000
│   │   ├── app.module.ts             # Root module: 14 feature modules + ThrottlerGuard
│   │   ├── app.controller.ts         # Health check endpoint
│   │   ├── app.service.ts            # App-level service
│   │   ├── auth/                      # Authentication & Onboarding
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts    # 12 endpoints (register, verify, login, logout, etc.)
│   │   │   ├── auth.service.ts       # Supabase auth, rate limiting, schema creation
│   │   │   └── dto/                   # LoginDto, RegisterDto, SetupStudioDto, etc.
│   │   ├── members/                   # Member Management
│   │   │   ├── members.module.ts
│   │   │   ├── members.controller.ts # 8 endpoints (CRUD, freeze, renew, face descriptor)
│   │   │   ├── members.service.ts
│   │   │   ├── plans.controller.ts   # 5 endpoints (membership plan CRUD)
│   │   │   ├── plans.service.ts
│   │   │   └── dto/                   # CreateMemberDto, FreezeMemberDto, etc.
│   │   ├── check-ins/                 # Check-in System
│   │   │   ├── check-ins.module.ts
│   │   │   ├── check-ins.controller.ts # 5 endpoints (create, facial, sync, list, heatmap)
│   │   │   └── check-ins.service.ts   # QR, facial recognition, offline sync
│   │   ├── payments/                  # Payments & Expenses
│   │   │   ├── payments.module.ts
│   │   │   ├── payments.controller.ts # 5 endpoints (cash, create-order, verify, list, invoice)
│   │   │   ├── payments.service.ts
│   │   │   ├── expenses.controller.ts # 4 endpoints (CRUD)
│   │   │   └── expenses.service.ts
│   │   ├── dashboard/                 # Dashboard Analytics
│   │   │   ├── dashboard.module.ts
│   │   │   ├── dashboard.controller.ts # 5 endpoints (KPIs, revenue, activity, alerts, branches)
│   │   │   └── dashboard.service.ts
│   │   ├── classes/                   # Class Scheduling
│   │   │   ├── classes.module.ts
│   │   │   ├── classes.controller.ts  # 7 endpoints (CRUD, enroll, cancel, waitlist)
│   │   │   └── classes.service.ts     # Trainer conflict detection, waitlist management
│   │   ├── staff/                     # Staff Management
│   │   │   ├── staff.module.ts
│   │   │   ├── staff.controller.ts    # 5 endpoints (CRUD, trainer performance)
│   │   │   ├── staff.service.ts       # Salary stripping for non-owners
│   │   │   └── dto/
│   │   ├── marketing/                 # Marketing Campaigns
│   │   │   ├── marketing.module.ts
│   │   │   ├── marketing.controller.ts # 6 endpoints (CRUD, send)
│   │   │   ├── marketing.service.ts   # Segment targeting logic
│   │   │   └── dto/
│   │   ├── ai/                        # AI Business Advisor
│   │   │   ├── ai.module.ts
│   │   │   ├── ai.controller.ts       # 3 endpoints (chat, briefing, conversations)
│   │   │   └── ai.service.ts          # Mock responses (Claude API not integrated)
│   │   ├── branches/                  # Branch Management
│   │   │   ├── branches.module.ts
│   │   │   ├── branches.controller.ts # 5 endpoints (CRUD, deactivate)
│   │   │   ├── branches.service.ts
│   │   │   └── dto/
│   │   ├── dashboard/                 # Dashboard Module (listed above)
│   │   ├── prisma/                    # Database Connection
│   │   │   ├── prisma.module.ts       # Global module exporting PrismaService
│   │   │   └── prisma.service.ts      # PrismaClient with connection timeout
│   │   └── common/                    # Shared Infrastructure
│   │       ├── index.ts               # Central export barrel
│   │       ├── guards/
│   │       │   ├── jwt-auth.guard.ts  # Supabase JWT validation
│   │       │   ├── roles.guard.ts     # Role-based access (owner, manager, etc.)
│   │       │   ├── permissions.guard.ts # Module+action permission check
│   │       │   ├── branch-access.guard.ts # Branch isolation guard
│   │       │   └── default-permissions.ts # 4-role permission matrix
│   │       ├── middleware/
│   │       │   └── tenant.middleware.ts # PostgreSQL search_path setter
│   │       ├── decorators/
│   │       │   ├── current-user.decorator.ts # @CurrentUser() param decorator
│   │       │   ├── roles.decorator.ts  # @Roles() method decorator
│   │       │   └── permissions.decorator.ts # @Permissions() method decorator
│   │       └── plan-configs.ts        # Subscription tier definitions (free/starter/pro/enterprise)
│   └── test/
│       ├── app.e2e-spec.ts            # E2E test skeleton
│       └── jest-e2e.json              # Jest E2E config
└── frontend/
    ├── package.json                   # Next.js 14 dependencies
    ├── next.config.mjs                # Next.js config
    ├── tailwind.config.ts             # Tailwind config with custom theme
    ├── tsconfig.json                  # TypeScript config
    ├── components.json                # shadcn/ui config
    ├── postcss.config.mjs             # PostCSS config
    └── src/
        ├── middleware.ts              # Route protection (auth-token cookie check)
        ├── app/
        │   ├── page.tsx               # Landing page
        │   ├── layout.tsx             # Root layout (providers, fonts, metadata)
        │   ├── globals.css            # Global styles + Tailwind directives
        │   ├── login/page.tsx         # Login form with JWT flow
        │   ├── forgot-password/page.tsx # Password reset request
        │   ├── auth/callback/page.tsx # OAuth/magic link callback handler
        │   ├── onboarding/
        │   │   ├── page.tsx           # Registration (Supabase signUp)
        │   │   ├── verify/page.tsx    # Email verification with resend
        │   │   ├── plans/page.tsx     # Subscription plan selection
        │   │   ├── setup/page.tsx     # Studio creation (name, branch, timezone)
        │   │   └── layout.tsx         # Onboarding step indicator layout
        │   └── [gymSlug]/             # All authenticated routes
        │       ├── layout.tsx         # Auth guard + slug validation
        │       ├── dashboard/
        │       │   ├── page.tsx       # KPIs, revenue chart, activity feed, alerts
        │       │   └── branches/page.tsx # Cross-branch comparison
        │       ├── members/
        │       │   ├── page.tsx       # Members list with search/filter
        │       │   ├── new/page.tsx   # Add member form
        │       │   ├── churn-risk/page.tsx # At-risk member analysis
        │       │   └── [id]/
        │       │       ├── page.tsx   # Member profile (tabs, actions)
        │       │       └── edit/page.tsx # Edit member form
        │       ├── check-in/
        │       │   ├── page.tsx       # Check-in method selector hub
        │       │   ├── qr/page.tsx    # QR scanner (html5-qrcode)
        │       │   ├── manual/page.tsx # Manual search + check-in
        │       │   ├── facial/page.tsx # Facial recognition check-in
        │       │   └── history/page.tsx # Check-in log with filters
        │       ├── schedule/
        │       │   └── page.tsx       # Weekly class calendar
        │       ├── classes/
        │       │   ├── new/page.tsx   # Create class form
        │       │   └── [id]/page.tsx  # Class detail + roster
        │       ├── finance/
        │       │   ├── page.tsx       # Finance overview (KPIs + transactions)
        │       │   ├── payments/
        │       │   │   ├── page.tsx   # Payments list
        │       │   │   └── new/page.tsx # Record payment
        │       │   └── expenses/
        │       │       └── new/page.tsx # Record expense
        │       ├── staff/
        │       │   ├── page.tsx       # Staff directory
        │       │   ├── new/page.tsx   # Add staff form
        │       │   ├── analytics/page.tsx # Trainer performance
        │       │   └── [id]/page.tsx  # Staff profile
        │       ├── marketing/
        │       │   ├── page.tsx       # Campaigns list
        │       │   ├── campaigns/new/page.tsx # Create campaign
        │       │   └── automation/page.tsx # Automation rules
        │       ├── ai/
        │       │   ├── page.tsx       # AI chat interface
        │       │   └── briefing/page.tsx # Daily AI briefing
        │       ├── settings/
        │       │   ├── page.tsx       # Settings overview
        │       │   ├── account/page.tsx # Studio account details
        │       │   ├── plans/page.tsx  # Membership plan management
        │       │   ├── roles/page.tsx  # Custom role builder
        │       │   ├── integrations/page.tsx # External service connections
        │       │   └── subscription/page.tsx # Subscription management
        │       └── branches/
        │           └── page.tsx       # Branch management
        ├── components/
        │   ├── providers.tsx          # React Query + Theme + Toast providers
        │   ├── theme-toggle.tsx       # Dark/light mode switch
        │   ├── layout/
        │   │   └── app-layout.tsx     # Main shell: sidebar + top bar + mobile drawer
        │   ├── onboarding/
        │   │   └── onboarding-layout.tsx # Step indicator layout
        │   ├── auth/
        │   │   └── protected-route.tsx # Auth guard component wrapper
        │   ├── shared/
        │   │   ├── data-table.tsx     # TanStack table wrapper with search/filter/pagination
        │   │   ├── status-badge.tsx   # Status indicator (active/expiring/expired/frozen)
        │   │   ├── kpi-card.tsx       # Metric card with trend arrow
        │   │   ├── confirm-dialog.tsx # Confirmation modal
        │   │   ├── empty-state.tsx    # "No data" placeholder
        │   │   ├── loading-skeleton.tsx # Shimmer loading variants
        │   │   └── form-fields.tsx    # FormInput, FormSelect, FormTextarea, FormDatePicker
        │   └── ui/                    # shadcn/ui base components (15 components)
        │       ├── avatar.tsx, badge.tsx, button.tsx, dialog.tsx
        │       ├── dropdown-menu.tsx, input.tsx, popover.tsx
        │       ├── scroll-area.tsx, select.tsx, separator.tsx
        │       ├── sheet.tsx, table.tsx, tabs.tsx, textarea.tsx
        │       └── tooltip.tsx
        ├── stores/
        │   └── auth-store.ts          # Zustand: user, studio, tokens, permissions
        └── lib/
            ├── api.ts                 # Fetch wrapper with auto-refresh on 401
            ├── types.ts               # 20+ TypeScript interfaces
            ├── utils.ts               # cn() class merger
            ├── supabase.ts            # Supabase client initialization
            └── hooks/
                └── use-gym-slug.ts    # useGymSlug() hook for dynamic routing
```

### Folder Purpose Summary

| Folder | Role in System |
|--------|---------------|
| `backend/src/auth/` | Authentication, registration, email verification, JWT management, studio onboarding |
| `backend/src/members/` | Member CRUD, membership lifecycle (freeze/renew), facial recognition data, churn risk |
| `backend/src/check-ins/` | QR/manual/facial check-in processing, offline sync, attendance heatmaps |
| `backend/src/payments/` | Cash recording, payment gateway integration (Razorpay/Stripe), invoicing |
| `backend/src/dashboard/` | KPI aggregation, revenue charts, activity feeds, branch comparison analytics |
| `backend/src/classes/` | Class CRUD, trainer conflict validation, enrollment with waitlist management |
| `backend/src/staff/` | Staff directory, role assignment, salary protection, trainer performance scoring |
| `backend/src/marketing/` | Campaign creation, audience segmentation, multi-channel delivery |
| `backend/src/ai/` | AI chat interface, daily briefing, conversation persistence |
| `backend/src/branches/` | Multi-branch CRUD, branch-scoped data access control |
| `backend/src/common/` | Guards (JWT, Roles, Permissions, Branch), decorators, tenant middleware, permission matrix |
| `backend/src/prisma/` | Global database service (PrismaClient singleton) |
| `frontend/src/app/[gymSlug]/` | All authenticated routes scoped to a studio's URL slug |
| `frontend/src/components/shared/` | Reusable presentation components (DataTable, StatusBadge, KPICard, etc.) |
| `frontend/src/stores/` | Client-side global state (auth, tokens, RBAC permissions) |
| `frontend/src/lib/` | API client, type definitions, utility functions |

---

# SECTION 4 — FEATURE INVENTORY

### 4.1 User Authentication & Onboarding

**Description:** Multi-step registration with email verification, plan selection, and studio setup. Login with JWT-based sessions, password reset, and auto-refresh.

**Frontend Files:**
- `app/onboarding/page.tsx` — Registration form (Supabase signUp)
- `app/onboarding/verify/page.tsx` — Email verification with 60s resend cooldown
- `app/onboarding/plans/page.tsx` — Subscription tier selection
- `app/onboarding/setup/page.tsx` — Studio + branch creation
- `app/login/page.tsx` — Login form
- `app/forgot-password/page.tsx` — Password reset request
- `app/auth/callback/page.tsx` — OAuth callback handler

**Backend Files:**
- `auth/auth.controller.ts` — 12 endpoints
- `auth/auth.service.ts` — Supabase auth integration, schema cloning, rate limiting

**Database Tables:** `studios`, `pending_registrations`, `email_verifications`, `subscription_plans`

**API Routes:**
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/auth/plans`
- `POST /api/v1/auth/select-plan`
- `POST /api/v1/auth/setup-studio`

---

### 4.2 Member Management

**Description:** Full CRUD for gym members, membership lifecycle management (freeze/renew), churn risk analysis, facial recognition descriptor storage, and member code generation (FS-YYYYMMDD-XXXX).

**Frontend Files:**
- `[gymSlug]/members/page.tsx` — Member list with search, status filter, branch filter, pagination
- `[gymSlug]/members/new/page.tsx` — Add member with plan assignment
- `[gymSlug]/members/[id]/page.tsx` — Profile with tabs (overview, memberships, payments, check-ins)
- `[gymSlug]/members/[id]/edit/page.tsx` — Edit member details
- `[gymSlug]/members/churn-risk/page.tsx` — At-risk member analysis with engagement scores

**Backend Files:**
- `members/members.controller.ts` — 8 endpoints
- `members/members.service.ts` — Member CRUD, freeze/renew logic, face descriptor storage
- `members/plans.controller.ts` — 5 endpoints
- `members/plans.service.ts` — Membership plan CRUD

**Database Tables:** `members`, `member_memberships`, `membership_plans`

**API Routes:**
- `GET /api/v1/members` (paginated, filterable)
- `POST /api/v1/members`
- `GET /api/v1/members/:id`
- `PATCH /api/v1/members/:id`
- `POST /api/v1/members/:id/freeze`
- `POST /api/v1/members/:id/renew`
- `POST /api/v1/members/:id/face-descriptor`
- `GET /api/v1/members/churn-risk`
- `GET/POST/PATCH/DELETE /api/v1/membership-plans`

---

### 4.3 Check-in System

**Description:** Multi-method attendance tracking. QR code scanning via camera, manual member search, facial recognition (on-device via face-api.js), offline sync for connectivity issues, and attendance heatmap analytics.

**Frontend Files:**
- `[gymSlug]/check-in/page.tsx` — Method selector hub (4 cards: QR, RFID-disabled, Face, Manual)
- `[gymSlug]/check-in/qr/page.tsx` — Camera-based QR scanner (html5-qrcode library)
- `[gymSlug]/check-in/manual/page.tsx` — Member search + one-click check-in
- `[gymSlug]/check-in/facial/page.tsx` — Face recognition check-in (face-api.js)
- `[gymSlug]/check-in/history/page.tsx` — Check-in log with date range filter

**Backend Files:**
- `check-ins/check-ins.controller.ts` — 5 endpoints
- `check-ins/check-ins.service.ts` — QR resolution, membership validation, facial matching (Euclidean distance < 0.5), offline batch sync, heatmap aggregation

**Database Tables:** `check_ins`, `members`, `member_memberships`

**API Routes:**
- `POST /api/v1/check-ins` (QR/manual)
- `POST /api/v1/check-ins/facial`
- `POST /api/v1/check-ins/sync`
- `GET /api/v1/check-ins` (paginated, filterable)
- `GET /api/v1/check-ins/heatmap`

---

### 4.4 Payments & Finance

**Description:** Cash payment recording, payment gateway order creation (Razorpay/Stripe), payment verification, expense tracking, invoice generation with auto-generated receipt numbers (RCP-YYYYMMDD-XXXX).

**Frontend Files:**
- `[gymSlug]/finance/page.tsx` — Financial overview with KPIs (revenue, pending, expenses, profit)
- `[gymSlug]/finance/payments/page.tsx` — Payments list with status filters
- `[gymSlug]/finance/payments/new/page.tsx` — Record new payment (member search + plan + amount + method)
- `[gymSlug]/finance/expenses/new/page.tsx` — Record expense (category + description + amount)

**Backend Files:**
- `payments/payments.controller.ts` — 5 endpoints
- `payments/payments.service.ts` — Cash recording, gateway order creation, payment verification
- `payments/expenses.controller.ts` — 4 endpoints
- `payments/expenses.service.ts` — Expense CRUD

**Database Tables:** `payments`, `expenses`, `member_memberships`, `membership_plans`

**API Routes:**
- `POST /api/v1/payments/cash`
- `POST /api/v1/payments/create-order`
- `POST /api/v1/payments/verify`
- `GET /api/v1/payments` (paginated)
- `GET /api/v1/payments/:id/invoice`
- `POST/GET/PATCH/DELETE /api/v1/expenses`

---

### 4.5 Dashboard Analytics

**Description:** Real-time business intelligence dashboard with KPI cards, 12-month revenue trend chart, live activity feed, alert notifications, and cross-branch comparison.

**Frontend Files:**
- `[gymSlug]/dashboard/page.tsx` — Main dashboard with 4 KPI cards, revenue AreaChart, activity feed, alerts
- `[gymSlug]/dashboard/branches/page.tsx` — Branch-level comparison view

**Backend Files:**
- `dashboard/dashboard.controller.ts` — 5 endpoints
- `dashboard/dashboard.service.ts` — KPI aggregation, revenue chart, activity feed, alert detection

**Database Tables:** `members`, `payments`, `check_ins`, `member_memberships`, `branches`

**API Routes:**
- `GET /api/v1/dashboard/kpis`
- `GET /api/v1/dashboard/revenue-chart`
- `GET /api/v1/dashboard/activity-feed`
- `GET /api/v1/dashboard/alerts`
- `GET /api/v1/dashboard/branch-comparison`

---

### 4.6 Class Scheduling & Management

**Description:** Class CRUD with trainer assignment, capacity management, enrollment with automatic waitlist promotion, and trainer conflict detection (double-booking prevention).

**Frontend Files:**
- `[gymSlug]/schedule/page.tsx` — Weekly calendar grid with class cards
- `[gymSlug]/classes/new/page.tsx` — Create class (name, category, trainer, capacity, time, room)
- `[gymSlug]/classes/[id]/page.tsx` — Class detail with enrollment roster

**Backend Files:**
- `classes/classes.controller.ts` — 7 endpoints
- `classes/classes.service.ts` — Trainer conflict detection, waitlist management, enrollment

**Database Tables:** `classes`, `class_enrollments`, `staff`

**API Routes:**
- `POST /api/v1/classes`
- `GET /api/v1/classes` (paginated, filterable)
- `GET /api/v1/classes/:id`
- `PATCH /api/v1/classes/:id`
- `POST /api/v1/classes/:id/enroll`
- `POST /api/v1/classes/:id/cancel-enrollment`
- `POST /api/v1/classes/:id/promote-waitlist`

---

### 4.7 Staff Management

**Description:** Staff directory with role-based access, salary field protection (owner-only), specializations, trainer performance scoring, and privilege escalation prevention.

**Frontend Files:**
- `[gymSlug]/staff/page.tsx` — Staff directory with search, role filter, branch filter
- `[gymSlug]/staff/new/page.tsx` — Add staff member
- `[gymSlug]/staff/[id]/page.tsx` — Staff profile
- `[gymSlug]/staff/analytics/page.tsx` — Trainer performance analytics

**Backend Files:**
- `staff/staff.controller.ts` — 5 endpoints
- `staff/staff.service.ts` — CRUD with salary stripping, trainer performance calculation

**Database Tables:** `staff`, `classes`, `class_enrollments`

**API Routes:**
- `GET /api/v1/staff` (paginated, filterable)
- `POST /api/v1/staff`
- `GET /api/v1/staff/:id`
- `PATCH /api/v1/staff/:id`
- `GET /api/v1/analytics/trainer-performance`

---

### 4.8 Marketing Campaigns

**Description:** Campaign creation with audience segmentation (all, expiring, inactive, by plan, by branch), multi-channel delivery (SMS, Email, WhatsApp, Push), draft/schedule/send lifecycle.

**Frontend Files:**
- `[gymSlug]/marketing/page.tsx` — Campaign list with status filters
- `[gymSlug]/marketing/campaigns/new/page.tsx` — Campaign builder
- `[gymSlug]/marketing/automation/page.tsx` — Automation rules (UI stub)

**Backend Files:**
- `marketing/marketing.controller.ts` — 6 endpoints
- `marketing/marketing.service.ts` — CRUD, segment count logic

**Database Tables:** `campaigns`, `members`, `member_memberships`

**API Routes:**
- `GET /api/v1/campaigns` (paginated)
- `POST /api/v1/campaigns`
- `GET /api/v1/campaigns/:id`
- `PATCH /api/v1/campaigns/:id`
- `DELETE /api/v1/campaigns/:id`
- `POST /api/v1/campaigns/:id/send`

---

### 4.9 AI Business Advisor

**Description:** Chat interface for gym owners to get business insights. Daily briefing with metrics summary, alerts, and recommendations. Conversation persistence for context continuity.

**Frontend Files:**
- `[gymSlug]/ai/page.tsx` — Chat UI (message bubbles, input, history)
- `[gymSlug]/ai/briefing/page.tsx` — Daily metrics summary + recommendations

**Backend Files:**
- `ai/ai.controller.ts` — 3 endpoints
- `ai/ai.service.ts` — Mock responses (Claude API integration pending)

**Database Tables:** `ai_conversations`, `members`, `check_ins`

**API Routes:**
- `POST /api/v1/ai/chat`
- `GET /api/v1/ai/daily-briefing`
- `GET /api/v1/ai/conversations`

**Current State:** Returns mock/contextual responses. Anthropic Claude API integration is not yet implemented.

---

### 4.10 Branch Management

**Description:** Multi-location management for studio chains. Branch CRUD with member counts, branch-scoped data isolation for non-owner roles.

**Frontend Files:**
- `[gymSlug]/branches/page.tsx` — Branch list with add/edit modal

**Backend Files:**
- `branches/branches.controller.ts` — 5 endpoints
- `branches/branches.service.ts` — CRUD with branch-scoped filtering

**Database Tables:** `branches`

**API Routes:**
- `GET /api/v1/branches`
- `GET /api/v1/branches/:id`
- `POST /api/v1/branches`
- `PATCH /api/v1/branches/:id`
- `DELETE /api/v1/branches/:id` (soft delete)

---

### 4.11 Settings & Configuration

**Description:** Studio settings management, subscription overview, membership plan configuration, custom role builder, external integration management.

**Frontend Files:**
- `[gymSlug]/settings/page.tsx` — Settings overview with account snapshot
- `[gymSlug]/settings/account/page.tsx` — Studio detail editor
- `[gymSlug]/settings/plans/page.tsx` — Membership plan CRUD
- `[gymSlug]/settings/roles/page.tsx` — Custom role permission matrix builder
- `[gymSlug]/settings/integrations/page.tsx` — Service connection toggles
- `[gymSlug]/settings/subscription/page.tsx` — Subscription management

**Backend Files:**
- `settings/settings.controller.ts` — 6 endpoints
- `settings/settings.service.ts` — Studio CRUD, account overview, plan seeding

**Database Tables:** `studios`, `subscription_plans`, `invoices`, `branches`

**API Routes:**
- `GET /api/v1/settings/studio`
- `GET /api/v1/settings/account`
- `GET /api/v1/settings/invoices`
- `GET /api/v1/settings/branches-summary`
- `GET /api/v1/settings/plans`
- `PATCH /api/v1/settings/studio`

---

### 4.12 RBAC & Custom Roles

**Description:** Role-based access control with 4 system roles and custom role creation. Permission matrix across 11 modules with 5 action types.

**Backend Files:**
- `roles/roles.controller.ts` — 6 endpoints
- `roles/roles.service.ts` — Role CRUD, permission validation, system role protection

**Database Tables:** `roles`, `staff`

**API Routes:**
- `GET /api/v1/roles`
- `GET /api/v1/roles/permissions`
- `GET/POST/PATCH/DELETE /api/v1/roles/:id`

---

### 4.13 Audit Logging

**Description:** Activity logging for compliance and debugging. Owner-only access to audit trail.

**Backend Files:**
- `audit/audit.controller.ts` — 3 endpoints
- `audit/audit.service.ts` — Log write + query

**Database Tables:** `audit_logs`

**API Routes:**
- `GET /api/v1/audit`
- `GET /api/v1/audit/by-module`
- `GET /api/v1/audit/by-user`

---

# SECTION 5 — COMPLETE USER FLOWS

### 5.1 User Registration Flow

```
User → /onboarding (registration form)
  └─ Frontend → Supabase Auth signUp (email + password)
      └─ Supabase → Sends verification email
          └─ User → /onboarding/verify (enters code or clicks link)
              └─ Supabase → Confirms email
                  └─ Frontend → /onboarding/plans
                      └─ Frontend → POST /api/v1/auth/select-plan
                          └─ Backend → Updates user_metadata.onboarding_step
                              └─ Frontend → /onboarding/setup
                                  └─ Frontend → POST /api/v1/auth/setup-studio
                                      └─ Backend:
                                          1. Creates Studio record (public schema)
                                          2. Generates slug from studio name
                                          3. Clones studio_template schema → studio_{uuid}
                                          4. Creates first Branch record
                                          5. Seeds default membership plans
                                          6. Seeds default roles
                                          7. Updates Supabase user_metadata (studio_id, role=owner, step=complete)
                                          8. Returns tokens + user + studio
                                              └─ Frontend → /{slug}/dashboard
```

### 5.2 Login Flow

```
User → /login (email + password)
  └─ Frontend → POST /api/v1/auth/login
      └─ Backend:
          1. Check in-memory rate limit (5 failures → 15-min lockout)
          2. Supabase auth.signInWithPassword()
          3. Fetch studio from DB by studio_id (from user_metadata)
          4. Return { access_token, refresh_token, user, studio }
              └─ Frontend:
                  1. Store tokens + user + studio in Zustand (localStorage)
                  2. Set auth-token cookie (7-day expiry)
                  3. If onboarding incomplete → redirect to step
                  4. If complete → redirect to /{studio.slug}/dashboard
```

### 5.3 Member Check-in Flow (QR)

```
User → /{slug}/check-in → selects "QR Code"
  └─ Frontend → /{slug}/check-in/qr
      └─ Opens camera via html5-qrcode
          └─ Scans QR code
              └─ Frontend → POST /api/v1/check-ins { qr_code, branch_id, checkin_method: "qr" }
                  └─ Backend:
                      1. Resolve member by qr_code
                      2. Find active membership
                      3. Validate:
                         - Membership not expired
                         - Branch matches
                         - Classes remaining (for class_pack plans)
                      4. Create check_in record
                      5. Decrement classes_remaining if applicable
                      6. Return { success: true, member_name }
                          └─ Frontend → Success toast + resume scanner after 3s
```

### 5.4 Member Registration Flow (Staff)

```
Staff → /{slug}/members/new
  └─ Fills form: name, phone, email, branch, plan, start date
      └─ Frontend → POST /api/v1/members
          └─ Backend:
              1. Generate member_code: FS-YYYYMMDD-XXXX
              2. Generate UUID qr_code
              3. Create member record
              4. If plan_id provided:
                 a. Fetch plan → calculate end_date from duration_days
                 b. Create member_membership record
              5. Return member with relations
                  └─ Frontend → Redirect to /{slug}/members/{id}
```

### 5.5 Payment Recording Flow

```
Staff → /{slug}/finance/payments/new
  └─ Search member → Select plan → Enter amount → Choose method (cash/card/upi/bank)
      └─ Frontend → POST /api/v1/payments/cash
          └─ Backend:
              1. Generate receipt_number: RCP-YYYYMMDD-XXXX
              2. Create payment record (status: 'paid', paid_at: now)
              3. Return payment record
                  └─ Frontend → Success toast → Redirect to /{slug}/finance/payments
```

### 5.6 Class Enrollment Flow

```
Staff/Trainer → /{slug}/classes/{id}
  └─ Click "Enroll Member"
      └─ Frontend → POST /api/v1/classes/{id}/enroll { member_id }
          └─ Backend:
              1. Count current 'enrolled' enrollments
              2. If count < class.capacity:
                 → Create enrollment (status: 'enrolled')
              3. If count >= capacity:
                 → Max waitlist_position + 1
                 → Create enrollment (status: 'waitlisted', waitlist_position)
              4. Return enrollment
                  └─ On cancellation:
                      → If cancelled member was 'enrolled':
                        → Auto-promote first waitlisted member
                        → Set status='enrolled', clear waitlist_position
```

### 5.7 Dashboard Load Flow

```
User → /{slug}/dashboard
  └─ [gymSlug]/layout.tsx validates auth + slug match
      └─ AppLayout renders sidebar + top bar
          └─ Dashboard page fires 4 parallel React Query requests:
              1. GET /api/v1/dashboard/kpis → KPI cards
              2. GET /api/v1/dashboard/revenue-chart → AreaChart data
              3. GET /api/v1/dashboard/activity-feed → Recent check-ins
              4. GET /api/v1/dashboard/alerts → Warning notifications
              └─ If multi-branch: GET /api/v1/branches → Branch selector dropdown
```

### 5.8 AI Chat Flow

```
Owner → /{slug}/ai
  └─ Types message → Click send
      └─ Frontend → POST /api/v1/ai/chat { message, conversation_id?, staff_id }
          └─ Backend:
              1. Find or create aiConversation
              2. Append user message to conversation.messages[]
              3. Generate response (currently mock, Claude API pending)
              4. Append assistant response to messages[]
              5. Update conversation in DB
              6. Return { conversation_id, response, messages }
                  └─ Frontend → Append response bubble to chat UI
```

### 5.9 Settings & Studio Update Flow

```
Owner → /{slug}/settings → Click "Account"
  └─ Frontend → GET /api/v1/settings/account
      └─ Backend:
          1. Fetch studio record
          2. Calculate subscription details
          3. Count usage (branches, members, staff)
          4. Fetch feature list from plan
          5. Return { studio, subscription, usage, features, billing }
              └─ Frontend renders sections: studio info, subscription, usage bars
                  └─ Owner edits studio name, email, timezone, etc.
                      └─ Frontend → PATCH /api/v1/settings/studio
                          └─ Backend → studio.update()
                              └─ Frontend → Success toast
```

---

# SECTION 6 — DATABASE AUDIT

## Public Schema Tables

### Table: `studios`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, gen_random_uuid() | |
| name | text | NOT NULL | Studio display name |
| slug | text | UNIQUE, NOT NULL | URL-friendly identifier |
| schema_name | text | UNIQUE, NOT NULL | PostgreSQL schema name |
| owner_user_id | UUID | NOT NULL | Supabase auth user ID |
| logo_url | text | nullable | Storage URL |
| tagline | text | nullable | |
| phone | text | nullable | |
| email | text | nullable | |
| website | text | nullable | |
| address | text | nullable | |
| city | text | nullable | |
| state | text | nullable | |
| country | text | nullable | |
| postal_code | text | nullable | |
| business_name | text | nullable | Legal business name |
| business_type | text | nullable | |
| timezone | text | DEFAULT 'Asia/Kolkata' | |
| currency | text | DEFAULT 'INR' | |
| subscription_plan | text | DEFAULT 'free' | free/starter/pro/enterprise |
| subscription_status | text | DEFAULT 'trial' | |
| billing_cycle | text | DEFAULT 'monthly' | |
| billing_name | text | nullable | |
| billing_email | text | nullable | |
| billing_address | text | nullable | |
| tax_id | text | nullable | GST number etc. |
| subscription_start | timestamptz | nullable | |
| next_billing_date | timestamptz | nullable | |
| trial_ends_at | timestamptz | nullable | |
| last_login_at | timestamptz | nullable | |
| two_factor_enabled | boolean | DEFAULT false | |
| email_verified | boolean | DEFAULT false | |
| phone_verified | boolean | DEFAULT false | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now(), auto-updated | |

**Relationships:** studios.id → invoices.studio_id

---

### Table: `subscription_plans`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | text | UNIQUE | free/starter/pro/enterprise |
| display_name | text | NOT NULL | Human-readable name |
| description | text | nullable | |
| monthly_price | decimal(10,2) | NOT NULL | |
| annual_price | decimal(10,2) | NOT NULL | |
| max_branches | int | DEFAULT 1 | |
| max_members | int | DEFAULT 100 | |
| max_staff | int | DEFAULT 5 | |
| storage_limit_gb | int | DEFAULT 1 | |
| api_access | boolean | DEFAULT false | |
| features | jsonb | DEFAULT '{}' | Feature flags |
| is_active | boolean | DEFAULT true | |
| sort_order | int | DEFAULT 0 | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### Table: `invoices`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| studio_id | UUID | FK → studios.id | |
| invoice_number | text | UNIQUE | |
| amount | decimal(10,2) | NOT NULL | |
| currency | text | DEFAULT 'INR' | |
| status | text | DEFAULT 'pending' | pending/paid/failed/refunded |
| billing_period_start | timestamptz | NOT NULL | |
| billing_period_end | timestamptz | NOT NULL | |
| paid_at | timestamptz | nullable | |
| invoice_url | text | nullable | |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `(studio_id, created_at)`

---

### Table: `email_verifications`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | NOT NULL | |
| token | text | UNIQUE | |
| expires_at | timestamptz | NOT NULL | |
| used | boolean | DEFAULT false | |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `(user_id)`, `(token)`

---

### Table: `pending_registrations`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| full_name | text | NOT NULL | |
| email | text | NOT NULL | |
| phone | text | nullable | |
| encrypted_password | text | NOT NULL | AES-256-GCM encrypted |
| token | text | UNIQUE | |
| expires_at | timestamptz | NOT NULL | |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `(email)`, `(token)`

---

## Studio Template Schema Tables (Per-Tenant)

### Table: `branches`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | text | NOT NULL | |
| address | text | nullable | |
| city | text | nullable | |
| phone | text | nullable | |
| email | text | nullable | |
| is_active | boolean | DEFAULT true | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Relationships:** Parent of members, membership_plans, member_memberships, check_ins, classes, payments, expenses

---

### Table: `members`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| member_code | text | UNIQUE | Format: FS-YYYYMMDD-XXXX |
| branch_id | UUID | FK → branches.id | |
| full_name | text | NOT NULL | |
| phone | text | NOT NULL | |
| email | text | nullable | |
| date_of_birth | date | nullable | |
| emergency_contact_name | text | nullable | |
| emergency_contact_phone | text | nullable | |
| profile_photo_url | text | nullable | |
| face_descriptor | float[] | WRITE-ONLY | 128-element vector; never returned in API responses |
| checkin_method | text | DEFAULT 'manual' | |
| qr_code | text | UNIQUE, nullable | UUID for QR scanning |
| status | text | DEFAULT 'active' | active/expired/frozen/inactive |
| engagement_score | int | DEFAULT 0 | 0-100 computed score |
| churn_risk | text | DEFAULT 'low' | low/medium/high |
| referral_code | text | UNIQUE, nullable | |
| referred_by_member_id | UUID | FK → members.id (self-ref) | |
| notes | text | nullable | |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Indexes:** `(branch_id)`, `(status)`, `(branch_id, status)`  
**Relationships:** members → memberships, check_ins, payments, class_enrollments, notifications

---

### Table: `membership_plans`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| branch_id | UUID | FK → branches.id, nullable | Null = available at all branches |
| name | text | NOT NULL | |
| description | text | nullable | |
| plan_type | text | NOT NULL | monthly/quarterly/half_yearly/yearly/class_pack/custom |
| duration_days | int | nullable | |
| total_classes | int | nullable | For class_pack plans |
| max_classes_per_week | int | nullable | |
| price | decimal(10,2) | NOT NULL | |
| is_active | boolean | DEFAULT true | |
| auto_renew_enabled | boolean | DEFAULT false | |
| created_at | timestamptz | DEFAULT now() | |

---

### Table: `member_memberships`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| member_id | UUID | FK → members.id | |
| plan_id | UUID | FK → membership_plans.id | |
| branch_id | UUID | FK → branches.id | |
| start_date | date | NOT NULL | |
| end_date | date | nullable | |
| classes_remaining | int | nullable | Decremented on check-in |
| status | text | DEFAULT 'active' | active/expired/frozen/cancelled |
| freeze_start_date | date | nullable | |
| freeze_end_date | date | nullable | |
| freeze_reason | text | nullable | |
| auto_renew | boolean | DEFAULT false | |
| payment_method_token | text | nullable | NEVER returned in API |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Indexes:** `(member_id, status)`

---

### Table: `check_ins`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| member_id | UUID | FK → members.id | |
| membership_id | UUID | FK → member_memberships.id | |
| branch_id | UUID | FK → branches.id | |
| class_id | UUID | FK → classes.id, nullable | |
| checkin_method | text | NOT NULL | manual/qr/facial |
| checked_in_at | timestamptz | DEFAULT now() | |
| status | text | DEFAULT 'success' | |
| failure_reason | text | nullable | |
| synced_at | timestamptz | nullable | For offline sync |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `(member_id, checked_in_at)`, `(branch_id, checked_in_at)`

---

### Table: `classes`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| branch_id | UUID | FK → branches.id | |
| trainer_id | UUID | FK → staff.id | |
| substitute_trainer_id | UUID | FK → staff.id, nullable | |
| name | text | NOT NULL | |
| category | text | NOT NULL | yoga/crossfit/hiit/etc. |
| room | text | nullable | |
| capacity | int | NOT NULL | |
| duration_minutes | int | NOT NULL | |
| starts_at | timestamptz | NOT NULL | |
| recurrence_rule | text | nullable | iCal RRULE format |
| recurrence_end_date | date | nullable | |
| status | text | DEFAULT 'scheduled' | |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `(branch_id, starts_at)`

---

### Table: `class_enrollments`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| class_id | UUID | FK → classes.id | |
| member_id | UUID | FK → members.id | |
| status | text | DEFAULT 'enrolled' | enrolled/waitlisted/cancelled |
| waitlist_position | int | nullable | Sequential position |
| enrolled_at | timestamptz | DEFAULT now() | |

---

### Table: `staff`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | nullable | Links to Supabase auth user |
| branch_ids | UUID[] | array | Array of accessible branch IDs |
| full_name | text | NOT NULL | |
| role | text | NOT NULL | owner/manager/trainer/front_desk |
| role_id | UUID | FK → roles.id, nullable | Custom role reference |
| phone | text | NOT NULL | |
| email | text | nullable | |
| specializations | text[] | array | e.g., ['yoga', 'crossfit'] |
| salary | decimal(10,2) | nullable | OWNER-ONLY visibility |
| performance_score | int | DEFAULT 0 | 0-100 computed |
| is_active | boolean | DEFAULT true | |
| joined_at | date | nullable | |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `(role_id)`

---

### Table: `payments`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| member_id | UUID | FK → members.id | |
| membership_id | UUID | FK → member_memberships.id, nullable | |
| branch_id | UUID | FK → branches.id | |
| amount | decimal(10,2) | NOT NULL | |
| currency | text | DEFAULT 'INR' | |
| payment_method | text | NOT NULL | cash/card/upi/bank_transfer/razorpay/stripe |
| status | text | DEFAULT 'pending' | pending/paid/failed/refunded |
| gateway_payment_id | text | nullable | Razorpay/Stripe ID |
| gateway_order_id | text | nullable | |
| receipt_number | text | UNIQUE | Format: RCP-YYYYMMDD-XXXX |
| invoice_url | text | nullable | |
| notes | text | nullable | |
| paid_at | timestamptz | nullable | |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `(member_id)`, `(branch_id, created_at)`

---

### Table: `expenses`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| branch_id | UUID | FK → branches.id | |
| category | text | NOT NULL | salaries/rent/equipment/utilities/marketing/maintenance/other |
| description | text | NOT NULL | |
| amount | decimal(10,2) | NOT NULL | |
| currency | text | DEFAULT 'INR' | |
| expense_date | date | NOT NULL | |
| receipt_url | text | nullable | |
| recorded_by_staff_id | UUID | FK → staff.id | |
| created_at | timestamptz | DEFAULT now() | |

---

### Table: `roles`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | text | UNIQUE | |
| description | text | nullable | |
| permissions | jsonb | DEFAULT '{}' | Module → action[] mapping |
| is_system | boolean | DEFAULT false | Blocks edit/delete if true |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### Table: `campaigns`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| name | text | NOT NULL | |
| segment | text | NOT NULL | all/expiring_soon/inactive/by_plan/by_branch |
| segment_filters | jsonb | nullable | Filter criteria |
| channels | text[] | array | sms/email/whatsapp/push |
| message_template | text | NOT NULL | |
| status | text | DEFAULT 'draft' | draft/scheduled/sending/sent/cancelled |
| scheduled_at | timestamptz | nullable | |
| sent_count | int | DEFAULT 0 | |
| delivered_count | int | DEFAULT 0 | |
| created_by_staff_id | UUID | FK → staff.id | |
| created_at | timestamptz | DEFAULT now() | |

---

### Table: `notifications_log`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| member_id | UUID | FK → members.id, nullable | |
| channel | text | NOT NULL | sms/email/whatsapp/push |
| trigger_type | text | NOT NULL | |
| message_body | text | NOT NULL | |
| status | text | DEFAULT 'sent' | |
| external_message_id | text | nullable | |
| sent_at | timestamptz | DEFAULT now() | |

---

### Table: `ai_conversations`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| staff_id | UUID | FK → staff.id | |
| messages | jsonb | NOT NULL | Array of {role, content} |
| context_snapshot | jsonb | nullable | Studio context at conversation start |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

---

### Table: `audit_logs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | NOT NULL | |
| action | text | NOT NULL | create/update/delete/login/etc. |
| module | text | NOT NULL | members/payments/etc. |
| entity_id | UUID | nullable | Target record ID |
| entity_type | text | nullable | Model name |
| details | jsonb | nullable | Change details |
| ip_address | text | nullable | |
| created_at | timestamptz | DEFAULT now() | |

**Indexes:** `(user_id)`, `(module, action)`, `(created_at)`

---

# SECTION 7 — SCHEMA RELATIONSHIP MAP

```
PUBLIC SCHEMA (Cross-Tenant)
=============================

subscription_plans (4 tiers: free/starter/pro/enterprise)
    │
    └── Referenced by studios.subscription_plan (string match, not FK)

studios
    │
    ├── invoices (1:N) ──── Studio billing history
    │
    └── owner_user_id ──── Supabase auth.users (external)

pending_registrations ──── Temporary pre-verification records
email_verifications   ──── Token-based email verification


PER-TENANT SCHEMA (studio_{uuid})
===================================

branches (Physical locations)
    │
    ├── members (1:N) ──── Gym members assigned to a branch
    │   │
    │   ├── member_memberships (1:N) ──── Active/frozen/expired plans
    │   │   │
    │   │   ├── check_ins (1:N) ──── Attendance records per membership
    │   │   └── payments (1:N) ──── Payments linked to memberships
    │   │
    │   ├── check_ins (1:N) ──── All check-ins by member
    │   ├── payments (1:N) ──── All payments by member
    │   ├── class_enrollments (1:N) ──── Class registrations
    │   ├── notifications_log (1:N) ──── Notification delivery records
    │   └── members (self-ref) ──── Referral chain
    │
    ├── membership_plans (1:N) ──── Branch-specific pricing tiers
    │   │
    │   └── member_memberships (1:N) ──── Plan assignments
    │
    ├── classes (1:N) ──── Scheduled classes at branch
    │   │
    │   ├── class_enrollments (1:N) ──── Enrolled/waitlisted members
    │   └── check_ins (1:N) ──── Class attendance
    │
    ├── payments (1:N) ──── All branch payments
    └── expenses (1:N) ──── Branch operating expenses

staff (Employees)
    │
    ├── classes_as_trainer (1:N) ──── Primary trainer assignment
    ├── classes_as_substitute (1:N) ──── Backup trainer
    ├── expenses_recorded (1:N) ──── Expenses logged by staff
    ├── campaigns_created (1:N) ──── Marketing campaigns authored
    ├── ai_conversations (1:N) ──── AI chat sessions
    └── custom_role ──── roles (N:1 via role_id)

roles
    │
    └── staff (1:N) ──── Staff with custom role assignments

campaigns ──── Marketing campaigns (standalone, linked to staff creator)

audit_logs ──── Activity trail (standalone, linked by user_id)
```

---

# SECTION 8 — API ENDPOINT DOCUMENTATION

## Authentication (Public)

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| POST | `/api/v1/auth/register` | Register new user | No | `{ full_name, email, password, phone }` | `{ success, email }` |
| POST | `/api/v1/auth/verify-email` | Verify email token | No | `{ token }` | `{ access_token, refresh_token, user }` |
| POST | `/api/v1/auth/resend-verification` | Resend verification | No | `{ email }` | `{ sent: true }` |
| POST | `/api/v1/auth/login` | Login | No | `{ email, password }` | `{ access_token, refresh_token, user, studio }` |
| POST | `/api/v1/auth/logout` | Logout | Bearer | — | `{ success: true }` |
| POST | `/api/v1/auth/refresh` | Refresh tokens | No | `{ refresh_token }` | `{ access_token, refresh_token }` |
| POST | `/api/v1/auth/forgot-password` | Request password reset | No | `{ email }` | `{ success: true }` |
| POST | `/api/v1/auth/reset-password` | Reset password | No | `{ otp, new_password }` | `{ success: true }` |
| GET | `/api/v1/auth/plans` | List subscription plans | No | — | `Plan[]` |
| POST | `/api/v1/auth/select-plan` | Select subscription plan | JWT | `{ plan_id }` | `{ plan, onboarding_step }` |
| POST | `/api/v1/auth/setup-studio` | Create studio + branch | JWT | `{ studio_name, branch_name?, timezone?, currency?, ... }` | `{ access_token, user, studio }` |

## Members

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| GET | `/api/v1/members` | List members | JWT + members:view | Query: `status, branch_id, search, page, limit` | `{ data: Member[], total, page, limit }` |
| POST | `/api/v1/members` | Create member | JWT + members:create | `{ full_name, phone, email?, branch_id, plan_id?, ... }` | `Member` |
| GET | `/api/v1/members/:id` | Get member detail | JWT + members:view | — | `Member` (with memberships, payments, check-ins) |
| PATCH | `/api/v1/members/:id` | Update member | JWT + members:edit | Partial member fields | `Member` |
| POST | `/api/v1/members/:id/freeze` | Freeze membership | JWT + members:edit | `{ freeze_start_date, freeze_end_date, reason? }` | `MemberMembership` |
| POST | `/api/v1/members/:id/renew` | Renew membership | JWT + members:edit | `{ plan_id, payment_method }` | `{ membership, payment }` |
| POST | `/api/v1/members/:id/face-descriptor` | Store face data | JWT + members:edit | `{ descriptor: number[128] }` | `{ success: true }` |
| GET | `/api/v1/members/churn-risk` | Churn risk analysis | JWT + members:view | Query: `risk=high|medium|low` | `Member[]` |

## Membership Plans

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| GET | `/api/v1/membership-plans` | List plans | JWT | Query: `branch_id?` | `MembershipPlan[]` |
| GET | `/api/v1/membership-plans/:id` | Get plan | JWT | — | `MembershipPlan` |
| POST | `/api/v1/membership-plans` | Create plan | JWT + owner | `{ name, plan_type, price, duration_days, ... }` | `MembershipPlan` |
| PATCH | `/api/v1/membership-plans/:id` | Update plan | JWT + owner | Partial plan fields | `MembershipPlan` |
| DELETE | `/api/v1/membership-plans/:id` | Deactivate plan | JWT + owner | — | `{ success: true }` |

## Check-ins

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| POST | `/api/v1/check-ins` | Create check-in | JWT + check_ins:create | `{ member_id?, qr_code?, branch_id, checkin_method, class_id? }` | `{ success, member_name, failure_reason? }` |
| POST | `/api/v1/check-ins/facial` | Facial recognition check-in | JWT + check_ins:create | `{ descriptor: number[128], branch_id }` | `{ success, member_name }` |
| POST | `/api/v1/check-ins/sync` | Sync offline check-ins | JWT + check_ins:create | `[{ member_id, branch_id, checkin_method, checked_in_at }]` | `{ synced, failed }` |
| GET | `/api/v1/check-ins` | List check-ins | JWT + check_ins:view | Query: `branch_id?, date_from?, date_to?, member_id?, page, limit` | `{ data: CheckIn[], total }` |
| GET | `/api/v1/check-ins/heatmap` | Attendance heatmap | JWT + check_ins:view | Query: `branch_id?, weeks?` | `7×24 grid[]` |

## Payments

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| POST | `/api/v1/payments/cash` | Record cash payment | JWT + payments:create | `{ member_id, membership_id?, branch_id, amount, notes? }` | `Payment` |
| POST | `/api/v1/payments/create-order` | Create gateway order | JWT + payments:create | `{ member_id, plan_id, branch_id, gateway }` | `{ order_id, receipt_number, amount, currency, gateway, plan_name }` |
| POST | `/api/v1/payments/verify` | Verify gateway payment | JWT + payments:create | `{ gateway_payment_id, gateway_order_id, signature, member_id, plan_id, branch_id }` | `{ payment, membership }` |
| GET | `/api/v1/payments` | List payments | JWT + payments:view | Query: `branch_id?, date_from?, date_to?, status?, page, limit` | `{ data: Payment[], total }` |
| GET | `/api/v1/payments/:id/invoice` | Get invoice | JWT + payments:view | — | `Payment` (with relations) |

## Expenses

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| POST | `/api/v1/expenses` | Create expense | JWT | `{ branch_id, category, description, amount, expense_date, receipt_url?, recorded_by_staff_id }` | `Expense` |
| GET | `/api/v1/expenses` | List expenses | JWT | Query: `branch_id?, category?, date_from?, date_to?, page, limit` | `{ data: Expense[], total }` |
| PATCH | `/api/v1/expenses/:id` | Update expense | JWT | Partial expense fields | `Expense` |
| DELETE | `/api/v1/expenses/:id` | Delete expense | JWT | — | Hard delete |

## Dashboard

| Method | Route | Purpose | Auth | Response |
|--------|-------|---------|------|----------|
| GET | `/api/v1/dashboard/kpis` | Get KPI metrics | JWT + dashboard:view | `{ active_members, monthly_revenue, avg_attendance_rate, expiring_soon_count }` |
| GET | `/api/v1/dashboard/revenue-chart` | 12-month revenue | JWT + dashboard:view | `[{ month, revenue }]` |
| GET | `/api/v1/dashboard/activity-feed` | Recent activity | JWT + dashboard:view | `Activity[]` (last 10 check-ins) |
| GET | `/api/v1/dashboard/alerts` | System alerts | JWT + dashboard:view | `Alert[]` (inactive members, overdue payments, expiring memberships) |
| GET | `/api/v1/dashboard/branch-comparison` | Branch-level KPIs | JWT + dashboard:view | `BranchStats[]` |

## Classes

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| POST | `/api/v1/classes` | Create class | JWT + classes:create | `{ branch_id, trainer_id, name, category, capacity, duration_minutes, starts_at, ... }` | `Class` |
| GET | `/api/v1/classes` | List classes | JWT + classes:view | Query: `branch_id?, trainer_id?, category?, date_from?, date_to?, page, limit` | `{ data: Class[], total }` |
| GET | `/api/v1/classes/:id` | Get class detail | JWT + classes:view | — | `Class` (with enrollments) |
| PATCH | `/api/v1/classes/:id` | Update class | JWT + classes:edit | Partial class fields | `Class` |
| POST | `/api/v1/classes/:id/enroll` | Enroll member | JWT + classes:edit | `{ member_id }` | `ClassEnrollment` |
| POST | `/api/v1/classes/:id/cancel-enrollment` | Cancel enrollment | JWT + classes:edit | `{ member_id }` | Updated enrollment |
| POST | `/api/v1/classes/:id/promote-waitlist` | Promote from waitlist | JWT + classes:edit | `{ enrollment_id }` | Updated enrollment |

## Staff

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| GET | `/api/v1/staff` | List staff | JWT + staff:view | Query: `branch_id?, role?, search?, page, limit` | `{ data: Staff[], total }` |
| POST | `/api/v1/staff` | Create staff | JWT + staff:create | `{ full_name, role, phone, email?, branch_ids?, specializations?, salary? }` | `Staff` |
| GET | `/api/v1/staff/:id` | Get staff detail | JWT + staff:view | — | `Staff` (salary stripped for non-owners) |
| PATCH | `/api/v1/staff/:id` | Update staff | JWT + staff:edit | Partial staff fields | `Staff` |
| GET | `/api/v1/analytics/trainer-performance` | Trainer metrics | JWT + staff:view | — | `TrainerPerformance[]` |

## Marketing

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| GET | `/api/v1/campaigns` | List campaigns | JWT + marketing:view | Query: `status?, search?, page, limit` | `{ data: Campaign[], total }` |
| POST | `/api/v1/campaigns` | Create campaign | JWT + marketing:create | `{ name, segment, channels[], message_template, created_by_staff_id, ... }` | `Campaign` |
| GET | `/api/v1/campaigns/:id` | Get campaign | JWT + marketing:view | — | `Campaign` |
| PATCH | `/api/v1/campaigns/:id` | Update campaign | JWT + marketing:edit | Partial fields (blocked if 'sent') | `Campaign` |
| DELETE | `/api/v1/campaigns/:id` | Delete campaign | JWT + marketing:delete | — (blocked if sending/sent) | Hard delete |
| POST | `/api/v1/campaigns/:id/send` | Send campaign | JWT + marketing:edit | — | `Campaign` (status→sending) |

## AI Advisor

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| POST | `/api/v1/ai/chat` | Send message | JWT | `{ message, conversation_id?, staff_id }` | `{ conversation_id, response, messages }` |
| GET | `/api/v1/ai/daily-briefing` | Get daily briefing | JWT | — | `{ date, summary, metrics, alerts, recommendations }` |
| GET | `/api/v1/ai/conversations` | List conversations | JWT | — | `AiConversation[]` |

## Branches

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| GET | `/api/v1/branches` | List branches | JWT + branches:view | — | `Branch[]` (filtered by user access) |
| GET | `/api/v1/branches/:id` | Get branch detail | JWT + branches:view | — | `Branch` (with counts) |
| POST | `/api/v1/branches` | Create branch | JWT + owner + branches:create | `{ name, address?, city?, phone?, email? }` | `Branch` |
| PATCH | `/api/v1/branches/:id` | Update branch | JWT + owner + branches:edit | Partial fields | `Branch` |
| DELETE | `/api/v1/branches/:id` | Deactivate branch | JWT + owner + branches:delete | — | Soft delete (is_active=false) |

## Settings

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| GET | `/api/v1/settings/studio` | Get studio info | JWT | — | `Studio` |
| GET | `/api/v1/settings/account` | Full account overview | JWT | — | `{ studio, subscription, usage, features, billing }` |
| GET | `/api/v1/settings/invoices` | Billing invoices | JWT + owner | — | `Invoice[]` (last 50) |
| GET | `/api/v1/settings/branches-summary` | Branch listing | JWT | — | `Branch[]` (with member counts) |
| GET | `/api/v1/settings/plans` | Available subscription plans | JWT | — | `SubscriptionPlan[]` |
| PATCH | `/api/v1/settings/studio` | Update studio settings | JWT + owner | `{ studio_name?, tagline?, phone?, timezone?, ... }` | `Studio` |

## Roles

| Method | Route | Purpose | Auth | Request Body | Response |
|--------|-------|---------|------|-------------|----------|
| GET | `/api/v1/roles` | List all roles | JWT + owner/manager | — | `{ system_roles, custom_roles }` |
| GET | `/api/v1/roles/permissions` | Permission matrix | JWT + owner/manager | — | `{ modules, actions, defaults }` |
| GET | `/api/v1/roles/:id` | Get role | JWT + owner/manager | — | `Role` |
| POST | `/api/v1/roles` | Create custom role | JWT + owner | `{ name, description?, permissions? }` | `Role` |
| PATCH | `/api/v1/roles/:id` | Update custom role | JWT + owner | Partial fields | `Role` |
| DELETE | `/api/v1/roles/:id` | Delete custom role | JWT + owner | — (blocked if staff assigned or system) | Hard delete |

## Audit

| Method | Route | Purpose | Auth | Response |
|--------|-------|---------|------|----------|
| GET | `/api/v1/audit` | Recent audit logs | JWT + owner | `AuditLog[]` (last 100) |
| GET | `/api/v1/audit/by-module` | Filter by module | JWT + owner | `AuditLog[]` (last 50) |
| GET | `/api/v1/audit/by-user` | Filter by user | JWT + owner | `AuditLog[]` (last 50) |

## Health

| Method | Route | Purpose | Auth | Response |
|--------|-------|---------|------|----------|
| GET | `/health` | Health check | None | `{ status: 'ok', timestamp }` |

**Total: 82 API endpoints across 14 modules**

---

# SECTION 9 — SECURITY AUDIT

### CRITICAL Severity

| ID | Finding | Impact | Location |
|----|---------|--------|----------|
| SEC-01 | **Payment gateway verification is mocked** — Razorpay/Stripe HMAC signature verification is not implemented. The `verifyPayment` method accepts any `gateway_payment_id` and `signature` without cryptographic validation. | An attacker could forge payment confirmations, creating memberships without actual payment. | `payments/payments.service.ts` → `verifyPayment()` |
| SEC-02 | **Login rate limiting uses in-memory Map** — The 5-failure lockout mechanism uses a JavaScript Map, which resets on server restart and doesn't work across multiple server instances. | Rate limiting is ineffective in production (multi-instance), and attackers can bypass by waiting for a restart. | `auth/auth.service.ts` → `loginAttempts Map` |
| SEC-03 | **No CSRF protection** — The application uses cookie-based auth (`auth-token`) without CSRF tokens. While the API uses Bearer tokens (mitigating most CSRF), the middleware-level cookie check could be exploited. | State-changing actions could be triggered via cross-site requests in browsers that send cookies automatically. | `frontend/src/middleware.ts` |

### HIGH Severity

| ID | Finding | Impact | Location |
|----|---------|--------|----------|
| SEC-04 | **Auth cookie lacks Secure flag** — The `auth-token` cookie is set with `SameSite=Lax` but no `Secure` flag, allowing transmission over HTTP. | Token could be intercepted on non-HTTPS connections. | `frontend/src/stores/auth-store.ts`, `frontend/src/lib/api.ts` |
| SEC-05 | **TenantMiddleware not registered in AppModule** — While coded, the middleware is not registered via `configure(consumer)` in any module, meaning `search_path` is never actually set per-request in production. | All tenants would query the default schema, causing data leakage between tenants. | `backend/src/app.module.ts` — missing `NestModule.configure()` implementation |
| SEC-06 | **No input sanitization for XSS** — User-provided text (member names, notes, campaign messages) is stored and rendered without HTML sanitization. React's default escaping helps but template strings in emails/WhatsApp may not be protected. | Stored XSS possible in campaign messages or notes rendered outside React. | All service `create()` methods |
| SEC-07 | **Encryption key for pending registrations is hardcoded/not rotated** — The AES-256-GCM encryption for pending_registration passwords uses a key that may be stored in environment without rotation mechanism. | Key compromise exposes all pending registration passwords. | `auth/auth.service.ts` |
| SEC-08 | **No webhook signature verification** — TRD requires HMAC verification for payment webhooks, but no webhook endpoints exist. | Can't receive asynchronous payment confirmations securely. | Missing entirely |

### MEDIUM Severity

| ID | Finding | Impact | Location |
|----|---------|--------|----------|
| SEC-09 | **Slug-based routing allows enumeration** — The `[gymSlug]` layout only does a client-side check (`gymSlug !== studio.slug`). There's no server-side validation that the slug exists or belongs to the authenticated user. | Users could discover valid studio slugs by trying common names, though they'd be redirected to their own workspace. | `frontend/src/app/[gymSlug]/layout.tsx` |
| SEC-10 | **No file upload validation** — Profile photo URLs and receipt URLs accept any string without checking MIME type, file size, or URL origin. | Potential for malicious file storage or SSRF via URL injection. | Member/expense creation endpoints |
| SEC-11 | **Expense deletion is a hard delete** — No soft-delete or audit trail for deleted expenses. | Financial records can be permanently destroyed without recovery. | `expenses/expenses.service.ts` → `remove()` |
| SEC-12 | **Audit logging not actually invoked** — The AuditModule exists but `audit.service.log()` is never called from any other service or controller. | No audit trail is actually recorded despite the table existing. | All controller methods |

### LOW Severity

| ID | Finding | Impact | Location |
|----|---------|--------|----------|
| SEC-13 | **Console logging of sensitive operations** — Some auth operations log success/failure to console without structured logging. | Sensitive data could leak to stdout in production. | `auth/auth.service.ts` |
| SEC-14 | **No Content-Security-Policy header** — Helmet with default options doesn't set a strict CSP. | Reduced protection against inline script injection. | `backend/src/main.ts` |
| SEC-15 | **No API versioning enforcement** — While routes use `/api/v1/`, there's no mechanism to deprecate or version endpoints for breaking changes. | Future API changes could break existing clients without warning. | Global architecture |

---

# SECTION 10 — PERFORMANCE AUDIT

### N+1 Query Risks

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| PERF-01 | **Dashboard KPIs fire 4 sequential aggregate queries** — `getKpis()` makes separate `count()` and `aggregate()` calls for members, payments, check-ins, and memberships. | MEDIUM | `dashboard/dashboard.service.ts` |
| PERF-02 | **Revenue chart loops 12 times** — `getRevenueChart()` runs a separate `payment.aggregate()` query for each of the last 12 months instead of a single GROUP BY query. | HIGH | `dashboard/dashboard.service.ts` → `getRevenueChart()` |
| PERF-03 | **Branch comparison runs nested queries per branch** — `getBranchComparison()` fetches all branches then queries members, payments, and check-ins for each branch individually. | HIGH | `dashboard/dashboard.service.ts` → `getBranchComparison()` |
| PERF-04 | **Facial recognition scans all members** — `facialCheckIn()` fetches ALL active members with face descriptors in a branch and computes Euclidean distance in JavaScript (not database). | HIGH | `check-ins/check-ins.service.ts` → `facialCheckIn()` |
| PERF-05 | **Trainer performance calculates occupancy per class** — Loops through trainer's classes and their enrollments to compute average occupancy. | MEDIUM | `staff/staff.service.ts` → `getTrainerPerformance()` |

### Frontend Performance

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| PERF-06 | **All pages are client components** — Every page uses `"use client"`, preventing any server-side rendering or static generation. Dashboard initial load requires full JS bundle + 4+ API calls. | MEDIUM | All page files |
| PERF-07 | **No code splitting for heavy components** — html5-qrcode, face-api.js, and Recharts are imported directly without dynamic imports (except html5-qrcode in QR page which uses `import()`). | MEDIUM | Various page files |
| PERF-08 | **Check-in page has 5s polling interval** — `refetchInterval: 5000` on recent check-ins list polling continuously even when the page is backgrounded. | LOW | `[gymSlug]/check-in/page.tsx` |
| PERF-09 | **No image optimization** — Profile photos use raw `<img>` tags instead of Next.js `<Image>` component, missing automatic resizing, lazy loading, and format optimization. | LOW | Member profile, settings pages |
| PERF-10 | **No pagination on initial data loads** — Some list pages fetch with arbitrary limits (e.g., `payments?limit=50`) without considering whether the user needs that much data. | LOW | Finance overview page |

### Suggestions

1. **Replace revenue chart loop with single GROUP BY query** — Use `payment.groupBy({ by: ['paid_at'], _sum: { amount: true } })` with date truncation.
2. **Parallelize dashboard KPI queries** — Use `Promise.all()` for independent aggregate queries.
3. **Use pgvector for facial recognition** — Store face descriptors as vector type and use cosine similarity at the database level instead of JavaScript.
4. **Add React.lazy/dynamic imports** for heavy chart and scanner components.
5. **Leverage Next.js SSR** — Convert dashboard and list pages to server components where possible.
6. **Add `refetchOnWindowFocus: false`** and `enabled` conditions to prevent unnecessary API calls.

---

# SECTION 11 — SAAS MULTI-TENANT READINESS

### Architecture Assessment

| Capability | Status | Notes |
|------------|--------|-------|
| **Schema-per-tenant isolation** | Designed but NOT functional | TenantMiddleware exists but is NOT registered in app.module.ts. The `search_path` is never set in practice. |
| **Tenant ID in JWT** | Implemented | `studio_id` is stored in Supabase user_metadata and included in JwtPayload. |
| **Slug-based URL routing** | Implemented | Dynamic `[gymSlug]` routing separates tenant workspaces by URL. |
| **Branch-level data scoping** | Implemented | Non-owner users are filtered to their assigned `branch_ids[]`. |
| **Role-based permissions** | Implemented | 4 system roles + custom roles with module×action permission matrix. |
| **Subscription tier enforcement** | Partially implemented | Subscription plans are stored and displayed, but limits (max_members, max_branches, max_staff) are NOT enforced at the API level. |
| **Cross-tenant data protection** | NOT functional | Without TenantMiddleware registration, all data queries hit the default schema. |
| **Subdomain routing** | Not implemented | Uses path-based routing (`/{slug}/...`) rather than subdomains (`{slug}.fitsync.app`). |
| **Tenant provisioning** | Implemented | Schema cloning is handled in `auth.service.ts` → `setupStudio()`. |

### Limitations

1. **Critical: TenantMiddleware not active** — The most critical multi-tenancy component (search_path per request) is coded but never applied to the NestJS middleware pipeline.
2. **No subscription limit enforcement** — A free-tier studio can create unlimited members, branches, and staff because no guard checks plan limits before resource creation.
3. **No tenant-aware caching** — React Query cache keys don't include studio_id, potentially causing cross-tenant data contamination if the same browser switches between studios.
4. **No tenant data deletion/export** — No tooling exists for GDPR compliance (data export, account deletion, right to be forgotten).
5. **Single-database approach** — All tenant schemas live in the same PostgreSQL instance. At scale (1000+ tenants), this creates migration complexity and connection pool pressure.

### Readiness Score: 4/10

The architectural design is sound (schema-per-tenant with template cloning), but the critical middleware registration gap means multi-tenancy is effectively non-functional. This must be fixed before any production deployment.

---

# SECTION 12 — CODE QUALITY REVIEW

### Architecture Quality: 7/10

**Strengths:**
- Clean modular NestJS architecture with clear separation of concerns
- Consistent controller → service → Prisma pattern across all modules
- Well-defined guard/decorator system for cross-cutting concerns
- Custom permission system with sensible defaults

**Weaknesses:**
- TenantMiddleware designed but not wired (architectural gap)
- Audit logging infrastructure built but never invoked
- WebSocket/BullMQ dependencies installed but unused

### Modularity: 8/10

**Strengths:**
- Each backend feature is a self-contained NestJS module
- Frontend uses shared components (DataTable, StatusBadge, KPICard) consistently
- Centralized API client with token refresh logic
- Barrel exports in `common/index.ts`

**Weaknesses:**
- Settings/Roles/Audit modules are slightly thinner than core modules
- Some frontend pages contain business logic that could be extracted to hooks

### Naming Conventions: 8/10

**Strengths:**
- Consistent `snake_case` for database fields and API payloads
- Consistent `camelCase` for TypeScript code
- Descriptive file names (e.g., `branch-access.guard.ts`, `default-permissions.ts`)
- Consistent `*.controller.ts`, `*.service.ts`, `*.module.ts` pattern

**Weaknesses:**
- Minor inconsistency: `checkin_method` (no hyphen) vs `check-ins` (hyphenated folder)
- AI module uses `ai.controller.ts` while other modules spell out full names

### Technical Debt: 6/10

| Debt Item | Impact | Effort to Fix |
|-----------|--------|---------------|
| TenantMiddleware not registered | Critical | Low (1 hour) |
| Payment gateway verification mocked | Critical | Medium (1 day) |
| AI service returns mock data | High | Medium (1-2 days) |
| Rate limiting uses in-memory Map | High | Low (use Redis) |
| Audit service never called | Medium | Medium (wire into all services) |
| WebSocket/BullMQ unused | Low | Low (remove or implement) |
| No automated tests | High | High (weeks of effort) |
| No e2e test coverage | High | High |

### Overall Code Quality Score: 7/10

The codebase demonstrates solid foundational architecture with professional patterns. The primary concerns are around incomplete integrations (mocked services) and the critical TenantMiddleware registration gap.

---

# SECTION 13 — MISSING FEATURES

### Likely Required (Based on Product Type)

| Feature | Category | Priority | Notes |
|---------|----------|----------|-------|
| **Subscription billing integration** | Payments | CRITICAL | Plans are defined but no actual Razorpay/Stripe subscription billing is implemented. Studios can't pay for FitSync Pro itself. |
| **Plan limit enforcement** | Multi-tenancy | CRITICAL | Free plan allows unlimited resources — no guards check max_members, max_branches, max_staff before creation. |
| **Real-time notifications** | Communication | HIGH | WebSocket infrastructure exists (socket.io installed) but never initialized. No real-time check-in notifications, alert pushes, or live updates. |
| **Email transactional templates** | Communication | HIGH | Resend SDK is installed but no email templates exist for: welcome, payment receipt, membership expiry warning, password reset confirmation. |
| **SMS/WhatsApp delivery** | Marketing | HIGH | Twilio SDK not installed. WhatsApp API not integrated. Campaign "send" only updates status — no actual message delivery. |
| **PDF invoice generation** | Finance | MEDIUM | @react-pdf/renderer listed in TRD but not installed. No PDF generation for payment receipts or invoices. |
| **Automated membership expiry** | Members | HIGH | No cron job to automatically expire memberships when `end_date` passes. Expiry only detected during check-in attempts. |
| **Auto-renewal processing** | Members | MEDIUM | `auto_renew` flag exists on memberships but no scheduled job processes renewals or charges stored payment methods. |
| **Engagement score computation** | Members | MEDIUM | `engagement_score` field exists but no algorithm computes it. Always defaults to 0. |
| **Churn risk calculation** | Members | MEDIUM | `churn_risk` field exists but no algorithm calculates it. Always defaults to 'low'. |
| **Claude AI integration** | AI | HIGH | @anthropic-ai/sdk not installed. AI chat returns mock responses. Daily briefing partially uses real data but recommendations are mocked. |
| **File upload to Supabase Storage** | Infrastructure | MEDIUM | Profile photos and receipt URLs accept string URLs but no actual upload flow to Supabase Storage exists. |
| **Offline sync queue** | Check-in | LOW | idb (IndexedDB) listed in TRD but not installed. Frontend offline queue not implemented. |
| **Data export (CSV/PDF)** | Reports | MEDIUM | `export` permission action exists but no export functionality is implemented. |
| **Full-text search** | Members | LOW | Member search uses `contains` filter. No PostgreSQL full-text search or trgm index. |
| **Automated tests** | Quality | HIGH | Only a skeleton e2e test exists. No unit tests, integration tests, or test utilities. |
| **Error monitoring** | Operations | MEDIUM | Sentry SDK not installed. No structured error tracking. |
| **Analytics/tracking** | Operations | LOW | PostHog SDK not installed. No product analytics. |
| **RFID check-in** | Check-in | LOW | UI shows "Coming Soon" card. No backend support (intentionally deferred to Phase 2). |
| **Referral program** | Marketing | LOW | `referral_code` and `referred_by_member_id` fields exist in members table but no referral tracking, rewards, or UI is implemented. |
| **Staff shifts & leave management** | Staff | MEDIUM | Referenced in PRD but no tables, endpoints, or UI exist for shift scheduling or leave requests. |

---

# SECTION 14 — SCALABILITY REVIEW

### 1K Users (Small Studios)

| Component | Assessment | Bottleneck |
|-----------|-----------|------------|
| Database | Adequate | Single Supabase instance handles easily |
| API Server | Adequate | Single NestJS instance sufficient |
| Frontend | Adequate | Static assets + client rendering |
| Multi-tenancy | Risk | TenantMiddleware must be activated |

**Verdict:** Functional once TenantMiddleware is registered. Performance adequate.

### 10K Users (~100 Studios)

| Component | Assessment | Bottleneck |
|-----------|-----------|------------|
| Database | Moderate concern | 100 PostgreSQL schemas with 16 tables each = 1,600 tables. Query planning overhead increases. |
| API Server | Adequate with caveats | In-memory rate limiting fails across instances. Need Redis. |
| Dashboard queries | Concern | N+1 patterns in revenue chart and branch comparison degrade with data volume. |
| Facial recognition | Concern | Loading all members per branch for Euclidean distance is O(n). |

**Verdict:** Requires Redis for rate limiting, query optimization for dashboard, and facial recognition performance fix.

### 100K Users (~1,000 Studios)

| Component | Assessment | Bottleneck |
|-----------|-----------|------------|
| Database | Significant concern | 1,000 schemas × 16 tables = 16,000 tables. PostgreSQL catalog bloat, migration complexity (schema changes must be applied to ALL schemas). |
| Connection pooling | Critical | Prisma default pool per schema could exhaust database connections. Need PgBouncer or Supabase connection pooler. |
| Schema migrations | Critical | No tooling to migrate 1,000+ schemas atomically. Single migration file approach doesn't scale. |
| Search | Bottleneck | LIKE queries on member names/phones won't scale. Need full-text search indexes. |
| Caching | Missing | No Redis caching layer for frequently accessed data (KPIs, member lists). |

**Verdict:** Requires connection pooling, migration tooling, caching layer, and search optimization. Schema-per-tenant model should be evaluated against row-level security (RLS) at this scale.

### 1M Users (~10,000 Studios)

| Component | Assessment | Bottleneck |
|-----------|-----------|------------|
| Database | Fundamental redesign needed | 10,000 schemas is beyond practical schema-per-tenant limits in PostgreSQL. Catalog queries become extremely slow. |
| API | Horizontal scaling needed | Need containerized deployment with load balancing. Current single-instance design won't suffice. |
| Storage | Critical | Supabase Storage for profile photos, receipts needs CDN. |
| Background jobs | Critical | BullMQ infrastructure installed but unused. Membership expiry, engagement scoring, campaign delivery need async processing. |
| Monitoring | Critical | No observability stack (Sentry, PostHog, structured logging, APM). |

**Verdict:** Requires architectural shift — either migrate to row-level security (RLS) on a shared schema, or shard across multiple database instances. Full observability stack, CDN, and background job processing become mandatory.

### Scalability Bottleneck Summary

```
1K users    ──── [Register TenantMiddleware]
                 │
10K users   ──── [Redis rate limiting] [Query optimization] [Facial recognition DB-level]
                 │
100K users  ──── [Connection pooling] [Schema migration tooling] [Full-text search] [Redis caching]
                 │
1M users    ──── [RLS migration or sharding] [Horizontal API scaling] [CDN] [Background jobs] [Observability]
```

---

# SECTION 15 — ARCHITECTURE DIAGRAM (TEXT BASED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│                                                                              │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                    │
│   │   Web App     │   │  Mobile PWA  │   │  API Client  │                    │
│   │  (Next.js)    │   │  (Future)    │   │  (Future)    │                    │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                    │
└──────────┼──────────────────┼──────────────────┼────────────────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Vercel)                                    │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────┐         │
│   │  Next.js 14 App Router                                         │         │
│   │                                                                 │         │
│   │  ┌───────────┐  ┌──────────────┐  ┌──────────────┐            │         │
│   │  │ Middleware │  │  [gymSlug]   │  │  Public      │            │         │
│   │  │ (auth     │──│  Layout      │  │  Pages       │            │         │
│   │  │  cookie)  │  │ (slug guard) │  │(login/onbd)  │            │         │
│   │  └───────────┘  └──────┬───────┘  └──────────────┘            │         │
│   │                        │                                       │         │
│   │  ┌─────────┐  ┌───────┴───────┐  ┌──────────────┐            │         │
│   │  │ Zustand  │  │  App Pages    │  │  Shared      │            │         │
│   │  │ Auth     │  │  (34 routes)  │  │  Components  │            │         │
│   │  │ Store    │  │               │  │  (DataTable,  │            │         │
│   │  └─────────┘  └───────┬───────┘  │  KPICard...) │            │         │
│   │                       │          └──────────────┘            │         │
│   │  ┌─────────────┐     │                                       │         │
│   │  │ React Query  │◄───┘ API calls                             │         │
│   │  │ (cache layer)│                                             │         │
│   │  └──────┬──────┘                                             │         │
│   │         │                                                     │         │
│   │  ┌──────▼──────┐                                             │         │
│   │  │  API Client  │ Auto token refresh on 401                  │         │
│   │  │  (fetch)     │                                             │         │
│   │  └──────┬──────┘                                             │         │
│   └─────────┼──────────────────────────────────────────────────────┘         │
└─────────────┼────────────────────────────────────────────────────────────────┘
              │ HTTPS
              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Railway)                                    │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────┐         │
│   │  NestJS 10 API Server (Port 4000)                              │         │
│   │                                                                 │         │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────────┐                 │         │
│   │  │ Helmet   │  │Throttler │  │ ValidationPipe│                 │         │
│   │  │(security)│  │(rate lim)│  │ (DTO check)   │                 │         │
│   │  └──────────┘  └──────────┘  └──────────────┘                 │         │
│   │                                                                 │         │
│   │  ┌──────────────────────────────────────────────┐              │         │
│   │  │              GUARD CHAIN                      │              │         │
│   │  │  JwtAuthGuard → RolesGuard → PermissionsGuard │              │         │
│   │  │                    ↓                          │              │         │
│   │  │           TenantMiddleware                    │              │         │
│   │  │     (sets search_path per studio)             │              │         │
│   │  └──────────────────────────────────────────────┘              │         │
│   │                                                                 │         │
│   │  ┌──────────────────────────────────────────────┐              │         │
│   │  │              FEATURE MODULES                  │              │         │
│   │  │                                               │              │         │
│   │  │  Auth │ Members │ CheckIns │ Payments         │              │         │
│   │  │  Classes │ Staff │ Marketing │ AI             │              │         │
│   │  │  Dashboard │ Branches │ Settings              │              │         │
│   │  │  Roles │ Audit                                │              │         │
│   │  └──────────────────┬───────────────────────────┘              │         │
│   │                     │                                           │         │
│   │  ┌──────────────────▼───────────────────────────┐              │         │
│   │  │           PrismaService (Global)              │              │         │
│   │  │     Single PrismaClient instance              │              │         │
│   │  └──────────────────┬───────────────────────────┘              │         │
│   └─────────────────────┼──────────────────────────────────────────┘         │
└─────────────────────────┼────────────────────────────────────────────────────┘
                          │ PostgreSQL Protocol
                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (Cloud)                                      │
│                                                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐               │
│   │  PostgreSQL DB   │  │  Supabase Auth   │  │  Supabase    │               │
│   │                  │  │  (JWT issuer)    │  │  Storage     │               │
│   │  ┌────────────┐ │  │                  │  │  (file store)│               │
│   │  │   public    │ │  │  - signUp        │  │              │               │
│   │  │   schema    │ │  │  - signIn        │  │  (not yet    │               │
│   │  │  ─────────  │ │  │  - verify        │  │   wired)     │               │
│   │  │  studios    │ │  │  - refresh       │  │              │               │
│   │  │  plans      │ │  │  - resetPassword │  └──────────────┘               │
│   │  │  invoices   │ │  │  - user_metadata │                                │
│   │  └────────────┘ │  └─────────────────┘                                  │
│   │                  │                                                       │
│   │  ┌────────────┐ │  ┌─────────────────┐                                  │
│   │  │ studio_001 │ │  │  (Future)        │                                  │
│   │  │ studio_002 │ │  │  - Realtime      │                                  │
│   │  │ studio_003 │ │  │  - Edge Functions│                                  │
│   │  │ studio_... │ │  └─────────────────┘                                  │
│   │  └────────────┘ │                                                        │
│   │  (per-tenant    │                                                        │
│   │   schemas)      │                                                        │
│   └─────────────────┘                                                        │
│                                                                              │
│   ┌─────────────────┐  ┌─────────────────┐                                  │
│   │  Upstash Redis   │  │  External APIs   │                                 │
│   │  (planned)       │  │                  │                                  │
│   │  - Rate limiting │  │  - Razorpay      │                                 │
│   │  - Session cache │  │  - Stripe        │                                 │
│   │  - Job queues    │  │  - Twilio        │                                 │
│   │                  │  │  - Resend        │                                  │
│   │  (not yet wired) │  │  - Anthropic     │                                 │
│   └─────────────────┘  │  - Meta WhatsApp │                                 │
│                         │                  │                                  │
│                         │  (not yet wired) │                                  │
│                         └─────────────────┘                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 16 — FINAL SYSTEM SUMMARY

## System Maturity Level

**Alpha / Pre-Production** — The system has a complete application shell with well-structured backend modules, comprehensive frontend pages, and a sound database design. However, critical infrastructure gaps (tenant middleware registration, payment verification, AI integration) and missing production features (email delivery, real-time notifications, automated tests) prevent production deployment.

## Production Readiness

**NOT production-ready.**

Key blockers:
1. TenantMiddleware not registered — multi-tenancy is non-functional
2. Payment gateway verification is mocked — security risk
3. No automated test suite — zero confidence in regression safety
4. Login rate limiting uses ephemeral in-memory storage
5. Auth cookie missing Secure flag
6. No subscription limit enforcement
7. No error monitoring (Sentry) or logging infrastructure

## Top 10 Improvements Required (Priority-Ordered)

| # | Improvement | Category | Impact |
|---|------------|----------|--------|
| 1 | **Register TenantMiddleware in AppModule** — Wire the middleware via `NestModule.configure()` to set `search_path` on every authenticated request. Without this, all tenants share one schema. | Multi-tenancy | CRITICAL — System-breaking |
| 2 | **Implement Razorpay/Stripe HMAC verification** — Replace mock signature verification with actual cryptographic validation in `payments.service.ts`. | Security | CRITICAL — Financial risk |
| 3 | **Migrate rate limiting to Redis** — Replace in-memory `Map` with Upstash Redis for login rate limiting. Works across instances and survives restarts. | Security | HIGH |
| 4 | **Add Secure + HttpOnly flags to auth cookie** — Update cookie setting in `auth-store.ts` and `api.ts` to include `Secure; HttpOnly` in production. | Security | HIGH |
| 5 | **Enforce subscription plan limits** — Add guard or service-level checks before creating members, branches, and staff to ensure counts don't exceed plan limits. | Business Logic | HIGH |
| 6 | **Integrate Anthropic Claude API** — Replace mock AI responses with actual Claude API calls for chat and daily briefing. Install `@anthropic-ai/sdk`. | Feature | HIGH |
| 7 | **Wire audit logging into all services** — Call `audit.service.log()` from every create/update/delete operation across all modules. | Compliance | HIGH |
| 8 | **Add automated membership expiry cron** — Use `@nestjs/schedule` to run a nightly job that expires memberships past their `end_date` and updates member status. | Business Logic | HIGH |
| 9 | **Optimize dashboard queries** — Replace 12-iteration revenue chart with single GROUP BY query. Parallelize KPI aggregation with `Promise.all()`. Fix N+1 in branch comparison. | Performance | MEDIUM |
| 10 | **Build automated test suite** — Add unit tests for services (especially auth, payments, check-ins) and E2E tests for critical user flows (registration, login, check-in, payment). | Quality | HIGH |

---

*Report generated by Architecture Review Board — March 13, 2026*
