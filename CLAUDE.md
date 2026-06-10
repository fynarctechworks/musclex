# CLAUDE.md — MuscleX Working Rules

This file defines how you (Claude Code) must work in this repository.
Read it fully at the start of every session. These rules override any
instinct to "be helpful" by doing more than asked.

## What this project is
MuscleX is a **production multi-tenant gym-management SaaS** used by real,
paying gyms. Real money and real member data flow through it. Each gym ("studio")
is a tenant and its data MUST stay isolated — a cross-tenant leak is the worst
thing that can happen here.

It is a **monorepo of four apps** sharing one Supabase Postgres database:

| Path | App | Stack |
|---|---|---|
| `backend/` | Core gym API (memberships, check-ins, classes, payments, inventory, member BFF) | NestJS 10 + Prisma 5 (**multi-schema**) |
| `frontend/` | Gym admin / operations web app | Next.js 14 (App Router) + Supabase |
| `gym-member-app/` | Member mobile app | Expo / React Native (dark-first "Geist" design system) |
| `saas-control-center/` (+ `/frontend`) | Internal super-admin control center (SCC) | NestJS + Next.js 16 |

Supporting: `docs/`, `design.md` (the design language), `scripts/`, `tasks/`.

## The prime directive
Do what the current task asks — no unrequested scope. If you notice other
problems while working, LIST them at the end (NOTED FOR LATER) instead of fixing
them inline. Scope creep is how working software gets broken.

## How we work: autonomous slices, hard gates
The standing instruction is to **execute autonomously** toward the agreed goal —
you do not need to stop and ask permission for each ordinary code step. But you
MUST work in **reviewable slices**: one coherent change at a time, then report
(see "How to report work") before continuing. Big multi-phase efforts get a short
analysis/roadmap first, then are built slice by slice.

**HARD STOP — never cross these without explicit confirmation in the message:**
1. **Database schema / migrations** — any change to `schema.prisma`, a Prisma
   migration, or hand-written SQL that alters structure.
2. **Auth, RLS, or tenant-isolation** — anything touching how identity, gym
   scoping, or the tenant-model set works.
3. **New dependencies** — adding any package. Justify each one when you propose it.
4. **Leaving Expo Go / native builds** for the member app (one-way EAS shift).
5. **External or legal actions** — partner-program registration, publishing,
   sending anything to a third party, anything hard to reverse.
6. **Deleting code you believe is unused** — show it first and explain why it's safe.
7. **Destructive git / DB ops** — `reset --hard`, force-push, `prisma migrate
   reset`, dropping data. Prefer a non-destructive path.

Everything else (writing UI/feature code, adding tests, refactors *you were asked
for*, docs) you may carry through a slice autonomously, then report and continue.

## Multi-tenant safety (read this before touching any data access)
Tenant isolation here is **enforced in the app layer, not by the database**:
- The backend connects to Postgres as a **superuser with `rolbypassrls`**, so
  **RLS is decorative / not load-bearing** — do not rely on it to stop a leak.
- Real isolation = Prisma middleware/extension auto-injecting `gym_id` + a
  JWT-sourced `gym_id`. The **single source of truth for which models are
  tenant-scoped is `backend/src/prisma/tenant-models.ts`** — a model missing from
  it can leak across gyms. Two model-sets drifting apart is a known leak class.
- Tenant data lives in **per-studio Postgres schemas** (`studio_template` is the
  template; live gyms get `studio_*`), plus a `public` schema and an `scc` schema.
- **Every query that reads gym data must be gym-scoped.** Raw SQL must include an
  explicit `gym_id` filter — the auto-injection does NOT cover `$queryRaw`.
- When you touch any query, confirm it cannot return another gym's rows, and flag
  any route/query that reads sensitive data without scoping.

## Repo-specific gotchas (these have bitten us)
- **Prisma + Json null:** Prisma rejects a raw `null` for a `Json` field on
  create/update. Use `Prisma.JsonNull` (nullable column) or `{}` (non-nullable
  with default).
- **SCC migrations:** SCC uses hand-written **idempotent SQL** + `apply-migrations.ts`
  against the `scc` schema. **NEVER run `prisma migrate dev`** here — it would wipe
  the shared Supabase DB.
