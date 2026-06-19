# MuscleX Email Infrastructure — Audit, Decision & Architecture

_Last updated: 2026-06-17_

This document is the canonical reference for transactional email across the MuscleX
monorepo. It consolidates the provider decision, the current-state audit, the target
architecture, the security review, and the DNS / environment / Supabase setup guides.

> **Scope note.** Three steps require credentials/consoles that live outside this repo
> and cannot be completed from a developer machine alone: (1) a real Resend API key + a
> verified sending domain, (2) Supabase dashboard Auth config, (3) real-inbox delivery
> testing. Those are called out explicitly as **[OPERATOR ACTION]** below.

---

## 1. Provider Research & Decision

### Decision: **Resend** (confirmed, not changed)

Resend is **already the integrated provider** — it is in `backend/package.json` and is
called from at least six services today. The task was to "research and select"; the
honest result is that the incumbent is also the correct long-term choice for this stack,
so we are **standardising on Resend** rather than switching. Rationale below.

### Comparison matrix

> Free-tier / limit figures are from each provider's public pricing pages and move over
> time — **verify before relying on them**. The decision does not hinge on free-tier size
> (per the directive); it hinges on production quality and fit.

| Provider | Free tier (typical) | SMTP | HTTP API | Deliverability reputation | Domain auth (SPF/DKIM/DMARC) | Stack fit (Next.js/React) | Notes |
|---|---|---|---|---|---|---|---|
| **Resend** ✅ | ~3k/mo, 100/day | ✅ | ✅ (first-class) | Strong (AWS SES backbone + managed reputation) | ✅ guided, auto-DKIM | **Best** — `react-email`, TS SDK, Next.js-native | Already integrated; cleanest DX |
| Postmark | ~100/mo | ✅ | ✅ | **Excellent** (transactional-only, aggressive) | ✅ | Good | Best raw deliverability; tiny free tier; pricier |
| Amazon SES | 3k/mo (in-cloud) | ✅ | ✅ | Strong but **self-managed** reputation | ✅ manual | Low-level | Cheapest at scale; most ops burden; no templating/UI |
| SendGrid | ~100/day | ✅ | ✅ | Mixed (shared-IP noise) | ✅ | OK | Mature but heavier; deliverability varies on free IPs |
| Mailgun | trial only now | ✅ | ✅ | Good | ✅ | OK | Free tier effectively removed |
| Brevo (Sendinblue) | ~300/day | ✅ | ✅ | Good | ✅ | OK | Marketing-leaning; good free volume |
| SMTP2GO | ~1k/mo | ✅ | ✅ | Good | ✅ | OK | Solid SMTP relay; less ecosystem |
| Mailjet | ~200/day | ✅ | ✅ | Mixed | ✅ | OK | EU-friendly |
| Zoho ZeptoMail | low-cost credits | ✅ | ✅ | Good | ✅ | OK | Cheap transactional; smaller ecosystem |
| Elastic Email | ~100/day | ✅ | ✅ | Mixed | ✅ | OK | Cheap; reputation varies |

### Why Resend wins for MuscleX

