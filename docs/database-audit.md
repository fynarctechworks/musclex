# FitSync Pro — Database Audit

## Schema Architecture

**Type**: Multi-tenant, schema-per-tenant isolation
**Engine**: PostgreSQL 15.x (Supabase)
**ORM**: Prisma 5.x

### Schema Layout
```
public              → studios (tenant registry)
studio_template     → template schema (cloned per tenant)
studio_{uuid}       → per-tenant isolated data
```

---

## Missing Indexes

### IDX-001: members.branch_id (HIGH)
- **Table**: `members`
- **Issue**: `branch_id` is a foreign key used in WHERE clauses for member listing and branch-scoped queries, but no explicit index defined in Prisma schema
- **Impact**: Full table scan on `GET /members?branch_id=...`
- **Fix**: `@@index([branch_id])` in Prisma schema

### IDX-002: members.status (HIGH)
- **Table**: `members`
- **Issue**: `status` field used in filter queries (`?status=active`) but no index
- **Impact**: Sequential scan on member list with status filter
- **Fix**: `@@index([status])` or composite `@@index([branch_id, status])`

### IDX-003: check_ins.checked_in_at (HIGH)
- **Table**: `check_ins`
- **Issue**: High-volume table filtered by date range (`date_from`, `date_to`) with no index on `checked_in_at`
- **Impact**: Slow heatmap and activity feed queries as check-ins grow
- **Fix**: `@@index([branch_id, checked_in_at])` composite index

### IDX-004: check_ins.member_id (MEDIUM)
- **Table**: `check_ins`
- **Issue**: Member profile loads check-in history by member_id, no explicit index
- **Impact**: Slow member detail page
- **Fix**: `@@index([member_id, checked_in_at])` for sorted lookups

### IDX-005: payments.branch_id + created_at (MEDIUM)
- **Table**: `payments`
- **Issue**: Payment list filtered by branch and date range
- **Fix**: `@@index([branch_id, created_at])`

### IDX-006: payments.member_id (MEDIUM)
- **Table**: `payments`
- **Issue**: Member profile loads payment history
- **Fix**: `@@index([member_id])`

### IDX-007: classes.starts_at (MEDIUM)
- **Table**: `classes`
- **Issue**: Schedule view filters by date range with no index
- **Fix**: `@@index([branch_id, starts_at])`

### IDX-008: members.full_name (search) (LOW)
- **Table**: `members`
- **Issue**: Search queries use `contains` on full_name — uses LIKE with wildcard
- **Impact**: Slower as member count grows (Prisma `contains` → `ILIKE '%term%'`)
- **Fix**: Consider PostgreSQL `pg_trgm` GIN index for trigram search, or full-text search

---

## Relational Issues

### REL-001: No Cascade Delete on Branch (HIGH)
- **Issue**: Deleting a branch doesn't cascade to members, classes, payments, etc.
- **Current**: No DELETE endpoint for branches (only PATCH to deactivate)
- **Risk**: If DELETE is added later, orphaned records would remain
- **Fix**: Add `onDelete: Cascade` or `onDelete: Restrict` to branch FK relations in Prisma schema

### REL-002: Self-Referencing Member (referred_by) (LOW)
- **Issue**: `referred_by_member_id` is `String? @db.Uuid` — not a proper Prisma relation
- **Current**: Works for tracking but no FK constraint enforcement
- **Fix**: Consider adding proper `@relation` for referential integrity

### REL-003: Staff branch_ids as Array (MEDIUM)
- **Issue**: `branch_ids: String[] @default([]) @db.Uuid` — denormalized
- **Impact**: Cannot do FK constraint enforcement on individual branch IDs, no join table
- **Trade-off**: Simpler queries vs. referential integrity
- **Fix**: Acceptable for now, but consider a `staff_branches` join table if branch assignment becomes complex

---

## Normalization Issues

