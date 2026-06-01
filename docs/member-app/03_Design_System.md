# Design System — Member App

> The documented design language. **Grounded in the real tokens already in code**
> (`gym-member-app/src/design-system/tokens.ts` + `tailwind.config.js`), not invented values.
> Source of truth for raw values remains `tokens.ts`; this doc explains *how and why* to use them.

Design DNA: **dark-first, Vercel/Geist-inspired** (per `docs/design.md`), adapted to a fitness habit app.
Principle: *the gradient is the entire decoration system* — restraint everywhere else.

---

## 1. Foundations

### 1.1 Color (from `tokens.ts`)
Dark-first. Light mode is a planned inversion of the same roles, not a separate palette.

| Role | Token | Value | Use |
|---|---|---|---|
| Canvas | `canvas` | `#0A0A0A` | App background |
| Canvas soft | `canvasSoft` | `#121212` | Sectioned background |
| Surface | `surface` | `#171717` | Cards |
| Surface 2 | `surface2` | `#1F1F1F` | Raised/nested cards |
| Hairline | `hairline` | `#2A2A2A` | Borders (the primary "edge", not shadow) |
| Ink | `ink` | `#FAFAFA` | Primary text |
| Body | `body` | `#A1A1A1` | Secondary text |
| Mute | `mute` | `#6E6E6E` | Tertiary / disabled |
| Accent | `accent` | `#0070F3` | Interactive, focus, links |
| Success | `success`/`successFg` | `#0070F3`/`#3291FF` | Positive |
| Warning | `warning` | `#F5A623` | Expiry, caution |
| Error | `error` | `#FF4D4D` | Destructive, failures |
| Cyan | `cyan` | `#50E3C2` | Accent highlight (charts, streaks) |

**Semantic mapping for fitness context:**
- Streaks / "on track" → `cyan` + `accent`.
- Membership expiring soon → `warning`; expired → `error`.
- PRs / achievements → mesh gradient (hero moments only).

### 1.2 The mesh gradient (the one decoration)
`tokens.ts → meshGradient`. Multi-stop sweep (`#007CF0 → #00DFD8 → #7928CA → #FF0080 → #FF4D4D → #F9CB28`).

**Rules (do not violate):**
- Used at **hero scale only**: Home header backdrop, check-in success, onboarding, PR celebration.
- **Never** miniaturized into icons, never flattened to one color, never on body content.
- It is the emotional payoff of the app — spend it on moments that deserve celebration.

### 1.3 Radius (`tokens.ts → radius`)
`xs 4 · sm 6 · md 8 · lg 12 · xl 16 · 2xl 20 · pill 100 · full`.
- Cards: `xl` (16). Inputs/buttons: `md`–`lg`. Pills/chips/avatars: `pill`/`full`.
- Consistency rule: a screen uses **at most two** radii. Rounded, soft, never sharp.

### 1.4 Spacing (`tokens.ts → space`, 4-pt base)
`xxs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · 2xl 40 · 3xl 48 · 4xl 64 · 5xl 96`.
- Default screen padding: `lg` (24). Card padding: `md`–`lg`. Between sections: `xl`–`2xl`.
- Generous whitespace is a feature — it's what makes it feel premium, not cluttered.

### 1.5 Elevation (`tokens.ts → elevation`)
Three levels only: `card`, `float`, `modal`. Soft, stacked-feel shadows — **never a single heavy drop**.
On dark UI, **prefer hairline borders over shadow** to separate surfaces; reserve `float`/`modal` for
truly floating elements (the QR button, bottom sheets, dialogs).

### 1.6 Typography
Geist voice = large headings with **aggressive negative tracking** (`tokens.ts → tracking`:
`displayXl -1.6 … displaySm -0.4`).

| Style | Use | Tracking |
|---|---|---|
| Display XL | Hero numbers (streak count, weight) | `-1.6` |
| Display LG/MD | Screen titles, greeting | `-1.0`/`-0.7` |
| Title | Card titles | `-0.4` |
| Body | Content | `~0` |
| Caption/Mute | Labels, meta | `body`/`mute` color |

