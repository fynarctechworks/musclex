# Needs your input

Items I could not decide or do alone. Each says what is blocked and what I did
instead so the rest of the work continued.

---

## 1. Branding assets for TestFlight (blocks on-device testing by others)

App icon, splash screen, App Store screenshots and store copy do not exist.
`app.json` has no `icon`/`splash` entries, so Expo's defaults are in use.

**Blocked:** distributing a build to anyone but this machine.
**Workaround:** none needed for development; the app runs fine on the simulator.

## 2. Apple signing / TestFlight setup

You confirmed the Apple Developer account and bundle id
(`com.infynarc.musclex.staff`) exist, but signing and a TestFlight internal
group have not been set up from here — that needs your account.

**Blocked:** Phase 5 testing by anyone but the developer.

## 3. 2FA and multi-workspace paths are unverified

The seeded test accounts have neither 2FA enabled nor membership of more than
one studio, so `app/(auth)/two-factor.tsx` and `app/(auth)/workspace.tsx` are
built and unit-tested but have never run against the real API.

**Blocked:** end-to-end verification of those two screens.
**Workaround:** left as-is; the logic follows the backend contract exactly
(`/auth/2fa/login` takes a camelCase `tempToken`).

## 4. Login returns no `refresh_token`

Verified against the live API: `POST /auth/login` returns `access_token` and
`session_id` but no `refresh_token`, so the app cannot silently refresh and
signs out on 401 instead. The backend code path *does* return one
(`refresh_token: session?.refresh_token`), so Supabase returned no session
object for these admin-created users.

**Needs a decision:** is this expected for admin-created accounts only, or a
real gap for normal sign-ups? If the latter, sessions expire far sooner than
intended on mobile.
**Workaround:** `Session.refreshToken` is optional; refresh is skipped when absent.

## 5. Unscoped referral reporting endpoints (product question)

`GET /admin/referrals/{,overview,analytics,fraud-queue}` still return
platform-wide aggregates to gym owners. Fixing them means deciding what a gym
owner *should* see of their own referral funnel — a product call, not a
mechanical one. Detail in `docs/SECURITY_FINDINGS_2026-08-26.md`.
