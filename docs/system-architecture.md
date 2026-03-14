# FitSync Pro — System Architecture

## 1. System Architecture Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Next.js 14 (App Router) — Vercel                              │ │
│  │  ├── Zustand (auth store, persisted to localStorage)           │ │
│  │  ├── React Query (server state, 60s stale time)                │ │
│  │  ├── shadcn/ui + Tailwind CSS 3.x (design system)             │ │
│  │  ├── Recharts (data visualization)                             │ │
│  │  ├── react-hook-form + zod (form validation)                   │ │
│  │  ├── face-api.js (on-device facial recognition)                │ │
│  │  └── html5-qrcode (QR scanning)                                │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ HTTPS (REST API)
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  NestJS 10.x — Railway                                         │ │
│  │  ├── JwtAuthGuard (Supabase token verification)                │ │
│  │  ├── RolesGuard (RBAC: owner, manager, trainer, front_desk)    │ │
│  │  ├── TenantMiddleware (schema-per-tenant isolation)            │ │
│  │  ├── ValidationPipe (class-validator, whitelist mode)          │ │
│  │  └── Global prefix: /api/v1                                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────┬────────────────┬────────────────┬──────────────────────────────┘
      │                │                │
      ▼                ▼                ▼
┌──────────┐  ┌──────────────┐  ┌──────────────────┐
│ Supabase │  │ Upstash Redis│  │ External Services│
│ (Primary)│  │ (Planned)    │  │                  │
│          │  │              │  │ ├── Razorpay     │
│ ├── Auth │  │ ├── BullMQ   │  │ ├── Stripe      │
│ ├── PgSQL│  │ ├── Rate     │  │ ├── Twilio      │
│ ├── Store│  │ │   Limiting │  │ ├── Resend      │
│ └── Real │  │ └── Sessions │  │ ├── WhatsApp API│
│    time  │  │              │  │ └── Claude AI   │
└──────────┘  └──────────────┘  └──────────────────┘
```

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 14.2.35 | SSR/CSR React framework |
| | TypeScript | ^5.x | Type safety |
| | Tailwind CSS | 3.4.x | Utility-first CSS |
| | shadcn/ui | new-york | Radix-based component library |
| | Zustand | 5.x | Client state management |
| | React Query | 5.x | Server state & caching |
| | Recharts | 3.x | Data visualization |
| | react-hook-form | 7.x | Form handling |
| | zod | 4.x | Schema validation |
| | face-api.js | 0.22.x | On-device facial recognition |
| | lucide-react | 0.577.x | Icon library |
| | sonner | 2.x | Toast notifications |
| **Backend** | NestJS | 10.x | Node.js framework |
| | Prisma | 5.x | ORM + migrations |
| | class-validator | 0.15.x | DTO validation |
| | Supabase JS | 2.x | Auth + DB client |
| | BullMQ | 5.x | Job queues (imported, not wired) |
| | socket.io | 4.x | WebSocket (imported, not wired) |
| **Database** | PostgreSQL | 15.x | Primary database (Supabase) |
| **Auth** | Supabase Auth | — | JWT issuance + user management |
| **Hosting** | Vercel | — | Frontend deployment |
| | Railway | — | Backend deployment |

## 3. Folder Structure

```
fitsync-pro/
├── frontend/                         # Next.js 14 App
│   ├── src/
│   │   ├── app/                      # 32 route pages
│   │   │   ├── login/                # Auth pages
│   │   │   ├── onboarding/
│   │   │   ├── forgot-password/
│   │   │   ├── dashboard/            # Dashboard + branch comparison
│   │   │   ├── members/              # List, New, [id] detail
│   │   │   ├── check-in/             # QR, Manual, Facial, Hub
│   │   │   ├── finance/              # Dashboard, Payments, Expenses
│   │   │   ├── staff/                # List, New, [id], Analytics
│   │   │   ├── schedule/             # Weekly calendar
│   │   │   ├── classes/              # New, [id] detail
│   │   │   ├── marketing/            # Dashboard, Campaigns, Automation
│   │   │   ├── ai/                   # Chat, Briefing
│   │   │   └── settings/             # Studio, Plans, Integrations
│   │   ├── components/
│   │   │   ├── layout/app-layout.tsx # Sidebar + topbar shell
│   │   │   ├── shared/               # 8 reusable components
│   │   │   ├── auth/                 # ProtectedRoute wrapper
│   │   │   └── ui/                   # 14 shadcn/ui components
│   │   ├── lib/
│   │   │   ├── api.ts                # REST client with auto-auth
│   │   │   ├── types.ts              # 15+ TypeScript interfaces
│   │   │   ├── utils.ts              # cn() helper
│   │   │   └── supabase.ts           # Supabase client init
│   │   └── stores/
│   │       └── auth-store.ts         # Zustand + persist
│   └── package.json
│
├── backend/                          # NestJS 10 API
│   ├── src/
│   │   ├── auth/                     # 6 endpoints, DTOs, Supabase auth
│   │   ├── branches/                 # CRUD
│   │   ├── members/                  # CRUD + freeze/renew/face-descriptor
│   │   ├── check-ins/                # QR, facial, manual, sync, heatmap
│   │   ├── payments/                 # Cash, gateway orders, verify, invoices
│   │   ├── classes/                  # CRUD + enrollment + waitlist
│   │   ├── staff/                    # CRUD + trainer analytics
│   │   ├── dashboard/                # KPIs, charts, alerts, activity
│   │   ├── marketing/                # Campaigns CRUD + send
│   │   ├── ai/                       # Chat, briefing, conversations
│   │   ├── common/
│   │   │   ├── guards/               # JwtAuthGuard, RolesGuard
│   │   │   ├── middleware/            # TenantMiddleware
│   │   │   └── decorators/           # @CurrentUser, @Roles
│   │   └── prisma/                   # PrismaService (global)
│   ├── prisma/schema.prisma          # 14 models, 2-schema architecture
│   └── package.json
│
├── docs/                             # Documentation
│   ├── PRD_v1.0.md                   # Product requirements
│   ├── TRD_v1.0.md                   # Technical requirements
│   ├── alignment-report.md           # UI ↔ API gap analysis
│   ├── SCREEN_MAP.md                 # PNG → Screen ID mapping
│   └── screens/                      # 47 Figma PNG exports
│
└── tasks/
    ├── todo.md                       # Build plan (phased)
    └── lessons.md                    # Patterns & pitfalls
