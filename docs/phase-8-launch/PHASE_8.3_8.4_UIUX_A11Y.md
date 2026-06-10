# Phase 8.3 + 8.4 — UI/UX Excellence & Accessibility

**Date:** 2026-06-07 • **App:** `gym-member-app` • **Method:** design-system + token inspection, a11y-prop coverage metrics. Pixel-level visual QA (spacing/alignment on real screens) and screen-reader testing are **device-only** and listed as such.

---

## 8.3 — UI/UX: the consistent design system the phase asks to "establish" **already exists** and is high quality.

### Design system — [src/design-system/](../../gym-member-app/src/design-system/) (29 primitives)
Button, Input, Card, Text, Badge, Chip, Avatar, BottomSheet, Dialog, SegmentedControl, Stepper, ListRow, Skeleton, EmptyState, ErrorState, ProgressRing/ActivityRings, Line/BarChart, CollapsingHeader, Screen, Logo, MeshGradient, Icon — a complete, composable kit. This directly satisfies the phase's "establish standards" list (buttons, inputs, cards, modals, bottom sheets, empty/loading/error states all have a single canonical component).

### Tokens — [src/design-system/tokens.ts](../../gym-member-app/src/design-system/tokens.ts)
- **Spacing scale** `space` xxs(4)→5xl(96); **radius** none→full; **elevation** card/float/modal (stacked-shadow approximation); **tracking** display→body. A real, enforced scale — not ad-hoc values. ✅
- **Two themes** (light default + dark) with **runtime switching** via NativeWind CSS vars (`theme-vars.ts`) — consume through `useThemeColors()`. ✅
- Single decorative element (mesh gradient) used at hero scale only — disciplined visual language per `design.md`. ✅

**8.3 verdict:** premium, consistent, motivational — the system is there. The remaining work is **per-screen visual QA** (congestion, alignment, card-height/margin consistency across the 40 screens) which is a human eyes-on pass during UAT, not a code change. Use the matrix below.

## 8.4 — Accessibility: strong foundations, one real gap.

### ✅ Done well
- **Contrast is deliberately engineered to WCAG AA** — tokens.ts documents ratios: `onPrimary` is dark ink because white-on-lime is ~1.8:1 (fail); `accent #5B8011` chosen for "AA, ~4.6:1" on white. This is rare and excellent. ✅
- **Touch targets**: core interactive primitives (Button, Input, Stepper, CollapsingHeader) carry `minHeight`/`hitSlop`. ✅
- a11y props (`accessibilityLabel/Role/Hint`) used in **26 files**. ✅

### ✅ Gap CLOSED (2026-06-07) — label sweep applied
The 12 touchable files that lacked a11y props were swept; all now expose `accessibilityRole` + `accessibilityLabel` (and `accessibilityState` where stateful):
- **DS (propagates everywhere):** `ListRow` (button + label/value), `Stepper` (decrease/increase), `Dialog` (close backdrop + `accessibilityViewIsModal`).
- **Feature:** `ExerciseCard` (set-done checkbox + add-set), `RestTimer` (start/stop presets), `HealthCard` (view health), `CountryPickerList` (country rows).
- **Screens:** `progress` (add photo), `goal` (option cards + selected state), `nutrition` (food results), `tools` (chips + selected), `onboarding/intro` (skip).
- Verified: member-app `tsc --noEmit` exit 0 after edits.

**Still device-only (UAT):** real VoiceOver/TalkBack pass (announcement quality, focus order) + min 44×44pt target check on custom touchables.

---

## Device-only QA matrix (UAT — visual + a11y)
- [ ] Each of the 40 screens: spacing/alignment, no congestion, consistent card heights & margins, consistent button sizes
- [ ] Light AND dark theme on every screen (runtime toggle)
- [ ] Small phone + large phone + tablet layout (no clipping/overflow)
- [ ] Dynamic type / large font scale doesn't break layouts
- [ ] VoiceOver (iOS) + TalkBack (Android): every control announces a meaningful label and role; focus order is logical
- [ ] Color-contrast spot-check on real screens (charts, badges, mute text on surfaces)

---
## NOTED FOR LATER
- Screen-reader label sweep on the ~9 touchable files lacking a11y props (offer above).
- No automated visual-regression or a11y-lint in CI — consider adding `eslint-plugin-react-native-a11y` post-UAT.

*Static review: design system is production-grade; a11y foundations strong with a labeling gap. No code changed (label sweep offered as a separate slice).*
