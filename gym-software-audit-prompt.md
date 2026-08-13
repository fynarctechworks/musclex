# Prompt: Feature Audit + Gap Analysis + Implementation Plan

> How to use: Run this prompt in Claude Code (or any AI assistant that can read your codebase) from the root of your project. Also place `mygymdesk-competitor-analysis.md` in the project root so it can be referenced. If your tool can't read files, paste the checklist section of that report at the bottom of this prompt.

---

You are a senior product engineer auditing my gym management software against a competitor (MyGymDesk). Your job has 3 phases. Do them in order and do not skip any feature.

## Phase 1 — Discover what MY software currently has

Explore the entire codebase (routes, pages, components, API endpoints, database schema/models, background jobs, integrations, mobile app code if present). Build an inventory of every implemented feature. For each, note:
- Feature name
- Where it lives (files/modules/endpoints)
- Status: ✅ Fully working / 🟡 Partially built (explain what's missing) / 🔴 Stub or dead code

Do not assume a feature exists just because a file name suggests it — verify there is real logic (API + DB + UI wired together).

## Phase 2 — Gap analysis against the competitor checklist

Compare my inventory against EVERY item in the checklist below (from `mygymdesk-competitor-analysis.md`). Produce a table with these columns:

| # | Category | Feature | Competitor has it | My app status (✅/🟡/🔴/❌ missing) | Evidence (file/endpoint) | Effort (S/M/L/XL) | Priority (P0–P3) |

Priority rules:
- P0 = core gym operations a paying gym cannot live without (members, plans, billing, attendance, invoices)
- P1 = strong selling points in the Indian market (WhatsApp automation, UPI/Razorpay, GST invoices, QR check-in, member app basics)
- P2 = growth/retention features (classes+waitlists, PT commissions, workout/diet plans, CRM leads, reports, multi-branch)
- P3 = differentiators (AI insights, biometric hardware, branded app, multi-currency)

Also list features MY app has that the competitor does NOT — these are our advantages to protect and market.

## Phase 3 — Implementation plan

From the gap table, produce an upgrade roadmap:
1. **Milestone plan** — group missing/partial features into releases (v-next, +1 month, +3 months), ordered by priority and dependency (e.g., billing before WhatsApp payment links; member model before member app).
2. For each milestone item: scope summary, DB schema changes, API endpoints, UI screens, third-party services needed (Razorpay, WhatsApp Business API, biometric SDKs, FCM/APNs), and estimated effort.
3. **Quick wins** — anything achievable in under a day each.
4. **Risks/blockers** — external approvals (WABA verification, payment gateway KYC, app store review), data migrations, breaking changes.

Output everything as a single markdown document named `GAP_ANALYSIS_AND_ROADMAP.md`.

---

## COMPETITOR FEATURE CHECKLIST (audit every line)

### Member Management
- Member CRUD with photos, body measurements, progress tracking
- Membership status / renewal / expiry tracking
- Digital member ID card with QR code
- Custom membership plans (monthly/quarterly/annual)
- Freeze / pause membership
- Member data import/migration

### Billing & Payments
- Instant bill creation + payment collection
- Razorpay (UPI, cards, net banking); Stripe/PayPal for international
- GST-compliant (tax-compliant) auto-generated invoices
- Payment links via WhatsApp
- Recurring billing / subscription management
- Partial payments, refunds, outstanding dues
- Invoice cancellation with revenue exclusion

### Attendance
- QR code check-in/check-out
- Front desk kiosk mode for tablets
- Real-time attendance dashboard
- Biometric (fingerprint) device integration
- Staff attendance and shift tracking
- Member attendance calendar, streaks, monthly stats

### Classes & Scheduling
- Group classes with capacity limits and waitlists
- Session-based class packages (auto-create subscriptions)
- Instructor assignment + schedules + notifications
- Online booking by members
- Class reminders 24h before

### Personal Training
- Trainer-member assignment with PT packages (session-based or duration-based)
- PT session logging with notes; trainers can assign sessions
- PT commission tracking and payouts

### Workout & Diet Plans
- Workout plan builder with exercise library (sets/reps/rest)
- Diet plans with meals + calorie/macro targets
- Plans visible in member app; progress + goal tracking
- (Advanced) AI-generated workout/diet plans

### CRM & Leads
- Lead capture (walk-in, phone, website, social)
- Pipeline with custom stages; follow-ups + reminders + assignee history
- Duplicate lead detection; one-tap lead→member conversion
- Lead conversion funnel report

### Communication (WhatsApp-first)
- Official WhatsApp Business API integration
- Automated: payment receipts, expiry/renewal reminders, birthday wishes, class reminders
- Bulk WhatsApp campaigns/broadcasts; email; SMS
- Push notification broadcasts to members

### Staff & Permissions
- Roles: Owner, Manager, Receptionist, Trainer, Custom
- Granular per-role permissions
- Staff payroll + commission tracking; shift scheduling

### Multi-Location
- Multiple branches under one owner dashboard
- Branch-scoped staff access; per-branch plans/schedules/branding
- Shared exercise/diet libraries across branches
- Per-branch + consolidated reports; centralized or per-branch billing

### Reports & Analytics
- Revenue by category (membership/PT/class packages/products)
- Active/expired/expiring-soon membership analytics
- Attendance trends; staff performance; retention; income/expense/net; daily+monthly views

### Member Self-Service (portal/app)
- Dashboard (status, expiry, days remaining), in-app renewal/upgrade
- Payment history; class booking + waitlists
- View workout/diet/PT plans; log weight; BMI + trend charts
- Check-in history; digital QR ID; health profile (height, blood group, allergies, goals)
- Notification inbox; feedback form

### Platform / Misc
- Native iOS + Android apps (owner app + member app)
- WhatsApp OTP passwordless login; Face ID / Touch ID
- Gym public landing page; online payment link generation
- Waiver collection; multi-currency + tax + timezone support
- AI business insights (revenue forecast, churn prediction) + natural-language analytics assistant

### Competitor's known weaknesses (check if WE can win here)
- Multiple payment gateways beyond Razorpay
- Open API / webhooks / Zapier
- Door/turnstile access control (auto-block expired members)
- Offline mode with sync
- POS / supplement inventory
- Hindi + regional language UI
- Website builder; wearable integrations; on-demand workout video library
- Free tier / transparent pricing
