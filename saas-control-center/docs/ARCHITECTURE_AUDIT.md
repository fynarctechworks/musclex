# SaaS Control Center — Deep Architecture Audit

**Auditor:** Principal Backend Architect Review
**Date:** 2026-03-19
**Scope:** Full backend codebase (schema, services, auth, APIs, infra)

---

## 🔴 CRITICAL ISSUES (Must Fix Before Launch)

### C1. MRR Calculation Loads All Active Subscriptions Into Memory
**File:** `src/modules/dashboard/dashboard.service.ts:51-54`
```ts
// PROBLEM: findMany loads ALL rows, then reduces in JS
const mrr = await this.prisma.subscription.findMany({
  where: { status: SubscriptionStatus.ACTIVE },
  include: { plan: { select: { price_monthly: true } } },
});
const mrrValue = mrr.reduce((sum, sub) => sum + Number(sub.plan.price_monthly), 0);
```
**Impact:** At 10K tenants, this loads 10K+ subscription objects into memory every minute (1-min cache TTL). OOM crash guaranteed at scale.
**Fix:** Use raw SQL with `JOIN` + `SUM` aggregate, or Prisma `$queryRaw`.

### C2. Analytics N+1 Loop Queries
**File:** `src/modules/analytics/analytics.service.ts:16-36, 81-97`
```ts
for (let i = months - 1; i >= 0; i--) {
  const agg = await this.prisma.payment.aggregate({...}); // 12 DB calls for 12 months
}
```
**Impact:** Each analytics call fires N sequential DB queries. At 12 months = 12 round trips. Under concurrent load, this hammers the DB.
**Fix:** Single raw SQL query with `DATE_TRUNC('month', created_at) GROUP BY`.

### C3. `redis.keys('ff:*')` Blocks Redis
**File:** `src/modules/feature-flags/feature-flags.service.ts:165`
```ts
const keys = await this.redis.keys('ff:*');
```
**Impact:** `KEYS` is O(N) and BLOCKS Redis for the entire keyspace scan. At 100K+ keys, this causes Redis timeouts for ALL clients.
**Fix:** Use `SCAN` iterator, or better, track tenant cache keys in a Redis SET and delete individually.

### C4. No Old Subscription Cancellation in `changePlan`
**File:** `src/modules/tenant/tenant.service.ts:126-146`
The `$transaction` creates a new subscription but never cancels/expires the existing active one. Results in **duplicate active subscriptions** for the same tenant.
**Fix:** Add `updateMany` to cancel existing active subscriptions within the same transaction.

### C5. Auto-Renew Without Payment Verification
**File:** `src/modules/subscription/subscription.service.ts:143-151`
```ts
if (sub.auto_renew) {
  await this.prisma.subscription.update({...}); // Just extends dates, no payment
}
```
**Impact:** Subscriptions renew for free. Revenue leaks. Tenants get unlimited service without paying.
**Fix:** Auto-renew should create a PENDING payment, attempt gateway charge, and only extend on success. On failure, mark PAST_DUE.

### C6. Refresh Tokens Not Stored or Revocable
**File:** `src/modules/auth/auth.service.ts:94-109`
Refresh tokens are stateless JWTs. There's no way to:
- Revoke a compromised refresh token
- Invalidate all sessions for an admin
- Track active sessions

**Fix:** Store refresh tokens in Redis with TTL. Validate against stored value on refresh. Add a revoke endpoint.

### C7. `sort_by` Parameter is Unbounded String
**File:** `src/common/dto/pagination.dto.ts:24-26` → used in `tenant.service.ts:40`
```ts
const sortField = filters.sort_by as keyof Prisma.TenantOrderByWithRelationInput;
const orderBy = { [sortField]: filters.sort_order || 'desc' };
```
**Impact:** User can pass ANY string as a sort key. While Prisma likely rejects invalid fields, this is a **mass assignment / query manipulation** vector. At minimum causes 500 errors with arbitrary input.
**Fix:** Whitelist allowed sort fields per entity with an enum.

---

## 🟠 MAJOR IMPROVEMENTS

