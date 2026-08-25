#!/usr/bin/env bash
# Verify interactive design-system components on a booted simulator.
#
#   scripts/verify-interactive.sh
#
# Drives the real app through idb (accessibility layer) and asserts on the
# ACCESSIBILITY TREE, not on a screenshot.
#
# Two hard-won rules encoded here:
#
#  1. Do NOT use synthetic CGEvent/AppleScript clicks. They reach native UIKit
#     controls (the tab bar) but are never delivered to the React Native/Fabric
#     hierarchy, so <Button onPress> silently never fires. idb works.
#  2. Assert on a string that exists ONLY in the opened overlay. Asserting on
#     "Collect payment" produced a FALSE PASS, because that is also a button
#     label in the gallery's Buttons section.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="com.infynarc.musclex.staff"
IDB="$HERE/idb.sh"
SHOT="$HERE/sim-screenshot.sh"
FAILED=0

find_center() {
  "$IDB" ui describe-all 2>/dev/null | python3 -c "
import json,sys
want = sys.argv[1].lower()
try: els = json.load(sys.stdin)
except Exception: sys.exit(0)
for e in els:
    if want in (e.get('AXLabel') or '').lower() and e.get('frame'):
        f = e['frame']
        print(int(f['x']+f['width']/2), int(f['y']+f['height']/2)); break
" "$1"
}

has_label() { [ -n "$(find_center "$1")" ]; }

# Scroll until $1 sits in the visible band (clear of header and tab bar).
# Scrolls in BOTH directions: the element's reported y tells us which way to go.
# A one-directional scroll silently fails for anything already above the fold.
scroll_to() {
  local want="$1" c y
  for _ in $(seq 1 14); do
    c=$(find_center "$want"); y=$(echo "$c" | awk '{print $2}')
    if [ -z "$y" ]; then
      "$IDB" ui swipe 210 700 210 320 --duration 0.25 >/dev/null 2>&1 || true
    elif [ "$y" -ge 130 ] && [ "$y" -le 760 ]; then
      sleep 0.8; return 0
    elif [ "$y" -gt 760 ]; then
      "$IDB" ui swipe 210 700 210 320 --duration 0.25 >/dev/null 2>&1 || true
    else
      "$IDB" ui swipe 210 320 210 700 --duration 0.25 >/dev/null 2>&1 || true
    fi
    sleep 1
  done
  sleep 0.8
}

# Tap $1 until $2 appears. Retries because a tap issued while a scroll is still
# settling lands on stale coordinates and silently does nothing.
tap_until() {
  local trigger="$1" expect="$2" c
  for attempt in 1 2 3; do
    # Re-scroll every attempt: the gallery is long, and a target that was on
    # screen a moment ago may not be after a previous overlay closed.
    scroll_to "$trigger"
    c=$(find_center "$trigger")
    if [ -z "$c" ]; then echo "  ✗ trigger '$trigger' not found"; FAILED=1; return 1; fi
    # shellcheck disable=SC2086
    "$IDB" ui tap $c >/dev/null 2>&1 || true
    sleep 2
    if has_label "$expect"; then
      echo "  ✓ '$trigger' → '$expect' (attempt $attempt)"; return 0
    fi
  done
  echo "  ✗ '$trigger' did not produce '$expect' after 3 attempts"; FAILED=1; return 1
}

# Assert the element exists AND sits within the visible band. Presence alone is
# not enough for a bottom sheet: when closed it stays mounted just below the
# screen, so a bare "exists" check passes on a sheet that never opened.
expect_visible() {
  local c y; c=$(find_center "$1"); y=$(echo "$c" | awk '{print $2}')
  if [ -n "$y" ] && [ "$y" -ge 0 ] && [ "$y" -le 900 ]; then
    echo "  ✓ '$1' visible at y=$y"
  else
    echo "  ✗ '$1' not visible (y=${y:-none})"; FAILED=1
  fi
}

UDID=$(xcrun simctl list devices booted | grep -oE '\(([0-9A-F-]{36})\)' | head -1 | tr -d '()')
echo "→ relaunch $BUNDLE"
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
sleep 2; xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null; sleep 12

echo "→ navigate to the gallery"
tap_until "More, tab" "Design system" || true
tap_until "Design system" "BUTTONS" || true

echo "→ portal-backed overlays"
scroll_to "Dialog"
tap_until "Dialog"  "Mark paid"            # Dialog (asChild trigger)
"$SHOT" verify-dialog >/dev/null
"$IDB" ui tap 210 200 >/dev/null 2>&1 || true; sleep 1.5   # dismiss via scrim

scroll_to "Popover"
tap_until "Popover" "14 visits this month" # Popover (asChild trigger)
"$IDB" ui tap 210 200 >/dev/null 2>&1 || true; sleep 1.5

echo "→ disclosure"
scroll_to "Payment history"
tap_until "Payment history" "7,200"        # Accordion (non-asChild trigger)

echo "→ toast"
scroll_to "Success"
tap_until "Success" "Payment recorded"     # in-house toast on reanimated

echo "→ filter sheet"
# NOTE: the sheet's INNER content is not exposed in idb's accessibility tree,
# so asserting on "Clear 2 filters" FAILS on a sheet that is visibly open. The
# handle is exposed, and its y position distinguishes open from closed.
scroll_to "Filters ·"
sheet_btn=$(find_center "Filters ·")
# shellcheck disable=SC2086
[ -n "$sheet_btn" ] && "$IDB" ui tap $sheet_btn >/dev/null 2>&1 || true
sleep 2.5
expect_visible "Bottom sheet handle"
"$SHOT" verify-sheet >/dev/null

echo
if [ "$FAILED" -eq 0 ]; then echo "PASS — interactive components verified on device"; else echo "FAIL — see above"; fi
exit "$FAILED"
