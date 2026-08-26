# MuscleX Staff — design system

Captured from the live app on 2026-08-27 (iPhone Air simulator, iOS 26.5), so
every screenshot is the real rendered component, not a mockup.

Screens are in [`screens/`](screens/); the gallery itself is
`staff-app/src/ui/Gallery.tsx`, reachable in a dev build via **More → Design
system (dev)**.

---

## ⚠️ Read this before porting it to member-app

The staff app's palette is a deliberate mirror of **`frontend/`** (the web admin
app), and it deliberately does **not** use MuscleX red for primary actions. From
`staff-app/src/global.css`:

> `--color-primary = ink (#171717)`, the single primary CTA colour
> `--color-destructive = error red (#ee0000)`, reserved for destructive actions
>
> Mapping primary to MuscleX red instead makes "Collect payment" and "Delete"
> the same colour, and "Active" and "Overdue" the same badge. In an app that
> takes payments and deletes members, those must never be indistinguishable.

member-app's own system says the opposite, on purpose — one saturated brand
accent (`#E10600`) carrying every action, on a faintly grey canvas, with a
four-step ink ladder tuned for contrast against that canvas.

**So "use this for the member app" is a real product decision, not a copy-paste.**
Adopting this system wholesale would take the brand red out of every primary
action in the consumer app and make it monochrome ink-on-white — which is right
for a back-office tool used eight hours a day, and is a much bigger question for
an app someone opens to log a workout.

Three honest options:

1. **Adopt the components, keep member-app's palette.** Port the component
   layer (RNR + uniwind + the `src/ui/*` patterns below) and re-point the token
   values at member-app's existing colours. You get one component vocabulary
   across both apps without repainting the consumer product. **This is the one
   I would pick** unless you specifically want the two apps to look identical.
2. **Adopt both, wholesale.** One visual language across staff and member.
   Costs member-app its brand accent; gains total consistency.
3. **Adopt tokens only.** Cheapest, and the least useful — the value here is in
   the components and the patterns, not the eight hex values.

Whichever you pick, the port is real work: member-app has **no uniwind or
Tailwind at all** (plain `StyleSheet` + `theme.ts`), so adopting the component
layer means adding that toolchain first.

---

## Colour tokens

`staff-app/src/global.css` is the single source of truth.
`staff-app/src/ui/tokens.ts` mirrors eight of them for React Native APIs that
demand a colour string, and `src/__tests__/tokens.test.ts` parses the CSS and
fails if the two drift.

| Token | Value | Role |
|---|---|---|
| `--color-background` | `#fafafa` | Page canvas |
| `--color-foreground` | `#171717` | Body ink |
| `--color-card` | `#ffffff` | Card surface |
| `--color-primary` | `#171717` | **The single primary CTA** |
| `--color-primary-foreground` | `#ffffff` | |
| `--color-secondary` | `#f5f5f5` | Secondary button fill |
| `--color-muted` | `#f5f5f5` | Inset wells |
| `--color-muted-foreground` | `#888888` | Secondary text |
| `--color-destructive` | `#ee0000` | **Destructive only** |
| `--color-success` | `#2eb87a` | Membership active |
| `--color-warning` | `#f5a623` | Expiring soon |
| `--color-border` | `#ebebeb` | Hairline |
| `--color-ring` | `#171717` | Focus ring |

`success` and `warning` are not stock shadcn; they exist because the product
needs membership-active and expiring-soon states.

**Radii:** `--radius-sm 6px` · `--radius-md 8px` · `--radius-lg 12px`

### member-app's palette, for comparison

From `member-app/src/ui/theme.ts` — different values *and* a different
philosophy (light-first, one saturated accent, a strict four-step ink ladder).

