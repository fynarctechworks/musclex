# FitSync Pro — Final System Audit Report
**Date:** March 15, 2026  
**Auditor:** Senior Staff Engineer — Full End-to-End Review  
**Scope:** Backend, Frontend, Database, API Integrations, Security, Performance, AI System

---

## SYSTEM HEALTH SCORE: 74 / 100

| Category | Score | Grade |
|----------|-------|-------|
| **Frontend Quality** | 76/100 | B |
| **Backend Quality** | 78/100 | B+ |
| **Database Design** | 68/100 | C+ |
| **Security** | 82/100 | A- |
| **Performance** | 65/100 | C |
| **AI Integration** | 30/100 | F |

---

## CODEBASE INVENTORY

| Metric | Count |
|--------|-------|
| Backend TypeScript files | ~260 |
| Frontend TypeScript/TSX files | ~281 |
| NestJS modules | 23 |
| Frontend feature modules | 20 |
| Prisma database models | 109 |
| Frontend pages/routes | 50+ |
| Shared UI components | 16 |
| React Query hooks | ~90 |
| API endpoints | ~398 |
| Zustand stores | 3 |

---

## STEP 1 — PROJECT STRUCTURE AUDIT

### Strengths
- **Feature-based architecture** — All 20 feature modules follow consistent `api.ts` / `hooks.ts` / `types.ts` / `components/` structure
- **Barrel exports** — Every feature module has `index.ts` re-exporting all public APIs
- **Centralized query key factory** — `services/query-client.ts` defines all ~60 query key builders
- **Shared components** — 16 reusable components (DataTable, StatusBadge, KPICard, FormInput, ConfirmDialog, EmptyState, LoadingSkeleton, PageHeader, FilterBar)
- **Separation of concerns** — Backend: NestJS modules with controllers/services/DTOs. Frontend: pages consume feature hooks, features wrap API client

### Issues Found

| Issue | Severity | Status |
|-------|----------|--------|
| Reports page missing `<AppLayout>` wrapper — no sidebar visible | Critical | **FIXED** |
| No classes listing page (`/classes/page.tsx` missing) | Medium | Noted |
| `@/lib/api` vs `@/services/api-client` import inconsistency — some pages use old path | Medium | Noted |
| Missing `.env.example` template files for both backend and frontend | Low | Noted |
| Sentry/PostHog monitoring not configured (in TRD but not implemented) | Medium | Noted |

---

## STEP 2 — FRONTEND AUDIT

### Query Key & Cache Issues — FIXED

| Issue | File | Status |
|-------|------|--------|
| Dashboard KPIs: hardcoded `["dashboard-kpis"]` instead of `queryKeys.dashboard.kpis()` | `dashboard/page.tsx` | **FIXED** |
| Dashboard revenue: hardcoded `["dashboard-revenue"]` | `dashboard/page.tsx` | **FIXED** |
| Dashboard activity: hardcoded `["dashboard-activity"]` | `dashboard/page.tsx` | **FIXED** |
| Dashboard alerts: hardcoded `["dashboard-alerts"]` | `dashboard/page.tsx` | **FIXED** |
| Dashboard branches: hardcoded `["branches"]` | `dashboard/page.tsx` | **FIXED** |
| Finance payments: hardcoded `["recent-payments"]` | `finance/page.tsx` | **FIXED** |
| Finance expenses: hardcoded `["expenses"]` | `finance/page.tsx` | **FIXED** |

### Cache Invalidation Gaps — FIXED

| Mutation Hook | Missing Invalidation | Status |
|---------------|---------------------|--------|
| `useCreateCheckIn` | `dashboard.all` | **FIXED** |
| `useFacialCheckIn` | `dashboard.all` | **FIXED** |
| `useCreateSale` | `finance.all`, `dashboard.all` | **FIXED** |
| `useCreateReturn` | `finance.all`, `dashboard.all` | **FIXED** |
| `useRecordCashPayment` | `finance.all`, `dashboard.all` | **FIXED** |
| `useVerifyPayment` | `finance.all`, `dashboard.all` | **FIXED** |
| `useCreateExpense` | `finance.all`, `dashboard.all` | **FIXED** |
| `useUpdateExpense` | `finance.all`, `dashboard.all` | **FIXED** |
| `useDeleteExpense` | `finance.all`, `dashboard.all` | **FIXED** |
| `useProcessPayroll` | `finance.all`, `dashboard.all` | **FIXED** |

