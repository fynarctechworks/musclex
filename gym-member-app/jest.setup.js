/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Jest global setup — runs before every test file.
 *
 * Scope rule: mock ONLY native modules that cannot execute under Node. Never mock
 * our own code here — a test that mocks the thing it is testing proves nothing.
 * Feature-specific fakes belong next to the test that needs them.
 */

// ── Native storage ────────────────────────────────────────────────────────────
// expo-secure-store is the keychain/keystore bridge; there is no Node equivalent,
// so back it with an in-memory map that behaves like the real async API.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
    isAvailableAsync: jest.fn(async () => true),
  };
});

// ── Device feedback ───────────────────────────────────────────────────────────
// Haptics fire on a real Taptic Engine only. Kept as jest.fn() (not no-ops) so a
// test can assert that, say, a successful check-in triggers success feedback.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// ── Offline outbox ────────────────────────────────────────────────────────────
// expo-sqlite needs a native DB handle. The app already ships a platform split
// (db.ts / db.web.ts); tests get a third, in-memory shape.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    runSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
  })),
}));

// ── Sensors / permissions ─────────────────────────────────────────────────────
jest.mock('expo-sensors', () => ({
  Pedometer: {
    isAvailableAsync: jest.fn(async () => false),
    requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
    getPermissionsAsync: jest.fn(async () => ({ granted: false })),
    watchStepCount: jest.fn(() => ({ remove: jest.fn() })),
    getStepCountAsync: jest.fn(async () => ({ steps: 0 })),
  },
}));

// NOTE: no NativeAnimatedHelper mock here. That path was removed in RN 0.85 and
// @react-native/jest-preset already stubs the animation bridge.

// Fail a test that logs an unexpected React error (bad props, missing keys, act()
// warnings) rather than letting it pass with noise in the output.
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('not wrapped in act(')) return; // RNTL handles this itself
    originalError(...args);
    throw new Error(`console.error during test: ${msg}`);
  };
});
afterAll(() => {
  console.error = originalError;
});
