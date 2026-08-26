import { TextDecoder, TextEncoder } from 'util';

/**
 * jsdom does not provide TextEncoder/TextDecoder, but Node does. Required by
 * dependencies pulled in under the jsdom environment (see package.json
 * jest.testEnvironment). Must run before any module that touches them.
 */
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

import { cleanup } from '@testing-library/react-native';

/**
 * SafeAreaProvider withholds its children until native layout metrics arrive,
 * which never happens under jsdom — so an unmocked provider renders as an
 * empty <RNCSafeAreaProvider /> and every child query fails. The library ships
 * a mock with static insets for exactly this.
 */
jest.mock('react-native-safe-area-context', () =>
  // `.default` matters: the bundled mock exports everything under a default
  // export, so without it SafeAreaProvider resolves to undefined and React
  // fails with the famously unhelpful "Element type is invalid".
  require('react-native-safe-area-context/jest/mock').default,
);

/**
 * RNTL v14's automatic cleanup is NOT registered under the jest-expo preset.
 * Without this, every render stays mounted and later queries match elements
 * from earlier tests — which fails in confusing, order-dependent ways.
 *
 * member-app rediscovered this per-file (see member-app/src/ui/__tests__/ui.test.tsx).
 * Registering it globally here means staff-app test files never carry the
 * boilerplate, and nobody has to learn this the hard way twice.
 *
 * Note the other half of the same quirk: `render()` must be AWAITED before
 * `screen` queries resolve. That one has to live in each test.
 */
afterEach(cleanup);

/**
 * Reanimated is mocked rather than executed. RNR's `progress` imports it
 * directly, and expo-router pulls it via react-native-drawer-layout; its real
 * implementation needs either native modules or a DOM, and jest-expo runs the
 * native platform in a `node` environment with neither.
 *
 * The mock only loads cleanly because jest.resolver.js strips `.native`
 * resolution for the animation stack — without that, the mock itself throws.
 *
 * Animation behaviour is therefore NOT covered by tests; it is on-device QA.
 */
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  const React = require('react');
  // The shipped mock omits some layout-animation exports that RNR's accordion
  // imports (LayoutAnimationConfig is a COMPONENT — undefined there means
  // "Element type is invalid" at render). Passthroughs keep the tree mountable;
  // the animations themselves are not under test.
  const passthrough = ({ children }: { children?: unknown }) => children ?? null;
  const descriptor = { duration: () => descriptor, reduceMotion: () => descriptor };
  return {
    ...mock,
    LayoutAnimationConfig: mock.LayoutAnimationConfig ?? passthrough,
    FadeOutUp: mock.FadeOutUp ?? descriptor,
    LinearTransition: mock.LinearTransition ?? descriptor,
    ReduceMotion: mock.ReduceMotion ?? { System: 'system', Never: 'never', Always: 'always' },
  };
});

/**
 * jsdom has no matchMedia. Reanimated's web build (which jest.resolver.js
 * selects) queries it for prefers-reduced-motion at import time.
 * Reports "no preference" — the right default for component tests.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/**
 * Mock react-native-gesture-handler wholesale.
 *
 * On import it queues a microtask calling worklets' `getUIRuntimeHolder`, which
 * throws on the web build that jest.resolver.js selects. That fires from a
 * deferred callback, so neither the library's jestSetup nor setupFiles ordering
 * prevents it, and a path-scoped mock misses its internal relative import.
 *
 * Gestures are therefore inert in tests — swipe rows and sheets render but do
 * not respond. That is deliberate: gesture behaviour is verified on device via
 * `npm run verify:ui`, which is the only place it is meaningful anyway.
 */
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const passthrough = ({ children }: { children?: unknown }) => children ?? null;
  const chain: Record<string, unknown> = {};
  const builder = new Proxy(chain, { get: () => () => builder });
  return {
    GestureHandlerRootView: View,
    GestureDetector: passthrough,
    Gesture: new Proxy({}, { get: () => () => builder }),
    Directions: {},
    State: {},
    gestureHandlerRootHOC: (c: unknown) => c,
  };
});

/**
 * Mock @gorhom/bottom-sheet.
 *
 * It reads reanimated shared values directly (useAnimatedDetents), which the
 * reanimated mock does not implement — "layoutState.get is not a function".
 *
 * The mock renders sheet CONTENT inline so assertions about what a sheet
 * contains still work; only the sheet's presentation and gestures are absent,
 * and those are verified on device via `npm run verify:ui`.
 */
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  return {
    __esModule: true,
    default: Passthrough,
    BottomSheetBackdrop: () => null,
    BottomSheetScrollView: Passthrough,
    BottomSheetView: Passthrough,
  };
});

/**
 * expo-sqlite has no implementation under Jest (it is a native module), and the
 * offline cache reaches for it as soon as the provider tree mounts. An
 * in-memory double keeps `shell`/`gallery` mounting the REAL provider tree —
 * including OfflineCache — rather than having those tests quietly skip it.
 */
jest.mock('expo-sqlite', () => {
  const rows = new Map<string, { payload: string; updated_at: number }>();
  return {
    openDatabaseAsync: async () => ({
      execAsync: async () => undefined,
      getFirstAsync: async (_sql: string, params: unknown[] = []) =>
        rows.get(String(params[0])) ?? null,
      runAsync: async (sql: string, params: unknown[] = []) => {
        if (/^INSERT/i.test(sql)) {
          rows.set(String(params[0]), {
            payload: String(params[1]),
            updated_at: Number(params[2]),
          });
        } else if (/scope <> \?/.test(sql)) {
          for (const k of [...rows.keys()]) if (k !== String(params[0])) rows.delete(k);
        } else if (/^DELETE/i.test(sql)) {
          rows.delete(String(params[0]));
        }
        return { changes: 0, lastInsertRowId: 0 };
      },
    }),
  };
});
