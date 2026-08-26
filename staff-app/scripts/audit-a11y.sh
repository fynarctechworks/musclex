#!/usr/bin/env bash
# Audit the CURRENT screen's accessibility tree for touch targets that are too
# small to hit reliably.
#
#   staff-app/scripts/audit-a11y.sh
#
# Apple's HIG puts the minimum at 44x44pt. Below that, people with any tremor,
# larger fingers, or a phone in one hand on a gym floor start missing — and a
# staff app is used standing up, one-handed, in a hurry.
#
# Reports rather than fails: some small elements are decorative and correctly
# not interactive, so this needs a human read.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

"$HERE/idb.sh" ui describe-all 2>/dev/null | python3 -c "
import json, sys
try: els = json.load(sys.stdin)
except Exception:
    print('could not read the accessibility tree'); sys.exit(1)

MIN = 44
INTERACTIVE = {'Button', 'Link', 'TabBar', 'SegmentedControl', 'TextField', 'SearchField'}

small = []
for e in els:
    f = e.get('frame') or {}
    label = (e.get('AXLabel') or '').strip()
    role = (e.get('role_description') or e.get('AXRole') or '')
    w, h = f.get('width', 0), f.get('height', 0)
    if not label or w == 0 or h == 0:
        continue
    # Only judge things that look interactive: everything else is text.
    looks_interactive = any(k.lower() in str(role).lower() for k in INTERACTIVE)
    if not looks_interactive:
        continue
    if w < MIN or h < MIN:
        small.append((label[:44], round(w), round(h)))

print(f'interactive elements below {MIN}pt: {len(small)}')
for lab, w, h in small[:20]:
    print(f'  {w}x{h}  {lab}')
"
