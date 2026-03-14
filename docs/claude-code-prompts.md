# FitSync Pro — Claude Code Starter Prompts

Copy-paste these prompts into Claude Code one session at a time.
Wait for each session to complete before starting the next.

---

## Session 1: Project Scaffold + Design System + Shared Components

```
Read the CLAUDE.md file first, then the TRD at docs/TRD_v1.0.md (Section 3 for tech stack).

Do the following in order:

1. Initialize a Next.js 14 project in /frontend with:
   - App Router, TypeScript, Tailwind CSS
   - Install: shadcn/ui, zustand, @tanstack/react-query, @tanstack/react-table, recharts, react-hook-form, zod, lucide-react, sonner, date-fns, @supabase/supabase-js
   - Configure shadcn/ui with the dark theme colors from CLAUDE.md Design System section

2. Initialize a NestJS project in /backend with:
   - TypeScript, Prisma
   - Install: @nestjs/jwt, @nestjs/passport, @nestjs/config, @nestjs/schedule, @nestjs/bullmq, @nestjs/websockets, socket.io, class-validator, class-transformer, @nestjs/axios
   - Set up basic module structure with placeholder modules for: auth, members, check-ins, payments, classes, staff, marketing, ai, dashboard

3. Configure Tailwind in frontend with exact design tokens from CLAUDE.md:
   - All color tokens as CSS variables
   - Font family: Inter (default), JetBrains Mono (monospace)
   - Create tailwind.config.ts that maps tokens to Tailwind classes

4. Build these shared frontend components (use shadcn/ui as base, customize to match design system):
   - AppLayout: Sidebar (Dashboard, Members, Check-ins, Schedule, Finance, Staff, Marketing, AI Advisor, Settings) + Top bar (search, notifications, user dropdown, branch selector). Look at any screenshot in docs/screens/ for the sidebar layout reference.
   - KPICard: Icon, value, label, trend indicator (+/-%)
   - StatusBadge: Variants for Active (green), Expiring (yellow), Expired (red), Frozen (blue), Pending (yellow)
   - DataTable: Built on @tanstack/react-table + shadcn Table, with search, column filters, sorting, pagination
   - FormFields: Styled Input, Select, Textarea, DatePicker, FileUpload matching dark theme
   - ConfirmDialog: Modal for destructive actions

5. Create a simple home page at /dashboard that uses AppLayout with a "Coming Soon" placeholder. Verify the layout renders correctly.

Do NOT start building any feature pages yet. Just the scaffold and shared components.
```

---

## Session 2: Database Schema + Auth

```
Read CLAUDE.md and docs/TRD_v1.0.md Section 4 (Database Schema) and Section 6 (Security).

1. Create the Prisma schema in /backend/prisma/schema.prisma with:
   - Public schema tables: studios (exact fields from TRD 4.1)
   - Per-studio schema tables: branches, members, membership_plans, member_memberships, check_ins, classes, class_enrollments, staff, payments, expenses, notifications_log, campaigns, ai_conversations (exact fields from TRD 4.2)
   - Use exact field names, types, and constraints from the TRD
   - All PKs are UUID with default gen_random_uuid()
   - All tables have created_at and updated_at

2. Set up Supabase Auth integration:
   - Configure @supabase/supabase-js in both frontend and backend
   - Create .env.example files with all variables from TRD 8.3

3. Implement in the NestJS backend:
   - JwtAuthGuard that validates Supabase JWT tokens
   - TenantMiddleware that reads studio_id from JWT and sets PostgreSQL search_path to studio_{studio_id}
   - RolesGuard with @Roles() decorator supporting: owner, manager, trainer, front_desk
   - RBAC matrix enforcement per the table in CLAUDE.md

4. Build Auth API endpoints (TRD 5.1):
   - POST /auth/login
   - POST /auth/logout
   - POST /auth/refresh
   - POST /auth/forgot-password
   - POST /auth/reset-password
   - Login lockout: 5 failed attempts → 15-minute lockout (use Redis/in-memory for now)

5. Build Auth frontend pages:
   - /login page — email + password form, "Forgot password" link, FitSync Pro logo. No screenshot available, design from PRD S01 description using the dark theme.
   - /forgot-password page — email entry → OTP → new password (PRD S03)
   - /onboarding page — studio name, first branch setup, admin profile (PRD S02). Multi-step form.
   - Auth state management in Zustand store
   - Protected route wrapper that redirects to /login if not authenticated

Test: Verify login flow works end-to-end with a test user.
```