### UI/UX Bugs — FIXED

| Issue | File | Status |
|-------|------|--------|
| Marketing delete dialog stays open on error | `marketing/page.tsx` | **FIXED** |
| Referrals page uses `any` cast | `referrals/page.tsx` | **FIXED** |
| Reports page missing AppLayout | `reports/page.tsx` | **FIXED** |

### Remaining Frontend Issues (Not Fixed — Lower Priority)

| Issue | File | Severity |
|-------|------|----------|
| Members page search fires query on every keystroke — needs debounce | `members/page.tsx` | Medium |
| Staff page search — same debounce issue | `staff/page.tsx` | Medium |
| Settings page `useForm()` has no Zod schema validation | `settings/page.tsx` | Medium |
| Staff page: still uses `@/lib/api` import directly | `staff/page.tsx` | Low |
| Dashboard: no error state when KPI query fails (shows blank) | `dashboard/page.tsx` | Medium |
| POS page: `staff_id: user?.id || ''` may send empty string | `pos/page.tsx` | Medium |
| Check-in page: `feedLoading` declared but never used | `check-in/page.tsx` | Low |
| Members page: row click conflicts with checkbox selection | `members/page.tsx` | Low |

---

## STEP 3 — BACKEND AUDIT

### Strengths
- **Solid module structure** — All 23 NestJS modules properly decorated and imported
- **Global ValidationPipe** — `whitelist: true, forbidNonWhitelisted: true` prevents mass assignment
- **Request body limit** — 1MB cap on JSON/URL-encoded bodies
- **Multi-tenant isolation** — Schema-level with SQL injection protection via UUID regex + schema name validation + existence check
- **Brute force protection** — Account-level lockout (15-min) + IP-level rate limiting (50/60s)
- **3-tier rate limiting** — Short (10/sec), Medium (100/min), Burst (50/10sec) via Redis

### Critical Backend Issues

| Issue | File | Severity | Status |
|-------|------|----------|--------|
| N+1 in `Members.findAll()` — loads memberships+plans+tags per member | `members.service.ts` | High | **OPEN** |
| N+1 in `Dashboard.getRevenueChart()` — 12 sequential monthly queries | `dashboard.service.ts` | High | **OPEN** |
| N+1 in `RbacService.getUserWorkspaces()` — sequential studio lookups | `auth/rbac.service.ts` | Medium | **OPEN** |
| Missing await on `recalculateInvoiceStatus()` | `payments.service.ts` | High | **OPEN** |
| API Key Guard sets `studio_id: null` — breaks tenant routing | `api-key.guard.ts` | Critical | **OPEN** |
| No UUID validation on `@Param('id')` route params | Multiple controllers | Medium | **OPEN** |
| `checkin_method` field: no `@IsIn()` validation | `create-member.dto.ts` | Medium | **OPEN** |
| `full_name` field: no `@MinLength` / `@MaxLength` | `create-member.dto.ts` | Low | **OPEN** |
| Inconsistent error response shapes across endpoints | System-wide | Medium | **OPEN** |

---

## STEP 4 — DATABASE AUDIT

### Schema Statistics
- **109 models**, proper `@id @default(uuid())` on all
- **46 models** missing `updated_at` timestamps
- **15+** missing critical indexes
- **15+** foreign keys without cascade rules

### Missing Indexes (Critical for Performance)

| Table | Missing Index | Impact |
|-------|--------------|--------|
| `MemberTagAssignment` | `@@index([member_id])` | Tag filtering slow |
| `ClassWaitlist` | `@@index([member_id])` | Waitlist lookups slow |
| `NotificationLog` | `@@index([member_id])` | Notification queries slow |
| `Payment` | `@@index([status])` | Payment filtering slow |
| `Campaign` | `@@index([status])` | Campaign filtering slow |
| `PosSale` | `@@index([status])` | Sales filtering slow |
| `Staff` | `@@index([email])` | Staff login lookups slow |
| `MemberInvoice` | `@@index([status, created_at])` | Invoice sorting slow |
| `PosSale` | `@@index([member_id, created_at])` | Sales history slow |
| `Lead` | `@@index([assigned_staff_id, status])` | Lead assignment slow |
| `ClassAttendance` | `@@index([check_in_time])` | Attendance reporting slow |

