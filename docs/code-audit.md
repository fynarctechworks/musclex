# FitSync Pro — Code Quality Audit

## Critical Issues

### CRIT-001: SQL Injection in Tenant Middleware
- **Severity**: CRITICAL
- **File**: `backend/src/common/middleware/tenant.middleware.ts:15`
- **Explanation**: `$executeRawUnsafe()` with string interpolation for schema name. Although studio_id comes from a verified JWT, the UUID-to-underscore replacement creates an unvalidated schema name.
- **Code**: `await this.prisma.$executeRawUnsafe(\`SET search_path TO "${schemaName}", public\`)`
- **Fix**: Validate schema name against whitelist pattern (`/^studio_[a-f0-9_]+$/`) before executing, or use parameterized approach.

### CRIT-002: No Token Refresh in Frontend API Client
- **Severity**: CRITICAL
- **File**: `frontend/src/lib/api.ts`
- **Explanation**: When JWT expires, all API calls silently fail with 401. No automatic refresh token mechanism. User must manually re-login.
- **Fix**: Add 401 interceptor that attempts token refresh via `/auth/refresh` before failing. If refresh fails, redirect to login.

### CRIT-003: In-Memory Login Throttling Lost on Restart
- **Severity**: CRITICAL
- **File**: `backend/src/auth/auth.service.ts`
- **Explanation**: Login attempt tracking uses a JavaScript `Map` in memory. Server restart or deployment resets all lockouts, allowing brute-force resume.
- **Fix**: Move to Upstash Redis with TTL-based counters as specified in TRD Section 6.

---

## High Issues

### HIGH-001: No Rate Limiting on Any Endpoint
- **Severity**: HIGH
- **File**: `backend/src/main.ts`
- **Explanation**: Despite `@nestjs/throttler` being in package.json, no ThrottlerModule or ThrottlerGuard is configured. All endpoints are unprotected against flooding.
- **Fix**: Add ThrottlerModule to AppModule with endpoint-specific limits per TRD Section 6.

### HIGH-002: Hardcoded Dark Theme Toast Colors
- **Severity**: HIGH
- **File**: `frontend/src/components/providers.tsx:25-28`
- **Explanation**: Sonner Toaster has hardcoded dark theme colors (`#1E3450`, `#2A4A6A`, `#FFFFFF`) that don't match the new light theme.
- **Fix**: Use CSS variables or `fs-*` tokens: `bg: 'var(--card)'`, `border: '1px solid var(--border)'`, `color: 'var(--card-foreground)'`.

### HIGH-003: No Middleware.ts for Auth Route Protection
- **Severity**: HIGH
- **File**: `frontend/src/` (missing file)
- **Explanation**: No Next.js middleware for server-side auth route protection. Any unauthenticated user can access /dashboard, /members, etc. by typing the URL. The ProtectedRoute component only guards client-side after full page load.
- **Fix**: Add `middleware.ts` that checks auth state and redirects unauthenticated users to /login before page renders.

### HIGH-004: PrismaService Silently Swallows Connection Failures
- **Severity**: HIGH
- **File**: `backend/src/prisma/prisma.service.ts:27-30`
- **Explanation**: If database connection fails, API starts anyway and every query will fail with unhelpful errors. Only a `logger.warn()` is emitted.
- **Fix**: Either fail fast (throw and prevent startup) or implement a health check that returns 503 when DB is disconnected.

### HIGH-005: No Request Logging or Audit Trail
- **Severity**: HIGH
- **File**: `backend/src/main.ts`
- **Explanation**: No request logging middleware. No audit trail for sensitive operations (member deletion, payment recording, settings changes). Makes debugging and compliance impossible.
- **Fix**: Add NestJS Logger middleware for all requests. Add audit log table for sensitive operations.

### HIGH-006: No CSRF Protection
- **Severity**: HIGH
- **File**: `backend/src/main.ts`
- **Explanation**: CORS is configured but no CSRF token validation. Bearer tokens in localStorage are immune to CSRF by default, but any future cookie-based auth would be vulnerable.
- **Fix**: Acceptable for current Bearer token auth, but document this architectural decision.

### HIGH-007: No Helmet Security Headers
- **Severity**: HIGH
- **File**: `backend/src/main.ts`
- **Explanation**: No security headers (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.). Leaves API vulnerable to clickjacking, MIME sniffing.
- **Fix**: Add `helmet` middleware: `app.use(helmet())`.

---

## Medium Issues

