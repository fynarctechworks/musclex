#!/usr/bin/env bash
# Tap the first on-screen element whose accessibility label CONTAINS $1.
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
for e in els:
    lab = (e.get('AXLabel') or '').lower()
    f = e.get('frame') or {}
    if want in lab and f:
        y = f['y'] + f['height'] / 2
        # Skip anything off-screen: it reports a real frame but will not respond.
        if 0 <= y <= 900:
            print(int(f['x'] + f['width'] / 2), int(y)); break
" "$WANT") || true

if [ -z "${X:-}" ]; then echo "no visible element matching '$WANT'" >&2; exit 1; fi
"$HERE/idb.sh" ui tap "$X" "$Y" >/dev/null
echo "tapped '$WANT' at ($X,$Y)"
