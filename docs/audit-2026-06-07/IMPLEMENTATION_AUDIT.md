# MuscleX — Implementation Wiring Audit
**Date:** 2026-06-07 · **Branch:** `feat/member-bff-phase0` · **Method:** route-decorator inventory + contract cross-reference + frontend API-call mapping. **Read-only.**

> **Scope honesty.** The backend exposes **700 route decorators across 76 controllers** and **183 Prisma models**. A literal per-endpoint claim of status for all 700 would be fabrication. This audit goes **deep + verified** on the **Member BFF** (your special-focus area — every endpoint cross-referenced screen↔contract↔controller) and **macro + sampled** on the admin/SCC surface, with everything not directly traced marked **UNVERIFIED**.

---

## 1. Macro inventory (verified counts)

| Layer | Count | Source |
|---|---:|---|
| Backend controllers | 76 | `grep @Controller` |
| Backend route decorators | 700 | `grep @Get/@Post/@Put/@Patch/@Delete` |
| Member BFF controllers | 12 (+1 decorator) | `backend/src/member/data` + `member/auth` |
| Prisma models | 183 | `schema.prisma` |
| Migrations on disk | 48 dirs | `prisma/migrations` |
| Member-app screens | 40 | `gym-member-app/app/**/*.tsx` |
| Admin frontend src files | 502 | `frontend/src` |
| SCC src files | 196 | `saas-control-center` |

---

## 2. Member BFF wiring matrix (fully traced)

Legend: ✅ Fully Implemented (contract + frontend call + backend route all present) · ⚠ Partial · ❌ Missing backend · 🔶 Orphaned frontend (app calls it, no backend route).

| Endpoint | Contract | App call | Backend route | Status |
|---|:--:|:--:|:--:|---|
| `GET/PATCH /me`, `/me/profile`, `/me/weekly`, `/me/context` | ✅ | ✅ | ✅ member-core/public | ✅ |
| `GET /home` | ✅ | ✅ | ✅ | ✅ |
| `GET /gym/occupancy`, `/gym/locations` | ✅ | ✅ | ✅ | ✅ |
| `GET /me/nearby-gyms`, `GET /me/gyms/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /me/tools/compute` | ✅ | ✅ | ✅ | ✅ |
| `GET /membership` | ✅ | ✅ | ✅ | ✅ |
| `POST /membership/renew` | ✅ | ✅ (`RazorpayOrder`) | ✅ (`MemberBillingService`) | ✅ **REMEDIATED 2026-06-07** |
| `POST /checkins` | ✅ | ✅ | ✅ | ✅ |
| `GET /progress`, `POST /progress/metrics` | ✅ | ✅ | ✅ | ✅ |
| `POST /progress/photos/upload-url` | ✅ | ✅ | ✅ (`MemberProgressPhotoService`) | ✅ **REMEDIATED 2026-06-07** |
| `POST /progress/photos` (confirm) | ✅ | ✅ | ✅ (`MemberProgressPhotoService`) | ✅ **REMEDIATED 2026-06-07** |
| `GET /workouts/today`, `POST /workouts/:id/logs` | ✅ | ✅ | ✅ | ✅ |
| `GET /classes`, `POST/DELETE /classes/:id/book(ing)` | ✅ | ✅ | ✅ | ✅ |
| `GET /exercises`, `/exercises/:id`, `PUT/DELETE …/favorite` | ✅ | ✅ | ✅ | ✅ |
| `GET /nutrition/today`, `/foods`, `POST /meals`, `/water`, `PUT /goal` | ✅ | ✅ | ✅ | ✅ |
| `POST /health/samples`, `GET /health/summary`, `GET/POST/DELETE /health/connections` | ✅ | ✅ | ✅ | ✅ |
| `GET /community/leaderboard`, `/challenges`, `POST …/join`, `/badges` | ✅ | ✅ | ✅ | ✅ |
| `GET /trainer-chat/threads`, `GET/POST …/messages` | ✅ | ✅ | ✅ | ✅ |
| `POST/DELETE /notifications/device-tokens`, `/me/device-tokens` | ✅ | ✅ | ✅ | ✅ |
| `/me/weight`, `/me/water`, `/me/goals*`, `/me/health/daily`, `/me/events`, `/me/notifications/ack`, `/me/referral` | ✅ | ✅ | ✅ | ✅ |

> ✅ **UPDATE 2026-06-07:** all three gaps below are now **REMEDIATED** — see [MEMBER_BFF_GAP_REMEDIATION.md](./MEMBER_BFF_GAP_REMEDIATION.md). Routes, gym-scoped services, DTO validation, audit logging, and 7 unit tests added; backend `tsc` clean. The text below is retained as the original finding.

