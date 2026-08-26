# Needs your input

Items I could not decide or do alone. Each says what is blocked and what I did
instead so the rest of the work continued.

---

## 1. Branding assets — the exact list

You asked which ones exactly. This is all of it. `app.json` currently declares
no `icon` and no `splash`, so Expo's generic defaults are in the build.

**Blocking a TestFlight build (3 files):**

| File | Size | Rules |
|---|---|---|
| `staff-app/assets/icon.png` | 1024×1024 | PNG, **no alpha/transparency**, no rounded corners — Apple masks it. Full-bleed artwork. |
| `staff-app/assets/adaptive-icon.png` | 1024×1024 | Android. Transparency allowed. Keep the logo inside the centre **66%** — Android crops to a circle/squircle. |
| `staff-app/assets/splash.png` | 1284×2778 | Or just a centred logo ~1200×1200 on a solid background; I set the background colour in `app.json`. |

**Blocking App Store / TestFlight external testers (not internal):**

- Screenshots: **6.7"** (1290×2796) and **6.5"** (1242×2688), 3–5 each. I can
  produce these from the simulator once the icon exists — no design work needed
  from you.
- Store copy: app name (30 chars), subtitle (30), description, keywords (100),
  support URL, privacy-policy URL. The privacy URL is **mandatory** and it is
  the one I cannot write for you.

**Fastest path:** send me the MuscleX logo as **SVG or a ≥1024px PNG with
transparency**, plus the brand background colour, and I will generate all three
files at the right sizes and wire them into `app.json`. One asset from you,
everything else derived.

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

## 7. Android is entirely unverified

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

## 8. App Store submission is automated — it needs credentials and 3 facts

`asc` is wired into a full pipeline: `staff-app/scripts/release-ios.sh`, with
`npm run release:{preflight,build,testflight,submit}`. Full write-up in
`docs/APP_STORE_RELEASE.md`. It has **no MCP server**; it ships an agent skill
pack, which I installed (`asc install-skills` → 23 skills in `~/.agents/skills/`).

Preflight runs today and names exactly what is missing:

```
✗ eas.json profile 'production' has no EXPO_PUBLIC_API_BASE_URL
✗ No app icon declared in app.json — Expo's default placeholder would ship
✗ Store metadata not release-ready (privacy policy URL, support URL)
✗ asc has no credentials
✓ EAS projectId: 5ad80e82-7758-4bb2-bfd4-a8c2cd175348
```

**What only you can give me:**

1. **App Store Connect API key** — Users and Access → Integrations → App Store
   Connect API, **App Manager** role. You get a `.p8` (downloadable once), a
   Key ID and an Issuer ID. Save the `.p8` outside the repo and run
   `asc auth login --name musclex --key-id KEY --issuer-id ISSUER --private-key /path/AuthKey.p8`.
   **Do not paste it here** — it would land in the transcript.
2. **The production API URL** (and staging, if `preview` differs).
3. **Privacy policy URL** and **support URL** — Apple rejects without the
   first.
4. **The app record** for `com.infynarc.musclex.staff` in App Store Connect —
   it does not exist yet. I can create it via `asc` once authenticated, if you
   would rather I did.
5. **The logo** (see item 1) so I can generate the icon and splash.

Store copy is already written and validates within Apple's limits — you should
read it and change anything you disagree with:
`staff-app/metadata/version/1.0.0/en-US.json`.

## 9. A production build has nowhere to send API calls (blocks TestFlight)

Found while checking the build command. `eas.json` sets
`EXPO_PUBLIC_API_BASE_URL` on the **development** profile only:

| profile | API URL |
|---|---|
| development | `http://localhost:4002/api/v1` |
| preview | **not set** |
| production | **not set** |

`app.json` has no `extra.apiBaseUrl` either, so both fall through to the
hardcoded default in `src/api/client.ts` — `http://localhost:4002/api/v1`. On a
tester's iPhone that is **the phone itself**. Sign-in would fail, every screen
would fail, and it would look like the app is broken rather than misconfigured.

I have made it fail LOUDLY instead of silently: a release build with no
configured URL now refuses the request with
`EXPO_PUBLIC_API_BASE_URL is not set in this build`, and logs it at startup.
That turns a mystery into one obvious message — but it does not make the build
usable.

**What I need from you: the public URL of the production backend** (and the
staging one, if `preview` should point somewhere different). Something like
`https://api.musclex.app/api/v1`. One line each in `eas.json` and it is done —
I did not guess at a hostname, because a wrong one is indistinguishable from
this same bug.

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
