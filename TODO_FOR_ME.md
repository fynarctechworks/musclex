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

## 8. AI advisor needs an LLM API key

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

## 9. Phase 7 (push notifications) needs a schema decision

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

## 10. Dashboard KPI inspector reads the wrong schema (needs your go-ahead)

`dashboard/kpi-inspector.service.ts` injects the **raw** `PrismaService` and
queries tenant models with it. Tenant models are `@@schema("studio_template")`,
so it reads **`studio_template`** instead of the caller's gym.

**Measured:** the seeded gym has 3 pending invoices worth ₹22,400.
`GET /invoices` (tenant-scoped) returns all three; `GET
/dashboard/inspect/outstanding_dues` returns `value: 0, sample_rows: []`, as
owner *and* as accountant. `studio_template.member_invoices` is empty.

Its other metrics only *look* right because this dev DB's `studio_template`
holds a stale copy of the same fixtures.

**I did not fix it.** It is one line — inject `TenantPrisma`, use
`this.tenant.client.*` like every other service — and it strictly narrows what
the query reaches. But it changes how a service is gym-scoped, which
`CLAUDE.md` hard-gate #2 reserves for you.

**Also in the same method:** the headline `value` is summed from the first 10
rows (`take: 10`) while claiming to be the full SUM. A gym with 500 unpaid
invoices would be shown the 10 oldest and told that is everything it is owed.

Full evidence in `docs/SECURITY_FINDINGS_2026-08-26.md` F-5.

**Consequence for the app:** I have **not** built a dues tile. The only metric
that reports dues is this one, and putting a number on screen that I know reads
the wrong schema would be worse than leaving it off.

## 11. Two small clean-ups the isolation work surfaced

Neither blocks anything; both are yours to call because they touch tenant code.

**a) `verifyFullTenantIsolation()` is dead code that would return false.** It
checks `search_path` and `app.gym_id` — the mechanism `CLAUDE.md` says is inert
under Prisma multiSchema. Nothing in `src/` calls it, and nothing sets those
session variables. It should be deleted or rewritten to assert the `gym_id`
injection that actually protects us. I skipped its test with a note rather than
touch the method.

**b) Comments claiming search_path protection.** `settings.service.ts` and
`payments.service.ts` carry comments like "tenant isolation relies on
search_path set by TenantMiddleware". Those queries ARE safe — the gym_id
injection covers them — but for a different reason than the comment states.
Worth correcting before somebody relies on the comment.

**Also worth knowing:** `.e2e-spec.ts` files are not collected by `npm test`
(the regex wants a literal dot; these use a hyphen). They only run under
`npm run test:e2e`. That is standard Nest layout, but it is why the
tenant-isolation suite could sit broken while CI stayed green — worth wiring
`test:e2e` into whatever runs on push.

## 12. Sentry (or another crash reporter) — a new dependency

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

## 13. Android is entirely unverified

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
