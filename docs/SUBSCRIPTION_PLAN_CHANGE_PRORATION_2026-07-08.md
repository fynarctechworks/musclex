# Subscription Plan Changes & Proration — shipped 2026-07-08

Industry-standard SaaS plan-change lifecycle for MuscleX gym subscriptions
(the money gyms pay MuscleX). Complements the existing renewal engine
(continuity-strict periods, GST, invoices, ledger, Razorpay + manual payments).

**Completion slice (same day):**
- **Renewal GST fix** — `renew()` used to record the PRE-GST plan price while
  Razorpay charged the GST-inclusive total (and the invoice PDF back-computed
  GST from the wrong figure). All renewal paths now record the GST-inclusive
  total; `renewal-preview` and `status` return subtotal/GST/total breakdowns
  and the checkout summary shows them.
- **Cancellation is real** — `POST /subscription/cancel` now schedules an
  end-of-period downgrade to the FREE tier (same machinery as downgrades, cron
  applies it), so a cancelled gym lands on the free plan instead of drifting
  into grace → locked. Reactivation = "Keep current plan" on the pending
  banner (DELETE change-plan/scheduled) or simply renewing — a renewal ignores
  FREE-tier schedules as its default (`getRenewalDefaultChange`) and the
  resulting `renewed` event supersedes the cancellation.
- **Scheduled-change confirmation email** (queue-backed, non-blocking).

## The model (server-decided, never client-decided)

Every plan-change request is classified server-side into one of three modes:

| Mode | When | What happens |
|---|---|---|
| `immediate_prorated` | **Upgrade** (higher price, same cycle) mid active paid period | Pay only `(new − old) × remaining/total` (+GST) now. Plan flips instantly. **Billing date does not move.** Next renewal bills the full new-plan price. |
| `scheduled` | **Downgrade**, equal-price lateral, or **cycle switch** mid period | Nothing to pay. Recorded in the ledger; current plan stays until period end. Applied at next renewal (paid targets) or by cron at period end (free tier). No mid-cycle refunds — standard abuse prevention. |
| `renewal_due` | No active paid period (expired / grace / locked / no billing date) | Proration doesn't apply — the change happens through the normal renew checkout at full price. |

### Proration formula (`backend/src/subscription/proration.util.ts`)

```
total_days     = 30 (monthly) | 90 (quarterly) | 365 (annual)   // matches computeNextPeriod
remaining_days = clamp(ceil((next_billing_date − now) / day), 0, total_days)
unused_credit  = current_price × remaining_days / total_days
remaining_cost = target_price  × remaining_days / total_days
subtotal       = max(0, remaining_cost − unused_credit)
total          = subtotal + GST (platform rate from scc.platform_settings)
```

Example (real plans): Starter ₹999 → Pro ₹2,499 with 15 of 30 days left
→ credit ₹499.50, remaining cost ₹1,249.50, **pay ₹750** (+GST).

## Where the pending change lives (NO schema change)

Scheduled changes are **ledger-derived** from `subscription_events` — the
latest event among `plan_change_scheduled | plan_change_unscheduled | renewed |
plan_changed` decides. A newer renewal or applied change supersedes an older
schedule automatically. The scheduled event stores `effective_at` in the
`period_end` column so the cron can range-query due changes.

## API surface (`/api/v1/subscription/*`, owner/brand_owner)

- `GET  change-plan/preview?plan=&billing_cycle=` — mode + full credit/charge/GST breakdown
- `POST change-plan` — schedules a change, applies a zero-amount upgrade, or records a MANUAL-paid prorated upgrade (payment_method + payment_reference)
- `POST change-plan/create-order` — Razorpay order for a prorated upgrade (`notes.kind='plan_change'`, breakdown frozen in server-set notes)
- `POST verify` — existing endpoint now routes by `notes.kind`: `subscription` → renew, `plan_change` → prorated upgrade
- `DELETE change-plan/scheduled` — cancel the pending scheduled change
- `GET  status` — now includes `pending_change`
- `create-order` / `renew` / `renewal-preview` — when no plan is passed explicitly, a pending scheduled change becomes the default target (the schedule is *consumed at renewal*)

## Safety properties

- Amounts always computed server-side; Razorpay order notes are server-set and re-validated at verify.
- `recordPlanChange` (policy service) is idempotent on `payment_reference` (replay-safe), runs in one transaction, and refuses **stale orders** — if the billing period or source plan moved between order creation and payment, it errors rather than misprice.
- Paid upgrades create a real invoice (period = now → next_billing_date) and mirror into `scc.payments` (same chokepoint pattern as renewals).
- Cron (`applyDueScheduledChanges`, daily 02:00 UTC before reconcile) applies due scheduled changes **only when the target plan is free** — paid targets are consumed by the next renewal payment because there is no auto-charge. A deliberate free-downgrade lands on the free tier instead of drifting into grace/locked.

## Frontend

- `settings/subscription` — plans grid now shows at all times: in the renewal window it renews (existing behavior); mid-cycle upgrades say "Upgrade now — prorated" and downgrades/cycle switches say "Switch at period end". Pending-change banner with "Keep current plan" cancel.
- `settings/subscription/checkout?intent=change` — renders per server mode: prorated payment form with credit/charge/GST breakdown, a no-payment "confirm scheduled change" card, or falls back to the plain renewal flow.

## Tests

- `backend/src/subscription/proration.util.spec.ts` — money math (textbook + real plans, clamps, rounding, downgrade floor) + mode classification.
- `backend/src/subscription/subscription.service.plan-change.spec.ts` — service orchestration: mode routing, GST-on-proration, payment validation, order-note freezing, GST-inclusive renewals, schedule consumption (paid consumed / free ignored / explicit supersedes), cancel → free-tier scheduling.
- `backend/src/common/services/subscription-policy.plan-change.spec.ts` — ledger supersede semantics, schedule/cancel event shapes.
- `backend/test/subscription/record-renewal-scc-sync.service.spec.ts` — repaired DI token (PrismaService → PublicPrismaService, stale since the two-client split).

## Deliberate non-goals (for now)

- No credit wallet (Scenario 3 in the research) — credit is consumed inline in the prorated charge.
- No mid-cycle refunds on downgrades (industry standard).
- No auto-charge at period end — renewals stay customer-initiated, so scheduled *paid* changes take effect at the next payment.
- Immediate prorated path is same-cycle upgrades only; cross-cycle moves are scheduled.
