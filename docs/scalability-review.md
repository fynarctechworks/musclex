# FitSync Pro — Scalability Review

## Scaling Scenario Analysis

### Scenario 1: Single Gym (1 Studio, 1-3 Branches)

| Metric | Estimate | Status |
|--------|----------|--------|
| Members | 50–500 | Handled ✅ |
| Daily check-ins | 20–200 | Handled ✅ |
| Monthly payments | 50–500 | Handled ✅ |
| Staff | 5–20 | Handled ✅ |
| Concurrent users | 3–10 | Handled ✅ |
| DB size | < 100 MB | No issues |

**Verdict**: Current architecture handles this well. No bottlenecks expected.

---

### Scenario 2: 100 Gyms (100 Studios, 300 Branches)

| Metric | Estimate | Concern |
|--------|----------|---------|
| Total members | 50,000 | Schema isolation handles ✅ |
| Daily check-ins | 20,000 | Need indexes on check_ins table ⚠️ |
| Monthly payments | 50,000 | Need indexes on payments table ⚠️ |
| Total staff | 2,000 | Handled ✅ |
| Concurrent users | 300 | Need connection pooling ⚠️ |
| DB size | ~10 GB | Supabase Pro handles ✅ |
| Schemas | 100 | PostgreSQL handles but migration complexity grows ⚠️ |

**Bottlenecks**:
1. **Database connections**: 100 tenants × 3 concurrent connections = 300 connections. Supabase free tier allows 60. Need Pro plan + connection pooler (PgBouncer on port 6543).
2. **Schema migrations**: Updating 100 schemas requires iteration script. No mechanism exists.
3. **Missing indexes**: check_ins, payments tables will degrade without composite indexes.

---

### Scenario 3: 1,000 Gyms (1,000 Studios, 3,000 Branches)

| Metric | Estimate | Concern |
|--------|----------|---------|
| Total members | 500,000 | Schema isolation scales ✅ |
| Daily check-ins | 200,000 | Need caching layer ❌ |
| Monthly payments | 500,000 | Need read replicas ❌ |
| Concurrent users | 3,000 | Need horizontal API scaling ❌ |
| DB size | ~100 GB | Need managed PostgreSQL ⚠️ |
| Schemas | 1,000 | PostgreSQL catalog pressure ❌ |

**Critical Bottlenecks**:
1. **1,000 PostgreSQL schemas**: Each schema adds metadata overhead. `pg_catalog` scans slow down. Consider switching to row-level multi-tenancy (tenant_id column) or schema sharding.
2. **Single API instance**: NestJS on Railway runs as single process. Need auto-scaling (Railway supports this) or Kubernetes.
3. **No caching**: Dashboard KPIs computed on every request. With 3,000 concurrent users hitting /dashboard/kpis, this becomes a DB bottleneck.
4. **No CDN**: Static assets (Next.js) served from Vercel (CDN included ✅), but API responses not cached.

---

## Database Bottleneck Analysis

### Current: Schema-per-Tenant (Good for 1-200 tenants)

**Pros**:
- Complete data isolation
- Simple queries (no WHERE tenant_id = ?)
- Can drop schema to delete all tenant data
- Per-tenant backup/restore possible

**Cons**:
- 1000+ schemas = PostgreSQL catalog bloat
- Schema migrations must iterate all tenants
- Connection pool shared across all schemas
- Cannot do cross-tenant analytics easily

### Alternative: Row-Level Tenancy (Better for 200+ tenants)

**Pros**:
- Single schema, single migration
- Cross-tenant analytics possible
- Better connection pool utilization
- PostgreSQL Row-Level Security (RLS) for isolation

**Cons**:
- Every query needs `WHERE tenant_id = ?`
- Risk of data leak if RLS misconfigured
- Cannot easily drop tenant data
- Index overhead on tenant_id columns

### Recommendation
- **Stay with schema-per-tenant** until 200 studios
- **Plan migration to row-level tenancy** if targeting 500+ studios
- **Hybrid approach**: Keep schema isolation but add `tenant_id` for analytics queries

---

## API Scaling

### Current Architecture: Single NestJS Process

