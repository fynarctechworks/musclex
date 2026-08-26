#!/usr/bin/env bash
# Visit every screen and assert it actually RENDERED.
#
# verify-interactive.sh proves that dialogs, sheets and toasts work. It says
# nothing about whether a screen mounts at all — and when a rules-of-hooks
# mistake took the Sheet down, the harness reported "sheet did not open" while
# the device was showing a full-screen red "Render Error". A missing element
# and a crashed screen looked identical.
#
# This checks the other half: navigate somewhere, then assert that the dev
# client is NOT showing an error screen and that something expected is present.
#
#   staff-app/scripts/smoke-screens.sh
#
# Requires the app running and signed in as OWNER (the only role that can see
# every screen).
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
IDB="$HERE/idb.sh"
FAILED=0

tree() { "$IDB" ui describe-all 2>/dev/null; }

labels() {
  tree | python3 -c "
import json,sys
try: els=json.load(sys.stdin)
except Exception: sys.exit(0)
for e in els:
    l=(e.get('AXLabel') or '').strip()
    if l: print(l)
"
}

# A red-box render error puts these strings in the tree. Checked FIRST, because
# a crashed screen can still contain the label we were looking for.
assert_no_crash() {
  local where="$1" out
  out=$(labels)
  if echo "$out" | grep -qiE "Render Error|Rendered more hooks|is not a function|undefined is not an object|Console.*Error"; then
    echo "  ✗ $where CRASHED:"
    echo "$out" | grep -iE "Render Error|Rendered more hooks|is not a function|undefined is not an object" | head -3 | sed 's/^/      /'
    FAILED=1
    return 1
  fi
  return 0
}

expect() {
  local where="$1" want="$2" out
  assert_no_crash "$where" || return 1
  out=$(labels)
  if echo "$out" | grep -qF "$want"; then
    echo "  ✓ $where"
  else
    echo "  ✗ $where — expected '$want', not found"
    echo "$out" | head -6 | sed 's/^/      /'
    FAILED=1
  fi
}

tap() { "$HERE/tap-label.sh" "$1" >/dev/null 2>&1 || true; sleep "${2:-3}"; }

# Wait until a label appears, rather than sleeping a guessed number of seconds.
#
# Fixed sleeps made this script flaky in a way that looked like app bugs: the
# FIRST entry after opening More would intermittently fail because the tap
# landed mid-transition, and which entry failed changed between runs. A moving
# failure is almost always the harness, not the product.
wait_for() {
  local want="$1" n
  for n in $(seq 1 "${2:-12}"); do
    if labels | grep -qF "$want"; then return 0; fi
    sleep 0.5
  done
  return 1
}

# tap-label refuses anything outside the tappable band, so a More entry below
# the fold is silently never tapped — which is exactly how two screens
# "failed" on the first run of this script while being perfectly fine.
scroll_into_view() {
  local want="$1" y n
  for n in $(seq 1 10); do
    y=$(tree | python3 -c "
import json,sys
want=sys.argv[1]
try: els=json.load(sys.stdin)
except Exception: sys.exit(0)
for e in els:
    if (e.get('AXLabel') or '').strip()==want and e.get('frame'):
        f=e['frame']; print(round(f['y']+f['height']/2)); break
" "$want")
    [ -z "$y" ] && return 1
    if [ "$y" -ge 150 ] && [ "$y" -le 800 ]; then return 0; fi
    # Slow drag, never a flick: a flick overshoots by ~1000pt.
    if [ "$y" -gt 800 ]; then "$IDB" ui swipe 210 700 210 400 --duration 1.1 >/dev/null 2>&1
    else "$IDB" ui swipe 210 400 210 700 --duration 1.1 >/dev/null 2>&1; fi
    sleep 0.6
  done
  return 1
}

back() { tap "Back" 2; }

echo "→ smoke: every screen mounts"

tap "Home, tab" 4;      expect "Home"        "MuscleX Test Gym"
tap "Members, tab" 4;   expect "Members"     "Members"
tap "Check-in, tab" 3;  expect "Check-in"    "Check-in"
tap "Money, tab" 4;     expect "Money"       "Money"

# NOT "Reports, tab": which tabs exist depends on the ROLE. Reports is 8th in
# CANDIDATE_TABS, so an owner (whose four slots are taken by earlier
# candidates) reaches it through More, while an accountant gets it as a tab.
# Asserting a fixed tab bar tests the fixture, not the app.

tap "More, tab" 4;      expect "More"        "Sign out"

# Each entry with something only THAT screen renders. A generic "Back" was the
# first attempt and gave two false failures: Schedule and POS are TAB routes
# reached through More, so they have no back button while being perfectly fine.
ENTRIES=(
  "Schedule|Dots mark days with activity"
  "Shop / POS|Shop"
  "PT sessions|Upcoming"
  "Staff|Everyone"
  "Expenses|Record an expense"
  "Inventory|Needs attention"
  "Training|Plans"
  "Reports|MRR"
  "Memberships|Membership plans"
)

for pair in "${ENTRIES[@]}"; do
  entry="${pair%%|*}"
  want="${pair##*|}"
  tap "More, tab" 1
  # Wait for More itself to settle before hunting for a row in it.
  wait_for "Sign out" || true
  if ! scroll_into_view "$entry"; then
    echo "  ✗ More → $entry — entry not present in More at all"
    FAILED=1
    continue
  fi
  tap "$entry" 1
  wait_for "$want" || true
  expect "More → $entry" "$want"
  back
done

echo
if [ "$FAILED" -eq 0 ]; then
  echo "PASS — every screen mounted without a render error"
else
  echo "FAIL — see above"
  exit 1
fi
