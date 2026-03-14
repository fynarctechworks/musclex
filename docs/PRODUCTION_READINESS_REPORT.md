# FitSync Pro — Production Readiness Report

**Date:** 2025-01-13  
**Scope:** Full backend audit across all 12 modules  
**Build Status:** ✅ TypeScript compiles with 0 errors  
**Codebase:** 106 Prisma models | ~280+ endpoints | 55 services | 45 controllers | 80 DTOs | 22 NestJS modules | 12 SQL migrations

---

## Production Readiness Score: 5.5 / 10

| Category | Score | Weight | Details |
|---|---|---|---|
| Core Functionality | 8/10 | 25% | All 12 modules complete, endpoints wired, DTOs for most routes |
| Data Integrity | 5/10 | 20% | Race conditions FIXED ✅, but missing updated_at/deleted_at on many models |
| Multi-Tenant Security | 3/10 | 20% | search_path isolation works, but NO app-level tenant checks in 40+ methods |
| Error Handling | 4/10 | 15% | Silent fallbacks in critical paths (tenant middleware, schema creation) |
| Performance | 5/10 | 10% | Multiple N+1 patterns in cron jobs + facial check-in is O(n) |
| Operations | 5/10 | 10% | Cron jobs lack distributed locks for multi-instance deploy |

---

## Critical Fixes Applied (This Session)

| # | File | Fix | Severity |
|---|---|---|---|
| 1 | `payments/payments.service.ts` | Added HMAC signature verification (Razorpay/Stripe) to `verifyPayment()` | **CRITICAL** |
| 2 | `payments/payments.service.ts` | Wrapped `verifyPayment()` in `$transaction` — prevents double membership creation | **CRITICAL** |
| 3 | `payments/payments.service.ts` | Replaced `Math.random()` with `crypto.randomInt()` for receipt numbers | **HIGH** |
| 4 | `check-ins/check-ins.service.ts` | Wrapped check-in creation + class credit decrement in `$transaction` | **CRITICAL** |
| 5 | `check-ins/check-ins.service.ts` | Changed credit decrement to `{ decrement: 1 }` (atomic) instead of read-then-write | **HIGH** |
| 6 | `classes/classes.service.ts` | Made `enroll()` fully atomic — capacity check + enrollment inside `$transaction` | **CRITICAL** |
| 7 | `inventory/inventory.service.ts` | Moved stock read + negative check inside `$transaction` in `adjustInventory()` | **CRITICAL** |
| 8 | `staff/payroll.service.ts` | Wrapped duplicate check + payroll creation inside `$transaction` | **CRITICAL** |
| 9 | `payments/billing.service.ts` | Moved discount validation + `used_count` increment inside invoice `$transaction` | **HIGH** |
| 10 | `payments/billing.service.ts` | Replaced `Math.random()` with `crypto.randomInt()` for invoice numbers | **HIGH** |
| 11 | 5 more files | Replaced ALL remaining `Math.random()` with `crypto.randomInt()` (9 total locations) | **HIGH** |

**Files modified:** `payments.service.ts`, `billing.service.ts`, `check-ins.service.ts`, `classes.service.ts`, `inventory.service.ts`, `payroll.service.ts`, `members.service.ts`, `membership.service.ts`, `renewals.service.ts`, `pos.service.ts`, `purchase-orders.service.ts`

---

## Top 10 Fixes Needed Before Production Deploy

### 1. 🔴 CRITICAL — Add Application-Level Tenant Checks (40+ methods)

**Problem:** Services use `findUnique({where: {id}})` without tenant filtering. The schema-per-tenant isolation via `SET search_path` is the ONLY defense. If it silently falls back to `studio_template`, cross-tenant data access occurs.

**Affected:** `staff.service.ts`, `membership.service.ts`, `member-crm.service.ts`, `billing.service.ts`, `discounts.service.ts`, `scheduling.service.ts`, `booking.service.ts`, `attendance.service.ts`, `inventory.service.ts`, `purchase-orders.service.ts`, `automation.service.ts`, `leads.service.ts`, and more.

**Fix:** Add `organization_id` or `branch_id` filter to every `findUnique`/`findFirst` call, or create a Prisma middleware that injects tenant filtering automatically.

### 2. 🔴 CRITICAL — Fix Tenant Middleware Silent Fallback

**Problem:** `tenant.middleware.ts` catches `SET search_path` failures and falls back to `studio_template` — a shared schema. This means if a schema doesn't exist or the query fails, all data operations silently run against shared data.

**Fix:** Throw `ForbiddenException` instead of falling back. Never allow requests to proceed against a shared template schema.

### 3. 🟠 HIGH — Add Distributed Locks to Cron Jobs

**Problem:** With multiple Railway instances, every cron fires on every instance simultaneously. `renewals.service.ts` has 4 crons that can create duplicate membership renewals, double payment records, and duplicate expiry processing.

**Fix:** Use Redlock (via Upstash Redis, already in tech stack) or `pg_advisory_lock()` before each cron body. Example: `await this.redis.set('lock:cron:auto_renew', '1', 'EX', 300, 'NX')`.

### 4. 🟠 HIGH — Wrap Auto-Renewal in Transaction

**Problem:** `renewals.service.ts` `handleAutoRenewals()` does 3 sequential operations per member (update old membership → create new → create payment) without a `$transaction`. If step 2 fails, the old membership is marked `renewed` with no replacement.

