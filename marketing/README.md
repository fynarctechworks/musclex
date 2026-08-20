# marketing/ — MuscleX public marketing website

The public site that sells MuscleX. A standalone Next.js 14 app, separate from
`frontend/` so it can be deployed on its own domain and iterated on without
touching the production admin app.

## What makes this app different from the other three

- **Almost no backend.** It never touches the MuscleX API, Supabase or any
  tenant data, and has no auth or middleware. It talks to exactly one service,
  server-side only: the SaaS Control Center, for contact-form ingest and the
  live plan catalogue. Every page is static except `/` and `/pricing` (ISR) and
  the two `/api/*` route handlers.
- **Three interactive islands only** — the mobile nav, the billing-cycle toggle
  and the contact form. Everything else is a Server Component.
- **Four dependencies** — `next`, `react`, `react-dom`, `lucide-react`. That is
  deliberate; keep it that way unless there is a real reason not to.

## Running it

```bash
npm --prefix marketing install
npm --prefix marketing run dev        # http://localhost:3002
npm --prefix marketing run build
npm --prefix marketing run typecheck
npm --prefix marketing run lint
```

Port 3002 avoids colliding with `frontend/` (3001) and `backend/` (3000).

> Bash cwd resets to the monorepo root between turns — use `npm --prefix marketing`
> or the local binary (`marketing/node_modules/.bin/tsc`) rather than `npx` from
> the root.

## Environment

Both are optional and both have dev-friendly defaults, so the site builds and
runs with no `.env` at all.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://app.musclex.infynarc.com` | Where the gym admin app lives. Every product CTA is built from this — "Start free" → `/register`, "Log in" → `/login`. Override it to point the site at a local or staging app. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3002` | Public origin of this site. Used for canonical URLs, Open Graph and `sitemap.xml`. **Set this in production.** |

Product links live in one place — `productLinks` in `src/lib/site.ts`. Never
hardcode a product URL in a page; every CTA on every page resolves through it.

## Design system

> **This app deliberately does NOT follow [`design.md`](../design.md).** The
> root `design.md` describes the ink-on-canvas Geist system that `frontend/`
> uses in-product. The marketing site keeps the *structure* of a dark
> glass-surface reference redesign — very large tightly-tracked display type,
> pill CTAs, card grids, a gradient rotating headline word — rendered light.
> Do not "fix" this back toward `design.md`; the divergence is intentional.

The system, defined in `src/app/globals.css` and mirrored in `tailwind.config.ts`:

- **White canvas** (`#ffffff`) with a tinted band (`#f6f6f9`) for alternating
  sections. Bands, not borders, do the section separation.
- **Cards** — white surface, hairline ring (`#e3e3e9`) and a soft 1px drop.
  On a white page a card can't rely on fill alone, so it's held by ring +
  shadow, never a heavy shadow alone. `.glass`, `.glass-2`, `.glass-hover`.
- **A four-step ink text ladder** — `#101014` / `#4c4c57` / `#70707c` /
  `#94949e`.
- **One saturated accent: MuscleX red** (`#E10600`). The reference site uses
  indigo; this uses the brand's own red, because the wordmark already lives in
  it. The accent carries every conversion target and nothing else.
- **Large, tightly-tracked display type** — 84 / 64 / 52 / 40px, weight 600
  ceiling, tracking from `-0.04em`. Weight comes from size, not stroke.
- **`.text-gradient`** — the red → orange → amber fill used on the rotating
  headline word and on one accented phrase per page.
- **Atmosphere** — `.bg-grid` (a 64px grid at 4.5% ink) and `.bg-bloom` (a warm
  accent wash above the fold), composed by `<HeroBackdrop>`.
- Fonts are the real **Geist** and **Geist Mono** variable faces (copied from
  `frontend/src/app/fonts/`) via `next/font/local`, so the build has no
  dependency on Google Fonts.

**Token names are inherited from the dark version on purpose** (`--glass-*`,
`--text-2`…) so switching themes only changed what they resolve to, not the
components. "Glass" here means a soft neutral tint, not translucent white.

**Product mockups use their own light palette.** `mockups.tsx` writes literal
colour values rather than page tokens, so the product visuals stay stable
regardless of what the marketing theme does — and they match the real MuscleX
admin app, which is light. The phone mockup keeps a dark bezel so it separates
from the page.