### M1. No `subscription_id` on Payment Model
Payments are linked to tenants but NOT to specific subscriptions. Impossible to:
- Track which subscription period a payment covers
- Reconcile billing cycles
- Handle prorated upgrades/downgrades

### M2. Discount "Best" Logic is Flawed
**File:** `src/modules/plans/discount.service.ts:104-121`
```ts
orderBy: { value: 'desc' } // Orders ALL types by raw value
```
A 50% discount (`value=50, type=PERCENTAGE`) ranks higher than a ₹4000 flat discount (`value=4000, type=FLAT`) even when the flat discount saves more money. The "best" discount selection must **calculate the actual savings** for each and pick the maximum.

### M3. No Trial Subscription Record Created
**File:** `src/modules/tenant/tenant.service.ts:75-93`
When a tenant is created, `trial_ends_at` is set but no `Subscription` record is created with `TRIALING` status. This means:
- Expiration cron never processes trial expirations
- Trial tenants don't appear in subscription analytics
- No subscription history for the trial period

### M4. Impersonation Token Uses Same JWT Secret
**File:** `src/modules/auth/auth.service.ts:118-125`
Impersonation tokens are signed with the default JWT secret. If the main app validates with the same secret, an impersonation token could be used as a regular access token. Should use a separate secret or audience claim.

### M5. Missing Idempotency on Payment Operations
**File:** `src/modules/billing/billing.service.ts`
`retryPayment`, `markAsPaid`, and `refund` have no idempotency keys. Concurrent requests could double-process. Need optimistic locking or idempotency middleware.

### M6. Slug Validation Missing
**File:** `src/modules/tenant/dto/tenant.dto.ts:21-22`
`slug` is validated only as `@IsString()`. No format enforcement. Users could create slugs with spaces, special characters, uppercase — breaking URL routing.
**Fix:** Add `@Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)`.

### M7. Audit Log Stores Full Objects
**File:** `src/modules/tenant/tenant.service.ts:106-108`
```ts
old_value: dto,        // The DTO, not actual diff
new_value: updated,    // Full tenant object with all fields
```
Full Prisma objects include internal fields. Over time, audit_logs becomes the largest table. Should store only changed fields (delta).

### M8. Global Exception Filter Leaks Error Details
**File:** `src/common/filters/global-exception.filter.ts:33-35`
```ts
} else if (exception instanceof Error) {
  message = exception.message; // Leaks internal error messages to client
```
In production, non-HTTP exceptions should return a generic "Internal Server Error" message. Stack traces and error details go to logs only.

---

## 🟡 MINOR OPTIMIZATIONS

### N1. Analytics Endpoints Not Cached
Dashboard metrics have 1-min Redis cache, but analytics endpoints (revenue trend, growth) run expensive queries with zero caching. These change infrequently and should be cached 5-15 minutes.

### N2. `getExpiringSoon` Has No Pagination
**File:** `src/modules/subscription/subscription.service.ts:112-125`
Returns all expiring subscriptions as a flat array. At scale, could return thousands of records.

### N3. Currency Field Should Be Enum
**File:** `prisma/schema.prisma:151`
`currency String @default("INR") @db.VarChar(3)` — free-text field. Should be an enum (`INR`, `USD`, `EUR`) to prevent invalid values like "XYZ".

### N4. Missing `updated_at` on Junction Tables
`PlanFeatureFlag` and `TenantFeatureFlag` have `created_at` but no `updated_at`. Can't track when overrides were last modified.

### N5. Docker Compose Hardcoded Credentials
**File:** `docker/docker-compose.yml`
PostgreSQL password is hardcoded in the compose file. Should reference `.env`.

### N6. No Request Correlation ID
No trace/request ID is generated or propagated. Makes debugging distributed issues across SCC + main app impossible.

### N7. Discount `max_uses` Not Checked on Apply
`getEffectivePrice` finds active discounts but never checks if `used_count >= max_uses`. Expired max-use discounts could still apply.

---

## ⚠️ HIDDEN RISKS (Long-Term)

### H1. Single Admin Role Model
All admins are equal. No distinction between SUPER_ADMIN, BILLING_ADMIN, SUPPORT_ADMIN. When the team grows, you'll need RBAC among admins themselves.

