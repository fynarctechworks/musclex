# SaaS Control Center — Project Summary

## What This Is
A **standalone NestJS microservice** (`saas-control-center/`) that acts as the "God Mode" admin backend for the MuscleX gym management SaaS platform. It is deployed independently from the main app and controls all tenants, subscriptions, billing, feature flags, and analytics globally.

## Tech Stack
- **Runtime:** Node.js + NestJS 10.x + TypeScript
- **ORM:** Prisma 5.x (PostgreSQL)
- **Cache/Queues:** Redis (ioredis)
- **Auth:** JWT (access + refresh tokens), SUPER_ADMIN only
- **Docs:** Swagger at `/docs`
- **Containerized:** Docker multi-stage build + docker-compose (API + Postgres 16 + Redis 7)

## Project Structure
```
saas-control-center/
├── prisma/
│   ├── schema.prisma        # 13 models, 6 enums, full indexing
│   └── seed.ts              # Bootstrap data: admin, 3 plans, 8 feature flags, 3 tenants
├── src/
│   ├── main.ts              # Bootstrap: Helmet, CORS, Swagger, GlobalExceptionFilter, ValidationPipe
│   ├── app.module.ts        # Root: ThrottlerGuard + ScheduleModule + all modules
│   ├── config/
│   │   └── redis.module.ts  # Global Redis provider
│   ├── database/
│   │   ├── database.module.ts
│   │   └── prisma.service.ts
│   ├── common/
│   │   ├── guards/jwt-auth.guard.ts          # Global JWT guard with @Public() bypass
│   │   ├── decorators/public.decorator.ts     # Mark routes as public (no auth)
│   │   ├── decorators/current-admin.decorator.ts  # Extract admin from JWT
│   │   ├── filters/global-exception.filter.ts # Catches all exceptions, formats response
│   │   ├── interceptors/response-transform.interceptor.ts  # Wraps responses in { success, data, meta }
│   │   └── dto/pagination.dto.ts              # Reusable PaginationDto + PaginatedResult<T>
│   └── modules/
│       ├── auth/           # JWT login, refresh, 5-attempt lockout, impersonation tokens
│       ├── tenant/         # CRUD, plan change, suspend/activate, impersonate
│       ├── plans/          # Plan CRUD + Discount system (scheduled, auto-deactivate cron)
│       ├── subscription/   # Lifecycle mgmt, expiry cron, auto-renew
│       ├── billing/        # Record/retry/mark-paid/refund payments
│       ├── feature-flags/  # tenant > plan > global resolution, Redis-cached (5min TTL)
│       ├── dashboard/      # KPIs: MRR, ARR, churn rate, tenant counts (Redis-cached 1min)
│       ├── analytics/      # Revenue trend, plan distribution, growth, sub breakdown
│       ├── audit-logs/     # Every mutation logged with admin ID, IP, user-agent, old/new values
│       └── health/         # GET /health — DB + Redis checks for load balancers
├── docker/
│   ├── Dockerfile           # Multi-stage build
│   └── docker-compose.yml   # API (port 4000) + Postgres (5433) + Redis (6380)
├── test/jest-e2e.json
├── .env.example
├── .dockerignore
├── .eslintrc.js
├── .gitignore
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
└── package.json
```

## Database Models (prisma/schema.prisma)
| Model | Purpose |
|-------|---------|
| AdminUser | Super admin accounts (email, password_hash, last_login) |
| Tenant | Gyms/studios (name, slug, owner, status, plan, limits) |
| SubscriptionPlan | Starter/Pro/Enterprise (pricing, features JSON, limits JSON) |
| Subscription | Tenant-plan relationship (lifecycle, auto-renew, expiry) |
| Payment | Transaction records (amount, gateway, status, retry_count) |
| Discount | Promo codes & festival sales (%, flat, date-range, max uses) |
| FeatureFlag | Global feature definitions (key, is_global) |
| PlanFeatureFlag | Plan-level flag overrides |
| TenantFeatureFlag | Tenant-level flag overrides (highest priority) |
| AuditLog | All admin actions with before/after snapshots |

## API Endpoints (40 total, base: /api/v1)
### Auth (public)
- `POST /auth/login` — Login, returns access + refresh tokens
- `POST /auth/refresh` — Refresh access token

