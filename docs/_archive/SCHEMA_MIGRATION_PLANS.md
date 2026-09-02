# Schema migration plans — the 7 gated items

**Status: PLANNED, NOT APPLIED.** Nothing in this document has been run. No
`schema.prisma` edit, no migration file, no DB change. This is the approval
package for the remaining roadmap items that cannot be built without a schema
change (CLAUDE.md HARD STOP #1).

Everything buildable *without* schema was implemented and committed — see
`CHANGELOG-M0.md` plus the M1/M2 commits (`14f15cb` → `49cfda3`).

---

## Read this before approving any of them

**1. Sequencing risk — the in-flight branch.** The working tree still carries a
large uncommitted per-gym-physical-schemas change (`feat/per-gym-schemas` work:
`schema.prisma`, `schema.tenant.prisma`, `prisma.service.ts`,
`tenant-prisma.extension.ts`, ~150 files). Adding migrations on top of a
half-landed schema rework is how the two diverge irrecoverably. **Recommendation:
land or park that branch first**, then take these in order.

**2. Every new tenant model MUST be registered** in
`backend/src/prisma/tenant-models.ts`. That file is the single source of truth
for both isolation layers (the `$use` middleware and the `$extends` client). A
model missing from it is a cross-tenant leak — this exact drift caused a real
leak before (see the biometric enrollment incident). Each plan below names its
registry entry explicitly.

**3. Migration mechanics.** Backend uses `prisma migrate` with forward-only,
descriptive names (`YYYYMMDD_description`). Never `prisma db push` in prod;
deploy with `prisma migrate deploy`. **SCC is different** — hand-written
idempotent SQL only, never `prisma migrate dev` there. None of these 7 touch SCC.

**4. Effort figures** are implementation-only and assume the migration applies
cleanly. Add QA and deploy time on top.

---

## 1. PT packages (unblocks the ₹500 hardcode)

**Why:** `TrainerClient` carries only `assigned_date | status | notes`. There is
no sessions-purchased/remaining concept anywhere, so PT can't be sold as a pack,
and `trainer.service.ts:247` books every completed session at a hardcoded
`sessionRate = 500` — meaning all `TrainerRevenue`, all commission, and the PT
revenue category I wired in M0 Fix 2 are internally consistent but priced wrong.

**Schema:**
```prisma
model PtPackage {                    // catalogue: what a gym sells
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  gym_id         String   @db.Uuid
  branch_id      String?  @db.Uuid   // null = gym-wide
  name           String
  total_sessions Int
  price          Decimal  @db.Decimal(10, 2)
  validity_days  Int?                // null = no expiry
  is_active      Boolean  @default(true)
  created_at     DateTime @default(now()) @db.Timestamptz()
  updated_at     DateTime @default(now()) @updatedAt @db.Timestamptz()
  @@index([gym_id])
  @@map("pt_packages")
  @@schema("studio_template")
}

model MemberPtPackage {              // a member's purchased pack
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  gym_id             String   @db.Uuid
  member_id          String   @db.Uuid
  package_id         String   @db.Uuid
  trainer_id         String?  @db.Uuid
  invoice_id         String?  @db.Uuid   // links the sale to revenue
  sessions_total     Int
  sessions_remaining Int
  price_paid         Decimal  @db.Decimal(10, 2)
  /** price_paid / sessions_total — the per-session rate that replaces ₹500 */
  session_rate       Decimal  @db.Decimal(10, 2)
  status             String   @default("active")  // active | exhausted | expired | cancelled
  expires_at         DateTime? @db.Timestamptz()
  created_at         DateTime @default(now()) @db.Timestamptz()
  @@index([gym_id, member_id])
  @@map("member_pt_packages")
  @@schema("studio_template")
}
```
Plus **`TrainerSession.member_package_id String? @db.Uuid`** so a completed
session decrements the right pack and books the right rate.

**tenant-models.ts:** add `'PtPackage'`, `'MemberPtPackage'`.

**API:** `GET/POST/PATCH/DELETE /pt-packages` (catalogue);
`POST /members/:id/pt-packages` (sell, creates invoice);
`GET /members/:id/pt-packages`. `trainer.service.completeSession` decrements
`sessions_remaining` and books `TrainerRevenue` at `session_rate`.

**UI:** package catalogue under Settings; "Sell PT package" on the member page;
remaining-sessions badge on the PT-sessions screen I shipped in M2-2.

**Member app:** surface remaining sessions (BFF has no PT exposure at all today).

**Effort:** L (~1.5 weeks). **Risk:** medium — touches money. Existing
`TrainerRevenue` rows keep their ₹500-derived values; decide whether to backfill
or leave history as-is and cut over from a date.

---

## 2. CRM follow-ups

**Why:** M2-3 shipped conversion, dedupe and assignee history, but `Lead` has no
date field to schedule a follow-up against, so there is still no "call them back
Tuesday" and no reminder.

**Schema:** on `Lead`:
```prisma
  next_follow_up_at DateTime? @db.Timestamptz()
  follow_up_notes   String?
  @@index([next_follow_up_at])
```

**API:** `PATCH /leads/:id` accepts the new fields; `GET /leads/due-follow-ups`.

**Cron:** extend the existing `AutomationDispatcherService` daily sweep with a
`lead_follow_up_due` trigger — the executor, tenant loop and cron lock already
exist, so this is a small addition rather than new infrastructure.

**UI:** date picker on the lead detail page; "Due today" filter on the list;
overdue count badge.

**Effort:** M (2–3 days). **Risk:** low — additive nullable columns.

---

## 3. Waiver e-signature

**Why:** `MemberDocument.document_type` accepts the string `'waiver'` and that's
the entire feature — there is no signature capture, no consent record, no
versioning. Competitors lead with this and it is a liability question, not a
convenience one.

**Schema:**
```prisma
model MemberWaiver {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  gym_id        String   @db.Uuid
  member_id     String   @db.Uuid
  /** Which waiver text they agreed to — never mutate a signed version. */
  waiver_version String
  waiver_text   String                          // snapshot of the terms as signed
  signature_url String                          // PNG in the private documents bucket
  signed_at     DateTime @db.Timestamptz()
  signed_ip     String?
  signed_via    String   @default("member_app") // member_app | kiosk | admin
  created_at    DateTime @default(now()) @db.Timestamptz()
  @@index([gym_id, member_id])
  @@map("member_waivers")
  @@schema("studio_template")
}
```

**tenant-models.ts:** add `'MemberWaiver'`.

**API:** `GET /waiver/current` (active text), `POST /members/:id/waiver`
(store signature), `GET /members/:id/waiver`. Member BFF:
`GET/POST /member/v1/waiver`.

**UI:** signature pad — **needs a dependency decision.** A canvas-based pad can
be hand-rolled (~80 lines, no dep) or use `react-signature-canvas`. Member app
would use `react-native-svg` (already present) for the same reason.

**Storage:** reuse the existing private Supabase bucket + 1-hour signed URLs.

**Effort:** M (3–4 days). **Risk:** low technically; **legal review recommended**
on the waiver text and on what "signed" must capture in your jurisdiction.

---

## 4. Server-backed notification inbox

**Why:** the member app's inbox is synthesised client-side from the Home payload
and chat unread counts, with read-state stored on-device. Nothing the server
sends (automation messages, campaign pushes, class reminders — including the
ones I shipped in M1) actually lands in an inbox, and read state doesn't survive
a reinstall.

**Schema:**
```prisma
model MemberNotification {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  gym_id     String    @db.Uuid
  member_id  String    @db.Uuid
  category   String                              // membership | class | payment | promo | system
  title      String
  body       String
  /** Deep link, e.g. "/membership" or "/classes/123". */
  action_url String?
  read_at    DateTime? @db.Timestamptz()
  created_at DateTime  @default(now()) @db.Timestamptz()
  @@index([gym_id, member_id, read_at])
  @@map("member_notifications")
  @@schema("studio_template")
}
```

**tenant-models.ts:** add `'MemberNotification'`.

**API:** `GET /member/v1/notifications` (paged), `POST .../:id/read`,
`POST .../read-all`, unread count on `GET /member/v1/home`.

**Writers:** `AutomationDispatcherService`, `CampaignSenderService`,
`PushService` — each writes a row alongside the outbound send, so the inbox is
the durable record of what was sent.

**Effort:** M (3–4 days). **Risk:** low. Note this **supersedes** the current
client-side inbox — plan the cutover so members don't see duplicates.

---

## 5. WhatsApp template registry

**Why:** `MetaCloudProvider.sendTemplate()` is implemented but **never called** —
every outbound message is free-form session text. Meta only permits that inside
a 24-hour customer-service window, so the expiry reminders, birthday wishes,
class reminders and receipts I wired in M0/M1 **will be rejected for cold
contacts** in production. This is the single biggest deliverability risk in the
messaging stack.

**Schema:**
```prisma
model WhatsAppTemplate {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  gym_id         String   @db.Uuid
  /** Name as registered with Meta. */
  template_name  String
  language       String   @default("en")
  category       String                        // MARKETING | UTILITY | AUTHENTICATION
  body_text      String                        // local copy for preview
  variables      String[]                      // ordered placeholder names
  /** Meta review state. */
  status         String   @default("pending")  // pending | approved | rejected | paused
  rejection_note String?
  /** Which internal trigger uses it (membership_expiring, class_reminder…). */
  maps_to_event  String?
  synced_at      DateTime? @db.Timestamptz()
  created_at     DateTime @default(now()) @db.Timestamptz()
  @@unique([gym_id, template_name, language])
  @@map("whatsapp_templates")
  @@schema("studio_template")
}
```

**tenant-models.ts:** add `'WhatsAppTemplate'`.

**API:** `GET/POST /whatsapp/templates`, `POST /whatsapp/templates/sync` (pull
approval status from Meta's Graph API).

**Dispatcher change:** when a trigger has an approved template, send via
`sendTemplate` with ordered variables; fall back to session text only when the
contact is inside the 24h window.

**Effort:** M (3–4 days) — **but gated on Meta approval turnaround**, which is
days-to-weeks and outside your control. Start template submission early.

**Risk:** medium. Get this in before relying on automated reminders at scale.

---

## 6. Campaign opt-out / consent

**Why:** bulk WhatsApp/email campaigns have no unsubscribe concept and no
consent check. That is a compliance exposure (DPDP here, and Meta's own policy)
and a fast route to a WABA quality-rating downgrade.

**Schema:** on `Member`:
```prisma
  marketing_opt_out_at DateTime? @db.Timestamptz()
  opt_out_source       String?   // whatsapp_reply | email_link | staff | member_app
```
Optionally per-channel later; a single flag is the honest MVP.

**Sender change:** `CampaignSenderService` filters out opted-out members and
records them as `skipped` rather than `sent`. Inbound WhatsApp "STOP" in
`WhatsAppInboxService` sets the flag.

**UI:** opt-out toggle on the member page; excluded-count shown on the campaign
audience screen.

**Effort:** S–M (1–2 days). **Risk:** low. **Do this before any large send.**

---

## 7. Recurring auto-charge (mandates)

**Why:** `auto_renew` exists and the 3AM cron creates a renewal row, but it
**never charges anything** — it writes `payment_method: 'bank_transfer'`,
`status: 'pending'`. `MemberMembership.payment_method_token` exists in the schema
and is read/written nowhere. So "auto-renew" today means "auto-create an unpaid
invoice".

**Schema:**
```prisma
model PaymentMandate {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  gym_id            String   @db.Uuid
  member_id         String   @db.Uuid
  gateway           String                       // razorpay | stripe
  /** Razorpay subscription/token id or Stripe payment_method id. */
  gateway_mandate_id String
  status            String   @default("active")  // active | paused | cancelled | failed
  max_amount        Decimal? @db.Decimal(10, 2)
  next_charge_at    DateTime? @db.Timestamptz()
  created_at        DateTime @default(now()) @db.Timestamptz()
  @@index([gym_id, member_id])
  @@map("payment_mandates")
  @@schema("studio_template")
}
```

**tenant-models.ts:** add `'PaymentMandate'`.

**Also:** drop or start using `MemberMembership.payment_method_token` — leaving a
dead secret-shaped column is a footgun (it's already in the
`StripSecretsInterceptor` redact list, implying someone expected it to hold a
token).

**Third-party:** Razorpay Subscriptions / UPI Autopay — a **separate product
application with its own KYC**, not just API keys. Stripe needs
`setup_intent` + off-session charging.

**Cron change:** `renewals.service.ts` charges via the mandate, then falls back
to the current pending-invoice behaviour when there is no mandate. Dunning can
reuse the existing `PaymentRetryLog` model.

**Effort:** L (1.5–2 weeks). **Risk:** high — it is unattended charging of real
customers. Needs its own test plan, a hard cap (`max_amount`), and an audit trail.

---

## Suggested order

| # | Item | Effort | Gate | Why this position |
|---|---|---|---|---|
| 1 | Campaign opt-out | S–M | none | Compliance; do before any large send |
| 2 | WhatsApp templates | M | **Meta approval — start now** | Reminders shipped in M1 will be rejected without it |
| 3 | CRM follow-ups | M | none | Cheap, completes M2-3 |
| 4 | Notification inbox | M | none | Makes M1's messages durable |
| 5 | Waiver e-sign | M | legal review; maybe 1 dep | Liability, independent of the rest |
| 6 | PT packages | L | none | Fixes the ₹500 hardcode; touches money |
| 7 | Auto-charge mandates | L | **Razorpay/Stripe KYC** | Highest risk, longest external lead time |

Items 2 and 7 have external dependencies with real lead time — **start those
applications now even if you build them last.**

## Still not code (unchanged from the gap analysis)

- **App Store / Play submission** — `eas.json` `submit.production` is empty.
- **i18n / Hindi** — XL, needs a new dependency and translators.
- **Gateway refunds** — refunds remain ledger-only; wiring the Razorpay/Stripe
  refund APIs needs no schema change but does need live keys to test.
