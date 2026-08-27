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

### Phase 3 — Community depth (COMPLETE)

`feed`, `friends`, `people`, `clubs`, `challenges`, `gym-challenges`,
`activities`, `heatmap`, `dm/index`, `dm/[id]` — every screen the Community tab
reaches.

**New: `src/ui/Field.tsx`.** Eighteen screens had each hand-rolled the same text
input, with the placeholder colour written out as a literal eighteen times, and
heights already drifted between 42 and 50 for no reason anyone chose.
`placeholderTextColor` is why it has to be a component and not a class — RN
takes it as a prop.

**Deliberately kept different:** the coach thread FILLS its own bubbles; the DM
thread TINTS them. A reply to the coach is read one at a time; person-to-person
messages are read in long runs, where a column of solid red is tiring. Both now
carry a comment, because otherwise the difference looks like drift.

### Phase 4 — You-tab depth (COMPLETE)

`body`, `calendar`, `photos`, `membership`, `visits`, `referral`, `tools`,
`settings/goals`, `settings/profile`.

**Two real de-duplications, not restyles:**
- `goals` and `profile` had each hand-rolled a pill toggle that was line-for-line
  the existing `Chip` — same height, radius, selected treatment, and
  `accessibilityRole="radio"`. Both now use it.
- `profile` carried a local `input` style object; `Field` replaces it.

The calendar's month pager was a `‹` / `›` text pair and is now circled
chevrons — deliberately not the bare `chevron` already in the set, which is the
list affordance. The day cell keeps an inline style, with a note: its fill, ring
and opacity are all derived from that day's own data.

Commits: `959ff19`, `987125d`, `969f1bb`.

**22 files still on `src/ui/theme`** (from 57 at session start).

### Phase 5 — everything else (COMPLETE)

`onboarding`, `classes`, `gyms`, `messages`, `scan`, both `explore` routes, the
share-link route, all eight detail routes (`activity/[id]`, `activity/new`,
`challenge/[id]`, `chat/[trainerId]`, `club/[id]`, `exercise/[id]`,
`friend/[id]`, `person/[id]`), the root layout, and the two dev route shells.

`onboarding` is worth calling out: it is the first screen a new member ever
sees, was still entirely on the old surface, and does not appear in any
"one tap from a tab" list because no tab links to it. Its `Choice` rows stay
full-width rather than becoming `Chip`s — they are the only thing on the step
and reading down a column is the point.

**New: `Badge` in `src/ui`.** The unread count was hand-drawn in both `messages`
and `dm/index`. The number is the whole message there, so it now carries its own
accessible label instead of relying on the fill.

**Three message threads, deliberately two treatments.** Coach and the trainer
chat FILL their bubbles; member-to-member DMs TINT them. A trainer or coach
exchange is read a message at a time; peer DMs are read in long runs where a
column of solid red is tiring. All three now say so in a comment, because
otherwise it looks like drift.

### `theme.ts` is retired

`levelColor` / `levelLabel` were the last live callers and moved to
`chart-colors` — they belong together, since a colour meaning "busy" is useless
without the word that says so.

`src/ui/theme.ts` is now imported by exactly three files: `(tabs)/gym.tsx`,
`me.tsx` and `progress.tsx`. **All three are registered `href: null` and
unreachable.** Nothing a member can navigate to reads it. See TODO_FOR_ME.md M3
before deleting them — two are safe, `progress` is still linked from You.

### Testing

`app/` screens had **no** tests at session start. They now have three files:

- `routines-screen` — pins that Start routes to `/session?routine=<id>`, the
  exact wire that opened an empty workout last week
- `routine-edit-screen` — pins that an old uniform `3 x 10` still expands into
  three editable rows, and that `fillGaps` sends `[12, 10, 10]`
- `screens-render` — mounts all 32 migrated screens against EMPTY data, the
  state a new member is in and the one most likely to hit an unguarded `.map`

**The smoke test was checked for vacuousness:** breaking `clubs.tsx` on purpose
failed exactly that case and no other, and the file was restored byte-identical.

**343 tests green, from 304.** `tsc` clean throughout.

⚠️ **Harness note:** `fireEvent.press` that changes state needs `await act(...)`
in this repo's RNTL, or the assertion reads the pre-press tree.

### Audited at the end

- No className collisions, empty classNames, or `style={{}}` left by the passes
- No `accessibilityLabel` lost anywhere. The one file that showed a drop
  (`routine-edit`) was a deliberate swap to `accessibilityElementsHidden` on a
  thumbnail whose name renders beside it
- Every colour class used resolves to a token defined in `global.css`