---

## Session 3: Members Module

```
Read CLAUDE.md and docs/TRD_v1.0.md Section 4.2 (members, membership_plans, member_memberships tables) and Section 5.3 (Member Endpoints).

Look at these screenshots for visual reference:
- docs/screens/members/New_Member_Registration.png
- docs/screens/members/Member_Profile__Sarah_Connor.png
- docs/screens/members/Membership_Plan_Management.png

1. Build Member API endpoints (TRD 5.3):
   - GET /members (list + filter by status, branch_id, search, page, limit)
   - POST /members (register with plan assignment)
   - GET /members/:id (full profile + memberships + payments + check_ins)
   - PATCH /members/:id (update)
   - POST /members/:id/freeze
   - POST /members/:id/renew
   - GET /members/churn-risk

2. Build Membership Plans CRUD:
   - Full CRUD for membership_plans table
   - Plans can be branch-specific or global (branch_id = NULL)

3. Implement member_code auto-generation: format FS-YYYYMMDD-XXXX

4. Build frontend pages:
   - /members — Member List page with DataTable. Search by name/phone/ID, filter by status (Active/Expiring/Expired/Frozen), sort, paginate. Export CSV button. No screenshot available — use the same table pattern as docs/screens/staff/Staff_Management_Directory.png
   - /members/new — Add Member form matching New_Member_Registration.png. Fields: full_name, phone (required), email, date_of_birth, emergency contacts, profile photo, plan selector, membership start date. Auto-show generated member ID.
   - /members/[id] — Member Profile matching Member_Profile__Sarah_Connor.png. Tabs: Overview (plan, dates, remaining classes, engagement score, recent check-ins, notes), Attendance, Payments, Notes. Quick actions: Renew, Freeze, Send Message, Edit, Deactivate.
   - /settings/plans — Membership Plans management matching Membership_Plan_Management.png. Table with plan name, duration, price, max classes/week, branch scope, active toggle. Create/Edit plan form.

Test: Create a member, view their profile, freeze and renew a membership.
```

---

## Session 4: Check-In Module

```
Read CLAUDE.md and docs/TRD_v1.0.md Section 5.4 (Check-In Endpoints) and Section 7.5 (Facial Recognition).

Look at these screenshots:
- docs/screens/checkins/Front_Desk_Checkin.png
- docs/screens/checkins/QR_Checkin_Interface.png
- docs/screens/checkins/Manual_Checkin_Flow.png
- docs/screens/checkins/Facial_Recognition_Checkin.png

1. Build Check-In API endpoints (TRD 5.4):
   - POST /check-ins (record check-in with validation)
   - POST /check-ins/facial (descriptor matching)
   - POST /check-ins/sync (offline queue sync)
   - GET /check-ins (history with filters)
   - GET /check-ins/heatmap (peak hours data)

2. Check-in validation logic:
   - Verify membership active
   - Verify classes remaining (for class_pack plans)
   - Verify correct branch
   - If valid: log with timestamp, method, branch → green confirmation
   - If invalid: return failure_reason (expired | no_credits | wrong_branch) → red alert

3. Build frontend pages:
   - /check-in — Front Desk hub matching Front_Desk_Checkin.png. Shows 4 method cards (QR, RFID greyed out as "Coming Soon", Face ID, Manual). Recent check-ins feed on the right with live updates.
   - QR mode: Camera scanner using html5-qrcode. Match QR_Checkin_Interface.png. On scan → validate → show member card with confirm button.
   - Manual mode: Search by name/phone/ID. Match Manual_Checkin_Flow.png. Show member details → "Check In Now" button.
   - Facial mode: Camera with face-api.js. Match Facial_Recognition_Checkin.png. Load face-api.js models on mount. Detect face → match against enrolled descriptors → show identity verified state.

4. Implement QR code generation:
   - Generate unique QR payload (UUID) for each member on registration
   - Store in members.qr_code field
   - Use qrcode.react to render QR on member profile

5. Implement offline queue:
   - Use idb library to store pending check-ins in IndexedDB when offline
   - Background sync worker retries every 30 seconds
   - POST /check-ins/sync to batch-upload when online

Test: QR check-in, manual check-in, and verify real-time feed updates on dashboard.
```

