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

## 6. QR check-in needs `expo-camera` (new native dependency)

Manual check-in is built and working (search a member, tap, confirm). **QR
scanning is not**, because it needs `expo-camera` — a new dependency plus a
native rebuild, which hard-gate #3 keeps behind your approval.

`member-app` already depends on `expo-camera` and has QR helpers in
`src/lib/qr.ts`, so the version and the pattern are both established; this is a
one-line approval rather than a research question.

**Blocked:** QR check-in, and later the kiosk mode (which is QR-driven).
**Workaround:** the check-in screen is built around member search and works
end to end; adding the scanner is an additive change to the same screen.

## 7. One tap I could not automate: the check-in confirm dialog

> **UPDATE:** the check-in MUTATION is now verified working end to end — with
> the confirm bypassed temporarily, a tap recorded a real check-in (59 → 60 rows)
> and the row's "last visit" updated. The earlier failure was the Hermes UUID
> bug, now fixed. What remains unverified is only the dialog's *button tap*,
> which is a tooling limit, not a code path. A single human tap closes it out.


Portal/overlay content (AlertDialog, bottom sheet) is exposed to idb as a
SINGLE accessibility element, so its buttons cannot be tapped by the automation.
Everything either side is verified — the member search, the dialog opening, and
the `POST /check-ins` endpoint (confirmed working via curl, returns
`{"success":true,...}`) — but the final "Check in" tap has never been performed
by a human on the device.

**Please tap it once** (Check-in tab → search a member → Check in) to confirm
the whole path. It should toast "<name> checked in" and clear the search.

That flow did surface one real bug on the way, now fixed: `crypto.randomUUID`
does not exist in Hermes, so a non-UUID idempotency key was sent and the backend
rejected it with `client_event_id must be a UUID`. See `src/lib/uuid.ts`.

## 8. Offline persistence needs two dependencies

Plan Phase 4 includes offline read (cached dashboard/member/schedule visible
with no signal). That needs `@tanstack/react-query-persist-client` plus a
storage layer — `expo-sqlite` (already used by `member-app`) or
`@react-native-async-storage/async-storage` (SDK-pinned at 2.2.0).

**Blocked:** offline read. The app currently shows its error state with no
network, which is honest but not what the plan promises.
**Recommendation:** `expo-sqlite`, matching `member-app`, plus the persist
client. Both are additive; no screen changes needed.

Note: whichever is chosen, the cache must still be **wiped on sign-out,
workspace switch and branch change** — a persisted cache makes that
cross-tenant rule more important, not less, because it now survives app
restarts. `SessionProvider` already does the wiping; it will need to clear the
persisted store too.

## 9. One flow still needs a human tap to confirm

Portal/overlay content is a single accessibility element to idb, so its buttons
cannot be driven by automation. Both sides of each flow are verified; only the
final tap is not:

- **Check-in confirm** (Check-in tab → search → Check in). See item 7.
- **POS checkout** (More → Shop / POS → add items → Checkout → Take ₹…).
  Not yet exercised, though the *same kind* of bottom-sheet button was proven
  tappable when recording a payment (below), so this is likely fine.

**Resolved since:** bottom-SHEET buttons ARE reachable by automation — a real
₹24,000 payment was recorded from the app (receipt `RCP-20260825-CDA6FB67`).
Only **AlertDialog** buttons resist it, which narrows item 7 to just the
check-in confirm.

## 10. Minor: the "Add" button collides with the dev-client Tools bubble

On the Members screen the header "Add" button sits at roughly the same spot as
Expo dev-client's floating Tools bubble, so in a DEV build a tap can hit the
bubble instead. Release builds have no bubble, so this is a development-only
annoyance — but if it bothers you during testing, the button can move to the
left of the header or become a floating action button.
