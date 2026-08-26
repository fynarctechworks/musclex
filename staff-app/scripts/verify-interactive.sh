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
# Exact match wins over substring, for the same reason tap-label.sh does it:
# 'Allow' would otherwise find the Don-t-Allow button, and 'Dialog' would find
# 'Alert Dialog'. (No double quotes in here: this whole block is inside a
# double-quoted shell string.)
exact, partial = [], []
for e in els:
    lab = (e.get('AXLabel') or '').strip()
    f = e.get('frame')
    if not lab or not f:
        continue
    point = (int(f['x']+f['width']/2), int(f['y']+f['height']/2))
    low = lab.lower()
    if low == want: exact.append(point)
    elif want in low: partial.append(point)
hit = exact or partial
if hit:
    print(hit[0][0], hit[0][1])
" "$1"
}

has_label() { [ -n "$(find_center "$1")" ]; }

# Scroll until $1 sits in the visible band (clear of header and tab bar).
# Scrolls in BOTH directions: the element's reported y tells us which way to go.
# A one-directional scroll silently fails for anything already above the fold.
# A slow DRAG, not a flick.
#
# A fast swipe imparts momentum: a 500pt gesture scrolls ~1000pt and sails past
# whatever it was aiming for, so the scan oscillates and never lands. Dragging
# over 1.1s moves roughly the gesture distance and nothing more, which is what
# a search loop needs. (Widening the flick is what broke the Dialog step after
# it fixed the filter-sheet one — coarser steps trade one miss for another.)
drag() {
  "$IDB" ui swipe 210 "$1" 210 "$2" --duration 1.1 >/dev/null 2>&1 || true
}

scroll_to() {
  local want="$1" c y
  # The gallery has grown; give the scan enough room to traverse it.
  for _ in $(seq 1 26); do
    c=$(find_center "$want"); y=$(echo "$c" | awk '{print $2}')
    if [ -z "$y" ]; then
      drag 700 320
    elif [ "$y" -ge 130 ] && [ "$y" -le 760 ]; then
      sleep 0.6; return 0
    elif [ "$y" -gt 760 ]; then
      drag 700 320
    else
      drag 320 700
    fi
    sleep 0.5
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

# ── The gallery this harness drove no longer exists ─────────────────────────
#
# Every check below reaches its component through the design-system gallery,
# and that route was removed so it could not ship to the App Store (see
# src/ui/Gallery.tsx). Without it there is nothing here to tap.
#
# This exits rather than carrying on, because every step below ends in
# `|| true`: left as it was, this script would sail past a dozen no-op taps and
# print "PASS — interactive components verified on device" having verified
# nothing at all. A harness that passes while doing nothing is worse than one
# that is switched off, because only one of the two lies to you.
#
# To bring it back, either re-add app/gallery.tsx locally for the run, or
# re-point each check at a real screen that uses the component.
cat <<'EOF'
verify:ui is out of service.

  It drove the design-system gallery, and that route was deleted so it could
  not ship in the App Store build. The overlay checks (dialog, popover,
  accordion, toast, sheet) have no target any more.

  Options:
    1. Re-add app/gallery.tsx locally for the run, then delete it again.
    2. Re-point each check at a real screen that uses the component.

  The component-mount coverage is NOT lost: src/__tests__/gallery.test.tsx
  still mounts every primitive in one render, and runs in `npm test`.
EOF
exit 2

echo "→ navigate to the gallery"

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
