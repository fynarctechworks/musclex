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
npx eas login          # your Expo account
npx eas build --platform ios --profile production
```

It will prompt for your **Apple ID**, then generate the distribution
certificate and provisioning profile on your behalf and store them in your Expo
account. Then `npx eas submit --platform ios --latest` pushes it to TestFlight.
Once that has run once, I can trigger every later build without your Apple ID.

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

## 3. Two auth paths still need a human pass

**2FA: the API is now verified, the SCREEN is not.** I drove the whole server
flow with real TOTP codes — enrol, challenge, step-2, wrong-code rejection —
and confirmed the important property: a challenged login returns a temp token
and **no access token**. Details in DECISIONS.md.

What I did not do is drive `app/(auth)/two-factor.tsx` on the device, because
that means leaving a seeded account in a 2FA state while the simulator is
driven through it, and I would rather not hand back a fixture in a state you
did not ask for.

**You asked what is needed from your side. Two minutes, on the web app:**

1. Sign in as `owner@mxtest.app` → Settings → Security → **Enable 2FA**.
2. Scan the QR with any authenticator (Google Authenticator, 1Password, Authy)
   and confirm the 6-digit code it shows.
3. Tell me it is on. I drive the phone screen from here, confirm it accepts a
   real code and rejects a wrong one, and tell you when to turn it back off.

That is the whole ask — I need the enrolment to exist on an account, and only
you should be holding the authenticator secret. **Alternatively**, say "go
ahead and enable it yourself on the test account" and I will do all three steps
and disable it again afterwards; I avoided that only because it changes a
fixture you did not ask me to change.

~~**Multi-workspace is still entirely unverified.**~~ **Done** — you approved
it, and it turned out to be broken in three separate places, not merely
untested. See DECISIONS.md. A second gym ("MuscleX Bandra") now exists via
`backend/scripts/seed-second-gym.ts`, and `owner@mxtest.app` holds a role in
both; the picker and the switch are verified on the simulator and in the
browser.

## 4. Referral reporting — the leak is closed; one product question is left

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

**The question that is actually yours** (nothing is leaking while it is open):
a gym owner can currently see their own referral totals via `/referrals/stats`.
Do you want them to see more — a funnel (invited → signed up → paid), the names
of gyms *they* referred, pending vs paid reward amounts? If yes, that is a new
gym-scoped endpoint and I need to know which of those numbers a gym should see.
If "stats is enough", this item closes.

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
  bodies, URLs redacted and UUIDs masked. **Still needs from you:** the DSN.

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
