#!/usr/bin/env bash
#
# ─────────────────────────────────────────────────────────────────────────────
# iOS RELEASE PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
#
# Wraps `eas` (build) and `asc` (App Store Connect) into one path, with a
# preflight that refuses the things we have ALREADY shipped-and-regretted once:
# a build pointing at localhost, a build with no Sentry org that dies in Xcode,
# a placeholder privacy URL that Apple rejects.
#
#   ./scripts/release-ios.sh preflight     # local checks only — no credentials
#   ./scripts/release-ios.sh build         # EAS production build
#   ./scripts/release-ios.sh testflight    # upload the latest build to TestFlight
#   ./scripts/release-ios.sh submit        # DRY RUN of the App Store submission
#   ./scripts/release-ios.sh submit --confirm   # actually submit for review
#
# Everything before `submit --confirm` is reversible. That one is not: it puts
# the app in front of Apple's reviewers under your developer account, so it is
# the only step that demands an explicit flag and a typed confirmation.
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$PWD"

EAS="npx --yes eas-cli@latest"
PROFILE="${PROFILE:-production}"
BUNDLE_ID="$(node -p "require('./app.json').expo.ios.bundleIdentifier")"
VERSION="$(node -p "require('./app.json').expo.version ?? '1.0.0'")"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }

FAILED=0
fail() { bad "$*"; FAILED=1; }

# ── Preflight ────────────────────────────────────────────────────────────────
#
# Ordered cheapest-first, and it never stops at the first failure: someone
# fixing five things wants all five named now, not one per run.
preflight() {
  bold "Preflight — $BUNDLE_ID v$VERSION (profile: $PROFILE)"

  # 1. The localhost trap. A release build with no API URL reaches the
  #    tester's own phone and every screen fails; we shipped that config once.
  local api_url
  api_url="$(node -e "
    const p = require('./eas.json').build['$PROFILE'] ?? {};
    process.stdout.write((p.env && p.env.EXPO_PUBLIC_API_BASE_URL) || '');
  ")"
  if [ -z "$api_url" ]; then
    fail "eas.json profile '$PROFILE' has no EXPO_PUBLIC_API_BASE_URL — the app would call localhost on the tester's phone."
  elif [[ "$api_url" == *localhost* || "$api_url" == *127.0.0.1* ]]; then
    fail "profile '$PROFILE' points at $api_url — unreachable from a real device."
  else
    ok "API base URL: $api_url"
  fi

  # 2. Sentry's build phase fails the whole Xcode build without an org.
  local sentry_off
  sentry_off="$(node -e "
    const p = require('./eas.json').build['$PROFILE'] ?? {};
    process.stdout.write((p.env && p.env.SENTRY_DISABLE_AUTO_UPLOAD) || '');
  ")"
  local sentry_org
  sentry_org="$(node -e "
    const pl = require('./app.json').expo.plugins ?? [];
    const e = pl.find((x) => Array.isArray(x) && x[0] === '@sentry/react-native');
    process.stdout.write((e && e[1] && e[1].organization) || '');
  ")"
  if [ -n "$sentry_org" ]; then
    ok "Sentry org configured ($sentry_org) — source maps will upload"
  elif [ "$sentry_off" = "true" ]; then
    warn "Sentry source-map upload disabled — crash stack traces will be minified"
  else
    fail "Sentry has no organization AND upload is not disabled — the Xcode build will fail."
  fi

  # 3. EAS project id. Also what push notifications need to mint a token.
  local project_id
  project_id="$(node -e "
    const x = require('./app.json').expo.extra ?? {};
    process.stdout.write((x.eas && x.eas.projectId) || '');
  ")"
  if [ -n "$project_id" ]; then ok "EAS projectId: $project_id"
  else fail "No extra.eas.projectId in app.json — run: $EAS init"; fi

  # 4. Branding. Apple requires a 1024x1024 icon; Expo's placeholder ships
  #    silently if none is declared.
  local icon
  icon="$(node -p "require('./app.json').expo.icon ?? ''")"
  if [ -n "$icon" ] && [ -f "$icon" ]; then ok "App icon: $icon"
  else fail "No app icon declared in app.json — Expo's default placeholder would ship."; fi

  # 5. Store metadata. --strict makes WARNINGS fatal, which is what turns a
  #    placeholder privacy URL into a blocked release instead of a rejection
  #    two days later.
  if [ -d ./metadata ]; then
    if asc metadata validate --dir ./metadata --strict >/dev/null 2>&1; then
      ok "Store metadata valid (strict)"
    else
      bad "Store metadata not release-ready:"
      asc metadata validate --dir ./metadata --output table 2>&1 | sed 's/^/      /'
      FAILED=1
    fi
  else
    fail "No ./metadata directory — run: asc metadata pull --app APP_ID --version $VERSION --dir ./metadata"
  fi

  # 6. App Store Connect credentials.
  #
  #    Captured to a variable rather than piped into `grep -q`. Under
  #    `set -o pipefail` that pipeline reports FAILURE even on a match: grep
  #    exits at the first hit, asc dies of SIGPIPE, and the non-zero pipeline
  #    status inverts the test. The first version of this check said
  #    "credentials present" with no credentials on the machine — a safety
  #    check that silently passes is worse than no check at all.
  local doctor_out
  doctor_out="$(asc auth doctor 2>&1 || true)"
  case "$doctor_out" in
    *"No stored credentials found"*)
      fail "asc has no credentials — run: asc auth login --name musclex --key-id KEY --issuer-id ISSUER --private-key AuthKey.p8" ;;
    *)
      ok "asc credentials present" ;;
  esac

  # 7. The app record has to exist before anything can be uploaded to it.
  local apps_json
  if apps_json="$(asc apps list --output json 2>/dev/null)"; then
    case "$apps_json" in
      *"$BUNDLE_ID"*) ok "App record exists for $BUNDLE_ID" ;;
      *) fail "No App Store Connect app for $BUNDLE_ID — create it in App Store Connect first." ;;
    esac
  else
    warn "Could not list apps (not authenticated yet) — app-record check skipped"
  fi

  echo
  if [ "$FAILED" -eq 0 ]; then bold "Preflight passed."; else bold "Preflight FAILED — fix the ✗ items above."; return 1; fi
}