---

## Session 5: Payments + Invoices

```
Read TRD Section 5.5 (Payment Endpoints) and TRD 4.2 (payments, expenses tables).

Screenshots:
- docs/screens/finance/Record_New_Payment_Form.png
- docs/screens/finance/Payments_Management_Table.png
- docs/screens/finance/Invoice_Preview.png
- docs/screens/finance/Record_Expense_Form.png
- docs/screens/finance/Financial_Analytics_Dashboard.png

1. Build Payment API endpoints (TRD 5.5):
   - POST /payments/cash (manual payment recording)
   - POST /payments/create-order (Razorpay/Stripe order creation)
   - POST /payments/verify (gateway payment verification)
   - POST /payments/webhook/razorpay (webhook handler with HMAC verification)
   - POST /payments/webhook/stripe (webhook handler)
   - GET /payments (history with filters: branch_id, date_from, date_to, status, page)
   - GET /payments/:id/invoice (PDF download)
   - GET /payments/send-link (send payment link to member)

2. Build Expense CRUD:
   - POST /expenses, GET /expenses, PATCH /expenses/:id, DELETE /expenses/:id
   - Categories: salaries, rent, equipment, utilities, marketing, maintenance, other

3. Invoice PDF generation:
   - Use @react-pdf/renderer to generate invoice PDF
   - Include: studio branding, member name, plan, amount, dates, receipt number, payment method
   - Upload to Supabase Storage → store URL in payments.invoice_url

4. Receipt number auto-generation: format RCP-YYYYMMDD-XXXX

5. Build frontend pages:
   - /finance — Financial Dashboard matching Financial_Analytics_Dashboard.png. KPI cards (Monthly Revenue, Pending Payments, Total Expenses, Net Profit). Revenue Trend chart. Revenue by Plan donut chart. Recent transactions table.
   - /finance/payments — Payments List matching Payments_Management_Table.png. DataTable with member, plan, amount, payment method, date, status columns. Filters by status, method, date range.
   - /finance/payments/new — Record Payment form matching Record_New_Payment_Form.png. Search member, select plan, amount, payment method (Cash, Card, UPI, Bank Transfer — NOT PayPal), notes.
   - /finance/expenses/new — Record Expense form matching Record_Expense_Form.png. Amount, category dropdown, date, branch, description, receipt upload.
   - /finance/invoices/[id] — Invoice Preview matching Invoice_Preview.png. Print, Share, Download PDF buttons.

IMPORTANT: Payment method options must be: Cash, Card, UPI, Bank Transfer (NOT PayPal — see alignment report).

Test: Record a cash payment, verify invoice PDF generates, record an expense.
```

---

## Session 6: Dashboard

