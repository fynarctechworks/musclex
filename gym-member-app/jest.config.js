/**
 * Jest configuration — MuscleX member app.
 *
 * Added in Phase 0.1 of the rebuild (`docs/MOBILE_IMPLEMENTATION_PLAN.md`). Before
 * this, the app had ZERO automated tests and `tsc --noEmit` was the only gate.
 *
 * Testing pyramid we build against (plan §3.12):
 *   1. UNIT       — pure logic in `src/**\/model.ts` + `src/lib` + feature math.
 *                   No mocking, fastest, highest ROI. This is where most tests live.
 *   2. COMPONENT  — design-system primitives and every state variant
 *                   (loading / empty / error / offline) via @testing-library/react-native.
 *   3. INTEGRATION— feature query hooks against a mocked API client, asserting the
 *                   `{ data, meta }` envelope and the MemberErrorCode error paths.
 *
 * NOT covered here: camera, push delivery, HealthKit / Health Connect, the pedometer
 * and haptics. Those are native paths that only a device build can prove — they are
 * tracked in `docs/QA_CHECKLIST.md` and must be reported `unverified` until run.
 */
const expoPreset = require('jest-expo/jest-preset');

/**
 * Packages this app depends on that ship untranspiled ESM/TS and are NOT in
 * jest-expo's default allowlist. Kept as an EXTENSION of the preset's patterns
 * rather than a replacement — overriding `transformIgnorePatterns` wholesale
 * silently drops `expo-modules-core` and every suite dies on `import` syntax.
 */
const EXTRA_TRANSFORMED = [
  'nativewind',
  'react-native-css-interop',
  'iconsax-react-native',
  'react-native-svg',
  'react-native-worklets',
];

module.exports = {
  preset: 'jest-expo',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Co-located `__tests__` folders inside the feature that owns the code, so a
  // module stays self-contained (plan §1: feature-first structure).
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],

  transformIgnorePatterns: [
    // Take the preset's first pattern (the big allowlist) and widen it.
    expoPreset.transformIgnorePatterns[0].replace(
      '))',
      `|${EXTRA_TRANSFORMED.join('|')}))`,
    ),
    ...expoPreset.transformIgnorePatterns.slice(1),
  ],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/api/contract.ts', // generated from the OpenAPI spec — never hand-edited
    '!src/**/__tests__/**',
  ],

  // Deliberately NOT a global threshold yet: the app starts at ~0% and a failing
  // gate on day one just gets disabled. The plan's 80% target applies per-module as
  // each one is rebuilt; raise this once the core modules land.
  coverageReporters: ['text-summary', 'lcov'],

  clearMocks: true,
  restoreMocks: true,
};
