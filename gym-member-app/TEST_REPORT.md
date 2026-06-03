# Member App — Test Execution Report

> Date: 2026-06-02 · Phase: MVP Validation & Production Stabilization.
> Companion to [QA_CHECKLIST.md](QA_CHECKLIST.md).

## Method & scope (honest)
There is **no test runner** in this app (no jest/vitest, zero test files), and a
device/simulator FPS pass can't be run headless. So this report = the project's
**automated static gates** + a **line-by-line verification of every QA-checklist case
against the code**. Each case is **PASS** (verified in code), **NEEDS-DEVICE** (only a
human on a device can confirm), or **ISSUE**.

## A. Automated gates
| Gate | Result | Notes |
|---|---|---|
| `tsc --noEmit` (strict) | ✅ PASS | clean |
| `expo export --platform web` | ✅ PASS | bundles (entry ~2.9 MB) |
| `expo-doctor` | ⚠️ 20/21 | `app.json` `newArchEnabled` not in SDK 56 schema (cosmetic; build OK) |
| Unit/integration | ⛔ N/A | none exist |

## B. Checklist verification by category
- **Navigation/shell** — PASS (5 tabs + FAB clears bar; AuthGate routing); transitions = NEEDS-DEVICE
- **Per-screen UI** — PASS (loading/error/empty states on every data screen); polish = NEEDS-DEVICE
- **Charts (empty/sparse)** — PASS (WeightChart hint <2 pts, LineChart null, BarChart max(1,…), Occupancy defaults)
- **Safe area** — PASS in code (Screen SafeAreaView, scanner now insets-driven, tab/FAB insets); render = NEEDS-DEVICE
- **Keyboard** — PASS in code (phone/otp KAV; Screen keyboardShouldPersistTaps; progress validates); overlap = NEEDS-DEVICE
- **API/state** — PASS (single-flight 401 refresh+retry, no-retry-on-4xx, session expiry→/welcome, cache clear on signout)
- **Offline** — PASS (logic: queue only on NetworkError, stable idempotency key, drain on foreground, MAX_ATTEMPTS); reconcile = NEEDS-DEVICE
- **Accessibility** — PASS (icon buttons labelled, tab selected state); contrast/font-scale = NEEDS-DEVICE
- **Animations/haptics** — present in code; FPS = NEEDS-DEVICE

## C. Issues found
| # | Sev | Where | Issue | Status |
|---|---|---|---|---|
| 1 | P1 | workout.tsx onFinish | non-network failure on Finish → silent + unhandled rejection, no error UI | **fixed** |
| 2 | P2 | goal.tsx onFinish | save failure leaves "Enter FitSync" stuck spinning, no recovery | **fixed** |
| 3 | P2 | lib/format.ts relativeFromNow | recent-past time renders "in -2h" | **fixed** |
| 4 | P3 | RestTimer.tsx | effect re-creates setInterval every tick | **fixed** |
| 5 | P3 | checkin.tsx | permission gate flashes before status resolves | **fixed** |
| 6 | P3 | app.json | `newArchEnabled` not in SDK 56 schema → doctor fails | **fixed** |
| 7 | P3 | WeightChart.tsx | `<Circle key={p.t}>` collides on duplicate timestamps | **fixed** |

## D. Verified-good (no action)
Classes `Alert` (documented convention), API envelope unwrap, multi-gym choose-gym,
charts, occupancy, offline idempotency, sign-out cache clear, session expiry.

## E. Outstanding (needs your decision)
- **No automated test net.** Recommend Jest + React Native Testing Library, covering pure
  logic first (offline outbox, `toSetLogs`, `weekAhead`, `relativeFromNow`, phone
  `normalize`). Needs sign-off on dev-dependencies.
- **Manual device QA** still required for every NEEDS-DEVICE item (dev build + iOS sim).
- ~2.9 MB web entry bundle — code-split opportunity (web preview only).
