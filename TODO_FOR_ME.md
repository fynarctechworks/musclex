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

## 3. Two auth paths still need a human pass

**2FA: the API is now verified, the SCREEN is not.** I drove the whole server
flow with real TOTP codes — enrol, challenge, step-2, wrong-code rejection —
and confirmed the important property: a challenged login returns a temp token
and **no access token**. Details in DECISIONS.md.

What I did not do is drive `app/(auth)/two-factor.tsx` on the device, because
that means leaving a seeded account in a 2FA state while the simulator is
driven through it, and I would rather not hand back a fixture in a state you
did not ask for. **One manual pass** would close it: enable 2FA on a test
account, sign in on the phone, confirm the code screen accepts a real code and
rejects a wrong one.

**Multi-workspace is still entirely unverified.** It needs one user holding
roles in two studios, which the seeder does not create. Say the word and I will
extend the seeder to make a second gym and a dual-membership account — it is
the only way to exercise `/auth/select-workspace` and the workspace picker.

## 4. Unscoped referral reporting endpoints (product question)

`GET /admin/referrals/{,overview,analytics,fraud-queue}` still return
platform-wide aggregates to gym owners. Fixing them means deciding what a gym
owner *should* see of their own referral funnel — a product call, not a
mechanical one. Detail in `docs/SECURITY_FINDINGS_2026-08-26.md`.

## 5. One QR scan on a physical device

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

## 6. AI advisor needs an LLM API key

`POST /api/v1/ai/chat` returns **500** in this environment. Neither
`ANTHROPIC_API_KEY` nor `OPENAI_API_KEY` is set in `backend/.env`, and the
service has no key to call.

`GET /ai/conversations` works (returns an empty list), so the endpoint surface
and the `ai_advisor` entitlement are fine — only the model call fails.

**Not built:** the AI advisor screen. I deliberately did not build a chat UI I
could not exercise even once; its entire behaviour *is* the model's response,
so there would be nothing to verify and it would look finished while being
untested. The trainer role does hold `ai.view` and `ai.create`, so it is
reachable as soon as a key exists.

**What I need:** a key in `backend/.env`, then this is roughly a day of work.

## 7. Phase 7 (push notifications) needs a schema decision

The plan marks Phase 7 as **"DB schema → approval"**, and `CLAUDE.md` hard-gate
#1 puts any migration behind your explicit go-ahead. Staff push needs somewhere
to store device tokens (per staff user, per device, revocable on sign-out),
which is a new table.

I have **not** designed or written that migration. It is skipped, not
forgotten, and Phase 8 was built instead.

**What I need:** approval to add a staff device-token table, or a steer that
push should reuse an existing mechanism I have not found.

Worth noting: the app already signs users out on token expiry and wipes the
query cache on workspace switch, so a device-token table has to be cleared on
those paths too — otherwise a staffer who signs out keeps receiving another
gym's notifications on that handset.

## 8. Sentry (or another crash reporter) — a new dependency

Phase 12 lists Sentry. It is a new package plus a native module, which
hard-gate #3 and #4 both cover, so I have not added it.

**Worth knowing before you decide:** the app currently has no crash reporting
at all. Everything I found this session was found by looking at a simulator or
querying the database. On a real device in a real gym, a crash is silent — the
staffer force-quits and carries on, and you never hear about it.

`@sentry/react-native` is the obvious choice (already used elsewhere in this
monorepo's dependency tree — `jest.config` references `@sentry/react-native` in
`transformIgnorePatterns`), so it is likely already an approved vendor here.

**What I need:** approval for the package and a DSN.

## 9. Android is entirely unverified

The plan is iOS-first and that is what I built and tested. Everything verified
this session was on an iOS simulator. The app has **never been run on
Android** — no build, no device, no emulator.

Nothing about the code is knowingly iOS-only: no native modules beyond
expo-camera and expo-sqlite (both cross-platform), and the design system is
Expo/RN throughout. But "should work" is not "works", and there are known
Android divergences worth expecting — keyboard avoidance, the bottom sheet's
backdrop behaviour, back-button handling, and date pickers.

**Not a blocker for an iOS TestFlight.** It becomes one the moment you want
Android, and it is a day of work plus a build, not a rewrite.

## RESOLVED

- **Login returns a refresh token again** (was item 4). It was not Supabase —
  `StripSecretsInterceptor` was deleting it from every response, including the
  one whose job is to return it. Now exempted on session-minting auth routes
  only.
- **F-5: the KPI inspector reads the caller's gym** (was item 9). Dues went
  0 → ₹22,400, matching the database. `mrr` and `check_ins_today` also changed,
  confirming they had been reading `studio_template` too.
- **The dead isolation check is a real one** (was item 10), and seven files'
  misleading `search_path` comments now name the actual mechanism.

- **Trainers can record measurements** (was item 7). You chose it; implemented
  as a NARROW new permission `members.measure` rather than granting
  `members.edit`, so a trainer records body stats without gaining the right to
  rename members or change their phone numbers. Verified per role against the
  running API and on device. See DECISIONS.md.

### Earlier, since you approved the dependencies

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
