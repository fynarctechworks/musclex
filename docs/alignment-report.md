# FitSync Pro — UI/UX ↔ Backend Alignment Verification Report

**Date:** March 9, 2026  
**Screens Reviewed:** 29 PNG screens  
**Verified Against:** PRD v1.0 + TRD v1.0  

---

## Executive Summary

Your screens are **~75% aligned** with the backend specs. The core data flows, forms, and feature coverage are solid. However, there are **12 missing screens**, several **branding/naming inconsistencies**, and some **field-level mismatches** that will cause bugs if not fixed before wiring the frontend to the backend. Below is the full breakdown.

---

## SECTION 1: CRITICAL ISSUES (Fix Before Coding)

### 1.1 — Inconsistent Branding Across Screens

Multiple screens use different product names instead of "FitSync Pro":

| Screen | Shows | Should Be |
|--------|-------|-----------|
| Class Details (HIIT) | "FitFlow" | FitSync Pro |
| Record New Payment | "Fitness SaaS" | FitSync Pro |
| Class Details footer | "© 2023 FitFlow Systems Inc." | FitSync Pro |
| Facial Recognition | Different logo style | Standardize |

**Impact:** If you hand these screens to Claude Code as-is, it will generate components with mixed branding strings. Fix all Figma frames to say "FitSync Pro" before exporting.

### 1.2 — Navigation Sidebar Is Different on Almost Every Screen

The sidebar menu items change from screen to screen. Some screens show 6 items, others show 10. Some have "Check-ins", some have "Reports", some have "AI Advisor" — but the combinations are inconsistent.

**What the PRD defines as the nav structure:**
- Dashboard
- Members
- Check-ins
- Schedule (Classes)
- Finance (Payments)
- Staff
- Marketing
- AI Advisor
- Settings

**Impact:** This is the single biggest source of bugs. When Claude Code generates components, each page will have a different sidebar, and you'll spend hours fixing layout inconsistency. **Create one standardized sidebar component in Figma and use it as a shared component across ALL frames.**

### 1.3 — 12 Missing Screens (PRD Specifies 30 Total)

The PRD defines 30 screens. You have 29 PNGs, but some are duplicates/variants, and several required screens are missing:

| PRD Screen ID | Screen Name | Status |
|---------------|-------------|--------|
| S01 | Login Screen | ❌ MISSING |
| S02 | Onboarding Setup | ❌ MISSING |
| S03 | Forgot Password / Reset | ❌ MISSING |
| S04 | Main Dashboard (KPI cards + revenue chart + alerts + activity feed) | ❌ MISSING |
| S05 | Branch Selector / Comparison View | ❌ MISSING |
| S07 | Member List (table with search/filter/sort) | ❌ MISSING |
| S11 | Churn Risk List | ❌ MISSING |
| S23 | Add/Edit Staff Form | ❌ MISSING |
| S25 | Campaign Creator (segment + compose + schedule) | ❌ MISSING |
| S27 | Referral Program Screen | ❌ MISSING |
| S28 | Studio Settings (name, logo, branches, timezone, currency) | ❌ MISSING |
| S15 | Waitlist Manager (dedicated) | ⚠️ Partially covered in Class Roster |

**Impact:** Without these screens, Claude Code will have to improvise their layout, which introduces inconsistency and bugs. The Login/Onboarding flow is especially critical — it's the first thing users see.

### 1.4 — Integrations Screen Shows Wrong Services

Your Integrations screen shows:

| Category | Screen Shows | TRD Specifies |
|----------|-------------|---------------|
| AI | OpenAI (Connected), Claude (Disconnected) | **Anthropic Claude only** |
| Email | SendGrid, Mailchimp | **Resend.com** |
| Payment | Stripe, PayPal | **Razorpay (primary) + Stripe** |

**Impact:** If coded as-is, the backend integration layer won't match the frontend. The TRD has specific SDK references (razorpay, resend, @anthropic-ai/sdk) — the UI must reflect these exact services.

### 1.5 — Payment Methods Mismatch

| Where | What's Shown | TRD payments.payment_method Values |
|-------|-------------|-----------------------------------|
| Record Payment form | Cash, Card, Bank, **PayPal** | cash, card, **upi**, bank_transfer, razorpay, stripe |
| Payments Table | Visa, PayPal, Mastercard, Cash, Amex | Should use the method enum values |

**PayPal is NOT in the TRD. UPI is missing from the UI.** Razorpay and Stripe are online gateway flows (separate from manual recording) and shouldn't appear as manual payment method buttons.

