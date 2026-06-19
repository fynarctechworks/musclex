# SECURITY AUDIT — MuscleX (2026-06-18)

Scope: real code + live Supabase advisors. Multi-tenant gym SaaS; isolation is
app-enforced (DB role has `rolbypassrls`, so RLS is **decorative by design**).

## Fixed this audit
- **P0-2 (Critical) Account takeover** — `POST /auth/reset-password` set any
  account's password by a client-supplied user-id with no recovery-token check.
  Fixed: server-side Supabase recovery-session verification.
- **P1-M3-1 Cross-tenant exposure** — check-in orchestrator + QR endpoints read
  any member by id and could bump another gym's `qr_version` (DoS) on the legacy
  prisma path. Fixed: gym-scoped every by-id access.

## Strong (verified)
- Razorpay: timing-safe HMAC on Checkout signature + **raw-body** webhook,
  300s replay window, authoritative `getOrder` notes (no cheap-order/expensive-plan).
- Member BFF: separate member-audience JWT, identity only from verified token,
  physical-schema routing, gym-gating + operator-suspension enforcement.
- SCC: fail-closed global guards, bcrypt(12) + Redis lockout + TOTP MFA + single-use
  hashed recovery codes, hashed/expiring/single-use reset tokens, refresh revocation,
  SUPER-gated suspend, SUPER/SUPPORT-gated **audited** impersonation.
- RBAC: no privilege escalation — all role/permission mutations owner/SUPER-gated;
  invite acceptance can't self-assign role.
- `StripSecretsInterceptor` + DTO whitelist + per-route throttle in place.

## Live advisor results
- Security: **39× `rls_enabled_no_policy` (INFO)** — expected (bypass-role design),
  **no anon-exposure** (Phase 8.1 fix holds). **1× `extension_in_public` (WARN)** —
  move `vector` out of `public`.

## Residual risk (open)
- **R3 by-id leak class (X-2)** on the legacy prisma path — sweep remaining
  `findUnique({where:{id}})` tenant reads as services migrate to `TenantPrisma`.
- **P1-M9-1** robust dedup needs a DB unique constraint (migration-gated).
- **SCC** Redis-down login fail-open (P2-M10-1); impersonation-token consumption
  validation unverified (P2-M10-2).
- Webhooks beyond Razorpay (`platform/webhooks`, integrations) not yet HMAC-audited.

**Posture:** strong for a product at this stage; the one Critical (P0-2) is fixed.
Biggest structural risk is the half-migrated isolation regime, not a specific hole.