### 🔶 The three confirmed gaps (were 404 at runtime — now fixed)
Verified: `membership/renew`, `progress/photos/upload-url`, `progress/photos` exist in **both** the OpenAPI contract (`backend/src/member/contract/member-api.types.ts`) **and** the app (`gym-member-app/src/api/endpoints.ts:131,167,172`), but **no `@Post` handler exists** in `backend/src/member/data/*.controller.ts` (grep for `renew|photos|upload-url` returns only service-layer reads, no route).

**Member-facing impact:**
- **Membership renewal** — tapping "Renew" (the `renewMembership` CTA wired in `member-context.service.ts:160`) calls `POST /membership/renew` → **404**. Razorpay renewal is unreachable from the app. *(Consistent with project memory: "subscription billing still stubbed.")*
- **Progress photos upload** — the app can *read* photos (`GET /progress` returns them) but **cannot upload** new ones; both the signed-URL and confirm endpoints are missing.

These are **⚠ Partially Implemented** features (UI + contract done, backend route absent), not cosmetic. Recommend implementing the 3 handlers (or, if intentionally deferred, removing the app calls + contract entries so the surface doesn't lie).

> **Note:** the contract↔controller drift here is the *implementation-layer* analogue of the tenant-models drift class — a single source (the OpenAPI spec) that the controllers don't fully satisfy. Worth a CI check that every contract path has a matching route.

---

## 3. Orphan analysis

- **Orphaned frontend (app → no backend):** the **3** above. No others found in the BFF surface.
- **Orphaned backend (route → no app call):** the suspected ones (`nutrition/foods`, `community/leaderboard`, `health/summary`, `me/nearby-gyms`) are all **confirmed called** by the app — not orphans. A full 700-endpoint orphan sweep of the **admin/SCC** surface is **UNVERIFIED** (not traced this pass) — candidate for a `ts-prune`/route-coverage tool run in the Dead-Code slice.

---

## 4. Migration consistency (your special-focus)

- **48 committed migration dirs**, but **9 untracked** migrations sit in the working tree (`?? backend/prisma/migrations/2026060*`), covering nutrition, health-platform, member-onboarding, and the public-app-user identity/campaigns/events. **These are not in version control** → a fresh clone or another environment is missing schema the running DB already has = **drift risk** and a HARD-GATE (DB) item.
- `prisma/schema.prisma` has **183 models**; whether every model has a corresponding migration (and vice-versa) is **UNVERIFIED** — needs a `prisma migrate status` / `migrate diff` run (recommend before any deploy).
- **Recommendation (gated):** commit the 9 untracked migrations as part of the WIP-baseline commit, then run `prisma migrate status` to confirm DB ↔ migration-history ↔ schema are in sync.

---

## 5. Admin frontend ↔ backend & SCC (macro / UNVERIFIED)

- The admin `frontend/` (502 files) and SCC (196 files) per-feature wiring was **not traced endpoint-by-endpoint** this pass. The structural risk already established: **admin frontend has 4 test files** (the wiring is largely unverified by tests), and **SCC frontend lacks a server-side route guard** (see SECURITY_AUDIT M1).
- Recommend a follow-up slice that maps the admin app's API client calls against the 700 backend routes to find admin-side orphans — same method as §2, larger surface.

---

## 6. Status roll-up

| Area | Fully | Partial | Missing/Orphan | Confidence |
|---|---|---|---|---|
| Member BFF data endpoints | ~41 endpoints ✅ (3 remediated 2026-06-07) | 0 | 0 | **High** (fully traced) |
| Member-app screens (40) | wired to BFF | renew/photo blocked by §2 | — | High |
| Migrations | 48 committed | — | 9 untracked (drift) | High |
| Admin frontend (502 files) | — | — | — | **UNVERIFIED** |
| SCC (196 files) | — | — | — | **UNVERIFIED** |
| Backend admin routes (≈640 non-BFF) | — | — | — | **UNVERIFIED** |

---

## 7. Priority actions from this audit

1. **HIGH:** Implement (or formally defer + de-wire) `POST /membership/renew`, `POST /progress/photos/upload-url`, `POST /progress/photos`. These are user-visible 404s today.
2. **HIGH (gated):** Commit the 9 untracked migrations; run `prisma migrate status` to prove DB/schema/history consistency.
3. **MEDIUM:** Add a CI contract-coverage check (every OpenAPI path has a matching Nest route).
4. **MEDIUM:** Follow-up slice — admin/SCC frontend↔backend wiring trace (the large UNVERIFIED surface).

*No code or DB changed by this audit.*
