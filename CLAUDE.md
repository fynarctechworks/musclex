# FitSync Pro — Project Instructions

## What This Project Is

FitSync Pro is a cloud-native, AI-powered gym management SaaS platform for fitness studio owners. It replaces spreadsheets, WhatsApp groups, and paper registers with one intelligent operating system.

## Documentation

- **PRD (Product Requirements):** `docs/PRD_v1.0.md` — features, user flows, design system, screen inventory
- **TRD (Technical Requirements):** `docs/TRD_v1.0.md` — database schema, API endpoints, tech stack, deployment
- **UI Screens:** `docs/screens/` — organized by module, PNG exports from Figma
- **Alignment Report:** `docs/alignment-report.md` — known mismatches between screens and backend specs
- **Screen Map:** `docs/SCREEN_MAP.md` — maps every PNG filename to its PRD screen ID
- **Build Plan:** `tasks/todo.md` — phased checklist

**The TRD is the single source of truth for all technical decisions.** If there's a conflict between screens and the TRD, follow the TRD.

## Workflow Rules

### Plan Mode
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Write detailed specs upfront to reduce ambiguity

### Build Order (STRICT — do not skip ahead)
Each phase depends on the previous. Never jump ahead.

1. **Project Setup** — Next.js 14 + NestJS + Prisma + Supabase + shared components
2. **Auth** — Login, JWT, RBAC, tenant middleware, onboarding
3. **Members** — CRUD, plans, profiles, registration
4. **Check-in** — QR + Manual + Facial Recognition (RFID skipped in Phase 1)
5. **Payments** — Manual recording + Razorpay + Stripe + invoices + expenses
6. **Dashboard** — KPIs, revenue chart, alerts, activity feed, branch comparison
7. **Classes & Schedule** — Class CRUD, calendar, roster, waitlist, trainer assignment
8. **Staff** — Directory, profiles, shifts, leave requests, performance
9. **Marketing** — Campaigns, automation rules, message templates, referral program
10. **AI Advisor** — Claude API chat, daily briefing, proactive alerts
11. **Settings** — Studio settings, integrations, membership plan management

### Shared Components FIRST
Before building any pages, create these shared components:
- `AppLayout` — sidebar navigation + top bar (consistent across ALL pages)
- `DataTable` — reusable table with search, filters, pagination, sorting
- `StatusBadge` — Active (green), Expiring (yellow), Expired (red), Frozen (blue)
- `KPICard` — metric card with label, value, trend indicator
- `Modal` / `Dialog` — confirmation dialogs, forms in modals
- `FormInput`, `FormSelect`, `FormDatePicker` — consistent form elements
- `EmptyState` — placeholder for screens with no data
- `LoadingSkeleton` — shimmer loading states

### Task Management
1. Write plan to `tasks/todo.md` with checkable items before starting
2. Mark items complete as you go
3. After corrections, update `tasks/lessons.md` with the pattern
4. Never mark a task complete without proving it works

## Tech Stack (from TRD Section 3 — do not deviate)

### Frontend (Web)
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS 3.x + shadcn/ui
- **State:** Zustand 4.x
- **Data Fetching:** @tanstack/react-query 5.x
- **Charts:** Recharts 2.x
- **Calendar:** @fullcalendar/react 6.x
- **Forms:** react-hook-form 7.x + zod 3.x
- **Tables:** @tanstack/react-table 8.x
- **QR Scanner:** html5-qrcode 2.x
- **QR Generator:** qrcode.react 3.x
- **Facial Recognition:** face-api.js 0.22.x (on-device, NO cloud)
- **PDF Generation:** @react-pdf/renderer 3.x
- **Offline Queue:** idb 8.x (IndexedDB)
- **Icons:** lucide-react
- **Toasts:** sonner
- **Supabase Client:** @supabase/supabase-js 2.x
- **Date Handling:** date-fns 3.x

### Backend (API)
- **Framework:** NestJS 10.x + TypeScript
- **ORM:** Prisma 5.x
- **Validation:** class-validator + class-transformer
- **WebSocket:** @nestjs/websockets + socket.io
- **Job Queues:** @nestjs/bullmq + bullmq (Upstash Redis)
- **Scheduled Tasks:** @nestjs/schedule
- **Auth:** @nestjs/jwt + @nestjs/passport
- **HTTP Client:** @nestjs/axios

### External SDKs
- **Payments:** razorpay (India primary) + stripe (international)
- **SMS:** twilio
- **WhatsApp:** Meta WhatsApp Cloud API (direct HTTP)
- **Email:** resend + React Email templates
- **AI:** @anthropic-ai/sdk (Claude claude-sonnet-4-20250514)

### Infrastructure
- **Web Hosting:** Vercel
- **API Hosting:** Railway
- **Database:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Redis:** Upstash Redis
- **Monitoring:** Sentry + Posthog




## Database Rules (from TRD Section 4)

- All field names are EXACT as specified in the TRD — use them verbatim
- snake_case throughout
- UUIDs for all primary keys
- All tables include created_at and updated_at
- Multi-tenancy: separate PostgreSQL schema per studio (studio_{studio_id})

## API Rules (from TRD Section 5)

- Base URL: /api/v1/
- All endpoints require Authorization: Bearer {jwt_token} except /auth/*
- JWT payload contains: user_id, studio_id, role, branch_ids[]
- TenantMiddleware sets search_path = studio_{studio_id} before every query

## Security Rules (from TRD Section 6)

- face_descriptor field: NEVER returned in any API response (write-only)
- payment_method_token: NEVER returned in API responses
- salary field: stripped from staff responses unless role === "owner"
- Supabase Storage: all buckets private, served via signed URLs (1-hour expiry)
- Webhook endpoints: verify HMAC signature before processing
- Max 5 failed logins → 15-minute lockout (Redis TTL)

## Known Issues (from alignment report)

These are known mismatches between current UI screens and the TRD. When implementing, follow the TRD spec:

1. **RFID check-in:** Show as greyed out "Coming Soon" — not wired to backend in Phase 1
2. **Payment methods:** Use cash | card | upi | bank_transfer | razorpay | stripe — NOT PayPal
3. **Member ID format:** FS-YYYYMMDD-XXXX — standardize across all screens
4. **Receipt number format:** RCP-YYYYMMDD-XXXX — as per TRD
5. **Integrations:** Anthropic Claude (not OpenAI), Resend (not SendGrid), Razorpay + Stripe (not PayPal)
6. **Member Goals section on profile:** Not in TRD — skip implementation

## Performance Targets (from TRD Section 9)

- Dashboard initial load: < 2s
- Check-in confirmation: < 1s
- AI advisor response: < 4s
- Member list (500 members): < 1.5s
- QR scan to confirmation: < 2s
- All Supabase queries: < 100ms P95