```

## 4. Dependency Graph

```
AppModule
├── ConfigModule (global)
├── PrismaModule (global — provides PrismaService to all)
├── AuthModule → PrismaModule, ConfigService
├── BranchesModule → PrismaModule
├── MembersModule → PrismaModule (includes PlansController + PlansService)
├── CheckInsModule → PrismaModule
├── PaymentsModule → PrismaModule (includes ExpensesController + ExpensesService)
├── ClassesModule → PrismaModule
├── StaffModule → PrismaModule
├── MarketingModule → PrismaModule
├── AiModule → PrismaModule
└── DashboardModule → PrismaModule
```

## 5. Database Schema

### Multi-Tenant Architecture
- **public schema**: `studios` table (tenant registry)
- **studio_template**: Template schema cloned per tenant
- **studio_{uuid}**: Per-tenant isolated schemas
- Tenant switching: `SET search_path TO "studio_{id}", public`

### 14 Database Models

| Model | Table | Records | Key Relations |
|-------|-------|---------|---------------|
| Studio | public.studios | 1 per gym | owner_user_id |
| Branch | branches | Multi per studio | → members, plans, classes |
| Member | members | Core entity | → branch, memberships, check_ins, payments |
| MembershipPlan | membership_plans | Plan catalog | → branch (optional), memberships |
| MemberMembership | member_memberships | Active/frozen/expired | → member, plan, branch |
| CheckIn | check_ins | High volume | → member, membership, branch, class |
| Class | classes | Scheduled sessions | → branch, trainer, enrollments |
| ClassEnrollment | class_enrollments | Booking/waitlist | → class, member |
| Staff | staff | Employees | → branches (array), classes |
| Payment | payments | Financial records | → member, membership, branch |
| Expense | expenses | Business expenses | → branch, recorded_by staff |
| NotificationLog | notifications_log | Delivery tracking | → member |
| Campaign | campaigns | Marketing campaigns | → created_by staff |
| AiConversation | ai_conversations | Chat history | → staff |

## 6. API Architecture

- **Base URL**: `/api/v1/`
- **Auth**: All endpoints (except `/auth/*`) require `Authorization: Bearer {jwt}`
- **Pagination**: `?page=1&limit=20` → `{ data: T[], total, page, limit }`
- **Validation**: DTOs with class-validator (whitelist + forbidNonWhitelisted)
- **Error format**: `{ message: string, error: string, statusCode: number }`

### Endpoint Count by Module

| Module | Endpoints | Auth Required |
|--------|-----------|---------------|
| Auth | 6 | No |
| Branches | 3 | Yes |
| Members | 7 | Yes |
| Plans | 5 | Yes |
| Check-ins | 5 | Yes |
| Payments | 5 | Yes |
| Classes | 7 | Yes |
| Staff | 5 | Yes |
| Dashboard | 5 | Yes |
| AI | 3 | Yes |
| Marketing | 6 | Yes |
| Health | 1 | No |
| **Total** | **58** | |

## 7. State Management Architecture

### Client State (Zustand)
- **auth-store**: user, studio, tokens, isAuthenticated
- Persisted to `localStorage` key: `auth-storage`
- Hydrated on page load

### Server State (React Query)
- 60-second stale time (cache revalidation)
- 1 retry on failure
- Query keys: `["members"]`, `["dashboard-kpis"]`, `["member", id]`, etc.
- Mutations invalidate related queries on success

## 8. Authentication & Authorization

### Auth Flow
1. User submits credentials → `POST /auth/login`
2. Backend validates against Supabase Auth
3. Returns JWT (`access_token`) + `refresh_token`
4. Frontend stores in Zustand (persisted to localStorage)
5. API client auto-attaches `Authorization: Bearer {token}` to every request
6. JwtAuthGuard verifies token with Supabase `auth.getUser()`
7. TenantMiddleware sets `search_path` to studio schema

### RBAC Roles
| Role | Permissions |
|------|------------|
| owner | Full access, can see salary, manage billing |
| manager | Branch-level management, staff scheduling |
| trainer | View own classes, attendance |
| front_desk | Check-ins, member lookup |

### Login Throttling
- 5 failed attempts → 15-minute lockout (in-memory Map, not Redis)

## 9. Environment Configuration

### Backend (.env)
| Variable | Required | Purpose |
|----------|----------|---------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_ANON_KEY | Yes | Public client key |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Admin key (backend only) |
| JWT_SECRET | Yes | JWT signing (currently unused — Supabase handles) |
| PORT | No | API port (default: 4000) |
| CORS_ORIGINS | No | Comma-separated allowed origins |
| ANTHROPIC_API_KEY | Planned | Claude AI integration |
| RAZORPAY_KEY_ID/SECRET | Planned | Payment gateway |
| STRIPE_SECRET_KEY | Planned | Payment gateway |

### Frontend (.env.local)
| Variable | Required | Purpose |
|----------|----------|---------|
| NEXT_PUBLIC_API_URL | No | Backend URL (default: localhost:4000) |
| NEXT_PUBLIC_SUPABASE_URL | Yes | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes | Public client key |

## 10. External Integrations

| Service | Status | Purpose |
|---------|--------|---------|
| Supabase Auth | **Active** | User management, JWT, login |
| Supabase PostgreSQL | **Active** | Primary database |
| Supabase Storage | **Planned** | Photos, invoices, receipts |
| Supabase Realtime | **Planned** | Live check-in feed |
| Razorpay | **Stubbed** | Indian payment gateway |
| Stripe | **Stubbed** | International payments |
| Anthropic Claude | **Stubbed** | AI business advisor |
| Twilio | **Planned** | SMS notifications |
| Meta WhatsApp API | **Planned** | WhatsApp messaging |
| Resend | **Planned** | Email delivery |
| Upstash Redis | **Planned** | Job queues, rate limiting |
| Sentry | **Planned** | Error monitoring |
| PostHog | **Planned** | Product analytics |