| Role | staff-app | member-app |
|---|---|---|
| Canvas | `#fafafa` | `#F5F5F7` |
| Card | `#ffffff` | `#FFFFFF` |
| Primary action | `#171717` (ink) | `#E10600` (MuscleX red) |
| Destructive | `#ee0000` | `#E10600` — the same accent |
| Body ink | `#171717` | `#101014` |
| Secondary text | `#888888` | `#4C4C57` / `#6F6F7B` |
| Hairline | `#ebebeb` | `#E3E3E9` |
| Success | `#2eb87a` | `#11823B` |
| Warning | `#f5a623` | `#A36108` |

member-app's semantic hues are darker because they were tuned to pass 4.5:1 as
**text** on `#F5F5F7`, not merely as fills. If you port staff-app's values into
member-app, re-check contrast — `#2eb87a` as a label on a light canvas does not
clear AA.

---

## Component inventory

**Primitives** — React Native Reusables, in `staff-app/src/components/ui/`:

`accordion` · `alert` · `alert-dialog` · `aspect-ratio` · `avatar` · `badge` ·
`button` · `card` · `checkbox` · `collapsible` · `context-menu` · `dialog` ·
`dropdown-menu` · `icon` · `input` · `label` · `popover` · `progress` ·
`radio-group` · `select` · `separator` · `skeleton` · `switch` · `tabs` ·
`text` · `textarea` · `toggle` · `toggle-group` · `tooltip`

**Product components** — built here, in `staff-app/src/ui/`:

| Component | What it is for |
|---|---|
| `RowCard` | The table replacement. A whole row is one touch target. |
| `DataList` | List with empty/error/loading states built in |
| `StatTile` | The KPI tile on every dashboard |
| `Meter` | Progress / occupancy bar |
| `SegmentedControl` | Today / Week / Month style switching |
| `Sheet` | Bottom sheet for filters and short forms |
| `SwipeActions` | Reveal-only; never auto-fires a destructive action |
| `Toast` | Transient feedback, 2.5s success / 5s error / 3s info |
| `States` | `EmptyState` / `ErrorState` / offline |
| `StaleBanner` | "Showing data from 9:05 am" when offline |
| `DatePicker` | Date and time entry |
| `ScheduleCalendar` | Month grid with activity dots |
| `Loading` | Skeleton placeholders |
| `Placeholder` | Not-built-yet / coming-soon rows |

**Seven primitives render through a portal** (dialog, alert-dialog, select,
dropdown-menu, popover, context-menu, tooltip) and mount nothing without a
`<PortalHost />` in the root layout. The failure is silent — the trigger
presses and no overlay appears — so carry that over with them.

---

## Screenshots

| File | Sections |
|---|---|
| `screens/00-top.png` | Typography · Buttons · Badges · Card |
| `screens/01.png` – `screens/14.png` | Form controls, Feedback, Interactive, Disclosure, Metrics, Charts, Segmented control, Row card, Empty/error/offline, Toast, Swipe actions, Filter sheet, Date & time, Calendar, Loading |
| `screens/overlay-dialog.png` | Dialog, open |
| `screens/overlay-alert-dialog.png` | Destructive confirm, open |
| `screens/overlay-filter-sheet.png` | Bottom sheet, open |
| `screens/overlay-toast.png` | Success toast |

Overlay states had to be triggered individually because they render into a
portal and do not appear in a static scroll.

---

## Rules worth carrying over

These are the load-bearing ones — the decisions that would be easy to lose in a
port and expensive to rediscover.

1. **Primary is ink; red is destructive.** Never let the pay button and the
   delete button be the same colour. (If member-app keeps red as its accent,
   it needs a *different* answer to this problem — not this one.)
2. **A whole row is the touch target.** A 6" screen has no room for a tap
   target inside a tap target.
3. **Swipe reveals, never fires.** A destructive action always takes a second,
   deliberate tap.
4. **Every list has an empty, an error and a loading state**, and they are
   components, not ad-hoc JSX.
5. **Offline is a first-class state**, with the timestamp of what you are
   looking at — not a spinner and not a lie.
6. **Portal-backed overlays need a `PortalHost`.** No host, no overlay, no
   error.