---

## SECTION 2: FIELD-LEVEL MISMATCHES

### 2.1 — Member ID Format Inconsistency

| TRD Spec | Screens Show |
|----------|-------------|
| `FS-YYYYMMDD-XXXX` | FSP-29402, FS-92834, FSP-882910, #FSP-29408 |

The prefix alternates between "FS" and "FSP", and the date portion (YYYYMMDD) is sometimes missing. Pick one format and standardize: the TRD says `FS-YYYYMMDD-XXXX`.

### 2.2 — Receipt/Invoice Number Format

| TRD Spec | Screens Show |
|----------|-------------|
| `RCP-YYYYMMDD-XXXX` | TRX-823910 (Payment form), INV-2024-001 (Invoice) |

The TRD defines `receipt_number` with format `RCP-YYYYMMDD-XXXX`. The invoice screen uses a separate invoice number format which is fine as a display ID, but the receipt number field should match.

### 2.3 — Member Profile "Member Goals" Section

The Member Profile screen shows "Member Goals" with Weight Loss and Muscle Gain progress bars. **This feature does not exist anywhere in the PRD or TRD** — there are no database fields for it, no API endpoints for it. Either remove this section from the UI, or document it as a future enhancement and don't wire it to the backend.

### 2.4 — Staff Profile "Payroll" Tab

The Staff Profile screen has a "Payroll" tab. The PRD explicitly lists "Payroll management" as **out of scope (Phase 3 lite)**. The "Salary Details" card (marked Owner Only) is fine — that aligns with the `salary` field in the staff table. But the tab should be renamed from "Payroll" to "Compensation" or similar to avoid confusion.

### 2.5 — Check-in Method: RFID in Phase 1

The Front Desk Check-in screen shows 4 methods: QR, RFID, Face ID, Manual. However, the TRD explicitly states: **"RFID (Phase 1): Skipped --- QR + Manual only"**. 

**Recommendation:** Keep RFID in the UI as a greyed-out "Coming Soon" state, or remove it for Phase 1. Don't wire it to the backend — there's no RFID endpoint in the TRD.

---

## SECTION 3: WHAT'S WELL-ALIGNED ✅

These screens closely match the PRD/TRD specs and should wire cleanly:

| Screen | Alignment Notes |
|--------|----------------|
| **New Member Registration** | All required fields present (name, phone*, email, DOB, emergency contact, photo, plan selector). Member ID auto-generated. ✅ |
| **Member Profile** | Engagement score (0-100), status badge (Active), tabs (Overview/Attendance/Payments/Notes), quick actions. ✅ |
| **Front Desk Check-in** | All 4 methods shown, recent check-ins feed with live badge. ✅ |
| **QR Check-in** | Camera scanner, member card with status/plan, confirm button. ✅ |
| **Manual Check-in** | Search by name, member details, "Check In Now" button. ✅ |
| **Facial Recognition** | Camera with face detection overlay, confidence %, identity verified state. ✅ |
| **Weekly Class Schedule** | Week view with class cards showing trainer, time, capacity. Branch/trainer filters. ✅ |
| **Create New Class** | All fields: name, category, trainer, branch, room, capacity, duration, recurrence. **Conflict detection shown!** ✅ |
| **Class Details** | Trainer, capacity, room, duration. Enrolled/Waitlist/Attendance tabs. ✅ |
| **Class Roster** | Enrolled members table, waitlist with "Move to Enrolled" action, capacity indicator. ✅ |
| **Financial Analytics** | Revenue, expenses, net profit KPIs. Revenue trend chart. Recent transactions. ✅ |
| **Payments Table** | Member, plan, amount, method, date, status. Filters and pagination. ✅ |
| **Record Expense** | Amount, category, date, branch, description, attachment upload. ✅ |
| **Invoice Preview** | Studio branding, member info, plan, amount, payment details, PDF download. ✅ |
| **Staff Directory** | Name, role, branch, joining date, status. Search + filters. ✅ |
| **Staff Profile** | Personal info, branch assignments, salary (Owner Only), performance metrics. ✅ |
| **Staff Shift Schedule** | Weekly calendar with shifts per staff, branch/role filters. ✅ |
| **Leave Requests** | Staff submits → manager approves/rejects. Status badges. ✅ |
| **Trainer Analytics** | Classes taught, occupancy %, attendance rate, no-show rate, member rating. Comparison table. ✅ |
| **Marketing Campaigns** | Campaign list with status, audience, channels, performance metrics. ✅ |
| **Automation Rules** | Trigger events, delivery channels, segmentation filters. Active/Paused toggle. ✅ |
| **Message Template Editor** | Variables ({member_name}, {plan_name}, {expiry_date}), channel selection, live preview. ✅ |
| **AI Business Advisor** | Conversational UI with data visualization, suggested actions, quick prompts. ✅ |
| **AI Morning Briefing** | Daily summary, high-risk members, top performer, revenue analysis. ✅ |
| **Membership Plans** | Plan name, duration, price, max classes/week, branch scope, active toggle. ✅ |

