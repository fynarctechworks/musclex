# Needs your input

Items I could not decide or do alone. Each says what is blocked and what I did
instead so the rest of the work continued.

---

## 1. ~~Branding assets~~ — done from your logos

You pointed me at `asserts/logo/`. Generated and wired in:

| File | What it is |
|---|---|
| `staff-app/assets/icon.png` | 1024², **no alpha** (Apple's hard requirement — verified in the built asset catalogue), MX mark on white |
| `staff-app/assets/adaptive-icon.png` | 1024², transparent, mark inside the centre 62% so Android's launcher mask cannot crop it |
| `staff-app/assets/splash-logo.png` | 1024², full MUSCLEX·MX lockup, used by both the native splash and the animated hand-off |

`npm run assets:launch` regenerates all three from the logos, so changing the
artwork is a one-line rerun rather than a design round-trip.

**Still needed for the App Store listing** (not for a build, and not for
TestFlight *internal* testing):

- **Screenshots** — 6.7" (1290×2796) and 6.5" (1242×2688), 3–5 each. I can
  capture these from the simulator now that the icon exists; say the word.
- **Privacy policy URL** and **support URL** — see item 8. Apple rejects
  without the first.

## 2. Apple signing — how you actually hand it over

You asked how to give this. Three options, easiest first. **Do not paste any
credential into this chat** — it lands in the transcript.

**Option A — you run two commands (recommended, ~10 min).**
EAS handles certificates and provisioning profiles itself; you never touch
Keychain or the developer portal.

```bash
cd staff-app
npx --yes eas-cli@latest login      # your Expo account
npx --yes eas-cli@latest init       # creates the EAS project + projectId
npx --yes eas-cli@latest build --platform ios --profile production
```

**The package is `eas-cli`, not `eas`.** I gave you `npx eas login` earlier and
that was wrong — plain `eas` on npm is an unrelated stub at v0.1.0 with no
executable, which is exactly the "could not determine executable to run" you
hit. `eas-cli` is not a local devDependency here on purpose (it was removed in
f50efb2 because EAS warns when its own CLI is a project dependency), so it has
to come from `npx` or a global `npm i -g eas-cli`. Verified working here:
`eas-cli/22.5.0`.

`init` is worth running on its own because it writes `extra.eas.projectId` into
`app.json` — which is also the missing piece stopping push notifications from
minting a token.

It will prompt for your **Apple ID**, then generate the distribution
certificate and provisioning profile on your behalf and store them in your Expo
account. Then `npx eas submit --platform ios --latest` pushes it to TestFlight.
Once that has run once, I can trigger every later build without your Apple ID.

**Before you ship that build, see item 8** — `preview` and `production` have no
API URL configured, so the app would talk to `localhost` on the tester's own
phone and every screen would fail.

**Option B — you delegate it.** Add me (or a build account) to your Expo
organisation with the right role, and add that same Apple ID to your Apple
Developer team as **App Manager**. Then A runs from here without you.

**Option C — App Store Connect API key (fully unattended, best for CI).**
App Store Connect → Users and Access → Integrations → **App Store Connect API**
→ generate a key with the **App Manager** role. You get:
- an `.p8` private key file (downloadable **once**),
- a Key ID,
- an Issuer ID.

Put the `.p8` outside the repo and set `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`
and `EXPO_ASC_ISSUER_ID` in your shell — or upload them to EAS with
`npx eas credentials`. This is the one to pick if you want builds to happen
without you at all.

**Also needed once, in App Store Connect:** create the app record for bundle id
`com.infynarc.musclex.staff` (it does not exist yet), and answer the export-
compliance question. `app.json` already declares
`ITSAppUsesNonExemptEncryption: false`, so that answer is "no".

**Blocked until then:** anyone but this machine installing the app.

## 3. ~~Two auth paths need a human pass~~ — done

**2FA is verified end to end on the phone.** You could not find Security in
Settings because the mobile app **had no Security screen at all** — the login
step-2 screen existed, so a staff member could be *challenged* by a control
they had no way to switch on. (On the web it does exist, sixth of twelve cards
in Settings → Quick Actions, which is its own findability problem.)

Built `staff-app/app/more/security.tsx`, then drove the whole flow on the
simulator against real TOTP codes:

- status reads Off → **Turn on** → QR renders, manual key shown
- a real 6-digit code is accepted; backup codes appear, and **"I've saved
  them" stays disabled** until you save or acknowledge them
- signed out, signed back in → the **Two-factor code** screen appears
- a wrong code (`000000`) is rejected with "Invalid verification code" and no
  session
- the correct code signs in
- **Turn off** with the account password returns it to Off

The test account is back exactly as you left it — `owner@mxtest.app` no longer
requires 2FA, confirmed against the API.

**It found a real bug on the way.** An account with BOTH 2FA and two gyms hit
"Session expired" on the workspace picker: the 2FA screen never forwarded the
interim access token, so the authenticated select call went out with no
credentials. The password path was fixed for this weeks ago and this path was
missed — nothing exercised the combination until 2FA was driven on a device.
Fixed and re-verified: 2FA → workspace picker → dashboard, correctly scoped.

Nothing needed from you on this item any more.

## 4. ~~Referral reporting~~ — leak closed, scope decided

You said you did not follow this one. Here is exactly what was happening,
measured against the running API, not described.

**The concrete example.** I inserted one referral into the local database:
*Iron Temple Fitness* referred *Zen Yoga Studio*. Neither gym has anything to
do with MuscleX Test Gym. I then signed in as the owner of **MuscleX Test Gym**
and called `GET /api/v1/admin/referrals/analytics`. They got back:

```json
{
  "total_referrals": 1,
  "by_status": [{ "status": "rewarded", "count": 1 }],
  "top_referrers": [{
    "studio": { "name": "Iron Temple Fitness", "referral_code": "A234AC" },
    "rewarded_count": 1
  }]
}
```

One of your paying gyms could read another gym's **name**, its **referral
code**, and how many successful referrals it had made. Substitute a real
customer list and a gym owner is reading a leaderboard of their competitors on
your platform.

The cause: the whole `/admin/referrals/*` controller is declared
`@Roles('owner', 'super_admin')`, and its handlers query
`prisma.referral.count()` with **no gym filter at all**. It was written as a
platform-admin screen; the `owner` in that decorator let every gym owner walk
into it.

It was worse than reporting. The same controller let a gym owner **write**:
create and edit referral **campaigns** (the reward amounts you offer), force a
referral's status, revoke another gym's reward, clear fraud signals, and
recompute risk scores.

**Fixed (this is authorisation, not a product call, so I did not wait).** Every
cross-tenant read and every write on that controller now calls
`assertPlatformAdmin` — a helper that already existed on the class and simply
had not been applied. Verified live as a gym owner: `analytics`, `overview`,
`fraud-queue`, `campaigns`, the referral list and `POST campaigns` all now
return **403**, while the gym's own `GET /referrals/stats` still returns 200.
26 tests in `backend/test/referrals/admin-scope.spec.ts` cover each handler for
both roles.

One deliberate exception: `GET /admin/referrals/rules` is still readable by a
gym owner. Reward rules are the offer *you publish to gyms* — what they earn
for referring someone — and the gym-facing
`/[gymSlug]/settings/referrals` page renders them.

**Answered: no.** You decided a gym owner should NOT see more than
`/referrals/stats` already gives them, so no gym-scoped funnel endpoint is
being built. This item is closed — nothing outstanding on referrals.

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

## 6. AI advisor — waiting on your LLM key (now a clean "coming soon")

**Still needs:** `ANTHROPIC_API_KEY` in `backend/.env`. Nothing else.

You asked for it to read as "coming soon" in both apps until then, so it now
does, and the endpoint no longer misbehaves without a key:

- `GET /api/v1/ai/status` reports `{ available: false }`. Every AI surface asks
  it before rendering.
- **Web:** AI Advisor → the *Chat* tab shows a "coming soon" panel and the tab
  itself carries a `Soon` badge; the floating **Ask AI** drawer on all four
  dashboards opens straight to the same panel with **no composer**. The
  *Insights* tab and the Daily Briefing keep working — they are rules over your
  real numbers, not model output, and blanking them would have hidden working
  analytics.
- **Mobile (staff app):** the More → AI advisor row reads "Coming soon" and is
  inert.
- The fallback reply no longer tells a paying gym to "configure the
  ANTHROPIC_API_KEY environment variable" — that was our internal config name,
  on a screen where they cannot act on it, phrased as if the feature were
  broken rather than unreleased.

The advisor screen itself is still not built, for the reason below. Once the key
lands it is roughly a day of work.

## 7. Exercise illustrations — one command from you, on production

The code is done and verified locally: 1,323 exercises, each with a thumbnail
in the list, muscle-head sub-filters, and the GIF ready for a detail view.
What is missing is the media itself in PRODUCTION storage — `.env.remote` is a
template with empty values, so I have no service-role key, and you should not
paste one into a chat.

**Run this once, with production credentials in your shell:**

```bash
cd backend
SUPABASE_URL=https://tcpchduxxqsjnsybegjz.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<your service role key> \
  npx ts-node scripts/upload-exercise-media.ts
```

It creates the public `exercise-media` bucket if absent and uploads 2,646 files
— **394 MB** (1,323 GIFs at 368 MB, 1,323 thumbnails at 26 MB). Check that
against your Supabase storage quota before running; the free tier is 1 GB. It
is idempotent and skips files already there, so a failed run can just be
repeated.

Then attach them to every gym's rows:

```bash
curl -X POST https://api.musclex.infynarc.com/api/v1/exercises/seed-defaults \
  -H "Authorization: Bearer <token>"
```

That one call now does three things and is safe to re-run: seeds any missing
movements, back-fills `media_url`/`thumb_url` on rows that predate
illustrations, and leaves alone any exercise a gym has customised.

**It needs the backend deployed first** — the media URL is built from
`SUPABASE_URL` at seed time, and production is still running the old code.

### A note on where this came from

You decided to ship these GIFs, so they are wired in. Recording the position
plainly, once, because it is the kind of thing that is hard to reconstruct
later: the dataset's README states the images were *"extraídos de Internet"*,
that its author does not hold their copyright and *"cannot grant rights over
them to third parties"*, and the repo carries no LICENSE. Nothing in the code
now prevents replacing them — `scripts/upload-exercise-media.ts` writes to one
shared bucket and the paths are stable, so a licensed set (ExerciseDB.io, ~$299,
whose field names match this schema one-for-one) drops in by re-running the
uploader against the new files. No schema change, no re-seed.

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

## 10. ~~App Store submission~~ — SUBMITTED

**MuscleX Staff 1.0.0 (build 2) is `WAITING_FOR_REVIEW`.**
Submission `1e2c5587-a62e-46ba-a187-e5cd66766da4`, submitted 2026-08-26 23:58 UTC.
Nothing further is required from either of us; Apple reviews in roughly 24–48
hours and emails the outcome.

Two things surfaced only when Apple actually evaluated the version — neither is
visible to `asc validate`, because they are checked at submission time:

1. **An iPad Pro 12.9" screenshot set was required.** `app.json` sets
   `supportsTablet: true`, which is right — Kiosk mode belongs on a front-desk
   iPad — and that obliges iPad screenshots. Captured five at 2064×2752.
2. **App Privacy data usages had to be published**, which is web-UI only.

Worth remembering for 1.0.1: the first retry after publishing App Privacy still
failed with "you must have published answers". It was Apple-side propagation
lag — the same command a minute later succeeded unchanged. Do not go hunting
for a config error if that happens again; wait and retry.

### If it comes back rejected

The likeliest reason is **Guideline 2.1, reviewer could not sign in**. The demo
account is `appreview@musclex.infynarc.com` / `AppReview2026!MX` and was
verified against the production API, but:

- Do not enable 2FA on it.
- Do not delete it, now or after approval — Apple re-checks on every update.
- If the production API is down when a reviewer tries, that reads as a broken
  app. Worth keeping an eye on `api.musclex.infynarc.com` over the next
  couple of days.

Second likeliest is **3.1.3(b)** — "free to install, gym subscribes on the
web". The review note covers it, the app never points anyone at an external
purchase, and it is a B2B employee tool, which is the accepted case.

### Still unverified, and worth doing on the TestFlight build

Neither blocks the release; both are things only a physical device can answer.

- **Scan a real member QR code** at Check-in. The decode path has only ever met
  a fake clock, never a camera.
- **Confirm a push banner lands.** `PUSH_NOTIFICATIONS` is enabled on the
  bundle ID and a signed build carries the `aps-environment` entitlement, so a
  token should mint where the simulator could not.

## 11. ~~A production build has nowhere to send API calls~~ — resolved

You gave me the nginx config. `api.musclex.infynarc.com` → `127.0.0.1:4100`.

Verified against the live server rather than assumed: `GET /health` returns
`{"status":"ok"}`, and `POST /api/v1/auth/login` returns **400** — a validation
error on my empty body, which means the route is there. (`GET` on it returns
404, which is what made the prefix look wrong at first.)

`eas.json` now sets `EXPO_PUBLIC_API_BASE_URL=https://api.musclex.infynarc.com/api/v1`
on both `preview` and `production`.

**One thing to confirm:** `preview` currently points at the SAME production
API. If you have a staging backend you would rather internal testers hit, tell
me the host and it is one line. `scc-api.musclex.infynarc.com` (→ 4101) is the
control-centre API and is not what this app talks to.

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

- **Push notifications** (was item 7). You approved it and asked for tokens to
  be cleared on sign out. Built end to end and verified against the running
  API — including the property you asked for: one sign-out call removed the
  device from **both** gyms it was registered in (`{"removed": 2}`), while
  another staffer's device on the same gym was untouched (`{"removed": 0}`).
  See DECISIONS.md. **Still needs from you:** an EAS `projectId` (`npx eas
  init` in `staff-app/`) before a real token can be minted, and a new dev build
  — `expo-notifications` is a native module.

- **Sentry** (was item 8). Approved and shipped, DSN-gated so it is inert until
  `EXPO_PUBLIC_SENTRY_DSN` is set. Scrubbing is unit-tested: no PII, no request
  bodies, URLs redacted and UUIDs masked. **Still needs from you:** the DSN —
  and see the note on source maps below.

  **Source-map upload is switched OFF** (`SENTRY_DISABLE_AUTO_UPLOAD=true` in
  all three `eas.json` profiles). It has to be: the Sentry Expo plugin uploads
  source maps during the iOS build and fails the whole build without an
  organisation slug, which is what broke your first EAS build. Cost of having
  it off: when you do add a DSN, JS stack traces in Sentry will be **minified**
  — you will see `t.a is not a function` at `index.bundle:1:284913`, not a file
  and line. Crashes are still captured and still grouped; they are just harder
  to read.

  **To turn it back on** once you have a Sentry account: add `organization` and
  `project` to the plugin entry in `app.json`, create a Sentry auth token with
  `project:releases` scope, store it as an EAS secret
  (`eas secret:create --name SENTRY_AUTH_TOKEN`), and delete the three
  `SENTRY_DISABLE_AUTO_UPLOAD` lines. I can do all of that in one pass — I just
  need the org slug and project name.

- **AI advisor reads "coming soon"** in both apps, as you asked, and the
  fallback no longer names our environment variables to a paying gym. See
  item 6 — it is now purely waiting on the key.

- **Referral endpoints no longer leak across gyms** (see item 4). The
  reporting-scope product question is all that is left.

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
