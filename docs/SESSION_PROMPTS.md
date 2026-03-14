# FitSync Pro — Claude Code Session Prompts

Copy-paste these prompts into Claude Code for each session.
Adjust as needed based on progress.

---

## SESSION 1: Project Setup + Shared Components

```
Read CLAUDE.md, docs/PRD_v1.0.md (Section 13 Design System and Section 14 Tech Stack), and docs/TRD_v1.0.md (Section 3 Tech Stack).

Do the following in order:

1. Initialize a Next.js 14 project in /frontend with App Router + TypeScript. Install all frontend dependencies listed in CLAUDE.md tech stack section.

2. Configure Tailwind CSS with the exact design tokens from CLAUDE.md Design System section. Set up a globals.css with the CSS custom properties for all colors.

3. Initialize shadcn/ui with the dark theme. Configure it to use our color palette.

4. Create the shared AppLayout component that will wrap every page. It should have:
   - A left sidebar with these nav items: Dashboard, Members, Check-ins, Schedule, Finance, Staff, Marketing, AI Advisor, Settings
   - Each nav item should have a lucide-react icon
   - A top bar with: search input, notification bell icon, user avatar + name/role dropdown
   - The sidebar should match the design system colors (bg #1A2F45, active item #4A9FD4)
   - Reference the sidebar visible in the screen PNGs in docs/screens/ for visual guidance

5. Create these shared components in /frontend/components/shared/:
   - StatusBadge (variants: active, expiring, expired, frozen, inactive)
   - KPICard (props: label, value, trend, trendDirection)
   - DataTable (using @tanstack/react-table + shadcn Table, with search, filters, pagination)
   - LoadingSkeleton (shimmer animation using design system gradient)
   - EmptyState (icon, title, description, action button)
   - PageHeader (title, subtitle, action buttons slot)

6. Initialize a NestJS project in /backend with TypeScript. Install all backend dependencies from CLAUDE.md.

7. Set up Prisma in the backend with a basic schema that includes the public.studios table from TRD Section 4.1.

8. Create .env.example files for both frontend and backend with all the environment variables from TRD Section 8.3.

Do not proceed to auth or any feature modules yet. Just setup and shared components.
```

---

## SESSION 2: Authentication & Onboarding

```
Read CLAUDE.md, docs/TRD_v1.0.md (Sections 5.1 Auth Endpoints, 6.1 Authentication & Authorization, 4.1 Public Schema).

Reference the auth screen PNGs in docs/screens/auth/ for the UI design.

Build the authentication module:

BACKEND:
1. Configure Supabase Auth (email/password) in the NestJS backend
2. Implement JwtAuthGuard that validates Supabase JWT tokens
3. Implement TenantMiddleware that reads studio_id from JWT and sets PostgreSQL search_path
4. Implement @Roles() decorator and RolesGuard for RBAC
5. Implement login lockout: track failed attempts in Redis, lock after 5 failures for 15 minutes
6. Build all 5 auth endpoints from TRD Section 5.1: login, logout, refresh, forgot-password, reset-password
7. Implement studio schema auto-creation: when a new studio signs up, create a new PostgreSQL schema with all per-studio tables from TRD Section 4.2

FRONTEND:
1. Build the Login page matching the screen in docs/screens/auth/
2. Build the Forgot Password flow (email → OTP → new password)
3. Build the Onboarding Setup page (studio name, first branch, admin profile)
4. Create a Zustand auth store (user, studio, token, role)
5. Create a ProtectedRoute wrapper that redirects to /login if not authenticated
6. Create a RoleGuard wrapper that shows 403 if user doesn't have required role

Test: Verify login flow works end-to-end with Supabase.
```

---

## SESSION 3: Member Management

```
Read CLAUDE.md, docs/TRD_v1.0.md (Sections 4.2 members/membership_plans/member_memberships tables, 5.3 Member Endpoints).

Reference the member screen PNGs in docs/screens/members/ for the UI design.

Build the members module:

BACKEND:
1. Create Prisma models for: members, membership_plans, member_memberships (exact fields from TRD Section 4.2)
2. Run migrations
3. Build all member endpoints from TRD Section 5.3
4. Implement member_code auto-generation: format FS-YYYYMMDD-XXXX
5. Implement QR code generation: UUID-based payload string stored in members.qr_code
6. Implement engagement_score field (placeholder — daily job to be added later)
7. Membership plan CRUD endpoints

FRONTEND:
1. Build Member List page (S07) using the shared DataTable component. Filters: status (Active/Expiring/Expired/Frozen), branch. Search by name/phone/member_code. Export CSV button.
2. Build Add/Edit Member page (S09) matching the registration form screen. Include: personal info fields, profile photo upload, emergency contact, plan selector, membership start date.
3. Build Member Profile page (S08) with tabs: Overview (plan info, recent check-ins, engagement score, notes), Attendance, Payments, Notes.
4. Build Membership Plans management page (S29) — table with create/edit/toggle/archive actions.
5. Build Churn Risk List page (S11) — filtered DataTable showing risk score column.

Connect frontend to backend APIs using @tanstack/react-query.
```

