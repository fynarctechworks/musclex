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

## 6. One QR scan on a physical device

The scanner is built and the plumbing is verified — permission prompt (with our
own usage string), camera view mounting, the fallback when access is refused,
and the escape hatch to search by name. What I **cannot** verify here is the
one thing that matters most: that pointing it at a real member's QR code
decodes and checks them in.

The iOS Simulator has no camera, so the viewfinder is black by design. The
duplicate-suppression rules (`ScanGate`) are unit-tested against a fake clock,
but they have never met a real camera firing ten events a second.

**What I need:** someone to open Check-in → Scan on a physical iPhone and scan
a member's code once. If it checks them in and a second scan of the same code
is ignored for a few seconds, the feature is done.

## 7. Should a trainer be able to record measurements? (permissions question)

Recording body stats requires `members.edit`. The seeded **trainer** role has
`members.view` only, so:

- the "Record measurements" button is correctly hidden from them in the app, and
- the backend would reject the write anyway (`POST /members/:id/body-stats` is
  `@Permissions({ module: 'members', action: 'edit' })`).

The app is consistent with the server here — this is not a bug. But a trainer is
arguably the person who *should* be taking a member's measurements, and right
now only roles with full member-edit rights can. Granting `members.edit` to
trainers would also let them change names, phones and emails, which may not be
what you want.

**The options**, none of which I should pick for you:
1. Leave it — measurements are recorded by a manager/owner.
2. Grant trainers `members.edit` (wider than measurements).
3. Split a narrower permission (e.g. `members.measure`) — a backend change to
   the permission set, which is gated anyway.

**Verified:** the write path itself works — `POST` with the exact payload the
app sends was accepted, and unfilled fields correctly stored as null rather
than 0. What is *not* verified on device is the button, because no role I was
signed in as can see it.

## RESOLVED since you approved the dependencies

These no longer need you. Kept as a record of what changed.

- **QR check-in** — `expo-camera` approved and shipped. Permission prompt,
  fallback state and scanner UI verified on the simulator; **decoding a real QR
  code is still unverified**, because the iOS Simulator has no camera. That
  needs one scan on a physical device.
- **Offline persistence** — `expo-sqlite` +
  `@tanstack/react-query-persist-client` approved and shipped. Verified on
  device with the API paused: the dashboard rendered from the persisted cache
  through a full app restart, and a check-in taken offline queued and then
  synced.
- **The check-in confirm dialog is automatable after all.** It was never a
  portal limitation. `tap-label.sh` matched labels by SUBSTRING, so "Allow"
  found "Don't Allow" first — which is also how I silently denied the camera
  permission and then misread it as an app bug. Exact matches now win.
- **The Tools-bubble collision** is now only a nuisance for automation, not for
  users; it is a dev-client overlay and does not exist in a release build.
