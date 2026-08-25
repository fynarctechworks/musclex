#!/usr/bin/env bash
# Thin wrapper around idb for driving the booted simulator.
#
#   scripts/idb.sh ui describe-all      # accessibility tree (JSON array)
#   scripts/idb.sh ui tap <x> <y>       # tap at DEVICE POINTS (not pixels)
#
# Why idb rather than synthetic mouse clicks: scripted CGEvent/AppleScript
# clicks reach native UIKit controls (the tab bar) but are NOT delivered to the
# React Native/Fabric hierarchy — a plain <Button onPress> never fires. idb
# drives the app through the accessibility layer, which does work.
#
# NOTE: `--udid` is a PER-SUBCOMMAND flag in idb, not a global one, so it is
# appended after the subcommand rather than placed before it.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
IDB="$HERE/../.tools/idb-venv/bin/idb"
[ -x "$IDB" ] || { echo "idb client missing — see README (staff-app/.tools/idb-venv)" >&2; exit 1; }

UDID=$(xcrun simctl list devices booted | grep -oE '\(([0-9A-F-]{36})\)' | head -1 | tr -d '()')
[ -z "$UDID" ] && { echo "No booted simulator." >&2; exit 1; }

exec "$IDB" "$@" --udid "$UDID"
