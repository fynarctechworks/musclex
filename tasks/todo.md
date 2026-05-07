# FitSync Pro — Build Plan

## Phase 1: Project Setup & Shared Components

### 1.1 Frontend Setup
- [x] Initialize Next.js 14 project with App Router + TypeScript
- [x] Install and configure Tailwind CSS 3.x
- [x] Install and init shadcn/ui (new-york style, dark theme)
- [x] Configure design tokens from PRD Section 13 (colors, typography, spacing)
- [x] Install all frontend dependencies from TRD Section 3.1
- [x] Set up project folder structure: app/, components/, lib/
- [x] Configure path aliases (@/components, @/lib, etc.)
- [x] Set up react-query provider + sonner toaster
- [ ] Set up environment variables (.env.local template)

### 1.2 Backend Setup
- [x] Initialize NestJS project with TypeScript
- [x] Install and configure Prisma ORM (placeholder schema)
- [x] Install all backend dependencies from TRD Section 3.1
- [x] Set up module structure: auth, members, check-ins, payments, classes, staff, marketing, ai, dashboard
- [x] Create PrismaModule (global)
- [x] Configure @nestjs/config (global)
- [ ] Set up Supabase project (copy keys to .env)
- [ ] Create public schema tables: studios, subscriptions
- [ ] Set up full Prisma schema matching TRD Section 4
- [ ] Configure environment variables (.env template)
- [ ] Set up health check endpoint (GET /health)

### 1.3 Shared Components (Frontend)
- [x] AppLayout — sidebar + topbar (matches dashboard screenshot)
- [x] DataTable — with search, filters, pagination, column sorting (@tanstack/react-table)
- [x] StatusBadge — Active/Expiring/Expired/Frozen/Pending
- [x] KPICard — icon, value, label, trend indicator (+/-%)
- [x] ConfirmDialog — modal for destructive actions
- [x] FormInput, FormSelect, FormTextarea, FormDatePicker, FormFileUpload
- [x] EmptyState — icon + message + action button
- [x] LoadingSkeleton / CardSkeleton / TableSkeleton

### 1.4 Infrastructure
- [ ] Set up Vercel project for frontend
- [ ] Set up Railway project for backend
- [ ] Set up Upstash Redis instance
- [ ] Set up Sentry error tracking (both projects)
- [ ] Configure CORS on backend

---

## Phase 2: Authentication & Onboarding

### 2.1 Backend — Auth Module
- [x] Configure Supabase Auth (email/password provider)
- [x] Implement JWT guard (@nestjs/jwt + @nestjs/passport)
- [x] Implement TenantMiddleware (extract studio_id from JWT, set search_path)
- [x] Implement RBAC decorator (@Roles('owner', 'manager', etc.))
- [x] Implement login lockout (5 failed attempts → 15min Redis TTL)
- [x] Build POST /auth/login endpoint
- [x] Build POST /auth/logout endpoint
- [x] Build POST /auth/refresh endpoint
- [ ] Build POST /auth/forgot-password endpoint
- [ ] Build POST /auth/reset-password endpoint
- [x] Implement studio schema auto-creation on signup (Supabase Edge Function)

### 2.2 Frontend — Auth Pages
- [x] Login page (S01) — email/password form, forgot password link, logo
- [ ] Forgot Password page (S03) — email → OTP → new password
- [x] Onboarding page (S02) — studio name, first branch, admin profile
- [x] Studio onboarding auto-location prefill (country/currency/timezone) with manual override
- [x] Onboarding wizard draft persistence across back navigation
- [x] Onboarding layout fixed-height split panes with right-panel scrolling only
- [x] Country/state/city address autofill for onboarding and studio settings forms
- [x] Auth state management (Zustand store)
- [x] Protected route wrapper (redirect to login if no JWT)
- [x] Role-based route guard (redirect if insufficient permissions)

---

## Phase 3: Member Management

### 3.1 Backend — Members Module
- [x] Create per-studio tables: members, membership_plans, member_memberships
- [x] Build GET /members (list + filter + paginate)
- [x] Build POST /members (register new member)
- [x] Build GET /members/:id (profile + history)
- [x] Build PATCH /members/:id (update)
- [x] Build POST /members/:id/freeze
- [x] Build POST /members/:id/renew
- [x] Build POST /members/:id/face-descriptor
- [x] Build GET /members/churn-risk
- [x] Implement member_code auto-generation (FS-YYYYMMDD-XXXX)
- [x] Implement QR code generation (UUID payload)
- [x] Membership plan CRUD endpoints

