# MuscleX Design System Reference

**Source of truth:** `docs/Design.md` (Vercel/Geist brand). This file is the
in-codebase developer reference — what to use, in which order, with which
guard-rails.

If you're adding a new screen or component, read this once and pattern-match.
The system should make the right choice the easy choice.

---

## 1. Tokens

All tokens are CSS vars defined in [globals.css](../app/globals.css) and
exposed to Tailwind via [tailwind.config.ts](../../tailwind.config.ts).

### Color
| Token | Use |
|---|---|
| `bg-canvas`, `bg-card` | Cards, dialogs, popovers — pure white surface |
| `bg-canvas-soft` | Default page body (98% white) |
| `bg-canvas-soft-2` | Inset / cluster / icon-tile backgrounds |
| `bg-primary` / `text-primary-foreground` | Primary CTA — ink-on-canvas |
| `text-foreground` | Headings + body on light surfaces |
| `text-muted-foreground` | Secondary text, placeholders, captions |
| `border-hairline` | Standard 1 px divider |
| `border-hairline-strong` | Deemphasised text or stronger dividers |
| `text-success`, `bg-success/12` | "Active", "Live", positive deltas |
| `text-warning-deep`, `bg-warning-soft` | "Pending", "Expiring", caution |
| `text-error-deep`, `bg-error-soft` | "Failed", "Denied", destructive |
| `text-link`, `text-link-deep`, `bg-link-soft` | Inline links + informational |

**Forbidden:** `text-green-*`, `text-amber-*`, `bg-blue-*`, `text-gray-*`,
`#abc123`, etc. The ESLint config warns on these.

### Spacing (4 px base)
Use the `design-*` scale for vertical rhythm: `design-xs` (8) · `design-sm`
(12) · `design-md` (16) · `design-lg` (24) · `design-xl` (32) · `design-2xl`
(40) · `design-3xl` (48) · `design-4xl` (64) · `design-5xl` (96) · `section`
(192). The standard Tailwind `p-4`, `gap-2` still work — prefer them for
component-internal spacing.

### Radius
| Token | Px | Use |
|---|---|---|
| `rounded-xs` | 4 | Tightest inline pill |
| `rounded-sm` | 6 | In-app buttons, inputs, dropdowns |
| `rounded-md` | 6 | (shadcn-compat alias) |
| `rounded-lg` | 8 | **Default card chrome** (Design.md `feature-card`) |
| `rounded-xl` | 12 | Larger callout / pricing chrome |
| `rounded-2xl` | 16 | Hero image-capped cards |
| `rounded-pill` | 100 | Marketing-scale CTA pills |
| `rounded-full` | ∞ | Avatars, status dots, ghost-pills |

### Shadow ladder
Always layered (stacked offsets + inset hairline ring) — never a single drop.
| Token | Use |
|---|---|
| `shadow-level-1` | Inset hairline ring only — flat cards |
| `shadow-level-2` | Default card elevation (KPI tiles, list rows) |
| `shadow-level-3` | Hover state for level-2 cards |
| `shadow-level-4` | Pricing / large callout cards |
| `shadow-level-5` | Modal, dropdown menu, popover |

**Forbidden:** `shadow-sm/md/lg/xl/2xl`. ESLint warns on these.

### Typography
| Class | Size · Weight · Tracking |
|---|---|
| `text-display-xl` | 48 / 600 / −0.05em — hero |
| `text-display-lg` | 32 / 600 / −0.04em — section |
| `text-display-md` | 24 / 600 / −0.04em — card-cluster headline |
| `text-display-sm` | 20 / 600 / −0.03em — micro-heading |
| `text-body-lg` | 18 / 400 — lead paragraph |
| `text-body-md` | 16 / 400 — default body |
| `text-body-sm` | 14 / 400 / −0.02em — table cells, nav |
| `text-caption-mono` | 12 / 400 mono — section eyebrows |

**Display ceiling is 600 (semibold).** Never `font-bold` / `font-extrabold`.

### Motion
| Class | ms | Use |
|---|---|---|
| `duration-fast` | 120 | Hover, focus, button press |
| `duration-medium` | 180 | Dropdown / popover / menu open |
| `duration-slow` | 240 | Sheet, dialog content slide-in |
| `duration-page` | 320 | Page transitions |
| `ease-out` | — | Default natural curve |
| `ease-in-out` | — | Symmetric (overlay fades) |

**Forbidden:** `duration-100/200/300/500`. Honor `prefers-reduced-motion`
automatically via globals.css.

---

## 2. Component primitives

### UI layer — `components/ui/*` (shadcn-derived)
- **Button** — variants `default | secondary | outline | ghost | link |
  destructive`. Sizes `sm | default | md | lg | icon | icon-sm | icon-lg |
  pill | pill-lg`. Use `pill-lg` only for marketing surfaces.
- **Card** — variants `tone={default|soft|ink}`, `elevation={flat|hairline|
  sm|md|lg}`, `radius={sm|DEFAULT|lg|xl}`. The brand's card-marketing chrome
  is the default (`tone=default` `elevation=sm` `radius=DEFAULT`).
- **Input / Textarea / Select** — heights 32 / 40 / 48 px (Design.md
  `--geist-form-height` ladder). Always hairline border + ink focus ring.
- **Badge** — semantic soft pills. Variants `default | solid | outline |
  success | warning | destructive | info | mono`.
- **Dialog / Sheet** — `shadow-level-5` + ink/40 backdrop blur.
- **Table** — mono-caps header, canvas-soft hover row, hairline dividers.
- **Tooltip** — ink pill, `shadow-level-4`.

