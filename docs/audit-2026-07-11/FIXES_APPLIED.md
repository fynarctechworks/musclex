# MuscleX — Fixes Applied (audit 2026-07-11)

Multi-agent audit found **29 issues, 26 confirmed** after adversarial verification.
This documents what was **fixed in code**, what was **prepared for review** (DB/hard-stop),
and what was **deliberately deferred** (would break prod if applied blind).

Verification: `tsc --noEmit` clean on backend, SCC, and frontend. Touched/added Jest
specs pass (access-scope resolver 21, payments webhook 7, prisma isolation 6).

## Fixed in code (applied)

| # | Sev | What | Files |
|---|-----|------|-------|
| 1 | CRITICAL | Referral wallet `manual-adjustment` restricted to platform super-admin; `amount` bounded (±1,000,000, 2dp) | `referrals-admin.controller.ts`, `dto/admin-actions.dto.ts` |
| 3 | HIGH | `getWallet`/`freeze`/`unfreeze` now assert caller owns the target studio (owner can't touch another gym's wallet) | `referrals-admin.controller.ts` |
| 5 | HIGH | Member dev-OTP bypass now requires a configured `MEMBER_DEV_OTP` and an exact match — the "any 4–8 digit code" path is removed; still off in prod | `member-auth.service.ts` |
| 6 | MED | Check-in access-scope resolver uses gym-scoped `findFirst` (was unscoped `findUnique` reachable with a client-supplied `branch_id`) | `access-scope.resolver.ts` (+ spec) |
| 7 | MED | `$use` **and** extension `findUnique`/`findUniqueOrThrow` now fail **closed**: force `gym_id` into a projecting `select`, verify, strip — a select that omits `gym_id` can no longer skip the cross-tenant guard | `prisma.service.ts`, `tenant-prisma.extension.ts` |
| 8 | MED | JWT guard no longer trusts client-supplied `metadata.permissions` for authorization (defense-in-depth; role defaults still apply) | `jwt-auth.guard.ts` |
| 10 | MED | Uploads validate real image bytes (magic-byte sniff) + extension, not the spoofable client MIME | `uploads.controller.ts` |
| 14 | LOW | Outbound webhook fetch guarded against SSRF: http(s)-only + reject hosts resolving to private/loopback/link-local/reserved IPs (blocks 127.0.0.1, 169.254.169.254, etc.) | `webhooks.service.ts` |
| 15 | LOW | Removed committed default super-admin password/email from tracked `.env.example` | `saas-control-center/.env.example` |
| 16 | LOW | `staff/:id/invite` now uses a validated `SendInviteDto` (was an inline object that bypassed `ValidationPipe`) | `send-invite.dto.ts` (new), `staff.controller.ts`, `dto/index.ts` |
| 20 | LOW | Added a baseline CSP (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`) — deliberately no `default-src`/`script-src` (would break Next) | `frontend/src/middleware.ts` |
| 22 | LOW | SCC member-app analytics/CRM/campaign controller gated `@Roles(SUPER)` (was reachable by any authenticated admin) | `member-app-analytics.controller.ts` |
| 12 | MED | Added Razorpay webhook security test (forged sig, tampered body, wrong secret, replay, missing secret, non-capture events) | `payments.controller.webhook.spec.ts` (new) |

## Prepared for review — NOT executed (DB / hard-stops)

See **`REMEDIATION_DB.sql`**. Every statement crosses a CLAUDE.md hard stop, so it is
staged, not run. Verified live facts baked into it:
- **#18 (highest-value):** `anon` **and** `authenticated` hold full write privileges (incl. TRUNCATE/DELETE) on 13 sensitive `public` tables (`invoices`, `user_identities`, `user_sessions`, `studios`, `staff_invitations`, `login_history`, …). Only RLS-without-policy blocks reads today — a landmine. SQL revokes them + locks default privileges. `authenticated` SELECT revoke is left commented pending confirmation the admin FE has no direct reads.
- **#17 (low):** `scc` schema is **NOT** PostgREST-exposed (verified `USAGE=false` for anon/authenticated), so the RLS-disabled `scc` tables are **not** anon-reachable. Enable-RLS SQL included as belt-and-suspenders only.
- **#19 (perf):** `CREATE INDEX CONCURRENTLY` for `login_history.user_id`, `user_sessions.user_id`.
- **#11 (PII):** two `zzz_backup_pre_truncate_*` schemas retain real PII — `DROP` statements included but commented (destructive/irreversible; export first).

## Deferred deliberately (would break prod / needs a coordinated slice)

- **#2/#8 keystone (HIGH, architectural):** `role`/`studio_id` come from Supabase **`user_metadata`**, which is **user-writable**, and `public.user_roles` is **empty** in prod — so the metadata/default fallback is the *live* auth mechanism. "Failing closed" as the auditor suggested would lock out the owner and all staff. The real fix = migrate `role`/`studio_id` to non-writable **`app_metadata`** + populate `user_roles` + then fail closed. Requires owner sign-off + a tested migration. **Not applied.**
- **#4 (HIGH):** staff access+refresh tokens in `localStorage`. Moving the session to httpOnly cookies is a coordinated auth-flow change (login callback, api-client, auth-store) with real regression risk. The new CSP (#20) reduces the XSS surface as an interim; the storage migration is staged, not blind-rewritten.
- **#9 (MED):** member photo signed URLs use a 1-year expiry, but the URL is stored directly in `members.profile_photo_url` and rendered across ~20 read paths with **no re-signing anywhere**. Shortening it naively breaks every photo. Correct fix = store path + re-sign on read (a read-path refactor). Deferred, not half-shortened.
- **#21 (LOW):** admin middleware checks cookie presence, not JWT validity — defense-in-depth only (backend enforces real auth on every call). Full edge JWT verification needs the secret at the edge; low value, deferred.
- **#23 (LOW):** jest thresholds are low, but raising them above the (unmeasured) current coverage would break CI. Measure-then-ratchet — left unchanged intentionally.
- **#13, #25, #26 (LOW/INFO):** refresh-token reuse-family revocation; unused-index cleanup; stale `@types/ioredis`. Noted, not urgent.
