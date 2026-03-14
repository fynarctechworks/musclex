# FitSync Pro — Security Audit

## Executive Summary

**Overall Security Rating: 6/10** — Solid authentication foundation via Supabase, good tenant isolation, but missing several production hardening measures.

---

## Authentication

### AUTH-01: Supabase-Based JWT (PASS)
- Token verification via `supabase.auth.getUser(token)` — server-side validation
- JWT contains: user_id, studio_id, role, branch_ids
- Tokens issued by Supabase (ES256 signed, non-forgeable)

### AUTH-02: Login Throttling (PARTIAL FAIL)
- **Implemented**: 5 failed attempts → 15-minute lockout
- **Issue**: Uses in-memory `Map` — resets on server restart/deployment
- **Risk**: Medium — attacker can time brute-force around deployments
- **Fix**: Migrate to Upstash Redis with TTL keys

### AUTH-03: No Auto Token Refresh (FAIL)
- Frontend API client does not handle 401 responses with refresh
- User must manually re-login when JWT expires (~1 hour)
- **Risk**: Poor UX, users may work with stale auth state

### AUTH-04: Password Requirements (PASS)
- Minimum 8 characters enforced in OnboardingDto
- Minimum 6 characters in LoginDto (inconsistency — should be 8)
- Supabase handles password hashing (bcrypt)

---

## Authorization

### AUTHZ-01: RBAC Guards (PARTIAL)
- `@Roles()` decorator and `RolesGuard` exist
- **Issue**: Not consistently applied to all endpoints. Many controllers only use `JwtAuthGuard` without `RolesGuard`
- **Risk**: Any authenticated user can access any endpoint regardless of role
- **Affected endpoints**: Most CRUD operations are unprotected by role

### AUTHZ-02: Tenant Isolation (PASS with caveats)
- Schema-per-tenant via `TenantMiddleware`
- `SET search_path` executed before every query
- **Caveat**: Uses `$executeRawUnsafe()` — schema name derived from JWT studio_id

### AUTHZ-03: Branch-Level Access Control (FAIL)
- JWT contains `branch_ids[]` but no endpoint validates that the user has access to the requested branch
- Any user in a studio can access all branches' data
- **Risk**: Low (same studio), but violates principle of least privilege

---

## Data Security

### DATA-01: Sensitive Field Protection (PASS)
- `face_descriptor`: Write-only, never returned in GET responses
- `payment_method_token`: Never returned in API responses
- `salary`: Stripped unless `role === 'owner'`

### DATA-02: Secrets in Environment (PASS)
- Database URL, Supabase keys stored in .env (not committed)
- .env.example documents required variables without values
- **Issue**: No runtime validation that required env vars are present

### DATA-03: CORS Configuration (PASS)
- Configured via `CORS_ORIGINS` env variable
- Supports comma-separated origins
- Credentials enabled

### DATA-04: No Encryption at Rest for Sensitive Data (FAIL)
- `payment_method_token` stored as plain text (field exists in schema)
- `face_descriptor` stored as plain float array
- **Fix**: Encrypt at application level before Prisma write

---

## Injection Vulnerabilities

### INJ-01: SQL Injection via Tenant Middleware (HIGH RISK)
- `$executeRawUnsafe()` with string interpolation
- **Mitigated by**: studio_id comes from Supabase-verified JWT (attacker cannot control)
- **Residual risk**: If Supabase ever allows studio_id manipulation
- **Fix**: Validate schema name format before executing

### INJ-02: SQL Injection via Prisma ORM (LOW RISK)
- All queries use Prisma client (parameterized by default)
- No raw SQL queries in service files (except tenant middleware)
- **Status**: Safe

### INJ-03: XSS via User Input (LOW RISK)
- React auto-escapes JSX output
- No `dangerouslySetInnerHTML` usage found
- **Residual risk**: Campaign message templates with placeholders if rendered as HTML in emails
- **Fix**: Sanitize on write for fields that may be rendered in emails

---

## API Security

### API-01: No Rate Limiting (FAIL)
- ThrottlerModule not configured despite being in dependencies
- All endpoints vulnerable to:
  - Brute-force attacks on /auth/login (beyond in-memory throttle)
  - DDoS on expensive endpoints (/dashboard/kpis, /ai/chat)
  - Enumeration attacks on /members search
- **Fix**: Configure ThrottlerModule per TRD Section 6 rate limits

### API-02: No Request Size Limits (FAIL)
- No `body-parser` limit configured
- Large payloads (e.g., massive face_descriptor array) could cause OOM
- **Fix**: Add `app.use(json({ limit: '1mb' }))`

### API-03: No Security Headers (FAIL)
- Missing: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, CSP
- **Fix**: Install and configure `helmet` middleware

### API-04: Webhook Signature Verification (NOT IMPLEMENTED)
- Razorpay/Stripe webhook endpoints exist in TRD but not implemented
- **Risk**: When implemented, HMAC verification is mandatory
- **Fix**: Verify `x-razorpay-signature` and Stripe webhook signatures

---

## Storage & Uploads

### STORE-01: File Upload Validation (NOT IMPLEMENTED)
- Profile photos and receipt uploads reference Supabase Storage URLs
- No file type validation, size limits, or virus scanning
- **Risk**: Malicious file upload when Supabase Storage is wired
- **Fix**: Validate MIME types, enforce size limits, use signed upload URLs

### STORE-02: Signed URLs (NOT IMPLEMENTED)
- TRD specifies 1-hour expiry signed URLs for all private Storage files
- Currently using placeholder URLs
- **Fix**: Implement signed URL generation when Storage is wired

---

## Session Security

### SESS-01: Token Storage (ACCEPTABLE)
- JWT stored in localStorage via Zustand persist
- **Risk**: Vulnerable to XSS (localStorage accessible to all scripts)
- **Mitigation**: React auto-escaping prevents most XSS vectors
- **Alternative**: httpOnly cookies (requires backend changes)

### SESS-02: No Session Invalidation on Logout (PARTIAL)
- Frontend clears localStorage on logout
- Backend calls `supabase.auth.admin.signOut()` to invalidate server-side
- **Issue**: JWT remains valid until expiry even after logout if cached
- **Fix**: Short JWT expiry (already ~1 hour from Supabase) is acceptable

---

## Recommendations Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| 1 | Add rate limiting (ThrottlerModule) | 2 hours |
| 2 | Add helmet security headers | 30 minutes |
| 3 | Migrate login throttling to Redis | 2 hours |
| 4 | Add request body size limits | 15 minutes |
| 5 | Validate tenant schema name format | 30 minutes |
| 6 | Add 401 interceptor + auto-refresh | 2 hours |
| 7 | Apply RolesGuard to all sensitive endpoints | 3 hours |
| 8 | Add env variable validation on startup | 1 hour |
| 9 | Add Next.js middleware for auth routing | 1 hour |
| 10 | Add error boundaries | 1 hour |