### Missing Cascade Rules (Orphan Data Risk)

| FK | Should Be | Impact |
|----|-----------|--------|
| `Lead.assigned_staff_id` → Staff | `onDelete: SetNull` | Staff delete orphans leads |
| `LeadActivity.staff_id` → Staff | `onDelete: SetNull` | Staff delete orphans activities |
| `MemberNote.staff_id` → Staff | `onDelete: SetNull` | Staff delete orphans notes |
| `Refund.processed_by` → Staff | `onDelete: SetNull` | Staff delete orphans refunds |
| `PayrollRecord.staff_id` → Staff | `onDelete: Cascade` | Staff delete orphans payroll |
| `Expense.recorded_by_staff_id` → Staff | `onDelete: Cascade` | Staff delete orphans expenses |
| `UserRole.studio_id` → Studio | Missing `@relation` entirely | FK exists but no relation defined |

### Schema Design Issues

| Issue | Impact |
|-------|--------|
| Legacy `Class` model coexists with `ClassSession` | Confusion, dual code paths |
| Status fields stored as strings, not Prisma enums | No compile-time safety, typo risk |
| JSON fields (workflow configs, bonus structures) not typed | Runtime errors possible |
| No soft-delete pattern on any model | GDPR compliance risk |
| `Inventory` uses `last_updated` instead of `updated_at` | Convention inconsistency |

---

## STEP 5 — API CONNECTION AUDIT

### Verified Working Connections
- Members CRUD → `members.controller.ts` → `members.service.ts` → Prisma
- Check-ins → `check-ins.controller.ts` → `check-ins.service.ts` → Prisma
- Payments → `payments.controller.ts` → `payments.service.ts` → Prisma
- Classes → `classes.controller.ts` → `classes.service.ts` → Prisma
- Staff → `staff.controller.ts` → `staff.service.ts` → Prisma
- Marketing → `marketing.controller.ts` → `marketing.service.ts` → Prisma
- POS → `pos.controller.ts` → `pos.service.ts` → Prisma
- Reports/Analytics → `analytics.controller.ts` → Prisma aggregations
- AI → `ai.controller.ts` → `ai.service.ts` → Mock responses

### Broken/Incomplete Connections

| Frontend | Backend | Issue |
|----------|---------|-------|
| Referrals page uses `useReferralPrograms` from marketing feature | `marketing.controller` | Should be separate referrals feature module |
| Dashboard KPIs use direct `apiClient.get()` | `dashboard.controller` | Should use feature hooks for consistency |
| Finance page uses inline query, not feature hooks | `payments.controller` | Bypasses feature layer |
| Staff page uses inline `apiClient.get()` | `staff.controller` | Should use `useStaffList` hook |

### External SDK Status

| SDK | Status |
|-----|--------|
| `@anthropic-ai/sdk` (Claude AI) | **NOT INSTALLED** — Mock responses only |
| `razorpay` | In package.json but webhook verification incomplete |
| `stripe` | In package.json but payment flow not fully wired |
| `twilio` (SMS) | In package.json, service stubbed |
| `resend` (Email) | In package.json, service stubbed |
| `@supabase/supabase-js` | Fully integrated (auth, storage) |

---

## STEP 6 — AI SYSTEM AUDIT

### Status: COMPLETELY MOCKED

The entire AI advisor system returns hardcoded responses. No LLM integration exists.

| Component | Implementation | Status |
|-----------|---------------|--------|
| `POST /ai/chat` | Keyword-matching mock responses | Fake |
| `GET /ai/daily-briefing` | Real Prisma queries for metrics, mock summary text | Partial |
| `GET /ai/conversations` | Correctly queries `AiConversation` by `staff_id` | Working |
| `@anthropic-ai/sdk` | **NOT in package.json** | Missing |
| Prompt injection protection | N/A (no prompts exist) | N/A |
| Frontend insight generation | Client-side from analytics data | Working |
| Frontend chat UI | Correct response shape handling | Working |
| Frontend daily briefing | Correct metrics rendering | Working |

### To Complete AI Integration
1. Install `@anthropic-ai/sdk` 
2. Initialize Anthropic client with `ANTHROPIC_API_KEY` env var
3. Replace `generateMockResponse()` with real Claude API calls (model: `claude-sonnet-4-20250514`)
4. Add system prompts with gym business context
5. Add `max_tokens` limit and input sanitization for prompt injection