build() {
  preflight
  bold "Building (EAS, profile: $PROFILE)"
  $EAS build --platform ios --profile "$PROFILE" --non-interactive
}

testflight() {
  preflight
  bold "Uploading the latest build to TestFlight"
  # EAS submit hands the artifact to App Store Connect; asc then manages the
  # TestFlight side (groups, release notes), which EAS does not cover.
  $EAS submit --platform ios --profile "$PROFILE" --latest --non-interactive
  bold "Build state"
  asc status --app "$(app_id)" --output table || true
}

app_id() {
  asc apps list --output json 2>/dev/null \
    | node -e "
        let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
          const rows = JSON.parse(s);
          const list = Array.isArray(rows) ? rows : (rows.data ?? []);
          const hit = list.find((a) => JSON.stringify(a).includes('$BUNDLE_ID'));
          process.stdout.write(hit ? (hit.id ?? hit.appId ?? '') : '');
        });"
}

submit() {
  preflight
  local id; id="$(app_id)"
  [ -n "$id" ] || { bad "Could not resolve the App Store Connect app id."; exit 1; }

  bold "Validating release readiness"
  asc validate --app "$id" --version "$VERSION" --platform IOS --output table

  if [ "${1:-}" != "--confirm" ]; then
    echo
    bold "DRY RUN — nothing was submitted."
    asc release stage --app "$id" --version "$VERSION" \
      --metadata-dir "./metadata/version/$VERSION" --dry-run --output table
    echo
    echo "  Re-run with --confirm to submit for App Store review."
    return 0
  fi

  # The one irreversible step in this file. Apple reviewers see the app after
  # this; a mistake is a public artefact under your developer account, not a
  # local file you can delete.
  echo
  bold "About to SUBMIT $BUNDLE_ID v$VERSION for App Store review."
  read -r -p "  Type the version ($VERSION) to confirm: " typed
  [ "$typed" = "$VERSION" ] || { bad "Did not match — aborted."; exit 1; }

  asc release stage --app "$id" --version "$VERSION" \
    --metadata-dir "./metadata/version/$VERSION" --confirm --output table
  asc review submit --app "$id" --version "$VERSION" --platform IOS --confirm --output table
  asc status --app "$id" --output table
}

case "${1:-preflight}" in
  preflight)  preflight ;;
  build)      build ;;
  testflight) testflight ;;
  submit)     shift; submit "${1:-}" ;;
  *) echo "usage: $0 {preflight|build|testflight|submit [--confirm]}"; exit 2 ;;
esac
