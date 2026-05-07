# Database Rules

## Schema Safety
- **Never delete tables directly** — use migrations to drop
- **Never modify columns in-place** — create forward migrations only
- Always check FK dependencies before removing/renaming anything
- Test migrations on a branch schema before applying to all tenants

## Multi-Tenancy
- Every table must enforce `studio_id` linkage (via schema isolation)
- TenantMiddleware sets `search_path = studio_{studio_id}` before every query
- Never query across tenant schemas without explicit admin authorization
- New tenant = new schema provisioned + seed data applied

## Data Integrity
- UUIDs for all primary keys
- All tables include `created_at` and `updated_at` (auto-managed)
- snake_case for all field names — match TRD exactly
- Avoid orphan records: cascade deletes or soft-delete with cleanup jobs
- Validate FK references exist before insert

## Migration Rules
- Forward-only migrations (no down migrations in production)
- Name migrations descriptively: `YYYYMMDD_HHMMSS_description`
- Review generated SQL before applying
- Never run `prisma db push` in production — use `prisma migrate deploy`

## Query Performance
- Index columns used in WHERE, JOIN, ORDER BY
- Avoid SELECT * — select only needed fields
- Use pagination for list endpoints (limit/offset or cursor)
- Target < 100ms P95 for all Supabase queries