Rules: big, readable, comfortable. Large touch targets. Numbers (reps, weight, calories) get the
display treatment — data *is* the hero in a fitness app.

---

## 2. Component library (primitives already in `src/design-system/`)

These exist in code — document and standardize, don't reinvent:

| Primitive | File | Role | Key states |
|---|---|---|---|
| `Text` | Text.tsx | All typography (variant prop) | — |
| `Button` | Button.tsx | Actions | default / pressed / loading / disabled |
| `Card` | Card.tsx | Surface container | flat / raised |
| `Input` | Input.tsx | Text entry (minimize its use!) | default / focus / error |
| `Badge` | Badge.tsx | Status, counts | neutral / success / warning / error |
| `Icon` | Icon.tsx | Iconography | — |
| `Skeleton` | Skeleton.tsx | Loading placeholders | shimmer |
| `Stepper` | Stepper.tsx | Numeric +/- (reps/sets) | — |
| `Screen` | Screen.tsx | Screen scaffold (safe area, padding, scroll) | — |
| `MeshGradient` | MeshGradient.tsx | The hero gradient | hero only |

### Composite components to define (Phase 1)
Built *from* the primitives above:
- **StatCard** — big number + label + trend (Home/Progress).
- **WorkoutSetRow** — exercise set with swipe-to-complete + Stepper (one-thumb logging).
- **OccupancyCard** — live gym fullness (exists in `features/home/`).
- **MembershipStrip** — status + expiry with urgency color.
- **StreakRing** — activity/streak ring (charts use `cyan`/`accent`).
- **EmptyState** — illustration + message + fallback action (for the "no plan assigned" case).

---

## 3. Motion & feedback

| Element | Spec |
|---|---|
| Transitions | Smooth, 200–300ms ease; respect `prefers-reduced-motion` |
| Haptics | On check-in success, set complete, PR hit (celebration), destructive confirm |
| Loading | Skeletons (never blocking spinners on full screens) |
| Pull-to-refresh | On Home / lists |
| Celebration | Mesh + haptic + confetti-restraint on PR / streak milestone / successful check-in |

Motion is feedback, not decoration. Every animation must communicate state or reward an action.

---

## 4. Interaction laws (one-thumb, low-typing)

These are the design rules that make it feel like Cult/Samsung Health, not a form:

1. **One-thumb reachability** — primary actions in the bottom 2/3 of the screen.
2. **Minimize typing** — Steppers, chips, presets, swipes over keyboards. During a workout, the keyboard should almost never appear.
3. **One primary action per screen** — visually dominant; secondary actions recede.
4. **Big targets** — ≥ 44pt; bigger for in-workout controls (sweaty hands, mid-set).
5. **Confirm only the irreversible** — check-ins, set logs are instant + undoable; only destructive things confirm.

---

## 5. Accessibility (non-negotiable)

- Contrast: body text ≥ 4.5:1, large text ≥ 3:1. (`body #A1A1A1` on `canvas #0A0A0A` passes; `mute #6E6E6E` is for non-essential text only — never body copy.)
- Every interactive element has an accessible label + role.
- Don't encode meaning in color alone (expiry uses color **+** text + icon).
- Dynamic type: layouts reflow when the OS font scale increases.
- Targets ≥ 44×44pt.

---

## 6. Theming

- **Dark is the default and primary** experience (gym lighting, evening use, OLED battery).
- Light mode = role inversion of the same tokens; build it as a token theme switch, not a parallel stylesheet.
- Respect system theme by default; allow manual override in Settings.

---

## 7. Do / Don't

| Do | Don't |
|---|---|
| Separate surfaces with hairlines | Stack heavy drop-shadows |
| Spend the mesh gradient on hero moments | Sprinkle gradient on every card |
| Let numbers/data be the visual hero | Decorate with stock-photo clutter |
| Use Steppers/chips/swipes | Make members type during a workout |
| Design every empty + error state | Ship a blank list or raw error |
