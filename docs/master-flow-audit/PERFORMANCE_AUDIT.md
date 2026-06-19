# PERFORMANCE AUDIT — MuscleX (2026-06-18)

## DB (live advisors)
- **1182 unused indexes** — schema-clone amplified; prune from `studio_template`.
- **147 `auth_rls_initplan`** — per-row `auth.*` re-eval in RLS; low priority (RLS decorative).
- Facial 1:N match uses an IVFFlat pgvector index with a logged >200ms slow-scan warning — good.

## Hot paths (from module reads)
- Check-in orchestrator: single `$transaction`, indexed lookups, idempotent replay — efficient.
- POS sale, booking, renewal: bounded transactions; guarded atomic updates (no extra round-trips added by fixes).
- `SubscriptionPolicyService` caches per-tenant context (60s TTL) to avoid hammering `studios`.
- Member BFF caches gym→schema mapping (immutable) to avoid a registry hit per request.

## Concerns
- **Per-gym client fan-out:** `TenantClientFactory` caches one PrismaClient per
  schema (pool `connection_limit=3`). At high gym counts total connections grow —
  factory comment flags an LRU/eviction revisit. Watch as tenants scale.
- **O(N) waitlist renumber** (classes) and **listUsers({perPage:1000})** scan
  (auth, P1-1) won't scale — addressed in respective reports.
- Targets in CLAUDE.md (P95 dashboard <2s, check-in <1s, etc.) not load-tested here.

## Recommendation
Index pruning + the per-schema-client eviction policy are the two scale levers;
neither is urgent at current tenant volume. No P0/P1 performance defect found.
