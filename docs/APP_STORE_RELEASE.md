# iOS release — how it works and what it still needs

One command per stage, each refusing to run when the stage before it is not
ready. `staff-app/scripts/release-ios.sh` is the whole pipeline; the npm
scripts are thin aliases.

```bash
cd staff-app
npm run release:preflight    # local checks, no credentials needed
npm run release:build        # EAS production build
npm run release:testflight   # upload the latest build to TestFlight
npm run release:submit       # DRY RUN of the App Store submission
npm run release:submit -- --confirm   # actually submit for review
```

Everything before `--confirm` is reversible. That one is not: it puts the app
in front of Apple's reviewers under your developer account, so it is the only
step that takes an explicit flag **and** asks you to type the version number
back before it proceeds.

## Tooling

- **`eas-cli`** builds the IPA. Invoke as `npx --yes eas-cli@latest` — the npm
  package is `eas-cli`; a bare `eas` is an unrelated stub with no executable.
  It is deliberately not a devDependency (EAS warns when its own CLI is one).
- **`asc`** ([App-Store-Connect-CLI](https://github.com/rorkai/App-Store-Connect-CLI),
  `brew install asc`) drives App Store Connect: metadata, validation,
  TestFlight, submission. **It has no MCP server**; it ships an agent skill
  pack instead, installed to `~/.agents/skills/` by `asc install-skills` (23
  skills, from a pinned reviewed commit). Those are reference documents, not
  tools — the pipeline calls the CLI directly.

## What preflight checks, and why each one is there

Every check exists because the failure it catches has already happened here or
was one step away.

| Check | The failure it prevents |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` set, and not localhost | A release build fell through to `http://localhost:4002` — on a tester's phone, the phone itself. Every screen fails and it reads as a broken app. |
| Sentry has an org **or** upload is disabled | The Sentry plugin's Xcode phase fails the whole build without an org slug. This broke the first EAS build. |
| `extra.eas.projectId` present | No project id means no push token can ever be minted. |
| App icon declared and present | Expo's placeholder icon ships silently otherwise. |
| `asc metadata validate --strict` | `--strict` makes *warnings* fatal, so a placeholder privacy-policy URL blocks the release here instead of coming back as an Apple rejection days later. |
| `asc` credentials | Nothing downstream can run without them. |
| App record exists for the bundle id | A build cannot be uploaded to an app that does not exist. |

Preflight never stops at the first failure. Someone fixing five things wants
all five named now, not one per run.

## Store metadata

Canonical files live in `staff-app/metadata/`, the layout `asc` expects:

- `metadata/app-info/en-US.json` — name, subtitle, privacy policy URL
- `metadata/version/1.0.0/en-US.json` — description, keywords, promotional
  text, support URL, what's new

Both are written and within Apple's limits (name 13/30, subtitle 18/30,
keywords 73/100, promo 83/170, description 1345/4000). Two fields are
deliberately left as `REPLACE_ME_` placeholders so that `--strict` validation
keeps refusing to release until they are real:

- **`privacyPolicyUrl`** — Apple requires this and will reject without it.
- **`supportUrl`**

Note: write `null` nowhere in these files. `asc` treats an empty field as an
error and asks you to *omit* the key instead, which leaves the remote value
unchanged.

## What is still needed before a submission can succeed

1. **App Store Connect API key** — Users and Access → Integrations → App Store
   Connect API, App Manager role. Gives a `.p8` (downloadable once), a Key ID
   and an Issuer ID. Then:
   `asc auth login --name musclex --key-id KEY --issuer-id ISSUER --private-key AuthKey.p8`
2. **The app record** for `com.infynarc.musclex.staff` — it does not exist yet,
   and **the API key cannot create it**. Apple's App Store Connect API has no
   app-creation endpoint, so `asc web apps create` falls back to a web session
   needing your Apple ID password and a 2FA code. Either run that yourself (it
   prompts securely) or create it in the App Store Connect UI. Everything after
   this point runs on the API key alone.
3. **Production API URL** in `eas.json` for the `production` (and `preview`)
   profile.
4. **App icon** (1024×1024, no alpha) and splash.
5. **Privacy policy URL** and **support URL**.
## Screenshots

Five per size, in `staff-app/metadata/screenshots/`:

- `APP_IPHONE_65/` — 1242×2688, the size App Store Connect **requires**
- `APP_IPHONE_69/` — 1320×2868, the larger modern size

Both validate clean (`asc screenshots validate --path … --device-type
IPHONE_65` → 5 ready, 0 errors, 0 warnings).

They are captured from a **Release** build, not a dev build. A dev build paints
expo-dev-client's floating tools bubble over the top right, and no amount of
tapping makes it go away — it would have been in every store image.

To recapture after a UI change:

```bash
# Release build so there is no dev-client chrome in the frame
EXPO_PUBLIC_API_BASE_URL=http://localhost:4002/api/v1 SENTRY_DISABLE_AUTO_UPLOAD=true \
  npx expo run:ios --configuration Release --device "iPhone 17 Pro Max"
```

Then sign in and step through Home → Check-in → Members → Money → More. Two
traps: the Check-in tab auto-focuses its search field and the keyboard then
covers the tab bar (send Return first), and iOS shows a one-time
"Type English and Hindi" keyboard tutorial that swallows taps until dismissed.

`asc screenshots upload --version-localization ID --path … --device-type
IPHONE_65` puts them on the listing once the app record exists.

Items 1, 2 and 3 can only come from you. After those, the rest is one
`npm run release:build` away.
