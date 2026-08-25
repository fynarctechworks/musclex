# MuscleX Staff App

Native mobile app for gym staff — the same operations they run today in the
`frontend/` web admin app. Serves **all 10 staff roles**, not just owners.

Plan and phasing: [`docs/STAFF_APP_PLAN.md`](../docs/STAFF_APP_PLAN.md).

## Status: Phase 2 (design system) in progress

What exists: the Expo app, routing, providers, design tokens, 30 UI primitives,
and a static front-desk tab shell. **No feature screens.** Every tab renders a
`Placeholder` naming the phase that will build it — `grep -r Placeholder app/`
lists what's outstanding.

See `/gallery` (a dev route, not in the tab bar) for every primitive rendered
against the MuscleX tokens.

## Styling: uniwind + React Native Reusables

Components come from [React Native Reusables](https://github.com/founded-labs/react-native-reusables)
— shadcn/ui ported to React Native — pulled with the shadcn CLI:

```bash
npx shadcn@latest add @rnr/<component>
```

The registry is configured in `components.json` as
`https://reactnativereusables.com/r/uniwind/{name}.json`. **The `uniwind`
segment matters** — RNR namespaces by styling engine, and the nativewind
variant will not work here.

Styling is [uniwind](https://uniwind.dev) (Tailwind compiled for RN), **not**
NativeWind: NativeWind 4 targets older RN and NativeWind 5 is still preview,
while uniwind declares `react >=19` / `react-native >=0.81`, matching Expo 57 /
RN 0.86.

**`src/global.css` is the single source of truth for design tokens.**
`src/ui/tokens.ts` mirrors a few of them for React Native APIs that cannot take
a `className` (React Navigation's `tabBarStyle`, `contentStyle`).
`src/__tests__/tokens.test.ts` parses the CSS and fails if the two drift.

### Registry caveats (verified, not guesses)

- **RNR publishes no `registry.json` index**, so the shadcn MCP cannot
  *enumerate* the registry — only fetch named items. The component list lives in
  `@react-native-reusables/cli`.
- **The shadcn CLI auto-installs each component's declared dependencies.** Adding
  a component can therefore add packages without being asked — check
  `git diff package.json` after any `shadcn add`.
- **RNR's uniwind build has bugs we patched locally.** shadcn's model is that you
  own the code, so these are ours to keep: `input`/`textarea` shipped NativeWind's
  `placeholderClassName` (uniwind calls it `placeholderTextColorClassName`), and
  `context-menu`/`dropdown-menu` fail RN 0.86's stricter `Platform.select`
  typing. Search for `NOTE (MuscleX)` before re-pulling a component — a re-pull
  overwrites the patch.

## Running it

```bash
npm --prefix staff-app start        # dev server (needs an EAS dev build to open on device)
npm --prefix staff-app run web      # browser
npm --prefix staff-app test         # jest
npm --prefix staff-app run screenshot   # export web + render + screenshot
staff-app/node_modules/.bin/tsc --noEmit
```

`run screenshot` renders the exported web build in Chromium and writes PNGs to
`.screenshots/`, failing on any console error. It is the only check that
verifies the app actually *paints* — typecheck and jest both pass on a screen
that renders blank. It borrows `frontend/`'s Playwright rather than adding a
dependency here. It does **not** verify native behaviour; that stays on-device QA.

`npx tsc` from the monorepo root fails — call the local binary, as in `member-app`.

The backend must be running. `.env` points at `http://localhost:4002/api/v1`
(matching `frontend/.env.local`; note `frontend/.env.example` still says 4000).

**`run web` needs a CORS entry.** The backend's `CORS_ORIGINS` must include the
Expo web origin, or every call fails preflight — the same trap `member-app` hit
on :8082.

## Installing packages: use `npx expo install`, not `npm install`

`npm install` resolves to the newest version, which is not necessarily the one
the Expo SDK's native code compiles against. This is not a style preference —
it produced a hard native build failure:

> `ExpoWorkletsBridgeProvider.mm:236: no member named 'executeSync' in
> 'worklets::WorkletRuntime'`

`expo-modules-core@57` compiles against `react-native-worklets ^0.7–^0.10`;
`npm install` had pulled 0.12.1 (via react-native-reanimated, itself transitive
via expo-router). npm printed a peer-dependency warning that was easy to skim
past, and **nothing catches it until an actual native build** — typecheck, jest
and the web bundle all passed on the broken combination.

`npx expo install --check` only inspects DIRECT dependencies, so it reported
"up to date" while the transitive versions were wrong. The fix was to pin them
explicitly: `npx expo install react-native-reanimated react-native-worklets`.

For packages outside the SDK (uniwind, lucide, RNR's @rn-primitives) plain
`npm install` is fine — they have no native code tied to the SDK version.

## Native gotchas found on device (not caught by tests or the web build)

- **`<PortalHost />` is REQUIRED in `app/_layout.tsx`.** Seven registry components
  (dialog, alert-dialog, select, dropdown-menu, popover, context-menu, tooltip)
  render through a portal and mount **nothing** without it. The failure is
  silent — the trigger presses and no overlay appears.
- **uniwind's `className` only works on React Native CORE components.**
  `<SafeAreaView className="flex-1">` is silently dropped, the view collapses to
  zero height, and the screen renders blank. Use `style` on third-party
  components. RNR components work because they forward className to core
  components internally.
- **`(tabs)` screens run `headerShown: false` with no top safe-area padding**, so
  top-aligned content renders under the status bar and the status bar swallows
  taps there. Placeholder screens hide this because they centre their content.
  Any real Phase 5 screen needs `SafeAreaView edges={['top']}` or equivalent.
- **Use `npx expo install`, never `npm install`, for SDK-adjacent packages** — see
  the section above; this cost a full native build failure.

## Driving the Simulator

### On-device UI verification (idb)

```bash
npm --prefix staff-app run verify:ui
```

Drives the real app on a booted simulator and asserts on the **accessibility
tree** — currently: dialog and popover open through the portal, and the
accordion expands. Verified passing on iPhone Air / iOS 26.5.

One-time setup (not in `package.json`, because it installs outside npm):

```bash
brew tap facebook/fb
brew trust --formula facebook/fb/idb-companion   # Homebrew 6 requires this
brew install --yes idb-companion
python3 -m venv staff-app/.tools/idb-venv
staff-app/.tools/idb-venv/bin/pip install fb-idb
```

`.tools/` is gitignored, so each machine runs this once.

**Two rules the harness encodes, both learned the hard way:**

1. **Never use synthetic CGEvent/AppleScript clicks.** They activate native
   UIKit controls (the tab bar) but are never delivered to the React
   Native/Fabric hierarchy — a plain `<Button onPress>` silently never fires.
   This produced repeated false "the component is broken" conclusions. idb
   drives the accessibility layer and works.
2. **Assert on a string unique to the opened overlay.** Asserting on
   "Collect payment" gave a FALSE PASS: it is also a button label elsewhere on
   the gallery, so it matched while no dialog was open.

Also note `idb` uses DEVICE POINTS (420x912 here), while screenshots are pixels
(1260x2736) — divide by 3, or better, read frames from `idb ui describe-all`.
And tap targets must be scrolled on screen first: elements below the fold report
real frames but tapping them does nothing.

## Driving the Simulator (screenshots)

`scripts/sim-screenshot.sh <name>` captures the booted simulator.
`scripts/sim-tap.sh <deviceX> <deviceY>` taps it.

`sim-tap.sh` re-reads the Simulator window position on **every** call, and takes
the device pixel size from a live screenshot. This is not defensive padding: the
window can be moved at any moment, and stale coordinates click the desktop
instead — which is indistinguishable from "the app ignored the tap" and cost
several wrong diagnoses before it was caught.

**Known limitation — synthetic taps do not reach app content.** Scripted clicks
activate the tab bar but NOT the app's own views. Verified by elimination: a
plain `<Button onPress={...}>` outside any ScrollView, with correct coordinates
and a 120ms press-and-hold, does not fire. It is not dialogs, portals, `asChild`,
or ScrollView — all were tested and cleared.

The likely reason is that expo-router's tab bar is a native UIKit control (via
react-native-screens) and receives synthetic mouse events, while the React
Native/Fabric hierarchy does not.

**Verified despite this:** overlays DO render. A `<Dialog open>` (controlled,
forced open, no tap) renders its full-window scrim and content correctly on
device — so `PortalHost`, the portal path and `FullWindowOverlay` all work. Only
the trigger→open *interaction* is unproven, and that is a tap-delivery limitation, not a
rendering one.

**Consequence:** anything requiring a tap on app content — opening a dialog or
select, submitting a form, toggling a checkbox — needs a human tap or a real UI
test harness (XCUITest / idb). **Never read a non-response to a scripted tap as
a component bug**; three separate wrong diagnoses came from doing exactly that.

## Component usage rules (learned on device)

- **A bottom sheet must be a SIBLING of the scroll view, never a child.** Nested
  inside a ScrollView it positions itself within the scroll *content* and lands
  off-screen: it mounts, state flips, and nothing appears. See `src/ui/Gallery.tsx`.
- **`GestureHandlerRootView` must wrap the app at the root** (`src/providers.tsx`).
  Without it, sheets and swipe rows render but never respond — silent, exactly
  like the missing `PortalHost`.
- **FlashList v2 removed `estimatedItemSize`** — it auto-measures. Unlike v1
  there is no size hint to pass or keep in sync.
- **idb's accessibility tree does not expose bottom-sheet inner content.**
  Asserting on text inside a sheet FAILS on a sheet that is visibly open. Assert
  on `Bottom sheet handle` plus its y position instead — presence alone is not
  enough, because a closed sheet stays mounted just below the screen.

## Conventions

- **Mirror `frontend/src/features/*` directory-for-directory.** Parity drift is
  the top long-term risk of the native rewrite; isomorphic trees make "is this
  ported?" answerable by looking rather than remembering.
- **Same endpoint paths and query shapes as the web app**, so pagination,
  filtering and error semantics match instead of being re-derived.
- **Client-side RBAC is UX, not security.** Hiding a tab must never be the only
  thing preventing access — the backend guard is the real boundary.

## Testing gotchas (already paid for, don't rediscover)

- RNTL v14 under `jest-expo` doesn't auto-register cleanup, and `render()` must
  be **awaited** before `screen` queries resolve. Cleanup is handled globally in
  `jest.setup.ts`; the `await` has to live in each test.
- `SafeAreaProvider` withholds children without native layout metrics, so it is
  mocked in `jest.setup.ts` — via the bundled mock's `.default`, which is easy to
  miss and fails as "Element type is invalid".
- `testMatch` only picks up `**/__tests__/**`.
- Mounting a screen needs more than member-app's setup ever did: `babel.config.js`
  (jest-expo's transform needs it even though Metro infers it), `expo-router` and
  `standard-navigation` in `transformIgnorePatterns`, lucide mapped to its CJS
  build, `testEnvironment: jsdom`, and TextEncoder/matchMedia polyfills.
- `jest.resolver.js` strips `.native` resolution for reanimated/worklets, which
  otherwise reach for native modules under jsdom. Consequence: **animation
  behaviour is not covered by tests** — that stays on-device QA.
- Route files must stay thin. `<Stack.Screen>` throws without a navigator, so
  screen CONTENT lives in `src/` and is what tests mount — see `app/gallery.tsx`
  vs `src/ui/Gallery.tsx`.
