# FitSync Pro — Production Readiness Report

## Environment Variable Validation

### Current State: NOT IMPLEMENTED
- Backend reads env vars via `ConfigService.get()` with defaults
- No startup validation that critical vars (DATABASE_URL, SUPABASE_URL, etc.) are present
- Missing vars cause cryptic runtime errors

### Required Fix
```typescript
// Add to main.ts bootstrap
const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}
```

---

## Logging System

### Current State: MINIMAL
- Only `PrismaService` has a NestJS Logger instance
- `main.ts` uses `console.log` instead of Logger
- No request/response logging
- No structured logging format (JSON)
- No log levels (debug/info/warn/error)

### Required Setup
1. Add global NestJS LoggerModule
2. Configure request logging middleware (method, path, status, duration)
3. Structured JSON logs for production (compatible with cloud log aggregators)
4. Log levels: `debug` for dev, `info` for production

---

## Error Monitoring

### Current State: NOT IMPLEMENTED
- Errors caught by NestJS exception filters (default)
- No external monitoring (Sentry, Datadog)
- No error alerting

### Required Setup
1. Integrate Sentry SDK for both frontend and backend
2. Configure source maps upload for readable stack traces
3. Set up error alerting (Slack/email) for Critical/High severity
4. Add PostHog for product analytics and user session replay

---

## Rate Limiting

### Current State: NOT IMPLEMENTED
- `@nestjs/throttler` in package.json but not configured
- In-memory login throttling only

### Required Configuration (per TRD Section 6)
| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /auth/login | 10 req | 15 min per IP |
| POST /ai/chat | 30 req | 1 hour per studio |
| POST /check-ins | 120 req | 1 min per branch |
| POST /payments/* | 20 req | 1 min per studio |
| GET /dashboard/* | 60 req | 1 min per user |
| All other | 100 req | 1 min per user |

### Implementation
- Use `@nestjs/throttler` with Upstash Redis storage adapter
- Apply `@Throttle()` decorator per controller/endpoint

---

## Input Sanitization

### Current State: PARTIAL
- ValidationPipe with `whitelist: true, forbidNonWhitelisted: true` — strips unknown fields
- class-validator decorators on DTOs (IsString, IsEmail, IsUUID, etc.)
- No HTML sanitization for text fields (notes, descriptions, messages)

### Required Fixes
1. Add `sanitize-html` for fields that could be rendered in emails/notifications
2. Validate file uploads (MIME type, size) when Supabase Storage is wired
3. Add request body size limit: `app.use(json({ limit: '1mb' }))`

---

## Secure Headers

### Current State: NOT IMPLEMENTED

### Required Setup
```typescript
import helmet from 'helmet';
app.use(helmet());
```

This adds: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Strict-Transport-Security, Content-Security-Policy

---

## API Protection

### Current State: PARTIAL
- JwtAuthGuard on protected endpoints ✅
- RolesGuard exists but inconsistently applied ⚠️
- No API key support for webhook endpoints ❌
- No request signing ❌

### Required Fixes
1. Apply RolesGuard consistently across all endpoints
2. Add HMAC signature verification for payment gateway webhooks
3. Consider API versioning headers for future compatibility

---

## Database Indexing

### Current State: MINIMAL
- Prisma auto-creates indexes on @id and @unique fields only
- No composite indexes for common query patterns

### Required Indexes (see database-audit.md for details)
- `members(branch_id, status)`
- `check_ins(branch_id, checked_in_at)`
- `check_ins(member_id, checked_in_at)`
- `payments(branch_id, created_at)`
- `payments(member_id)`
- `classes(branch_id, starts_at)`

---

## Backup Strategy

### Current State: SUPABASE DEFAULT
- Supabase provides daily backups on Pro plan
- No custom backup schedule
- No point-in-time recovery testing

### Required Setup
1. Enable Supabase Pro plan for daily backups + PITR
2. Set up weekly backup verification (restore to staging)
3. Document recovery procedure
4. Set RTO: 1 hour, RPO: 24 hours (daily backup)

---

## Monitoring Setup

### Current State: NOT IMPLEMENTED

### Required Stack
| Tool | Purpose | Priority |
|------|---------|----------|
| Sentry | Error tracking (frontend + backend) | P0 |
| PostHog | Product analytics, session replay | P1 |
| Uptime Robot | Endpoint health monitoring | P0 |
| Railway Metrics | CPU, memory, response time | P0 (auto) |
| Vercel Analytics | Frontend performance | P0 (auto) |
| Supabase Dashboard | DB connections, query perf | P0 (built-in) |

### Health Check Endpoint
- `GET /health` exists — returns `{status, timestamp}`
- **Fix**: Add database connectivity check, Redis check, Supabase auth check

---

## Production Checklist

| Item | Status | Priority |
|------|--------|----------|
| Environment variable validation | ❌ Not done | P0 |
| Helmet security headers | ❌ Not done | P0 |
| Rate limiting (ThrottlerModule) | ❌ Not done | P0 |
| Request body size limits | ❌ Not done | P0 |
| Structured logging | ❌ Not done | P0 |
| Error monitoring (Sentry) | ❌ Not done | P0 |
| Database indexes | ❌ Not done | P0 |
| Migration history | ❌ Not done | P0 |
| Health check enhancements | ❌ Not done | P1 |
| Input sanitization | ⚠️ Partial | P1 |
| RBAC enforcement | ⚠️ Partial | P1 |
| Auto token refresh | ❌ Not done | P1 |
| Next.js middleware auth | ❌ Not done | P1 |
| Error boundaries | ❌ Not done | P1 |
| Backup verification | ❌ Not done | P2 |
| Product analytics | ❌ Not done | P2 |
| Session replay | ❌ Not done | P2 |

**Verdict: NOT production-ready. Requires P0 items completion (~2-3 days of work).**