- **Next.js dev cache:** never run `next build` and then `next dev` against the
  same `.next/` — vendor-chunk mismatch crashes dev. Prefer `tsc --noEmit` to verify.
- **Bash cwd resets to the monorepo root between turns.** Use absolute paths,
  `npm --prefix <app>`, or call a sub-project's local binary directly
  (e.g. `gym-member-app/node_modules/.bin/tsc`). `npx tsc` from the root fails.
- **Member app can't run in Expo Go** (native modules) — it needs a dev build.

## Testing & verification
- ALWAYS run the relevant checks after a change and report the real result.
- `backend/` has Jest tests — run the ones covering what you touched.
- `gym-member-app/` has **no tests** — verify with
  `gym-member-app/node_modules/.bin/tsc --noEmit` and SAY that no tests cover it;
  RN UI behavior (animation, layout) is **on-device QA**, not verifiable from here.
- Never invent findings. If you haven't measured or verified something, say
  **"unverified"** — never present a guess as a fact.

## How to report work (after every slice)
- **WHAT** you changed (files + one line each)
- **WHY** (the reason it serves the task)
- **TESTS** (what you ran and the result, or "no tests cover this")
- **RISKS** (what could break; what I should manually check; what's unverified)
- **NOTED FOR LATER** (issues you saw but did NOT touch)

## When unsure
Ask only when the answer genuinely changes what you build and you cannot resolve
it from the code or sensible defaults — a wrong change to a production app is far
more expensive than a question. Do not guess at business logic. For ordinary
sequencing/scope choices, pick the sensible default, state it, and proceed.

## Operational reference (consolidated from the legacy rules docs)
These specifics are folded in from the old `docs/{AGENT,DB,SECURITY,PERFORMANCE,CLEANUP}_RULES.md`
(now in `docs/_archive/`). Where they conflicted with reality, the corrected version is below.
Full architecture/audit lives in `MASTER_PROJECT_DOCUMENTATION.md`; the API map in
`docs/API_REFERENCE.md`.

**Security**
- All DTOs use class-validator; the global `ValidationPipe` runs `whitelist` +
  `forbidNonWhitelisted` + `transform` — never trust raw input.
- Every route requires `Authorization: Bearer <jwt>` except `auth/*` and `health`.
  Member BFF (`member/v1/*`) uses the **member JWT**, not the staff JWT.
- Login lockout: 5 fails → 15-min Redis lockout. Supabase Storage buckets are private;
  serve via 1-hour signed URLs. Validate uploads server-side (MIME + size + extension).
- Never return secret fields — `face_descriptor`, `payment_method_token`/`card_token`,
  `salary`/`base_salary`/`hourly_rate` (owner/brand_owner only), passwords, 2FA secrets.
  The global `StripSecretsInterceptor` enforces this; don't defeat it.
- Verify inbound webhook HMAC (timing-safe) before processing. Payment webhooks already do;
  the `platform/webhooks` + integrations surface is not yet audited.

**Database / Prisma**
- UUID PKs; every table has `created_at`/`updated_at`; **snake_case** column names matching
  the TRD. `Json` fields: use `Prisma.JsonNull` or `{}`, never raw `null`.
- Forward-only migrations, descriptive names. **Never `prisma db push` in prod** — use
  `prisma migrate deploy`. (SCC is hand-SQL only — never `prisma migrate dev` there.)
- **Correction to the old DB/SECURITY rules:** isolation is **NOT** `search_path = studio_{id}`
  — under Prisma `multiSchema` that is inert. Real isolation = the `gym_id` `$use` injection
  (single source: `backend/src/prisma/tenant-models.ts`) + JWT `gym_id` + RLS (currently
  decorative until the Phase-B non-bypass-role keystone ships). Raw SQL must hand-filter `gym_id`.

**Performance targets** (P95): dashboard < 2s, check-in < 1s, AI < 4s, member list < 1.5s,
DB query < 100ms. No `SELECT *`; index WHERE/JOIN/ORDER-BY columns; paginate list endpoints;
avoid N+1; lazy-load heavy FE components (charts, calendar, PDF).

**Hygiene:** remove dead code/unused imports/unused deps as you touch them; group by feature,
not type; keep project docs in `/docs/` (the master doc + API reference are the canonical pair).
