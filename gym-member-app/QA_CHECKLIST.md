# Member App — QA & Production-Stabilization Checklist

> Phase: **MVP Validation & Production Stabilization** (no new V2 modules).
> Scope: Home · Check-in · Workout · Classes · Membership · Progress (+ auth, community scaffold).
> Last updated: 2026-06-02.

## How this was validated

| Check | Tool | Result |
|---|---|---|
| Type safety | `npm run typecheck` (`tsc --noEmit`, strict) | ✅ clean |
| Web bundle builds | `npx expo export --platform web` | ✅ clean |
| Project/config health | `npx expo-doctor` | ✅ 21/21 |
| Unit/integration tests | — | ⚠️ **None exist** — no jest/vitest, no test files in the app |
| Visual/device QA (Android/iOS/web runtime) | manual on device | ⛔ **Not yet done** — requires a dev build / simulator a human drives; this doc is the script for it |

> Full issue log + per-category verification: see [TEST_REPORT.md](TEST_REPORT.md).
> All 7 issues found in the 2026-06-02 test pass are fixed.

**Honest limitation:** static checks (types + bundler) pass, but no automated tests
cover this app and no frame-rate / visual pass has been run on a real device. The
checklist below is the manual script to execute on web + an Android dev build + an
iOS simulator.

---

## Fixed this session

- **P0 — Web bundle was broken.** `expo-sqlite`'s web worker imports a `.wasm`
  module Metro can't bundle for the static web export; it was pulled in
  transitively from the check-in screen via the offline outbox, so `expo export`
  (and the documented `npm run web` preview path) failed. Refactored the offline
  layer into a platform-split repository: native keeps durable SQLite
  ([src/offline/db.ts](src/offline/db.ts)), web uses an in-memory variant Metro
  auto-selects ([src/offline/db.web.ts](src/offline/db.web.ts)); `outbox.ts` now
  talks to semantic functions instead of raw SQL. Web export now succeeds.
- **P1 — OTP screen keyboard overlap.** [otp.tsx](app/(auth)/otp.tsx) lacked the
  `KeyboardAvoidingView` that [phone.tsx](app/(auth)/phone.tsx) already uses, so
  the on-screen keyboard could cover the "Verify" button on shorter devices.
  Mirrored the phone-screen pattern.

---

## Prioritized findings

### Fixed in the P1 batch (this session)
- **Scanner hardcoded safe-area offsets** — [checkin.tsx](app/checkin.tsx) had the
  close/torch at `top: 56` and the manual button at `bottom: 48` as raw numbers; the
  scanner is a bare `View` (not `Screen`), so controls could sit under the status bar /
  home indicator on notched devices. Now driven by `useSafeAreaInsets()`.
- **Scroll-form keyboard tap-swallow** — [Screen.tsx](src/design-system/Screen.tsx)'s
  ScrollView had no `keyboardShouldPersistTaps`, so the first tap on a button under an
  open keyboard only dismissed the keyboard. Added `keyboardShouldPersistTaps="handled"`
  + `keyboardDismissMode="on-drag"` (helps the Progress log form and any future
  form-in-scroll).
- **Progress log silent failure** — [progress.tsx](app/(app)/progress.tsx) `onLog`
  returned silently on invalid input; now shows an inline validation/save error.

### Not a defect (verified)
- **Classes uses native `Alert`** — this is the **documented design-system convention**:
  `Dialog`'s own doc comment says *"For destructive OS-native confirms, prefer
  `Alert.alert`; use this when the body needs custom content."* Left as-is. Caveat:
  `Alert` multi-button callbacks are unreliable on react-native-web, so validate the
  cancel-confirmation path on a native build, not the web preview.
- **Session-expiry redirect** — verified wired: `auth-store.hydrate()` registers
  `sessionBridge.setOnExpired(() => signOut())`; a failed refresh in `client.ts` →
  `signOut()` → status `unauthenticated` → `AuthGate` redirects to `/welcome`.

### Also fixed (P2 cleanup)
- **`signOut` now clears the React Query cache** ([auth-store.ts](src/auth/auth-store.ts) →
  `queryClient.clear()`) so cached member data can't leak to the next account on a shared
  device (multi-tenant safety).
- **Back affordance unified.** The five hand-rolled `"←  Back"` Pressables (membership,
  locations, notifications, phone, otp) now use one [BackButton](src/navigation/BackButton.tsx)
  — identical visuals, one place to evolve into a real header. Kept routing-aware (in
  `navigation/`, not the design system).