---

## STEP 7 — PERFORMANCE AUDIT

### Database Performance Issues

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| N+1 in `Members.findAll()` — 100+ queries for 50 members | Dashboard sluggish | Use `_count` aggregates, fetch tags separately |
| N+1 in `Dashboard.getRevenueChart()` — 12 sequential monthly queries | 12x latency on chart | Use single `GROUP BY` query |
| N+1 in `RbacService.getUserWorkspaces()` — sequential studio lookups | Slow login for multi-studio users | Batch: `findMany({ where: { id: { in: ids } } })` |
| 15+ missing database indexes | Slow filtering on status, member_id, created_at | Add indexes per schema audit |

### Frontend Performance Issues

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| Check-in feed polls every 5 seconds | Excessive network traffic | Configure interval, disable on unmount, use WebSocket |
| Members/Staff search fires on every keystroke | 4+ requests per search term | Add 300ms debounce hook |
| Reports page loads all 8 analytics queries at once | Slow initial load | Lazy-load per-tab queries |
| No `React.memo` on insight cards, table rows | Unnecessary re-renders | Memoize expensive components |
| No virtual scrolling on large tables | 500+ rows = lag | Implement virtualized rows |

---

## STEP 8 — SECURITY AUDIT

### Excellent Implementations
- **JWT via Supabase** — Token validation delegated to Supabase `getUser()`
- **Tenant isolation** — Multi-layer: UUID regex → schema name validation → `information_schema` existence check
- **Brute force protection** — Account lockout (15-min, 5 attempts) + IP rate limiting (50/60s)
- **3-tier API rate limiting** — Redis-backed via `ThrottlerModule`
- **Helmet headers** — CSP, X-Frame-Options, X-Content-Type-Options
- **AES-256-GCM encryption** — For pending registration passwords with PBKDF2 key derivation (100K iterations)
- **Role-based access** — 8 role definitions with granular module.action permissions
- **Sensitive data stripping** — `face_descriptor`, `payment_method_token`, salary (unless owner)

### Security Issues

| Issue | Severity | File |
|-------|----------|------|
| API key hashing uses plain SHA256 (no salt) — rainbow table vulnerable | **High** | `api-key.guard.ts` |
| Session token hashing uses plain SHA256 (no salt) | **High** | `auth-session.service.ts` |
| CORS defaults to `localhost:3000` if `CORS_ORIGINS` env not set | **Medium** | `main.ts` |
| No UUID validation on route `@Param('id')` — invalid IDs reach Prisma | **Medium** | All controllers |
| Webhook HMAC signature verification incomplete for Razorpay/Stripe | **Medium** | Payments module |

---

## STEP 9 — ERROR HANDLING AUDIT

### Strengths
- All 90 mutation hooks have `onError` handlers with `toast.error()`
- Backend `ValidationPipe` returns 400 with field-level errors
- `NotFoundException`, `BadRequestException`, `ForbiddenException` used in services
- Frontend `LoadingSkeleton` used consistently on most pages

### Gaps

| Issue | Location |
|-------|----------|
| Dashboard: no error state when KPI/chart queries fail — shows blank | `dashboard/page.tsx` |
| No global error boundary component | `app/layout.tsx` |
| Inconsistent backend error response shape (`{ success: false }` vs NestJS exceptions) | System-wide |
| Some pages don't handle `isError` from React Query | Multiple pages |
| No retry logic for failed check-in sync | `check-in/page.tsx` |

---

## STEP 10 — DEAD CODE AUDIT

### Unused/Redundant Code

| Item | Location | Recommendation |
|------|----------|----------------|
| Legacy `Class` model (replaced by `ClassSession`) | `schema.prisma` | Deprecate with migration |
| No `/classes` listing page exists | Frontend routes | Create or remove route from sidebar |
| `useQuery` import in `finance/page.tsx` (should use feature hooks) | `finance/page.tsx` | Migrate to `usePayments()` hook |
| `apiClient` import in `staff/page.tsx` (feature hooks exist) | `staff/page.tsx` | Migrate to `useStaffList()` hook |
| `check-in/page.tsx` declares `feedLoading` but never renders loading state | `check-in/page.tsx` | Use `feedLoading` for skeleton |
| Multiple pages still import from `@/lib/api` instead of feature modules | Dashboard, Staff, Finance, Settings | Migrate to feature hooks |