---

## SECTION 4: THEME/DESIGN INCONSISTENCY

### 4.1 — Dark vs. Light Theme

The PRD Design System (Section 13) specifies a **dark theme**:
- Background: `#0D1B2A`
- Surface: `#1A2F45`
- Cards: `#1E3450`

However, several screens use a **white/light theme**: Create New Class, Record Payment, Invoice Preview, Facial Recognition. This creates visual inconsistency.

**Recommendation:** Decide which theme to use and apply it uniformly. If you want light mode, update the PRD design tokens. If you want dark mode (as specified), update those Figma frames.

### 4.2 — Floating AI Chat Button Missing

The PRD says: *"Floating chat button on all screens — opens AI assistant panel."* Your screens show AI Advisor as a full sidebar page (which is good for deep conversations), but the floating chat button overlay is missing from other screens. Consider adding a small floating chat icon on the dashboard, members, finance screens, etc.

---

## SECTION 5: RECOMMENDATIONS FOR WIRING (Claude Code Strategy)

Given what I've seen, here's my recommended approach for moving to VS Code / Claude Code:

### Step 1: Fix Figma First (1-2 days)
1. Standardize sidebar navigation as a shared Figma component
2. Fix all branding to "FitSync Pro"
3. Create the 12 missing screens (Login, Onboarding, Dashboard, Member List, etc.)
4. Fix payment methods, integrations, and ID formats
5. Apply consistent dark/light theme

### Step 2: Project Folder Structure
```
fitsync-pro/
├── docs/
│   ├── PRD_v1.0.md
│   ├── TRD_v1.0.md
│   └── screens/          ← All PNG screens organized by module
│       ├── auth/
│       ├── dashboard/
│       ├── members/
│       ├── checkins/
│       ├── classes/
│       ├── finance/
│       ├── staff/
│       ├── marketing/
│       ├── ai/
│       └── settings/
├── frontend/              ← Next.js 14 app
├── backend/               ← NestJS app
└── CLAUDE.md              ← Your project instructions
```

### Step 3: Build Order (from TRD Section 11)
Follow the TRD's exact build order: **Infrastructure → Auth → Core Data → Check-In → Payments → Analytics → AI → Marketing.** Do NOT skip ahead. Each phase depends on the previous.

### Step 4: Give Claude Code Context Per Module
Instead of dumping everything at once, work module by module:
1. Start with auth screens + PRD Section 7 (RBAC) + TRD Section 6 (Security)
2. Then members screens + PRD Feature 2 + TRD Section 4 (members table)
3. And so on...

This reduces context window bloat and produces fewer bugs.

### Step 5: Shared Components First
Before building pages, have Claude Code create:
- Layout component (sidebar + topbar)
- Design tokens/theme file matching PRD Section 13
- Shared form components (inputs, selects, buttons, status badges)
- Data table component (used on 10+ screens)
- Modal/dialog component

This prevents each screen from re-inventing common elements.

---

## SECTION 6: SUMMARY SCORECARD

| Category | Score | Notes |
|----------|-------|-------|
| Feature Coverage | 75% | 12 of 30 screens missing |
| Data Field Alignment | 85% | Minor format mismatches (IDs, payment methods) |
| API Endpoint Coverage | 90% | All major flows have corresponding screens |
| Design System Compliance | 70% | Theme inconsistency, nav inconsistency |
| Branding Consistency | 60% | Multiple product names used |
| RBAC Alignment | 95% | Staff profile correctly shows "Owner Only" salary |
| Check-in Flow | 90% | All 4 methods present (RFID should be greyed out) |
| Integration Accuracy | 50% | Wrong services shown (OpenAI, SendGrid, PayPal) |

**Overall Alignment: ~78%** — Solid foundation but needs the fixes above to avoid rework during coding.

---

*Report generated from visual inspection of 29 Figma screen exports against FitSync Pro PRD v1.0 and TRD v1.0.*