### Composite layer — `components/shared/*`
- **PageHeader** `{ eyebrow?, title, description?, actions? }`
- **KPICard / StatCard** — KPI display chrome.
- **StatusBadge** — semantic dot-pill mapping known statuses.
- **EmptyState / ErrorState** — full canonical recipes for those states.
- **LoadingSkeleton / CardSkeleton / TableSkeleton** — shimmer placeholders.
- **DataTable** — sortable + paginated table. `stickyHeader` opt-in for
  long-form lists.
- **FilterBar / FilterChip** — horizontal filter cluster (Design.md
  `tab-ghost`).
- **Form fields** — `FormInput / FormSelect / FormTextarea / FormDatePicker /
  FormFileUpload` — label + hint + error wiring.
- **Banner** — unified inline state messaging (tone: info / success / warning
  / error / neutral, optional CTA + dismiss).

### Typography + Layout primitives
```tsx
import {
  // Typography
  Eyebrow, DisplayXL, DisplayLG, DisplayMD, DisplaySM,
  BodyLG, BodyMD, BodySM, Code,
  // Layout
  Container, Section, SectionHeader,
  Page, PageBody, FormGrid, DashboardGrid, FilterRow, CardGroup,
} from "@/components/shared";
```

---

## 3. Page recipe

Every in-product page composes from:

```tsx
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader, Page, PageBody, DashboardGrid } from "@/components/shared";

export default function MyPage() {
  return (
    <AppLayout>
      <Page>
        <PageHeader
          eyebrow="Module"
          title="Page title"
          description="One-line context."
          actions={<Button>Primary</Button>}
        />
        <PageBody>
          <DashboardGrid cols={4}>
            <KPICard ... />
          </DashboardGrid>
          {/* further sections... */}
        </PageBody>
      </Page>
    </AppLayout>
  );
}
```

**Never** roll your own page header / container / spacing chain. If the
primitive doesn't fit, extend it — don't duplicate it.

---

## 4. State recipes

### Loading
- Inline data → `<Skeleton className="h-9 w-40" />` (shimmer)
- Full table → `<TableSkeleton rows={5} />`
- Full page → render `<Page>` with skeletons in place of real content

### Empty
- `<EmptyState icon={Inbox} title="No results" description="..." action={...} />`

### Error
- `<ErrorState variant="server" onRetry={...} />`
- Inline → `<Banner tone="error" title="Failed to save" description="..." />`

### Banner (top-of-page or top-of-section)
```tsx
<Banner tone="warning" title="Offline mode"
  description="Check-ins will sync when connection returns." />
<Banner tone="info" title="3 pending sync"
  cta={<BannerButton size="sm" variant="outline">Sync now</BannerButton>}
  onDismiss={() => ...} />
```

### Toast (transient)
Use `sonner`'s `toast.success / .error / .info / .warning`. Never bare
`toast()` without a tone.

---

## 5. Interaction recipes

### Hover / focus
- Interactive elements: `transition-colors duration-fast ease-out`
- Hover should change color OR shadow — not both at once.
- Focus is **never** removed. Use `.focus-ring` helper or rely on primitive
  focus styles. Never `focus:outline-none` without a replacement ring.

### Pressed
- Buttons: `active:bg-primary/95` already handled by Button variant.
- Avoid `transform: scale()` on press — too app-like for enterprise SaaS.

### Disabled
- `disabled:opacity-50 disabled:pointer-events-none` (already in primitives).
- Inputs add `disabled:bg-canvas-soft` to reinforce non-interactivity.

---

## 6. Accessibility checklist

- [ ] Every interactive element has a visible `:focus-visible` ring.
- [ ] All icons are paired with text or have `aria-label` / `aria-hidden`.
- [ ] Color is never the only signal — pair with icon + text (StatusBadge
  does this via leading dot).
- [ ] Form fields use `<label>` + `aria-invalid` on error (the
  `FieldWrapper` primitive wires this automatically).
- [ ] Modals trap focus (Radix Dialog handles this).
- [ ] `prefers-reduced-motion` is respected globally — don't bypass it.
- [ ] Tap targets are ≥ 40 × 40 px on mobile (Button default `h-9` is
  already there; nav uses `h-8` + padding).
- [ ] Contrast: ink-on-canvas pairs are WCAG AAA; muted-foreground vs canvas
  is AA. Don't drop opacity below 60% on text.

---

## 7. Governance

- **ESLint** ([.eslintrc.json](../../.eslintrc.json)) warns on hex colors,
  freeform Tailwind color scales (`bg-red-500`), and legacy shadow utilities.
  Override list whitelists `components/ui/**` and tests.
- **Normalization script** ([scripts/normalize-design-tokens.mjs](../../scripts/normalize-design-tokens.mjs))
  is idempotent — re-run any time a third-party codegen sneaks legacy
  classes back in.
- **Motion script** ([scripts/normalize-motion.mjs](../../scripts/normalize-motion.mjs))
  normalizes `duration-N` to semantic tokens.

If you find yourself reaching for a hex color or a raw Tailwind palette,
**the system already has a token for it** — search this doc first.

---

## 8. The five Design.md rules (memorise)

1. **Ink CTAs only** — `bg-primary` is the conversion target. Don't tint
   it (`bg-primary/10` for chips is banned — use `bg-canvas-soft-2`).
2. **Stacked shadows, never single drops** — `shadow-level-2` minimum.
3. **Sentence-case + period headlines** — "Build and deploy on the AI Cloud."
4. **Mesh gradient is hero-only chrome** — never miniaturised, never a flat
   single colour. Use `.bg-mesh-brand` on hero / CTA / kiosk-success bands.
5. **Mono for technical labels only** — eyebrows, code, terminal mockups.
   Body paragraphs are never mono.
