# Module 10 — SaaS Control Center (SCC) · Audit Report

**Date:** 2026-06-18 · **App:** `saas-control-center/` (NestJS + Next.js)
**Status:** 🟢 AUDITED — auth/authz strong; no P0/P1. Minor fail-open note + un-audited sub-modules.

Scope (security-first, since SCC is the highest-privilege app): auth (login/MFA/
reset/refresh), authorization model, impersonation, tenant suspend. Skimmed:
analytics, billing, feature-flags, system-monitoring, audit-logs, email.

## 1. Auth / authz model
- **Fail-closed by default.** Global `APP_GUARD`: `JwtAuthGuard` + `RolesGuard` +
  `ThrottlerGuard`. Every route requires a valid admin JWT unless `@Public()`
  (only the 6 login/reset/refresh endpoints).
- **Login hardening.** bcrypt (12 rounds); 5-attempt → 15-min Redis lockout;
  invalid login is generic ("Invalid credentials"); audit-logged.
- **MFA.** TOTP with QR setup-confirm; 8 single-use **bcrypt-hashed** backup
  recovery codes; 5-min MFA session token; recovery-code use logged + consumed.
- **Password reset.** sha256-hashed token, 30-min TTL, single-use, prior tokens
  invalidated, refresh tokens revoked on reset/change; **email-enumeration-safe**
  (always returns success).
- **Refresh tokens** stored in Redis + revocable (rotation on change/reset).
- **Role separation (verified at controllers):** tenant `suspend` = `@Roles(SUPER)`;
  `impersonate` = `@Roles(SUPER, SUPPORT)` **and audited** (`AuditAction.IMPERSONATE`);
  reads = SUPER/BILLING/SUPPORT; destructive = SUPER only.

## 2. Positives
- This is a **well-secured** control plane: defense-in-depth auth, least-privilege
  role gating on the dangerous actions, and an audit trail on login + impersonation.
- Super-admin is seeded from env on boot (`ensureSuperAdmin`) — no hard-coded creds.

## 3. Findings

### 🟡 P2-M10-1 — Login lockout fails OPEN when Redis is unavailable.
`login()` wraps the attempt-count check in try/catch and, on Redis error, logs a
warning and **proceeds** to credential verification. bcrypt cost still throttles,
but the 5-attempt brute-force lockout is bypassed while Redis is down. Acceptable
availability trade-off; consider a low static fallback or alerting when the lockout
store is unreachable.

### 🟡 P2-M10-2 — Verify impersonation-token consumption.
`generateImpersonationToken` signs `{ sub, email: tenant.owner_email, tenant_id,
type: 'impersonation', exp 1h }`. The issuance is SUPER/SUPPORT-gated + audited
(good). Recommend a focused check of the **consuming** side (gym backend) to
confirm it validates `type === 'impersonation'`, scopes strictly to `tenant_id`,
and ideally surfaces an "impersonated session" banner — so the powerful capability
can't be widened by a token that's accepted too loosely. *Not traced this pass.*

## 4. Not-yet-covered (recommended follow-up passes)
- SCC `billing` (scc.payments reconciliation vs gym invoices — cross-checks
  Module 9), `feature-flags` (enforcement), `system-monitoring`/error-center,
  `analytics`, `audit-logs` retention. SCC migrations are hand-SQL (never
  `prisma migrate dev`) — confirm any new SCC table follows that convention.
- SCC **frontend** (responsive shell exists per project memory) not audited here.

## 5. Completion status
🟢 **AUDITED — security-critical surfaces strong.** No P0/P1. P2-M10-1 (Redis
fail-open) + P2-M10-2 (impersonation consumption) documented; several SCC
sub-modules flagged for a dedicated follow-up.