### Tenants
- `GET /tenants` — List (paginated, search, filter by status/plan/active)
- `GET /tenants/:id` — Full details with subscriptions, payments, flags
- `POST /tenants` — Create (14-day trial auto-set)
- `PATCH /tenants/:id` — Update details
- `PATCH /tenants/:id/plan` — Change plan (creates new subscription atomically)
- `POST /tenants/:id/suspend` — Suspend tenant
- `POST /tenants/:id/activate` — Activate tenant
- `POST /tenants/:id/impersonate` — Generate 1h impersonation JWT

### Plans
- `GET /plans` — List all (optionally include inactive)
- `GET /plans/:id` — Plan details with tenant list
- `POST /plans` — Create plan
- `PATCH /plans/:id` — Update plan
- `POST /plans/:id/toggle` — Toggle active/inactive

### Discounts
- `GET /discounts` — List (optionally include expired)
- `GET /discounts/price/:planId?cycle=monthly|yearly` — Effective price after best discount
- `POST /discounts` — Create discount
- `PATCH /discounts/:id` — Update discount

### Subscriptions
- `GET /subscriptions` — List (filter by status/tenant/plan)
- `GET /subscriptions/expiring?days=7` — Expiring soon
- `POST /subscriptions` — Create (cancels existing active sub)
- `POST /subscriptions/:id/cancel` — Cancel

### Billing
- `GET /billing/payments` — List (filter by status/tenant/gateway)
- `POST /billing/payments` — Record manual payment
- `POST /billing/payments/:id/retry` — Retry failed (max 3)
- `POST /billing/payments/:id/mark-paid` — Manual mark as paid
- `POST /billing/payments/:id/refund` — Refund

### Dashboard & Analytics
- `GET /dashboard/metrics` — KPIs (MRR, ARR, churn, tenants breakdown)
- `GET /analytics/revenue-trend?months=12` — Monthly revenue chart
- `GET /analytics/plan-distribution` — Tenants per plan with %
- `GET /analytics/growth?months=12` — Signups + cumulative
- `GET /analytics/subscription-breakdown` — Status distribution

### Feature Flags
- `GET /feature-flags` — All flags with plan/tenant overrides
- `GET /feature-flags/resolve/:tenantId` — Resolved flags (tenant > plan > global)
- `POST /feature-flags` — Create flag
- `PATCH /feature-flags/:id` — Update flag
- `POST /feature-flags/plan` — Set plan-level flag
- `POST /feature-flags/tenant` — Set tenant-level override

### Audit & Health
- `GET /audit-logs` — Filtered log history (action, entity, admin, date range)
- `GET /health` — DB + Redis health check (public, no auth)

## Key Business Logic
1. **Plan change** → atomic transaction: updates tenant, creates new subscription, cancels old
2. **Feature flag resolution** → `tenant override > plan override > global`, cached in Redis (5min TTL)
3. **Discount engine** → best active discount auto-applied, expired discounts auto-deactivated (daily cron)
4. **Subscription lifecycle** → daily cron at midnight: auto-renews or expires, updates tenant status
5. **Login security** → 5 failed attempts → 15min Redis-based lockout
6. **Audit trail** → every write operation logged with admin_id, IP, user-agent, before/after JSON
7. **Impersonation** → generates scoped JWT (1h expiry) for "login as tenant"

## Security
- All routes require JWT except `/auth/login`, `/auth/refresh`, `/health`
- Global ThrottlerGuard (60 req/min)
- Helmet + CORS + compression middleware
- Input validation via class-validator (whitelist + forbidNonWhitelisted)
- Global exception filter catches all errors with consistent response format

## Setup Commands
```bash
cd saas-control-center
cp .env.example .env        # Edit with real values
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed          # Creates admin, plans, flags, sample tenants
npm run start:dev           # http://localhost:4000
                            # Swagger: http://localhost:4000/docs
```

### Docker
```bash
npm run docker:up           # Starts API + Postgres + Redis
```

## Default Credentials
- **Email:** admin@musclex.com
- **Password:** change-this-in-production (set via SUPER_ADMIN_PASSWORD env var)

## Seed Data
- 3 plans: Starter (₹499/mo), Pro (₹1499/mo), Enterprise (₹4999/mo)
- 8 feature flags: check_in, facial_recognition, ai_advisor, classes, marketing, multi_branch, api_access, white_label
- 3 sample tenants: Iron Paradise (Pro), FitZone (Trial), MuscleFactory (Enterprise)