---

## STEP 11 — FIXES APPLIED IN THIS AUDIT

### Critical Fixes (11 total)

1. **Reports page** — Added missing `<AppLayout>` wrapper
2. **Dashboard page** — Replaced 5 hardcoded query keys with `queryKeys.*` factory
3. **Finance page** — Replaced 2 hardcoded query keys with `queryKeys.*` factory
4. **Check-in hooks** — Added `dashboard.all` invalidation to `useCreateCheckIn` and `useFacialCheckIn`
5. **POS hooks** — Added `finance.all` + `dashboard.all` invalidation to `useCreateSale` and `useCreateReturn`
6. **Payment hooks** — Added `finance.all` + `dashboard.all` invalidation to `useRecordCashPayment` and `useVerifyPayment`
7. **Expense hooks** — Added `finance.all` + `dashboard.all` invalidation to create/update/delete expense hooks
8. **Payroll hooks** — Added `finance.all` + `dashboard.all` invalidation to `useProcessPayroll`
9. **Marketing page** — Fixed delete dialog not closing on error (added `onError` callback)
10. **Referrals page** — Removed `any` cast, replaced with typed assertion
11. **Build verified clean** — All fixes compile without errors

---

## STEP 12 — PRODUCTION READINESS VERDICT

### **NEEDS FIXES BEFORE DEPLOYMENT**

The system has a strong architectural foundation but is **not production-ready** due to:

#### Blockers (Must Fix)
1. **AI advisor is completely mocked** — Core feature returns fake responses
2. **API Key Guard breaks multi-tenancy** — Sets `studio_id: null`, all API key requests fail
3. **N+1 queries** — Members list + Dashboard chart make 100+ DB round-trips
4. **15+ missing database indexes** — Critical performance degradation at scale
5. **API key/session token hashing unsalted** — Security vulnerability

#### Should Fix
6. **Payment gateway integration incomplete** — Razorpay/Stripe flows stubbed
7. **SMS/Email services stub** — Twilio/Resend not fully wired
8. **Missing error boundaries** — No global React error boundary
9. **No classes listing page** — Route exists in sidebar but page is missing
10. **Search debounce missing** — Members/Staff search fires on every keystroke
11. **Settings form missing validation** — Can submit empty/invalid data
12. **46 database models missing `updated_at`** — Audit trail incomplete
13. **15+ cascade rules missing** — Staff deletion orphans related records

#### Nice to Have
14. Migrate remaining pages from inline `apiClient` calls to feature hooks
15. Add Sentry/PostHog monitoring integration
16. Add soft-delete pattern for GDPR compliance
17. Convert status strings to Prisma enums
18. Add virtual scrolling for large tables
19. Create `.env.example` files for both projects

---

## RECOMMENDATION PRIORITY MATRIX

| Priority | Item | Effort |
|----------|------|--------|
| **P0 — Before Deploy** | Fix API Key Guard `studio_id: null` | 30 min |
| **P0 — Before Deploy** | Add HMAC salt to API key + session token hashing | 1 hour |
| **P0 — Before Deploy** | Add 15 missing database indexes (migration) | 1 hour |
| **P0 — Before Deploy** | Fix N+1 in Members.findAll() | 2 hours |
| **P0 — Before Deploy** | Fix N+1 in Dashboard.getRevenueChart() | 1 hour |
| **P1 — High Priority** | Integrate Anthropic SDK for AI advisor | 3 hours |
| **P1 — High Priority** | Add global React error boundary | 30 min |
| **P1 — High Priority** | Add search debounce to Members/Staff | 30 min |
| **P1 — High Priority** | Add form validation to Settings page | 30 min |
| **P1 — High Priority** | Fix CORS production default | 15 min |
| **P2 — Medium Priority** | Add missing cascade rules (migration) | 2 hours |
| **P2 — Medium Priority** | Add `updated_at` to 46 models (migration) | 1 hour |
| **P2 — Medium Priority** | Complete payment gateway integration | 4 hours |
| **P2 — Medium Priority** | Create classes listing page | 1 hour |
| **P3 — Low Priority** | Migrate pages to feature hooks | 2 hours |
| **P3 — Low Priority** | Add Sentry/PostHog | 2 hours |
| **P3 — Low Priority** | Soft-delete pattern | 4 hours |