## Product visuals

`src/components/mockups.tsx` builds the dashboard, churn-risk, check-in and
member-app visuals **in code**, not as screenshots. Two reasons:

1. `docs/screens/` is branded **"FitSync Pro"** in a purple design language —
   those are concept mockups, not the shipped MuscleX UI, and shipping them
   would advertise a different product's name on our own site.
2. Code mockups inherit the `design.md` tokens directly, so the marketing site
   and the product cannot visually drift apart.

All figures in the mockups are illustrative sample data for a fictional studio,
labelled as such in the surrounding copy.

## Content sources — keep these in sync

| File | Mirrors | Risk if it drifts |
|---|---|---|
| `src/lib/plans.ts` | `backend/src/common/plan-configs.ts` (`PLAN_CONFIGS`) | **Fallback only.** Pricing is now read live from the SCC (see below); this hardcoded catalogue is what renders if the SCC is unreachable. Keep it roughly current so a fallback render is not wildly wrong. |
| `src/lib/features.ts` | `backend/src/*` and `frontend/src/features/*` | Advertising a capability that does not ship. Each group carries an `evidence` field naming the modules it is drawn from. |
| `src/app/security/page.tsx` | Actual implemented controls | Every claim on that page is backed by code in this repo. It explicitly does **not** claim SOC 2, ISO 27001 or any third-party audit. Do not add compliance claims without the evidence. |

## Live pricing (linked to the SaaS Control Center)

The pricing page and the home-page pricing preview are **driven by the SCC**, not
by hardcoded copy. `src/lib/plans-source.ts` reads `GET /plans/marketing`, which
serves the same `public.subscription_plans` rows the SCC's Plans screen edits —
so there is no second copy of pricing to keep in sync.

- **Server-only.** The fetch uses the shared ingest secret and throws if the
  module is ever pulled into a client bundle.
- **ISR, 5 minutes.** `/` and `/pricing` carry `export const revalidate = 300`.
- **Immediate on edit.** After any plan mutation the SCC pings
  `POST /api/revalidate-plans` (same shared secret), which calls
  `revalidatePath()` — so an admin's change is live within seconds rather than
  waiting out the ISR window. Best-effort: if the marketing site is unreachable,
  the plan edit still succeeds and the page catches up on its own.
- **Always renders.** If the SCC is down, misconfigured, or returns nothing, it
  falls back to `src/lib/plans.ts`. A slightly stale price is recoverable; a
  broken pricing page is not.

What the database controls vs. what marketing controls:

| From the SCC | From marketing code |
|---|---|
| Name, description, monthly/annual price | CTA wording (`CTA_BY_NAME`) |
| Member / branch / staff / storage limits | Card bullet derivation (`highlightsFor`) |
| The 16 feature flags | Page copy, FAQ, layout |
| "Popular" badge (`is_featured`) | |
| Active discounts (effective prices) | |

Adding a plan in the SCC needs no marketing code change — it appears with
derived bullets and a sensible CTA.

## Known caveats

- **The `/legal/*` documents are drafts.** They are structurally complete and
  accurate about how the product works, but they have not been reviewed by a
  lawyer, and each renders a visible "pending legal review" banner saying so.
  Do not remove that banner until counsel has approved the final text.
- **The contact form has nowhere to POST.** It composes a pre-filled `mailto:`
  and hands it to the visitor's mail client, and the button and helper text say
  exactly that. Swap `handleSubmit` for a real POST when a form endpoint exists.
- **Contact addresses are placeholders** (`hello@`, `sales@`, `support@`,
  `security@` at `musclex.app`). Point them at real inboxes in `src/lib/site.ts`
  before launch.
- **Social proof is unverified.** The home page carries "500+ gyms already
  onboard" and three named testimonials inherited from the previous landing
  page. These were kept at the owner's explicit direction; they are not
  substantiated anywhere in this repo.

## Relationship to `frontend/src/app/landing/`

The old single-page landing still exists and still serves at the admin app's
`/`. This app supersedes it. Retiring it — pointing the admin app's `/` at the
marketing domain, or deleting `app/landing/` — is a separate, deliberate change
that has not been made.