### 3.2 Frontend — Member Pages
- [x] Member List page (S07) — table with search, status filter, export CSV
- [x] Add/Edit Member page (S09) — registration form with plan selector
- [x] Member Profile page (S08) — tabs: Overview, Attendance, Payments, Notes
- [x] Edit Member page — /members/[id]/edit (pre-populated form)
- [x] Membership Plans management page (S29) — CRUD table
- [x] Churn Risk List page (S11) — filtered view with risk scores

---

## Phase 4: Check-In System

### 4.1 Backend — Check-In Module
- [x] Create check_ins table
- [x] Build POST /check-ins (validate membership, log check-in)
- [x] Build POST /check-ins/facial (descriptor matching)
- [x] Build POST /check-ins/sync (offline queue sync)
- [x] Build GET /check-ins (history with filters)
- [x] Build GET /check-ins/heatmap (peak hours data)
- [ ] Enable Supabase Realtime on check_ins table
- [x] Check-in validation logic (active? credits remaining? correct branch?)

### 4.2 Frontend — Check-In Pages
- [x] Front Desk Check-in page (S10) — method selector + recent feed
- [x] QR Scanner integration (html5-qrcode)
- [x] Manual Check-in flow — search member → confirm
- [ ] Facial Recognition flow (face-api.js) — camera → detect → match → confirm
- [x] Success/failure feedback (green welcome / red error)
- [ ] IndexedDB offline queue (idb) — store pending, sync on reconnect
- [ ] Real-time check-in feed (Supabase Realtime subscription)
- [x] Check-in history page — filterable table with date range

---

## Phase 5: Payments & Finance

### 5.1 Backend — Payments Module
- [x] Create payments and expenses tables
- [x] Build POST /payments/cash (manual payment recording)
- [x] Build POST /payments/create-order (Razorpay/Stripe order) — stub, needs SDK
- [x] Build POST /payments/verify (gateway verification) — stub, needs HMAC
- [ ] Build POST /payments/webhook/razorpay (HMAC verified)
- [ ] Build POST /payments/webhook/stripe (signature verified)
- [x] Build GET /payments (list with filters)
- [x] Build GET /payments/:id/invoice (PDF download) — partial, no PDF gen
- [ ] Invoice PDF generation (@react-pdf/renderer)
- [ ] Upload invoice to Supabase Storage
- [x] Expense CRUD endpoints
- [ ] Auto-renewal BullMQ job (charge 1 day before expiry)

### 5.2 Frontend — Finance Pages
- [x] Financial Dashboard page (S16) — KPIs, revenue computed from data
- [x] Payments List page (S17) — table with filters, export
- [x] Record Payment page (S18) — manual entry form
- [x] Expense Tracker page (S19) — add expense form with categories
- [ ] Invoice View page (S20) — preview + PDF download
- [ ] Razorpay checkout flow integration
- [ ] Stripe checkout flow integration

---

## Phase 6: Dashboard

### 6.1 Backend — Dashboard Module
- [x] Build GET /dashboard/kpis (4 hero cards, Redis cached 60s)
- [x] Build GET /dashboard/revenue-chart (last 12 months)
- [x] Build GET /dashboard/activity-feed (last 10 check-ins)
- [x] Build GET /dashboard/alerts (inactive, overdue, expiring)
- [x] Build GET /dashboard/branch-comparison
- [ ] Create materialized view for monthly revenue aggregation

### 6.2 Frontend — Dashboard Pages
- [x] Main Dashboard page (S04) — KPI cards + revenue chart + alerts + feed
- [x] Branch Selector/Comparison page (S05)
- [ ] Real-time activity feed (WebSocket subscription)
- [ ] Auto-refresh alerts every 60 seconds

---

## Phase 7: Classes & Schedule

### 7.1 Backend — Classes Module
- [x] Create classes, class_enrollments tables
- [x] Class CRUD endpoints (create, list, get, update)
- [x] Enrollment/waitlist management endpoints (enroll, cancel, promote)
- [x] Conflict detection (trainer double-booking)
- [x] Waitlist auto-promotion when spot opens

### 7.2 Frontend — Class Pages
- [x] Weekly Class Schedule page (S12) — week grid with navigation
- [x] Create Class page (S14) — form with trainer/branch/category
- [x] Class Detail page (S13) — enrollment roster, waitlist, enroll member
- [ ] Edit Class page
- [ ] Class attendance marking
- [ ] Recurring class expansion

---

## Phase 8: Staff Management