### MED-001: Member Code Collision Risk
- **Severity**: MEDIUM
- **File**: `backend/src/members/members.service.ts`
- **Explanation**: `FS-YYYYMMDD-XXXX` uses 4-digit random (10,000 combinations). On a busy day with 100+ registrations, collision probability is non-trivial (birthday paradox). DB unique constraint catches it but returns 500 error, not graceful retry.
- **Fix**: Add retry loop (3 attempts) on unique constraint violation, or increase to 6 digits.

### MED-002: Receipt Number Collision Risk
- **Severity**: MEDIUM
- **File**: `backend/src/payments/payments.service.ts`
- **Explanation**: Same pattern as member codes — `RCP-YYYYMMDD-XXXX` with 4-digit random.
- **Fix**: Same as MED-001.

### MED-003: No Input Sanitization for XSS
- **Severity**: MEDIUM
- **File**: Various service files
- **Explanation**: Member notes, campaign messages, class descriptions stored as-is. Frontend renders with React (auto-escapes JSX), but any `dangerouslySetInnerHTML` usage or email templates could execute scripts.
- **Fix**: Sanitize HTML-sensitive fields on write (strip tags) or use a library like `sanitize-html`.

### MED-004: Missing Error Boundaries
- **Severity**: MEDIUM
- **File**: `frontend/src/app/layout.tsx`
- **Explanation**: No React Error Boundary wrapping the app. Any unhandled JS error crashes the entire page with a white screen.
- **Fix**: Add `error.tsx` files in app directories for Next.js error boundaries.

### MED-005: No Loading/Error States for Branch Selector
- **Severity**: MEDIUM
- **File**: `frontend/src/components/layout/app-layout.tsx`
- **Explanation**: Branch dropdown fetches from API but has no loading state or error handling. If API is down, dropdown is empty with no feedback.
- **Fix**: Add loading skeleton and fallback text.

### MED-006: Inconsistent Date Handling
- **Severity**: MEDIUM
- **File**: Multiple frontend pages
- **Explanation**: Some pages format dates with `date-fns`, others use raw ISO strings or `toLocaleDateString()`. No consistent date formatting utility.
- **Fix**: Create `formatDate()` utility using date-fns with studio timezone.

### MED-007: No Pagination on Dashboard Activity Feed
- **Severity**: MEDIUM
- **File**: `backend/src/dashboard/dashboard.service.ts`
- **Explanation**: Activity feed hardcoded to last 10 items. No "load more" or pagination.
- **Fix**: Add `?limit=10&offset=0` support.

### MED-008: React Query Keys Not Centralized
- **Severity**: MEDIUM
- **File**: Multiple frontend pages
- **Explanation**: Query keys are string literals scattered across pages (`"members"`, `"dashboard-kpis"`, etc.). Easy to typo and cause cache misses.
- **Fix**: Create a `queryKeys.ts` constants file.

---

## Low Issues

### LOW-001: Console.log in Production
- **Severity**: LOW
- **File**: `backend/src/main.ts:27`
- **Explanation**: `console.log(\`FitSync Pro API running on port ${port}\`)` — should use NestJS Logger.
- **Fix**: Replace with `Logger.log()`.

### LOW-002: Unused WebSocket/BullMQ Imports
- **Severity**: LOW
- **File**: `backend/package.json`
- **Explanation**: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/bullmq`, `bullmq`, `@nestjs/schedule` are imported but not wired into any module.
- **Fix**: Accept as planned dependencies or remove until needed to reduce bundle size.

### LOW-003: No TypeScript Strict Null Checks in Backend
- **Severity**: LOW
- **File**: `backend/tsconfig.json`
- **Explanation**: Backend TypeScript config may not enforce `strictNullChecks`, allowing potential null reference errors at runtime.
- **Fix**: Enable `strict: true` in tsconfig.json.

### LOW-004: form-fields.tsx FormDatePicker Has Dark Color Scheme
- **Severity**: LOW
- **File**: `frontend/src/components/shared/form-fields.tsx`
- **Explanation**: `[color-scheme:dark]` class hardcoded on date picker inputs — wrong for light theme.
- **Fix**: Remove `[color-scheme:dark]` class.

### LOW-005: Hardcoded "default" Branch ID in Check-In
- **Severity**: LOW
- **File**: `frontend/src/app/check-in/qr/page.tsx`
- **Explanation**: QR check-in sends `branch_id: "default"` instead of the actual selected branch from the layout.
- **Fix**: Pass actual branch_id from branch selector context.

### LOW-006: No Favicon
- **Severity**: LOW
- **File**: `frontend/public/`
- **Explanation**: Default Next.js favicon. No branded FitSync Pro icon.
- **Fix**: Add branded favicon.ico and apple-touch-icon.