### P2 — polish / lower-risk (still open)
- **`Screen` has no `KeyboardAvoidingView`.** Tap-handling is fixed, but bottom buttons
  still aren't pushed above the keyboard except where a screen adds its own
  `KeyboardAvoidingView` (phone, otp). Consider an opt-in `keyboard` prop on `Screen`.
- **`weekAhead()` recomputed every render** in [home.tsx](app/(app)/home.tsx) (cheap, but
  trivially `useMemo`-able); workout `onFinish` double-invalidates `todayWorkout`
  (already invalidated inside `useLogWorkout`).
- **Web entry bundle is ~2.9 MB** — fine for native, but a code-split/lazy pass would
  help the web preview's load time (plan Step 3 target: <500ms).
- **Camera permanent-denial path.** [checkin.tsx](app/checkin.tsx) re-calls
  `requestPermission()` which won't reprompt once permanently denied on iOS; offer an
  "Open Settings" deep link.

### Needs verification (not yet read — do not assume)
- **Session-expiry UX.** `client.ts` calls `sessionBridge.notifyExpired()` on a failed
  refresh; confirm `AuthGate` / `session-bridge` actually redirects to login and clears
  the query cache (not yet inspected).

---

## Manual QA script (run on web + Android dev build + iOS simulator)

### Navigation & shell
- [ ] 5 tabs (Home/Workout/Classes/Progress/Community) switch with no flicker
- [ ] QR FAB floats above the tab bar on every tab; never collides with center tab
- [ ] Modal check-in slides up; back/swipe-down dismisses
- [ ] Stack routes (membership/profile/locations/notifications) push & back cleanly
- [ ] Deep cold-start: splash holds until fonts + stores hydrate, then routes correctly

### Per-screen UI
- [ ] **Home** — streak ring, week-ahead bars, membership card, today's workout / empty, next class / browse, occupancy
- [ ] **Check-in** — permission gate → scan → success/queued/error; torch toggle; manual fallback
- [ ] **Workout** — set steppers, rest timer, progress ring, finish → PR dialog; empty/no-plan state
- [ ] **Classes** — book / waitlist / cancel; seat counts; busy state per card
- [ ] **Progress** — stats grid, range segmented control, weight chart, photo add/compare
- [ ] **Membership** — timeline bar, details, invoices, renew (Razorpay order stub)

### Responsiveness & safe area
- [ ] Small phone (≤375pt) — no clipped buttons, no overflow, bottom actions reachable
- [ ] Notched / edge-to-edge — status bar & home indicator never overlap controls (**watch the scanner**)
- [ ] Landscape (if allowed) or large tablet — layout doesn't break
- [ ] Long content scrolls clear of the FAB (each screen has the `h-2xl` spacer)

### Keyboard
- [ ] Phone, OTP, Progress-log — keyboard never covers the primary action button
- [ ] Return/submit keys advance/submit as expected; dismiss on scroll

### API / state
- [ ] Loading → skeletons on every data screen
- [ ] Error → `ErrorState` with working retry (kill network, then restore)
- [ ] Empty → designed empty states (new member: no workout, no classes, no invoices)
- [ ] No duplicate/redundant refetch storms when switching tabs
- [ ] 401 → silent refresh → retry; expired refresh → routed to login

### Offline (native)
- [ ] Airplane mode: check-in shows "Saved offline"; metric & workout log queue
- [ ] On reconnect/foreground the outbox drains; server dedupes (no double counts)
- [ ] No crash when offline writes pile up; failed rows cap at MAX_ATTEMPTS

### Animations & feel
- [ ] Scan line, progress rings, transitions stay smooth (target 60fps)
- [ ] Haptics fire: tab select, FAB press, check-in success/error
- [ ] No jank on first paint of charts (Bar/Line/Weight)

### Accessibility
- [ ] All icon-only buttons have `accessibilityLabel` (FAB, bell, avatar, torch, close, tabs ✅)
- [ ] Tab bar exposes `selected` state ✅; verify focus order & contrast in dark theme
- [ ] Text scales reasonably with OS font-size bump

### Edge cases
- [ ] Invalid phone / wrong OTP → inline error, recover
- [ ] Renew with no plan id → no-op (no crash)
- [ ] Booking a full class → waitlist path; cancel → promotion notice
- [ ] Progress with 0/1 photos (no compare) and with ≥2 (compare shows)
