# SAAS UPGRADE ROADMAP — MuscleX (2026-06-18)

High-value, enterprise-grade gaps (Salesforce/Shopify/Stripe-class), prioritized.
Only items that earn their keep — not a feature dump.

## Now (correctness/safety — mostly done or migration-gated)
- ✅ Money/booking/check-in concurrency hardening (shipped: Modules 2/3/4/5/9).
- ✅ Account-takeover closed (P0-2).
- ⬜ **Finish the per-gym-schema migration** incl. test-harness mock update
   (X-1) and onboarding↔runtime schema parity (P0-1) — unblocks safe scale.
- ⬜ **Payment-reference unique constraint** (P1-M9-1 race-proof) — DB migration.
- ⬜ **R3 sweep** — eliminate legacy-prisma by-id tenant reads (X-2).

## Next (enterprise table-stakes)
- **Usage metering + plan limits enforcement** — gate features by plan
  (member caps, branches, feature-flags already scaffolded in SCC) with hard/soft limits.
- **Data export / portability** per tenant (CSV/JSON) — compliance + churn-safety.
- **Audit-log surface for gym owners** (not just SCC) — who-changed-what on members/billing.
- **Webhook signature hardening** for the non-Razorpay `platform/webhooks` + integrations surface.
- **Idempotency keys** as a first-class platform primitive (member BFF already has an
  idempotency service — generalize to all mutating gym/billing endpoints).

## Later (differentiation / scale)
- **Per-schema client eviction (LRU)** + connection governance at high tenant counts.
- **Disaster recovery runbook + PITR validation**; backup restore drills.
- **Observability**: the SCC Error Center exists — extend client SDK + perf tracing
  (its phases 4–5 per project memory).
- **AI/automation**: dunning/retention automation on the subscription lifecycle
  events (already ledgered), and member-facing AI on the BFF (competitive gap per memory).
- **Compliance readiness**: data-retention policies, PII map (scrubber exists), DPA tooling.

## Guiding note
The platform's foundations (auth, billing integrity, tenant isolation target
architecture, RBAC, SCC governance) are sound. The single highest-leverage
investment is **completing the per-gym-schema migration cleanly** — it removes the
R3 leak class, restores the test safety net, and unlocks confident scaling.