**Scaling Strategy**:
1. **Vertical scaling** (Railway): Increase CPU/RAM allocation. Handles up to ~500 concurrent connections.
2. **Horizontal scaling**: Deploy multiple Railway instances behind load balancer. Requires:
   - Stateless API design ✅ (no in-memory sessions... except login throttle Map ⚠️)
   - Shared Redis for rate limiting, login throttling
   - Shared database (already via Supabase)
3. **Auto-scaling**: Railway supports replicas. Configure scale-to-zero for cost efficiency.

### Statelessness Audit
| Component | Stateless? | Fix Needed |
|-----------|-----------|------------|
| JWT Auth (Supabase) | ✅ Yes | — |
| Login Throttle Map | ❌ No | Move to Redis |
| Prisma Connection | ✅ Yes (pooled) | — |
| Config | ✅ Yes (env vars) | — |
| File Uploads | ✅ Yes (Supabase Storage) | — |

---

## Caching Strategy (Not Implemented)

### Recommended Cache Layers

| Data | Cache TTL | Strategy | Tool |
|------|-----------|----------|------|
| Dashboard KPIs | 60 seconds | Cache-aside | Upstash Redis |
| Revenue chart | 5 minutes | Cache-aside | Upstash Redis |
| Member list (paginated) | 30 seconds | Cache-aside | Upstash Redis |
| Membership plans | 5 minutes | Cache-aside | Upstash Redis |
| Branch list | 10 minutes | Cache-aside | Upstash Redis |
| Staff list | 5 minutes | Cache-aside | Upstash Redis |
| Check-in heatmap | 5 minutes | Cache-aside | Upstash Redis |

### Cache Invalidation
- Invalidate on write (create/update/delete mutations)
- Use cache keys with tenant prefix: `studio:{id}:dashboard:kpis`
- Set reasonable TTLs (no cache for real-time check-in feed)

---

## Background Jobs (Planned, Not Implemented)

### BullMQ Queue Architecture
```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ notification-q   │     │ analytics-q      │     │ maintenance-q    │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ Welcome SMS      │     │ Daily KPI calc   │     │ Expired member   │
│ Expiry reminder  │     │ Churn risk score │     │   status update  │
│ Payment receipt  │     │ Engagement score │     │ Schema cleanup   │
│ Campaign send    │     │ Trainer metrics  │     │ Backup verify    │
│ Birthday message │     │ Revenue reports  │     │ Token cleanup    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                        ┌─────────▼──────────┐
                        │   Upstash Redis    │
                        │   (Queue Backend)  │
                        └────────────────────┘
```

### Cron Jobs Needed
| Job | Schedule | Purpose |
|-----|----------|---------|
| AI Daily Briefing | 07:45 AM (studio TZ) | Generate morning summary |
| Membership Expiry Check | Daily 00:00 | Update expired memberships to 'expired' |
| Churn Risk Scoring | Daily 02:00 | Recalculate engagement/churn scores |
| Auto-Renewal | Daily 06:00 | Process auto-renew memberships |
| Campaign Scheduler | Every 5 min | Send scheduled campaigns |

---

## Scalability Scorecard

| Dimension | 1 Gym | 100 Gyms | 1000 Gyms |
|-----------|-------|----------|-----------|
| Database | ✅ 10/10 | ⚠️ 7/10 | ❌ 4/10 |
| API | ✅ 10/10 | ⚠️ 7/10 | ❌ 5/10 |
| Caching | ❌ 0/10 | ❌ 0/10 | ❌ 0/10 |
| Background Jobs | ❌ 0/10 | ❌ 0/10 | ❌ 0/10 |
| Auth | ✅ 10/10 | ✅ 9/10 | ⚠️ 7/10 |
| Storage | ✅ 10/10 | ✅ 9/10 | ✅ 8/10 |
| **Overall** | **8/10** | **5/10** | **3/10** |

### Path to 1000-Gym Scale
1. Add Redis caching layer (Upstash)
2. Implement BullMQ background jobs
3. Add database indexes
4. Configure connection pooling (PgBouncer)
5. Move login throttling to Redis
6. Plan schema-to-RLS migration strategy
7. Add auto-scaling on Railway
8. Consider read replicas for analytics queries