---

## SESSION 4: Check-In System

```
Read CLAUDE.md, docs/TRD_v1.0.md (Sections 4.2 check_ins table, 5.4 Check-In Endpoints, 7.5 Facial Recognition).

Reference the check-in screen PNGs in docs/screens/checkins/ for the UI design.

Build the check-in module:

BACKEND:
1. Create Prisma model for check_ins table (exact fields from TRD Section 4.2)
2. Build POST /check-ins — validate membership active, classes remaining, correct branch. Return success/failure with reason.
3. Build POST /check-ins/facial — receive 128-float descriptor, find closest match via euclidean distance (threshold < 0.5), return matched member
4. Build POST /check-ins/sync — batch sync offline check-ins
5. Build GET /check-ins — history with filters (branch, date range, member)
6. Build GET /check-ins/heatmap — 7x24 grid of check-in counts
7. Enable Supabase Realtime on check_ins table

FRONTEND:
1. Build Front Desk Check-in page (S10) — 4 method cards (QR, RFID greyed out "Coming Soon", Face ID, Manual) + recent check-ins live feed on the right
2. QR Scanner: integrate html5-qrcode, decode QR → extract member_id → POST /check-ins → show green/red result
3. Manual Check-in: search bar → member card with details → "Check In Now" button
4. Facial Recognition: load face-api.js models from /public/models/, camera stream → detect face → compute descriptor → POST /check-ins/facial → show result
5. Success state: green "Welcome, [Name]!" with member photo
6. Failure state: red alert with reason (Expired / No Credits / Wrong Branch)
7. Offline queue: use idb to store failed check-ins in IndexedDB, sync via POST /check-ins/sync when connection restored
8. Real-time feed: subscribe to Supabase Realtime check_ins channel, update feed instantly

Note: RFID method should show in the UI but be greyed out with "Coming Soon" label — not wired to backend.
```

---

## SESSION 5: Payments & Finance

```
Read CLAUDE.md, docs/TRD_v1.0.md (Sections 4.2 payments/expenses tables, 5.5 Payment Endpoints).

Reference the finance screen PNGs in docs/screens/finance/ for the UI design.

Build the payments and finance module:

BACKEND:
1. Create Prisma models for payments and expenses (exact fields from TRD)
2. Build POST /payments/cash — record manual payment, auto-generate receipt (RCP-YYYYMMDD-XXXX)
3. Build POST /payments/create-order — create Razorpay/Stripe order
4. Build POST /payments/verify — verify gateway payment, activate membership
5. Build webhook handlers for Razorpay and Stripe with HMAC/signature verification
6. Build GET /payments — list with filters
7. Build GET /payments/:id/invoice — generate PDF with @react-pdf/renderer, upload to Supabase Storage
8. Expense CRUD endpoints
9. Auto-renewal BullMQ job: check expiring memberships daily, charge if auto-renew enabled

FRONTEND:
1. Financial Dashboard page (S16) — KPI cards (Revenue, Pending, Expenses, Net Profit), revenue trend chart (Recharts), revenue by plan donut chart, recent transactions
2. Payments List page (S17) — DataTable with status/method/date filters
3. Record Payment page (S18) — member search, plan select, amount, method (Cash/Card/UPI/Bank Transfer), notes
4. Expense Tracker page (S19) — form with amount, category dropdown (from TRD enum), date, branch, description, receipt upload
5. Invoice Preview page (S20) — studio branding, member info, plan details, PDF download button
```

---

## SESSION 6+: Continue with remaining phases

Follow the same pattern for Dashboard, Classes, Staff, Marketing, AI, and Settings.
Reference tasks/todo.md for the detailed checklist for each phase.
Reference docs/screens/{module}/ for the UI designs.
Reference docs/TRD_v1.0.md for the exact database fields and API endpoints.
```

---

## TIPS FOR EVERY SESSION

1. Always start with: "Read CLAUDE.md and tasks/todo.md first"
2. After completing a session, ask Claude to mark items complete in tasks/todo.md
3. If something breaks, tell Claude to log it in tasks/lessons.md
4. Keep sessions focused — one module per session
5. Test after each session before moving to the next
