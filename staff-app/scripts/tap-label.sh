#!/usr/bin/env bash
# Tap the on-screen element whose accessibility label matches $1.
#
# An EXACT label match always wins over a substring one. This is not a nicety:
# matching "Allow" by substring picks "Don't Allow" if it comes first in the
# tree, which is how a camera-permission prompt got silently denied and then
# misread as an app bug.
#
#   scripts/tap-label.sh "Members, tab"
#
# Exists because reading coordinates out of `idb ui describe-all` and passing
# them through the shell repeatedly hit word-splitting bugs ("invalid int value:
# '210 853'"). Labels are also stable across layout changes; coordinates are not.
set -euo pipefail

WANT="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"

read -r X Y < <("$HERE/idb.sh" ui describe-all 2>/dev/null | python3 -c "
import json, sys
want = sys.argv[1].lower()
try: els = json.load(sys.stdin)
except Exception: sys.exit(0)
exact, partial = [], []
for e in els:
    lab = (e.get('AXLabel') or '').strip()
    f = e.get('frame') or {}
    if not lab or not f:
        continue
    y = f['y'] + f['height'] / 2
    # Skip anything off-screen: it reports a real frame but will not respond.
    if not (0 <= y <= 900):
        continue
    point = (int(f['x'] + f['width'] / 2), int(y))
    low = lab.lower()
    if low == want:
        exact.append(point)
    elif want in low:
        partial.append(point)

hit = (exact or partial)
if hit:
    print(hit[0][0], hit[0][1])
" "$WANT") || true

if [ -z "${X:-}" ]; then echo "no visible element matching '$WANT'" >&2; exit 1; fi
"$HERE/idb.sh" ui tap "$X" "$Y" >/dev/null
echo "tapped '$WANT' at ($X,$Y)"
