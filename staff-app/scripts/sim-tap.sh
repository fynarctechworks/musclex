#!/usr/bin/env bash
# Tap the booted simulator at DEVICE pixel coordinates.
#
#   scripts/sim-tap.sh <deviceX> <deviceY>
#
# Reads the Simulator window's position and size on EVERY call. This matters:
# the window can be moved at any time, and stale coordinates silently click the
# desktop instead — which looks exactly like "the tap did nothing".
#
# Device pixel size is taken from a live screenshot, so this works on any
# simulator without hardcoding a device.
set -euo pipefail

DEVX="$1"; DEVY="$2"
UDID=$(xcrun simctl list devices booted | grep -oE '\(([0-9A-F-]{36})\)' | head -1 | tr -d '()')
[ -z "$UDID" ] && { echo "No booted simulator." >&2; exit 1; }

TMP=$(mktemp -t simshot).png
xcrun simctl io "$UDID" screenshot "$TMP" >/dev/null 2>&1
PXW=$(sips -g pixelWidth  "$TMP" | awk '/pixelWidth/{print $2}')
PXH=$(sips -g pixelHeight "$TMP" | awk '/pixelHeight/{print $2}')
rm -f "$TMP"

read -r WX WY WW WH < <(osascript -e 'tell application "System Events" to tell process "Simulator" to return {position, size} of window 1' | tr ',' ' ')

SX=$(python3 -c "print(int($WX + $DEVX * $WW / $PXW))")
SY=$(python3 -c "print(int($WY + $DEVY * $WH / $PXH))")

osascript >/dev/null <<OSA
tell application "Simulator" to activate
delay 0.5
tell application "System Events" to click at {$SX, $SY}
OSA
echo "tapped device($DEVX,$DEVY) -> screen($SX,$SY)  [win ${WX},${WY} ${WW}x${WH}; px ${PXW}x${PXH}]"