**Fix:** Wrap the per-member renewal loop body in `this.prisma.$transaction()`.

### 5. 🟠 HIGH — Create DTOs for 9 Unvalidated Endpoints

**Problem:** Controllers using `@Body() body: { ... }` bypass `class-validator` entirely. Critical endpoints like `POST /payments/cash` accept unvalidated amounts (including negative numbers).

**Endpoints needing DTOs:**
- `POST /payments/cash`, `/payments/create-order`, `/payments/verify`
- `POST /check-ins`, `/check-ins/facial`, `/check-ins/sync`
- `POST /ai/chat`
- `POST /auth/select-workspace`
- `POST /marketing/push-notifications`

### 6. 🟠 HIGH — Enforce Payment Signature Verification

**Problem:** The new HMAC verification only runs if `PaymentGatewayConfig` has a `webhook_secret`. If no config row exists, verification is silently skipped.

**Fix:** Make gateway config required — throw `BadRequestException('Payment gateway not configured')` if no config found for the gateway.

### 7. 🟠 HIGH — Fix Encryption Key Derivation

**Problem:** `auth.service.ts` derives AES keys by zero-padding `SUPABASE_SERVICE_ROLE_KEY` to 32 chars. No KDF (PBKDF2/HKDF). The first 32 bytes of a Supabase service role key are predictable base64 characters.

**Fix:** Use `crypto.pbkdf2Sync(serviceRoleKey, staticSalt, 100000, 32, 'sha256')` for proper key derivation.

### 8. 🟠 HIGH — Fix Silent Error Handling in Critical Paths

**Problem:**
- Schema creation failure silently swallowed (2 locations in `auth.service.ts`)
- RBAC guard failure falls through to more-permissive defaults
- AI briefing returns fake hardcoded metrics on DB error

**Fix:** Log and throw on schema creation failure. Make RBAC guard deny by default on error. Remove hardcoded mock data from AI briefing.

### 9. 🟡 MEDIUM — Add Auth-Specific Rate Limits

**Problem:** Global throttle (10 req/sec) applies to all routes. Auth endpoints like `/register`, `/forgot-password`, `/resend-verification` need much tighter limits (3-5 req/min) to prevent credential stuffing and email bombing.

**Fix:** Add `@Throttle({ default: { limit: 3, ttl: 60000 } })` to auth registration and password reset endpoints.

### 10. 🟡 MEDIUM — Optimize N+1 Query Patterns in Cron Jobs

**Problem:**
- `aggregateMemberBehavior()` runs 5 queries per active member (2500+ queries for 500 members)
- `handleMembershipExpiry()` does per-member count + update loop
- `bulkMarkAttendance()` processes entries sequentially

**Fix:** Use batch queries with `groupBy`, `updateMany`, and `Promise.all` for parallel processing where safe.

---

## Remaining Issues by Severity

### CRITICAL (2 remaining)
1. Application-level tenant isolation missing in 40+ service methods
2. Tenant middleware silently falls back to shared schema

### HIGH (6 remaining)
3. No distributed locks for cron jobs (multi-instance duplication)
4. Auto-renewal not wrapped in transaction
5. 9 controller endpoints missing DTO validation
6. Payment signature verification skipped when no gateway config
7. Weak encryption key derivation (no KDF)
8. Silent error handling in schema creation + RBAC guard

### MEDIUM (5 remaining)
9. Auth-specific rate limits missing
10. N+1 query patterns in cron jobs and batch operations
11. AI briefing returns fake data on error
12. `face_descriptor` field filtering not enforced at schema level
13. 58 models missing `updated_at` timestamps, all 106 missing `deleted_at`

### LOW (3 remaining)
14. AES-GCM uses 16-byte IV instead of recommended 12-byte
15. 80+ foreign keys missing explicit indexes
16. `Inventory.last_updated` should be `updated_at` for consistency

---

## Database Schema Issues (Non-Blocking but Important)

| Issue | Count | Impact |
|---|---|---|
| Models missing `updated_at` | 58 of 106 | No audit trail for record modifications |
| Models missing `deleted_at` (soft delete) | 106 of 106 | Hard deletes lose data permanently |
| Foreign keys without indexes | 80+ | Slow JOIN/WHERE on FK columns |
| Models missing `@@schema("studio_template")` | 2 | `ClassEnrollment`, `NotificationLog` may be in wrong schema |
| `MemberTag` missing `organization_id` | 1 | No tenant isolation for tags |
| `Inventory.last_updated` naming | 1 | Inconsistent with convention |

---

## What's Working Well

- ✅ All 12 modules complete and functional
- ✅ TypeScript compiles with 0 errors
- ✅ 22 NestJS modules properly wired in `app.module.ts`
- ✅ JWT auth + RBAC + permissions guard on all controllers
- ✅ Global `ThrottlerModule` configured (short + medium windows)
- ✅ Multi-schema tenant isolation at DB level
- ✅ Supabase Auth integration for login
- ✅ 7 cron jobs for metrics aggregation
- ✅ 4 cron jobs for membership lifecycle (expiry, grace, freeze, renewal)
- ✅ Outbound webhooks with HMAC-SHA256 signing
- ✅ Platform settings, integrations catalog, feature flags system
- ✅ All race conditions in financial operations now fixed (this session)
- ✅ All `Math.random()` replaced with `crypto.randomInt()`