### NORM-001: Status Fields as Strings (LOW)
- **Tables**: members, memberships, check_ins, payments, campaigns, classes, enrollments
- **Issue**: Status fields are free-form strings, not enforced enums at DB level
- **Risk**: Typo in status value ("actve" instead of "active") would silently succeed
- **Fix**: Add PostgreSQL CHECK constraints or use Prisma `enum` types

### NORM-002: Currency Duplication (LOW)
- **Tables**: payments, expenses both have `currency` field (default: INR)
- **Issue**: Studio has a `currency` setting — payment/expense currency should reference it
- **Risk**: Inconsistent currency across records
- **Fix**: Consider removing per-record currency and using studio-level setting

---

## Cascade & Deletion Issues

### CASC-001: Member Deletion (NOT IMPLEMENTED)
- **Issue**: No member deletion endpoint. Members are deactivated (status='inactive')
- **Consideration**: If hard delete is ever needed, must cascade to: memberships, check_ins, payments, class_enrollments, notifications
- **Fix**: Keep soft delete approach. Add `deleted_at` field if GDPR compliance needed.

### CASC-002: Plan Deletion is Soft Delete (GOOD)
- `DELETE /membership-plans/:id` sets `is_active=false` instead of removing
- Preserves referential integrity with existing memberships
- **Status**: Correctly implemented

---

## Migration Issues

### MIG-001: No Migration Files (HIGH)
- **Issue**: No `prisma/migrations/` directory present. Schema applied directly via `prisma db push`
- **Risk**: No version history, no rollback capability, destructive changes possible
- **Fix**: Run `npx prisma migrate dev` to create migration history. Use `prisma migrate deploy` in production.

### MIG-002: Schema Cloning Strategy (MEDIUM)
- **Issue**: Per-tenant schemas are created by cloning `studio_template`. The cloning mechanism (presumably `CREATE SCHEMA ... LIKE`) is in auth.service.ts onboarding but exact SQL not visible.
- **Risk**: Schema drift if template is updated but existing tenant schemas are not
- **Fix**: Need a migration strategy that applies changes to ALL existing tenant schemas

### MIG-003: No Database Seeding (LOW)
- **Issue**: No seed script for development/testing data
- **Fix**: Create `prisma/seed.ts` with sample studios, branches, members, plans

---

## Performance Concerns

### PERF-001: N+1 Query Risk in Dashboard (MEDIUM)
- **Issue**: Dashboard KPIs, revenue chart, alerts each execute separate queries
- **Impact**: 5+ queries per dashboard load
- **Fix**: Combine into a single stored procedure or use Prisma `$transaction` for batching

### PERF-002: No Connection Pooling Configuration (MEDIUM)
- **Issue**: PrismaService creates default connection pool. No explicit pool size configuration.
- **Impact**: Under load, connections may be exhausted
- **Fix**: Configure `connection_limit` in DATABASE_URL or Prisma config. Use Supabase connection pooler (port 6543).

### PERF-003: Unbounded Eager Loading (MEDIUM)
- **Issue**: Member detail includes `check_ins`, `payments`, `memberships` with no limit
- **Impact**: Members with 1000+ check-ins → large response payloads
- **Fix**: Add `take: 50` limit on included relations, or paginate separately

---

## Recommendations

| Priority | Issue | Type | Effort |
|----------|-------|------|--------|
| 1 | Add indexes: branch_id, status, checked_in_at, starts_at | Performance | 1 hour |
| 2 | Create migration history (`prisma migrate dev`) | Operations | 30 min |
| 3 | Add cascade rules to FK relations | Integrity | 1 hour |
| 4 | Limit eager-loaded relations (take: 50) | Performance | 1 hour |
| 5 | Add DB connection pool configuration | Performance | 30 min |
| 6 | Create seed script | Development | 2 hours |
| 7 | Add CHECK constraints for status enums | Integrity | 1 hour |
| 8 | Plan tenant schema migration strategy | Architecture | 4 hours |