### H2. Audit Logs Grow Unbounded
No TTL, archival, or partitioning strategy. At 100 audit events/day, that's 36K/year. With JSON blobs in `old_value`/`new_value`, this becomes the largest table fast.

### H3. No Webhook/Event System
No way for the main MuscleX app to know when:
- A tenant is suspended → should lock out their users
- A plan changes → should update feature access
- A payment fails → should show warnings

Currently requires polling or manual sync. Need an event bus (Redis pub/sub, webhooks, or queue).

### H4. Cron Jobs Not Distributed
If SCC runs multiple replicas (for HA), both instances execute crons simultaneously → double-processing subscriptions. Need distributed locking (Redis-based `SETNX` lock before cron execution).

### H5. No Graceful Degradation on Redis Failure
If Redis goes down:
- Login lockout checks fail (throws unhandled error)
- Dashboard returns errors (no fallback)
- Feature flag resolution fails (no fallback)

### H6. Payment Model Has No Gateway Integration
`retryPayment` just sets status to PENDING. No actual Razorpay/Stripe SDK integration. In production, retries without gateway calls are meaningless.

### H7. Tenant Deletion Not Supported
No soft delete. `onDelete: Cascade` means deleting a tenant nukes all subscriptions, payments, and feature flags. No way to recover or comply with data retention requirements.

---

## ✅ WHAT IS WELL-DESIGNED

1. **Clean module structure** — NestJS modules are properly separated with clear boundaries. Each domain has its own module, service, controller, and DTOs.

2. **Prisma schema fundamentals** — Good use of UUIDs, proper indexing strategy, composite indexes on hot query patterns (tenant_id + status).

3. **Audit trail architecture** — Comprehensive audit logging with IP, user-agent, old/new values. Covers all critical actions. Global module export makes it injectable everywhere.

4. **Feature flag resolution with priority** — Tenant > Plan > Global priority chain is correct. Redis caching with invalidation on writes.

5. **Authentication lockout** — Redis-based login attempt tracking with TTL-based expiry. Prevents brute force.

6. **Pagination** — Consistent pagination DTO with cursor-based skip/take. Used across all list endpoints.

7. **Global middleware stack** — Helmet, compression, CORS, throttling, validation pipe, exception filter, response interceptor — all properly configured.

8. **Docker setup** — Multi-stage build, health checks on Postgres, persistent volumes, proper port mapping.

9. **Swagger integration** — All DTOs decorated with `@ApiProperty`. Bearer auth configured. Auto-generated docs.

10. **Transaction usage** — Plan changes use `$transaction` for atomicity. Good awareness of consistency needs.

---

## 🧠 SUGGESTED ARCHITECTURAL UPGRADES

### 1. Event-Driven Communication
Add Redis pub/sub or BullMQ event bus:
- `tenant.suspended` → main app locks tenant
- `plan.changed` → main app updates limits
- `payment.failed` → main app shows warning
- `feature.toggled` → main app refreshes flags

### 2. Read Replicas for Analytics
Analytics queries are expensive and read-only. Route them to a Postgres read replica to avoid impacting transactional workload.

### 3. Admin RBAC
Add `AdminRole` enum (SUPER_ADMIN, BILLING_ADMIN, SUPPORT_ADMIN) to `AdminUser`. Add a `RolesGuard` that checks role per endpoint.

### 4. Distributed Cron Locking
Use Redis `SET key NX EX 60` before each cron execution. Only the instance that acquires the lock runs the job.

### 5. Webhook Outbox Pattern
For reliable event delivery to the main app:
1. Write event to a `webhook_outbox` table in the same transaction as the business logic
2. Background worker reads outbox and delivers webhooks with retry

### 6. Audit Log Partitioning
Partition `audit_logs` table by `created_at` (monthly). Archive partitions older than 12 months to cold storage.

### 7. API Versioning Strategy
Currently hard-coded `api/v1` prefix. Plan for v2 migration path — separate controllers or version negotiation middleware.

---

**Verdict:** The codebase is a solid **MVP** with good structural foundations. However, it has **6 critical issues** that would cause data corruption, memory exhaustion, or security vulnerabilities in production. The major improvements are necessary for a reliable billing system. Fix C1-C7 and M1-M6 before any production deployment.
