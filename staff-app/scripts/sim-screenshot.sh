#!/usr/bin/env bash
# Screenshot the app running on a booted iOS Simulator.
#
#   staff-app/scripts/sim-screenshot.sh <name> [more names...]
#
# Unlike scripts/screenshot.mjs (which renders the WEB build in Chromium), this
# captures the real native app: uniwind classes resolved to RN styles by the
# Metro transformer, real fonts, real safe-area insets. That is the only place
# those are actually exercised.
#
# Requires the app already running on a booted simulator.
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/.screenshots"
mkdir -p "$OUT"

BOOTED=$(xcrun simctl list devices booted | grep -oE '\(([0-9A-F-]{36})\)' | head -1 | tr -d '()')
if [ -z "$BOOTED" ]; then echo "No booted simulator." >&2; exit 1; fi

for name in "$@"; do
  xcrun simctl io "$BOOTED" screenshot "$OUT/sim-$name.png" >/dev/null 2>&1
  echo "✓ .screenshots/sim-$name.png"
done
