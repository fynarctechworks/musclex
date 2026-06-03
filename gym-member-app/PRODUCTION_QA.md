# Production QA — Phase 1 (Stabilization)

> Date 2026-06-02. Scope: the V2 modules (Nutrition, Exercise Library, Trainer Chat)
> plus the core loop. Companion to QA_CHECKLIST.md / TEST_REPORT.md.

## Method & honest scope
I can run the static gates (`tsc`, web bundle) and review code rigorously, but I
**cannot** drive Android/iOS/low-end/tablet devices or measure FPS, memory, touch
latency, or dark-mode visuals headless. Items below are **VERIFIED (code)**,
**FIXED**, or **NEEDS-DEVICE** (a human must confirm on a dev build + simulators).

## Fixed in this pass
- **Search fired an API call per keystroke** (exercise browse + nutrition food search):
  the query string was in the React Query key, so every character refetched. Added
  `useDebouncedValue` (300ms) on both → far fewer requests, smoother typing.
  [use-debounced-value.ts](src/lib/use-debounced-value.ts).
- **Polling didn't pause in the background**: React Query's `focusManager` wasn't wired
  to `AppState`, so the chat polls (8s conversation / 20s threads) and occupancy (15s)
  kept running when the app was backgrounded — battery drain. Wired `focusManager` to
  `AppState` (native only, dep-free) so intervals pause when the app isn't active.
  [query-client.ts](src/lib/query-client.ts).

## Verified in code (no change needed)
- **Favorites heart inside a Card row**: nested `Pressable` — RN grants the responder to
  the innermost pressable, so tapping the heart does NOT also trigger row navigation.
- **Optimistic UI**: exercise favorite + chat send both snapshot → patch → rollback on
  error → invalidate on settle. Offline send keeps its optimistic bubble (a failed
  refetch retains cached data; it reconciles when the outbox drains).
- **Offline-first writes**: check-in / metric / workout / meal / water / chat all go
  through the SQLite outbox with a stable idempotency key; the server dedupes (verified
  at runtime for each module).
- **Tenant isolation**: every new model is in the single-source `tenant-models.ts`;
  wrong-gym tokens return zero rows (verified at runtime for nutrition/exercise/chat).
- **Keyboard**: phone/otp/conversation wrap `KeyboardAvoidingView`; `Screen` scroll uses
  `keyboardShouldPersistTaps="handled"`.
- **Safe area**: `Screen` uses `SafeAreaView`; scanner + FAB + tab bar use insets.

## NEEDS-DEVICE (manual pass on Android + iOS + a low-end device + tablet + web)
| Area | What to check |
|---|---|
| Chat conversation | bubble layout, auto-scroll on new message, keyboard push of the composer, send latency, long messages wrap |
| Polling/real-time | new trainer message appears within the poll window; backgrounding stops polls (battery) |
| Exercise library | muscle-chip horizontal scroll, debounced search feel, heart toggle responsiveness, detail media placeholder |
| Nutrition | calorie ring + macro bars render, water quick-add feel, log bottom sheet + keyboard, food search results tap |
| Charts/scanner | weight/bar charts, QR scanner framing on notched devices |
| Dark mode | contrast of bubbles, chips, badges, placeholders across all new screens |
| Tablet/large | layouts don't stretch awkwardly; cards cap width |
| Low-end | scroll/animation FPS, memory while polling chat |

## Known deferred (not defects)
- Real-time WebSocket chat (polling today), push notifications, voice/image in chat —
  all need infra/deps (Phases 2–3).
- Exercise media (`media_url` null — no fabricated videos).
- No automated test runner in the app (recommend Jest + RNTL on pure logic).