- **Already wired** — zero migration risk, no new dependency (HARD-STOP #3 avoided). Six
  services already import it; the work is to *centralise*, not to *replace*.
- **Stack fit** — first-class TypeScript SDK, `react-email` templating, Next.js docs. The
  admin app is Next.js 14; the member app and SCC are TS end-to-end.
- **Deliverability** — runs on the AWS SES backbone with managed warmup/reputation, so we
  get SES-class delivery without SES-class ops.
- **Domain auth** — guided SPF/DKIM/DMARC with automatic DKIM key generation per domain;
  supports **multiple verified domains** → directly enables the multi-tenant / white-label
  requirement (one verified domain per brand, one `from` identity per tenant).
- **Maintenance** — managed dashboard, webhooks for delivery/bounce/complaint, idempotent
  send API. Low operational surface for a small team.

**When we would revisit:** if monthly volume crosses ~100k and cost dominates, add
**Amazon SES** as a second adapter behind the same `EmailProvider` interface (the
architecture below makes this a drop-in, not a rewrite). If a specific tenant demands
best-in-class transactional deliverability, **Postmark** can be a per-tenant adapter.

---

## 2. Current-State Audit (code)

### 2.1 What exists

| Area | Location | State |
|---|---|---|
| Verification email | `backend/src/auth/auth.service.ts` `sendVerificationEmail()` | Direct `Resend` client, inline HTML (Supabase-green `#3ECF8E` — **off-brand**) |
| Staff invite | `backend/src/staff/staff-invite.service.ts` `sendInviteEmail()` | Direct dynamic-import Resend, inline HTML (blue `#4A9FD4` — **off-brand**) |
| Staff (other) | `backend/src/staff/staff.service.ts:733` | Direct `resend.emails.send` |
| 2FA codes | `backend/src/auth/two-factor.service.ts:687,732` | Direct `resend.emails.send` |
| Document/invoice delivery | `backend/src/documents/document-delivery.service.ts:154` | Direct `resend.emails.send` |
| Subscription lifecycle | `backend/src/subscription/{subscription.service.ts,subscription.cron.ts}` | Via `QueueService.enqueueEmail` (good) |
| Members / settings / referrals | `members.service.ts:704`, `settings.service.ts:275`, `referral-notification.service.ts:95` | Via `QueueService.enqueueEmail` (good) |
| Queue worker | `backend/src/queue/processors/email.processor.ts` | BullMQ; **re-implements** Resend separately; naive `{{var}}` string render |
| Queue dispatch | `backend/src/queue/queue.service.ts` `enqueueEmail()` | Dry-run/log-only unless `ENABLE_REDIS=true` |
| SCC critical alerts | `saas-control-center/.../alert-email.transport.ts` | `LoggingAlertEmailTransport` only — **provider not wired** |
| SCC password reset | `saas-control-center/src/modules/auth/auth.service.ts` `forgotPassword()` | **Logs the reset URL only** — email not wired (`TODO`) |
| Gym password reset | `backend/src/auth/auth.service.ts` `forgotPassword()` | Delegates to **Supabase** `resetPasswordForEmail` (uses Supabase's own SMTP/templates, not Resend) |

### 2.2 Problems found

1. **No single email service layer.** ≥6 direct `resend.emails.send` call sites + a
   separate queue worker that re-implements sending. This is the exact anti-pattern the
   directive targets.
2. **Three inconsistent, off-brand palettes.** Verification = Supabase green `#3ECF8E`,
   invite = blue `#4A9FD4`, queue templates = ad-hoc. The admin brand is **Geist
   monochrome — ink `#171717` on white** (`frontend/src/app/globals.css`).
3. **Naive templating.** `{{var}}` regex replace with no escaping → **HTML-injection risk**
   if any variable is user-controlled (e.g. studio name in invite).
4. **Two parallel verification systems.** App-owned token flow (`pending_registrations`)
   **and** Supabase email confirm — they can disagree. Password reset uses a *third* path
   (Supabase). No single source of truth.
5. **Queue is off by default.** `ENABLE_REDIS=false` → every `enqueueEmail` is a silent
   dry-run. Subscription/security emails are effectively no-ops in that mode.
6. **SCC has no real email at all** — alerts and password reset only log.

### 2.3 Dev-only verification shortcuts (must be removed — see §6 gating)

- `auth.service.ts register()` returns **`skip_verification: true` + live session tokens**
  when a Supabase user exists without a `studio_id` → **bypasses email entirely.**
- `register()` / `resendVerification()` return **`verification_url` in the API response**
  when send fails → **leaks the verification link to the client**, letting anyone "verify"
  without inbox access. (Security + bypass.)
- Verification/reset links are **logged to the server console** (`📧 …`).
- Member app `MEMBER_DEV_OTP` (phone `7386648648` / code `000000`) — SMS, not email, and
  already hard-gated off in production. Noted, out of email scope.

---

## 3. Target Architecture

```
                     ┌─────────────────────────────────────────────┐
   callers  ───────► │  EmailService  (single entry point)          │
 (auth, staff,       │   • typed helpers: sendVerificationEmail()…   │
  subscription,      │   • render(templateId, data) → {subject,html, │
  documents, 2FA,    │     text}                                     │
  SCC, members)      │   • dedupeKey → no duplicate sends            │
                     │   • Redis on  → enqueue (BullMQ retry/backoff)│
                     │   • Redis off → inline send + bounded retry   │
                     └───────────────┬───────────────────┬──────────┘
                                     │                    │
                        ┌────────────▼──────┐   ┌─────────▼───────────┐
                        │ Template registry │   │  EmailProvider (DI) │
                        │  shared layout +  │   │  ResendEmailProvider │
                        │  16 branded tpls  │   │  NoopEmailProvider   │
                        │  (HTML + text,    │   │  (future: SES,       │
                        │   escaped)        │   │   Postmark)          │
                        └───────────────────┘   └─────────────────────┘
```

**Principles**

- **One provider seam** (`EMAIL_PROVIDER` DI token). Swapping/adding a provider = one new
  class, no caller changes. Enables multi-domain / per-tenant `from` (white-label).
- **One template registry.** All HTML lives in `backend/src/email/templates/`, built on a
  single responsive, dark-mode-aware, accessible layout. All variables **HTML-escaped**.
- **Queue-aware, queue-optional.** With Redis, sends go through BullMQ (retry, backoff,
  dedupe via `jobId`). Without Redis, `EmailService` sends inline with a bounded retry so
  dev still works — but **never** leaks links to the client.
- **Failure is non-fatal to the request** for fire-and-forget mails, but **observable**
  (logged + Sentry via the existing `reportJobFailure` path for queued mail).
- **Zero new dependencies.** Resend is already present; templating is plain typed
  template literals (no `handlebars`/`react-email` added).

### Module layout (`backend/src/email/`)

```
email.module.ts                 @Global; provides EmailService + EMAIL_PROVIDER factory
email.service.ts                single entry point (render + send/enqueue + retry + dedupe)
email.types.ts                  EmailTemplateId, address/message/result types, per-tpl data
providers/
  email-provider.interface.ts   EmailProvider interface + EMAIL_PROVIDER token
  resend.provider.ts            ResendEmailProvider (only place that calls resend SDK)
  noop.provider.ts              logs when no RESEND_API_KEY (dev / CI)
templates/
  layout.ts                     branded responsive layout (HTML + text), Geist monochrome
  index.ts                      renderTemplate(id, data) dispatch + helpers (escaping)
  auth.ts saas.ts security.ts   the 16 templates
```

### Templates (16, all on one layout)

- **Auth:** Verify Email · Welcome · Password Reset · Password Changed
- **SaaS:** Tenant Invitation · Trial Started · Trial Expiring · Subscription Activated ·
  Subscription Expired · Payment Success · Payment Failed
- **Security:** Login Alert · Password Changed Alert · Email Changed Alert

Layout features: table-based (email-client safe), `max-width:480px` mobile-responsive,
preheader text, `prefers-color-scheme: dark` support, semantic headings, descriptive link
text + alt, ≥4.5:1 contrast (ink on white), and a plain-text alternative for every email.

---

## 4. Security Review (email)

| # | Finding | Severity | Fix |
|---|---|---|---|
| S1 | `verification_url` returned in API response on send failure → anyone can verify without inbox | **High** | ✅ FIXED (Slice 3) — `register`/`resendVerification` never return the token/link; client UI fallback + sessionStorage path removed. |
| S2 | `skip_verification: true` issues live session without email proof | **High** | ✅ FIXED (Slice 3) — fast-path now requires `email_confirmed_at` (re-registration of an *already-verified* incomplete account only); renamed `already_verified`. Never issues a session for an unverified address. |
| S3 | Naive `{{var}}` templating, no HTML escaping | Medium | ✅ FIXED (Slice 1) — template engine escapes all interpolated values by default. |
| S4 | Reset/verify links logged to server console | Low/Medium | ✅ FIXED (Slices 2b/3) — all link logging gated behind `NODE_ENV !== 'production'`. |
| S5 | Email enumeration | — | Gym `forgotPassword` returns generic success (good); SCC `forgotPassword` already returns generic success (good). Keep. **`register()` reveals "account already exists"** — acceptable for signup UX but note it. |
| S6 | No inbound webhook for bounces/complaints | Low | Add Resend webhook (HMAC-verified) to suppress bad addresses — roadmap. |
| S7 | `resetPassword(dto.otp)` uses the field as a Supabase user id directly | Medium | Verify the reset-token→user binding can't be forced; review with the frontend reset flow (roadmap). |

---

## 5. Environment Variables

Backend (`backend/.env`) — see `backend/.env.example` for the documented block:

| Var | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | prod | Resend API key. Without it, `NoopEmailProvider` logs instead of sending. |
| `RESEND_FROM_EMAIL` | prod | Default `From` identity, e.g. `MuscleX <noreply@mail.musclex.app>`. Must be on a **verified** domain. |
| `EMAIL_REPLY_TO` | optional | Default `Reply-To` (e.g. `support@musclex.app`). |
| `FRONTEND_URL` | prod | Gym app base URL for verification/reset links (must be the gym app, not SCC). |
| `SCC_FRONTEND_URL` | prod (SCC) | SCC base URL for SCC reset links. |
| `ENABLE_REDIS` | prod | `true` to route email through BullMQ (retry/backoff). |

**[OPERATOR ACTION]** Provision a real `RESEND_API_KEY` and set `RESEND_FROM_EMAIL` to an
address on your verified domain. Never commit these.

---

## 6. Rollout Plan (slices & hard-stop gates)

| Slice | Content | Status / Gate |
|---|---|---|
| **1** | Centralised `EmailService` module + 16 branded templates + provider seam. No behavior change. | ✅ done, tsc + 15 unit tests |
| **2a** | Migrate all backend direct call sites (verification, staff invite, 2FA ×2, leave, invoice+attachment) + queue worker to `EmailService`/`sendRaw`. Now exactly **one** Resend client in the repo. | ✅ done, tsc + tests; pre-existing safety-net failures unrelated |
| **2b** | Wire SCC alert transport + SCC password-reset email. | ✅ done (dep `resend` approved + added to SCC). New `SCC EmailModule`/`EmailService`; `ResendAlertEmailTransport` bound when key present (else logging); `forgotPassword` now sends a branded reset email (generic response preserved → no enumeration). tsc + 21 SCC tests pass. |
| **3** | **Removed dev bypasses** (`verification_url` response leak gone; `skip_verification`→`already_verified` guarded on `email_confirmed_at`; console links gated to dev). Frontend dead-path removed. | ✅ done, backend+frontend tsc clean. **NOTE:** with no `RESEND_API_KEY`, registration now relies on the **dev server console** link (no client fallback) — set a key for real delivery. |
| **4 [OPERATOR]** | Verify domain in Resend; add SPF/DKIM/DMARC (see `DNS_SETUP.md`); configure Supabase Auth (templates, SMTP, redirect/site URLs). | **HARD STOP — external/auth config.** |
| **5** | Resend bounce/complaint webhook (HMAC) + suppression; delivery monitoring. | webhook surface |

### Slice 2a — files migrated (one provider seam)

| File | Before | After |
|---|---|---|
| `auth/auth.service.ts` | own `Resend` client + inline HTML | `EmailService.send(VerifyEmail)`; `resend` field/import removed |
| `staff/staff-invite.service.ts` | dynamic-import Resend + inline HTML | `EmailService.send(TenantInvitation)` |
| `staff/staff.service.ts` | dynamic-import Resend (leave w/ cc) | `EmailService.sendRaw({cc})` |
| `auth/two-factor.service.ts` | own `Resend` client (recovery + reset) | `EmailService.sendRaw`; `resend` field/import removed |
| `documents/document-delivery.service.ts` | dynamic-import Resend (invoice + PDF) | `EmailService.sendRaw({attachments})` |
| `queue/processors/email.processor.ts` | `new Resend()` re-implementation | injects `EMAIL_PROVIDER`; renders + sends via the seam |

> `enqueueEmail` callers (subscription, members, settings, referrals) were left untouched —
> they already use the queue, and the worker now delivers via the central provider, so they
> automatically stop using ad-hoc Resend. Converting them to typed templates is a follow-up.

---

## 7. Testing Plan

Verifiable here:
- `tsc --noEmit` on the backend (type safety of the module + templates).
- Unit-render every template with sample data → assert subject/text present and that a
  `<script>`-laden variable is escaped (HTML-injection regression).
- Dry-run path: with `RESEND_API_KEY` unset, `EmailService.send` logs via `NoopProvider`
  and never throws.

**[OPERATOR ACTION] — real delivery (cannot be done from the repo):**
1. Set `RESEND_API_KEY` + verified `RESEND_FROM_EMAIL`.
2. Trigger each flow to a real inbox: register→verify, forgot→reset, staff invite,
   subscription/trial/payment mails, security alerts.
3. Confirm inbox placement (not spam), DKIM `pass`, SPF `pass`, DMARC alignment.

See `DNS_SETUP.md` for the exact records.
