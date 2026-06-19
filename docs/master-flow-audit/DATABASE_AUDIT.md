# DATABASE AUDIT — MuscleX (2026-06-18)

Source: live Supabase advisors + schema reads. Postgres (Supabase), Prisma
multiSchema; per-gym physical schemas (`studio_<uuid>`) cloned from `studio_template`.

## Live performance advisors — 1553 total (1386 INFO / 167 WARN)
| Lint | Count | Read |
|---|---|---|
| `unused_index` | 1182 (INFO) | Amplified by per-gym schema cloning (`CREATE TABLE … LIKE … INCLUDING ALL` copies every index into each `studio_*`). Low urgency; prune the template's truly-unused indexes so clones don't inherit them. |
| `no_primary_key` | 200 (WARN) | **Investigate.** Likely cloned `studio_*` tables where PKs weren't carried, or genuinely PK-less tables. No-PK harms replication, dedup, and `findUnique`. Confirm the clone copies PRIMARY KEY constraints (LIKE … INCLUDING ALL should, but FKs are added separately in `cloneTenantSchema` — verify PKs too). |
| `auth_rls_initplan` | 147 (WARN) | RLS policies re-evaluate `auth.*` per row; wrap in `(select …)`. Low priority — RLS is decorative here. |

## Schema design (observed)
- UUID PKs, snake_case, `created_at/updated_at`, per-tenant `gym_id` columns retained.
- `cloneTenantSchema` (auth.service) copies tables (LIKE INCLUDING ALL) + re-adds
  FKs from `information_schema` with identifier allow-listing + FK-rule allow-list.
  **Risk:** correctness of this clone is load-bearing for every new gym — the
  `no_primary_key` advisor count suggests verifying PK/constraint fidelity.

## Integrity / concurrency (from module audits)
- Money/stock/booking write paths now use guarded atomic claims or `$transaction`
  (Modules 2/4/5/9 fixes). POS return eligibility check is still pre-transaction
  (P2-M6-1).
- `Json` null handling: project convention is `Prisma.JsonNull` / `{}` (never raw
  null) — adhered to in audited code.

## Tenant data location (current, mid-migration)
Live tenant data is in shared `studio_template` keyed by `gym_id`; per-gym
`studio_<uuid>` schemas are the migration target. The TenantPrisma runtime expects
per-gym schemas — onboarding still writes some tables to `studio_template`
(**P0-1**). Resolve within the migration before onboarding new gyms at scale.

## Recommendations (priority order)
1. Verify `cloneTenantSchema` carries **PRIMARY KEYs** (chase the 200 `no_primary_key`).
2. Resolve onboarding↔runtime schema split (P0-1) inside the migration.
3. Prune unused indexes from `studio_template` so clones don't inherit 1182×N bloat.
4. Move `vector` extension out of `public`.
5. Add the `payment_reference` unique constraint (P1-M9-1 robust fix) when migrating.