```
Read TRD Section 5.6 (Dashboard & Analytics Endpoints).

Screenshot: docs/screens/dashboard/AI_Morning_Briefing_Dashboard.png (for briefing card style)
No screenshot for Main Dashboard — build from PRD Section 4 Feature 1 description.

1. Build Dashboard API endpoints (TRD 5.6):
   - GET /dashboard/kpis → {active_members, monthly_revenue, avg_attendance_rate, expiring_soon_count}
   - GET /dashboard/revenue-chart → MonthlyRevenue[] (last 12 months)
   - GET /dashboard/activity-feed → last 10 check-ins with member_name, branch, method, timestamp
   - GET /dashboard/alerts → {inactive_members[], overdue_payments[], expiring_memberships[]}
   - GET /dashboard/branch-comparison → Branch[] with revenue, members, occupancy, growth_rate

2. Implement Redis caching for KPIs (60-second TTL, stale-while-revalidate)

3. Implement real-time check-in feed:
   - Supabase Realtime subscription on check_ins table
   - WebSocket event pushes to dashboard → updates activity feed instantly

4. Build frontend pages:
   - /dashboard — Main Dashboard. Top: Branch selector dropdown. 4 KPI cards (use KPICard component). Revenue bar chart (recharts, last 12 months, filterable by branch). Activity feed (last 10 check-ins with live updates). Alert panel (expiring memberships, overdue payments, inactive 7+ days members — auto-refresh every 60 seconds).
   - /dashboard/branches — Branch Comparison View. Side-by-side table of all locations with revenue, member count, attendance, growth rate.

Test: Verify KPIs update after a check-in, verify real-time feed shows new check-ins within 5 seconds.
```

---

## Session 7: Classes & Schedule

```
Read TRD Section 4.2 (classes, class_enrollments tables).

Screenshots:
- docs/screens/classes/Weekly_Class_Schedule.png
- docs/screens/classes/Create_New_Class_Form.png
- docs/screens/classes/Class_Details__HIIT_Advanced_Training.png
- docs/screens/classes/Class_Roster_Management.png

Build:
1. Class CRUD API endpoints
2. Class enrollment endpoints (enroll, waitlist, cancel, promote from waitlist)
3. Conflict detection (trainer double-booking, room capacity)
4. Frontend pages:
   - /schedule — Weekly calendar using @fullcalendar/react matching Weekly_Class_Schedule.png. Branch and trainer filters. Week/Day/Month toggle. "+ Add Class" button.
   - /classes/new — Create Class form matching Create_New_Class_Form.png. Fields: name, category, trainer (visual selector), branch, room, capacity, duration, recurrence, start date/time. Conflict detection alert.
   - /classes/[id] — Class Detail matching Class_Details__HIIT_Advanced_Training.png. Trainer, capacity, room, duration. Tabs: Enrolled Members, Waitlist, Attendance.
   - /classes/[id]/roster — Class Roster matching Class_Roster_Management.png. Enrolled table, waitlist with "Move to Enrolled" action, capacity indicator.

Test: Create a class, enroll members, trigger conflict detection, promote from waitlist.
```

---

## Session 8: Staff Management

```
Read TRD Section 4.2 (staff table) and TRD 5.6 (GET /analytics/trainer-performance).

Screenshots:
- docs/screens/staff/Staff_Management_Directory.png
- docs/screens/staff/Staff_Profile__Alex_Rivera.png
- docs/screens/staff/Staff_Shift_Schedule.png
- docs/screens/staff/Leave_Request_Management.png
- docs/screens/staff/Trainer_Analytics_Dashboard.png

Build:
1. Staff CRUD API endpoints
2. Trainer performance analytics endpoint
3. Staff scheduling and leave request endpoints
4. Frontend pages:
   - /staff — Staff Directory matching Staff_Management_Directory.png
   - /staff/[id] — Staff Profile matching Staff_Profile__Alex_Rivera.png. Tabs: Personal Info, Schedule, Compensation (NOT "Payroll"), Performance. Salary card visible only to owner role.
   - /staff/new — Add/Edit Staff form (no screenshot — follow same pattern as Add Member form)
   - /staff/schedule — Shift Schedule matching Staff_Shift_Schedule.png. Weekly calendar with branch/role filters.
   - /staff/leave — Leave Requests matching Leave_Request_Management.png. Approve/Reject actions.
   - /staff/analytics — Trainer Analytics matching Trainer_Analytics_Dashboard.png. KPI cards, performance trends chart, occupancy by trainer, comparison table.

IMPORTANT: Salary field must be stripped from API responses unless role === "owner" (TRD Section 6.3).

Test: Create staff member, assign to branch, view trainer analytics.
```