### 8.1 Backend — Staff Module
- [x] Staff CRUD endpoints (list, create, get, update)
- [x] Build GET /analytics/trainer-performance (partial — occupancy real, attendance faked)
- [x] Branch-based filtering (fixed)
- [x] Privilege escalation protection (ForbiddenException)
- [x] Auto-generate employee code (EMP-XXXX) when not provided
- [x] Staff invite system (create, accept, resend, revoke invites)
- [x] Invite email via Resend (RESEND_API_KEY + RESEND_FROM_EMAIL)
- [x] RBAC permission overrides (per-staff grant/deny on 56 permission codes)
- [x] Public invite acceptance endpoint (no auth — POST /api/v1/staff-invites/accept)
- [x] Invite token validation + Supabase user creation on accept
- [x] Staff shifts CRUD (create, list, update, delete)
- [x] Staff leave requests (create, list, review, cancel)
- [x] Staff attendance (check-in, check-out)
- [x] Staff availability management
- [x] Staff profile sub-resource (get, update)

### 8.2 Frontend — Staff Pages
- [x] Staff Directory page (S21) — search, role/branch filters, pagination
- [x] Staff Profile page (S22) — performance score, specializations
- [x] Add Staff page (S23) — form with role, branch, invite toggle, permission picker
- [x] Trainer Analytics Dashboard page — occupancy chart + table
- [x] Staff detail page — access management section (owner-only) with invite + permissions
- [x] Invite acceptance page (/invite/[token]) — public, set password flow
- [x] Permission picker UX — per-module Grant All / Deny All / Clear + master buttons
- [x] Staff list 404 fix — proper gymSlug-prefixed links
- [ ] Edit Staff page
- [ ] Staff Shift Schedule page
- [ ] Leave Request Management page

---

## Phase 9: Marketing & Notifications

### 9.1 Backend — Marketing Module
- [x] Campaign CRUD endpoints (list, create, get, update, delete)
- [x] Campaign send endpoint (stub — no actual message delivery)
- [ ] Integrate Twilio SMS
- [ ] Integrate Meta WhatsApp Cloud API
- [ ] Integrate Resend email + React Email templates
- [ ] Automated trigger BullMQ jobs (expiry 7d/3d/1d, inactivity 7d/14d, birthday)
- [ ] Referral code generation + reward tracking

### 9.2 Frontend — Marketing Pages
- [x] Marketing Campaign Dashboard (S24) — campaign list with pagination
- [x] Campaign Creator (S25) — segment + channels + template + schedule
- [x] Automation Rules page (S26) — toggle triggers
- [ ] Message Template Editor
- [ ] Referral Program page (S27)

---

## Phase 10: AI Advisor

### 10.1 Backend — AI Module
- [x] Build POST /ai/chat (stub — keyword-based mock responses)
- [x] Build GET /ai/daily-briefing (partial — real counts, fake details)
- [x] Build GET /ai/conversations
- [ ] Set up Anthropic Claude API integration (replace mock)
- [ ] Daily briefing BullMQ cron job (07:45 AM studio timezone)

### 10.2 Frontend — AI Pages
- [x] AI Business Advisor Chat page (S06) — conversational UI with typing indicator
- [x] AI Morning Briefing Dashboard — metrics, alerts, recommendations
- [ ] Quick prompt suggestions
- [ ] Floating AI chat button on key screens

---

## Phase 11: Settings & Polish

### 11.1 Backend
- [x] Studio settings CRUD
- [ ] Integration configuration endpoints (save API keys securely)

### 11.2 Frontend
- [x] Studio Settings page (S28) — name, tagline, phone, email, timezone, currency
- [x] Account Overview — plan, usage bars, features
- [x] Roles page — RBAC management
- [x] Integrations page (S30) — Razorpay, Stripe, Resend, Twilio, WhatsApp, Claude
- [x] Membership Plans page (S29) — CRUD with correct plan types

### 11.3 Final Polish
- [ ] Run OWASP security checklist
- [ ] Performance test critical paths
- [ ] Fix all P1/P2 bugs
- [ ] Lighthouse audit: Performance >80, Accessibility >90
- [ ] Set up Posthog analytics events
- [ ] Cross-browser testing (Chrome, Safari, Firefox)

---

## Completion Criteria (from TRD Section 12)
- [ ] Owner can register, log in, set up studio and first branch
- [ ] Staff can add member + assign plan in < 3 minutes
- [ ] QR check-in confirms in < 1 second
- [ ] Facial recognition matches enrolled member (>95% accuracy)
- [ ] Offline check-ins sync on reconnect within 30s
- [ ] Razorpay payment creates + activates membership
- [ ] AI advisor answers 5 standard business queries factually
- [ ] Dashboard real-time feed updates on check-in within 5 seconds
- [ ] Multi-branch: Studio 2 cannot see Studio 1 data
- [ ] Invoice PDF generated and downloadable
