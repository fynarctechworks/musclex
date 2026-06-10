# Member BFF — Functional Gap Remediation
**Date:** 2026-06-07 · **Branch:** `feat/member-bff-phase0` · **Scope:** the 3 orphaned member-BFF endpoints found in [IMPLEMENTATION_AUDIT.md](./IMPLEMENTATION_AUDIT.md).

## Summary
All three endpoints that existed in the OpenAPI contract + app but had **no backend route** (would 404 at runtime) are now **implemented, tenant-scoped, validated, audited, and tested**. Decision for all three: **implement** (not de-wire) — the app UI and contract already expected them and they are real member-value features (renewal, progress photos).

| Endpoint | Before | After |
|---|---|---|
| `POST /membership/renew` | 🔶 404 | ✅ Implemented |
| `POST /progress/photos/upload-url` | 🔶 404 | ✅ Implemented |
| `POST /progress/photos` | 🔶 404 | ✅ Implemented |

---

## Flow traces (as required before coding)

### A. `POST /membership/renew`
- **Frontend screen:** `membership.tsx` (Renew CTA, surfaced via `member-context.service.ts:160 renewMembership`).
- **Frontend service:** `gym-member-app/src/api/endpoints.ts:131` → `request<RazorpayOrder>('/membership/renew', …)`.
- **Contract:** `member-api.types.ts` `/membership/renew` (body `{ planId }`, `Idempotency-Key` header, returns `RazorpayOrder`).
- **Backend controller (NEW):** `MemberCoreController.renew` — `@Post('membership/renew') @HttpCode(200) @Idempotent()`.
- **Backend service (NEW):** `MemberBillingService.renew` → **delegates to the existing `PaymentsService.createOrder`** (creates the pending `Payment` + Razorpay order with the `notes` the verify/webhook path already consumes, so payment actually credits the membership — no forked billing logic).
- **DB:** `MembershipPlan` (gym-scoped validation), `Member` (branch), `Payment` (created by `PaymentsService`).

### B. `POST /progress/photos/upload-url` + `POST /progress/photos`
- **Frontend service:** `endpoints.ts:167` (`UploadTarget`) and `:172` (confirm). App PUTs the file to the signed URL, then confirms.
- **Contract:** upload-url body `{ contentType }` → `UploadTarget { photoId, uploadUrl }`; confirm body `{ photoId, takenAt }`.
- **Backend controller (NEW):** `MemberCoreController.photoUploadUrl` (`@HttpCode(200)`) + `confirmPhoto` (`@HttpCode(201)`).
- **Backend service (NEW):** `MemberProgressPhotoService` — Supabase Storage signed **upload** URL into the private `member-photos` bucket; `confirm` persists `MemberProgressPhoto`.
- **DB:** `MemberProgressPhoto` (existing model; `GET /progress` already reads photos — only the write path was missing, exactly as the `getProgress` code comment noted).

---

## What was built

**New files**
- `backend/src/member/data/member-billing.service.ts`
- `backend/src/member/data/member-progress-photo.service.ts`
- `backend/src/member/data/member-billing.service.spec.ts` (3 tests)
- `backend/src/member/data/member-progress-photo.service.spec.ts` (4 tests)

**Modified**
- `member-core.controller.ts` — 3 new routes (identity from `@CurrentMember` only).
- `dto.ts` — `RenewMembershipDto` (`@IsUUID planId`), `ProgressPhotoUploadUrlDto` (`@IsIn` MIME allowlist), `ProgressPhotoConfirmDto` (`@IsUUID photoId`, `@IsISO8601 takenAt`).
- `member.module.ts` — import `PaymentsModule` + `AuditModule`; register the 2 services.

## Security / tenant-isolation measures (per CLAUDE.md)
- **Plan re-validated against the member's own gym** (`findFirst { id, gym_id: tenantId }`) **before** delegating — guards the known `findUnique` fails-open class in `PaymentsService`.
- **Identity only from the verified token** — no `memberId`/`tenantId`/`planId`-owner trust from the client.
- **Photo object path is token-derived** (`tenantId/memberId/photoId`) → a member can only address their own folder; cross-member/cross-gym access is impossible by construction.
- **`confirm` verifies the object exists** before persisting (no phantom rows) and **rejects non-UUID `photoId`** (path-traversal guard).
- **Private bucket** (`public:false`, 5 MB limit, image MIME allowlist); signed READ URLs deferred (consistent with current `getProgress`).
- **Audit logging** on both actions via `AuditService` (`module: 'member-bff'`), non-fatal so a logging failure never blocks the user action.
- **Authorization:** both live on `MemberDataController` = `MemberJwtGuard + GymMemberGuard` (gym members only; public users 403). Renewal is `@Idempotent()` for the offline outbox.

## Tests
`node_modules/.bin/jest member-billing.service.spec member-progress-photo.service.spec` → **7 passed / 7**. Backend `tsc --noEmit` → **clean (exit 0)**.

## Risks / unverified
- **End-to-end runtime is UNVERIFIED here** (no live Razorpay keys / Supabase bucket exercised in this pass) — unit-level only. Manual QA: a real renewal checkout + a real photo PUT→confirm on device.
- Renewal correctness depends on the **existing** `PaymentsService` verify/webhook crediting the membership; this remediation reuses that path rather than re-testing it.
- `member-photos` bucket auto-creates on first call (mirrors `uploads.controller`); confirm the bucket exists in prod or pre-create it.

## NOTED FOR LATER
- Signed READ URLs for progress photos are still deferred (whole `getProgress` photo set returns raw storage paths).
- Add a CI check that every OpenAPI contract path has a matching Nest route (would have caught these three automatically).