---

## Session 9: Marketing + Notifications

```
Read TRD Section 4.2 (campaigns, notifications_log tables) and PRD Section 4 Feature 7.

Screenshots:
- docs/screens/marketing/Marketing_Campaign_Dashboard.png
- docs/screens/marketing/Marketing_Automation_Rules.png
- docs/screens/marketing/Message_Template_Editor.png

Build:
1. Campaign CRUD API endpoints
2. Notification service integrations (Twilio SMS, Resend email, Meta WhatsApp)
3. BullMQ scheduled jobs for automated triggers: expiry reminders (7d, 3d, 1d), inactivity alert (7d, 14d), birthday greeting, welcome message, payment receipt
4. Frontend pages:
   - /marketing — Campaign Dashboard matching Marketing_Campaign_Dashboard.png
   - /marketing/campaigns/new — Campaign Creator (no screenshot — build from PRD 7.2: segment selector, message editor with {{variables}}, channel selection, schedule/send)
   - /marketing/automation — Automation Rules matching Marketing_Automation_Rules.png. Toggle triggers, configure channels and filters.
   - /marketing/templates — Message Template Editor matching Message_Template_Editor.png. Variables insertion, live preview for SMS and email.
   - /marketing/referral — Referral Program (no screenshot — build from PRD 7.3: code list, reward config, conversion tracker)

Test: Create a campaign, trigger an automated reminder, verify message logs.
```

---

## Session 10: AI Advisor + Settings + Final Polish

```
Read TRD Section 5.7 (AI Endpoints), TRD Section 7 (AI Integration), PRD Feature 8.

Screenshots:
- docs/screens/ai/AI_Business_Advisor_Chat.png
- docs/screens/ai/AI_Morning_Briefing_Dashboard.png
- docs/screens/settings/Integrations_Settings.png

Build:
1. AI Advisor:
   - POST /ai/chat with live studio context injection (see TRD 7.2 system prompt)
   - GET /ai/daily-briefing
   - GET /ai/conversations
   - Conversation history persistence in ai_conversations table
   - BullMQ cron job at 07:45 AM for daily briefing
   - Frontend: /ai — Chat interface matching AI_Business_Advisor_Chat.png. Conversation UI, suggested actions, quick prompt buttons. /ai/briefing — Morning Briefing matching AI_Morning_Briefing_Dashboard.png.

2. Settings:
   - /settings — Studio Settings (no screenshot — build from PRD S28: name, logo, branches, timezone, currency)
   - /settings/integrations — Integrations matching Integrations_Settings.png. IMPORTANT: Show Razorpay + Stripe (payments), Resend (email), Twilio (SMS), Meta WhatsApp, Anthropic Claude (AI). NOT OpenAI, NOT SendGrid, NOT PayPal.

3. Churn Risk:
   - Implement churn risk scoring algorithm as daily BullMQ job
   - Score factors: days since last visit (40%), attendance trend (30%), payment delays (20%), plan type (10%)
   - Build /members/churn — Churn Risk List (no screenshot — filtered DataTable showing high/medium/low risk members)

4. Final Polish:
   - Add floating AI chat button on all screens (small icon in bottom-right corner)
   - Error boundary components
   - Loading skeleton states using shimmer gradient (#1A2F45 → #2A4A6A)
   - Verify all RBAC permissions enforced
   - Run through OWASP checklist
   - Performance check: dashboard loads < 2s, check-in < 1s

Test: Ask AI advisor 5 sample questions from PRD 8.2, verify daily briefing generates, verify integrations page shows correct services.
```

---

## Tips for Success

- **One session = one module.** Don't combine modules in a single prompt.
- **Always say "Read CLAUDE.md first"** at the start of each session.
- **Test after each session** before moving to the next.
- **If something breaks**, say: "Stop. Read the error. Fix it before continuing."
- **If Claude Code deviates from the TRD**, say: "Check TRD Section X. Use the exact field names/endpoints specified there."
- **Don't rush.** It's better to have 3 solid modules than 10 broken ones.
