# MuscleX — E2E / Automated Test Plan (2026-07-11)

Goal: a runnable, browser-driven + API regression suite that (a) proves core admin
flows work and (b) permanently locks the security fixes from this audit so they
can't regress.

## Reality constraints (honest)
- Local run needs **both** servers: backend on `:4000` (`nest start`), admin frontend
  on `:3000` (`next dev`). Backend also expects Redis (login lockout) + the Supabase
  test DB (already reachable).
- Current test DB has **one** studio (`Mama`, slug `mama`) and `user_roles` is empty,
  so there's no ready admin password. E2E auth uses a **dedicated seeded test owner**
  created via the Supabase admin API (known password, `user_metadata.role=owner`,
  `studio_id=<Mama>`), namespaced so it never collides with real data.
- Next.js dev compiles pages on first hit (cold 3–30 s) — Playwright timeouts are set
  generously and the first navigation is warmed in global setup.

## Test layers
1. **No-auth browser tests** (most reliable — run first):
   - Login page renders; unauthenticated gym route → redirect to `/login`.
   - **Security headers** present on responses: `Content-Security-Policy` (the audit
     #20 fix), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
     `Referrer-Policy`, `Permissions-Policy`. This validates the CSP fix in a real browser.
2. **Authenticated browser tests** (seeded owner):
   - Login flow → lands on `/{gymSlug}` dashboard.
   - Members list loads; create a member; member appears in list.
   - Navigation smoke across core modules (dashboard, members, classes, payments, settings).
3. **API security-regression tests** (Playwright `request` context → backend `:4000`):
   These pin the audit fixes. Where two tenants are needed, a second seeded studio is used.
   | Fix | Assertion |
   |-----|-----------|
   | #1 wallet manual-adjustment | owner token → `POST /admin/referrals/wallets/manual-adjustment` returns **403** |
   | #1 amount bounds | out-of-range `amount` → **400** |
   | #3 cross-tenant wallet | owner A → `GET /admin/referrals/wallets/{studioB}` returns **403** |
   | #10 upload validation | non-image bytes with `image/png` MIME → **400** |
   | #5 dev OTP | with no `MEMBER_DEV_OTP` set, dev login route → not usable |
   | #16 invite DTO | `POST staff/:id/invite` with junk keys → validation error / stripped |
   | auth | any protected route without `Authorization` → **401** |

## Module coverage roadmap (expand over time)
Auth · Members · Memberships · Check-in (incl. cross-branch access scope) · Classes/booking ·
Payments/invoices · Inventory/POS · Staff/RBAC · Referrals · Subscription · Reports/dashboard ·
Member BFF (member JWT self-scoping) · SCC (super-admin gating).

Each module: happy path + one authz/tenant-isolation negative test (the negative tests are
the ones that catch leaks).

## How to run
```
# terminal 1
npm --prefix backend run start:dev          # :4000
# terminal 2
npm --prefix frontend run dev                # :3000
# terminal 3
npm --prefix frontend run e2e                # playwright test
```
`playwright.config.ts` can also auto-start the frontend via its `webServer` block.

## Status (this session)
Implemented + run: layer 1 (no-auth browser) and the API auth/negative checks that don't
require multi-tenant seeding. Layers 2–3 full breadth are scaffolded with the seeded-owner
strategy; they expand from here. Results recorded in `E2E_RESULTS.md`.
