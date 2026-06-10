# Phase 8.2 — Mobile App QA (Findings + UAT Test Matrix)

**Date:** 2026-06-07 • **App:** `gym-member-app` (Expo/RN) • **Method:** static review of the runtime/data/auth/offline layers + state-coverage metrics. RN UI behavior (animation, gesture, layout, on-device nav) is **device-only QA** and is listed as such — not verifiable from here (per CLAUDE.md).

---

## Verdict: runtime robustness infrastructure is **production-grade**. No structural defects found.

### Network / API resilience — [src/api/client.ts](../../gym-member-app/src/api/client.ts)
- 401 → **single-flight** token refresh → retry once → `notifyExpired()` (no refresh stampede). ✅
- `NetworkError` on fetch failure; `MemberApiError` carries `code/status/retryable`. ✅
- Graceful 204 + empty-body handling (nullable resources don't become false error states). ✅
- `Idempotency-Key` header support for safe write retries. ✅

### React Query config — [src/lib/query-client.ts](../../gym-member-app/src/lib/query-client.ts)
- Retry policy: **network/5xx only (≤2)**, never 4xx. ✅
- `staleTime` 30s; polling + focus refetch **paused while backgrounded** via `AppState`↔`focusManager` (battery). ✅

### Data/mutation layer — [src/api/queries.ts](../../gym-member-app/src/api/queries.ts)
- 48 queries + 20 mutations centralized; **32 `onError`/`onMutate`/`onSettled`/`invalidateQueries`** handlers → optimistic updates with rollback + cache invalidation. ✅
- Screen state coverage (via hooks): 20 files render loading, 17 render error, 15 use `EmptyState`. Healthy. ✅

### Session / auth — [src/auth/auth-store.ts](../../gym-member-app/src/auth/auth-store.ts)
- Expiry wired to auto `signOut()`; `signOut` clears tokens **and** `queryClient.clear()` (no stale data leak between sessions). ✅
- Dev-only OTP bypass is hard-gated off in prod (verified previously).

### Offline — [src/offline/outbox.ts](../../gym-member-app/src/offline/outbox.ts)
- Writes enqueued with client idempotency key; flush on foreground/reconnect; **non-retryable 4xx are not retried** (won't infinite-loop on a rejected write). ✅
- Platform-split DB (`db.ts` / `db.web.ts`) so web build doesn't choke on `expo-sqlite` wasm. ✅

---

## 🔴 Device-only QA — MUST be exercised during UAT (not verifiable statically)
Give this matrix to UAT testers. Each needs a real dev build (Expo Go can't run native modules).

**Auth**
- [ ] New user OTP request + verify + first session
- [ ] Existing user login; logout; OTP retry after wrong/expired code; OTP rate-limit message
- [ ] Session expiry mid-use → auto-redirect to login, no crash, no stale data shown
- [ ] Device change / reinstall → re-auth works

**Onboarding**
- [ ] First launch full flow; resume after app close mid-flow (state persisted server-side); back-nav; skip; validation messages

**Public user (gym-independent)**
- [ ] Dashboard, calculators, nearby gyms (location permission grant/deny), referrals, streaks, goals, progress

**Gym member**
- [ ] Membership card, attendance/check-in, classes (book/cancel), subscription/renewal, trainer chat (send offline → reconnect flush), gym notices, progress

**Cross-cutting**
- [ ] Airplane-mode: error states render (not blank/spinner-forever); recover on reconnect
- [ ] Deep links + push-tap navigation land on the right screen (depends on Phase 8.6 push creds)
- [ ] Referral link open → attribution
- [ ] Slow-network: loading states, no duplicate submits (idempotency)

---

## NOTED FOR LATER (non-blocking)
- Only `PublicProgress.tsx` shows an explicit inline `onRetry`; most retry happens via React Query auto-retry. Consider a shared "retry" affordance on `ErrorState` for manual recovery on permanent-feeling errors. (UX nicety, not a defect.)
- No automated tests exist for the member app (by design) — the matrix above is the safety net for UAT.

---
*Static review found a production-grade resilience layer. Device-interaction QA is delegated to UAT via the matrix above. No code changed.*
