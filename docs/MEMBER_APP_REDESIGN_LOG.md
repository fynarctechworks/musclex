# Member-app redesign — session log (2026-08-28)

Screen-by-screen record of the autonomous session. Newest first.

Baseline at start: 11 of 68 screens migrated, 57 files still importing
`src/ui/theme`. 304 tests passing, `tsc` clean.

## Changelog

_(appended as each slice lands)_
### Phase 1 — `src/features` + shared `src/ui` (COMPLETE)

Nothing under `src/features` imports `src/ui/theme` any more. Done first
because these render *inside* already-redesigned screens, so they were the
visible mixed-styling rather than a future problem.

| Component | Note |
|---|---|
| `PendingBanner` | straight port |
| `RestTimer` | **surface changed**: `surface2` → `bg-card`. It floats above content; an inset well was wrong |
| `Sparkline` | **a11y fix**: `WeekDots` active days were colour-only, so a screen reader read seven identical day initials |
| `ExerciseBlock` | the app's most-repeated surface. Logging behaviour ported byte-identical; column widths kept inline as one shared `COL` const so header and rows cannot drift |
| `StepsCard` | straight port |
| `ExercisePicker` | 618 lines, the largest. Both sheets now share a `SHEET` const |
| `InfoTip`, `Notice` | shared deps, migrated to unblock the above |
| `BodyMap`, `Heatmap`, `RouteShape`, `FormChart`, `ActivityChart`, `TileLayer` | see below |

**New file: `src/ui/chart-colors.ts`.** The charts could not migrate the way
screens did — `react-native-svg`'s `fill`/`stroke` are node props that never
reach the class engine, and `Meter`'s `tint` is picked per-macro from data. So
the tokens are mirrored as typed strings in one module rather than each chart
re-deciding what red means. `global.css` stays the source of truth and the new
file documents that it is a mirror.

**Deliberate visual change:** column headers and section labels are now sentence
case, not uppercase, following the `Label` convention already in the design
system ("STREAK / FUEL stacked down a screen added noise and no information").

Commits: `9a9b80e`, `9914675`, `87466e8`, `607b9e0`. 304 tests green, `tsc` clean at each.

### Phase 2 — the five Train-adjacent screens (COMPLETE)

The visible edge of the redesign: these are one tap from the Train tab, so
before this the app changed visual identity mid-flow.

| Screen | Note |
|---|---|
| `routines` | **redesigned, not just migrated** — see below |
| `routine-edit` | 483 lines. Markup only; `toSets`, `fillGaps` and the unit round-trip untouched. Arrow/cross glyphs became real SF Symbols |
| `training` | `Stat` and `FormChart` now read one palette, so the key and its line cannot drift |
| `plan` | straight port |
| `coach` | bubbles take `text-primary-foreground`; verified `twMerge` really drops `Txt`'s own `text-foreground`, or the text would be dark-on-red |

Also migrated `ScreenHeader` and `Chip` (needed by every non-tab screen), and
added `share`/`edit`/`trash`/`more`/`up`/`down` to the icon set.

**The one real design change: My routines.** Start, Edit, Share and Delete used
to sit in one row at equal weight — the action a member came for was the same
size as the one that destroys the routine. Start now owns the card; the rest sit
behind a disclosure. Same four actions, ranked.

**Tests: `app/` screens now have some.** They had none. 311 total, up from 304.
The two new files pin the things worth pinning: that Start routes to
`/session?routine=<id>` (the exact wire that opened an empty workout last week),
and that an old uniform `3 x 10` routine still expands into three editable rows.

⚠️ **Harness note for whoever writes the next screen test:** a `fireEvent.press`
that changes state must be wrapped in `await act(...)`, or the assertion reads
the pre-press tree. I lost time treating this as a bug in my own screen; it
reproduces on a three-line Pressable, so it is RNTL here, not the code.

Commits: `bc29666`, `8246e7b`, `a2c9179`.

**Remaining: 41 files still on `src/ui/theme`** (was 57).
