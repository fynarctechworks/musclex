# Brand assets

Real MuscleX logos, **transparent + trimmed**, used via `src/design-system/Logo.tsx`.

| File | Variant | Aspect (w/h) | Use |
|---|---|---|---|
| `logo-wordmark.png` | `wordmark` (default) | 6.96 | top bars, inline headers |
| `logo-full.png` | `full` | 2.30 | splash / hero (stacked MUSCLEX + MX) |
| `logo-mark.png` | `mark` | 3.11 | compact / square contexts |

```tsx
import { Logo } from '../src/design-system';
<Logo height={18} />                 // wordmark
<Logo height={120} variant="full" /> // splash lockup
<Logo variant="mark" height={28} />  // monogram
```

## Regenerating

Source art lives in `asserts/logo/` (`full.PNG`, `Musclex.PNG`, `MX.PNG`) — those are
RGB **white-background** originals (1536×1024). `scripts/make-logos.js` keys out the
white, feathers the edge, trims to the alpha bbox, and writes the transparent PNGs
here. Run from the app root: `node scripts/make-logos.js`.

## Notes

- The art is **red + black**, so it reads on light surfaces; on the lime splash it
  sits as red/black on green (bold/sporty). No single-color/white version exists — ask
  if you want a mono knockout for dark/colored backgrounds.
- App icon / adaptive icon are NOT wired yet (build-time, needs a square master) —
  follow-up.
