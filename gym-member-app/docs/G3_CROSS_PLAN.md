# G3 Cross Plan — Native build / leave Expo Go

> Status: **APPLIED 2026-06-03** (user approved "yes cross G3"). The config diffs
> below are live: `app.config.ts` added, `app.json` removed, `expo-build-properties`
> installed, all three native plugins resolving (`expo config` exits 0, `tsc`
> clean). Two decisions taken on apply: **`targetSdkVersion: 35`** (not the brief's
> 34 — Play rejects 34) and **`NSHealthUpdateUsageDescription` omitted** (the app
> only reads). The remaining steps (§6 EAS build commands) are the **user's to
> run** on a real device — the agent did not run them.
> Authored: 2026-06-03 · Scope: `gym-member-app` only.

Crossing G3 leaves Expo Go permanently (one-way to a dev client / EAS build). The
member app already can't run in Expo Go (native modules), so this is the build
that makes wearable reads actually testable.

---

## 0. Corrections to the master brief (verified against the repo)

| Brief said | Reality in repo | What I'll do |
|---|---|---|
| Add a **`react-native-health`** plugin block | Repo uses **`@kingstinct/react-native-healthkit` ^9.0.0** (see `provider.native.ts:54`). `react-native-health` is **not** installed. | Use the kingstinct plugin instead. |
| Create `eas.json` `development` profile | **Already exists** (`eas.json` → `build.development`, `developmentClient: true`, device-only). | No eas.json change needed. |
| `expo-build-properties` plugin | **Not installed.** | Must `npx expo install expo-build-properties` (config-only dep). |
| iOS `NSHealthUpdateUsageDescription` | We only **read** (HealthKit `requestAuthorization([], reads)` — empty share set; Health Connect all `accessType: 'read'`). | Include the string per brief, but **flagged OPTIONAL** — not required until a write path exists. |

**Expo SDK is 56** (`expo ^56.0.8`). ⚠️ See §8 — the brief's `targetSdkVersion: 34`
is **below** the SDK 56 default and below Google Play's current minimum (35 since
Aug 2025). Recommendation noted there.

---

## 1. Permissions are derived from real reads only

Source of truth — the only metrics the bridge reads today (`provider.native.ts`):

| `HealthMetricType` | iOS (`IOS_QUANTITY`) HK id | Android (`ANDROID_RECORDS`) HC record | HC permission |
|---|---|---|---|
| `steps` | `stepCount` | `Steps` | `READ_STEPS` |
| `calories_active` | `activeEnergyBurned` | `ActiveCaloriesBurned` | `READ_ACTIVE_CALORIES_BURNED` |
| `distance_m` | `distanceWalkingRunning` | `Distance` | `READ_DISTANCE` |
| `heart_rate` | `heartRate` | `HeartRate` | `READ_HEART_RATE` |
| `hr_resting` | `restingHeartRate` | `RestingHeartRate` | `READ_RESTING_HEART_RATE` |
| `spo2` | `oxygenSaturation` | `OxygenSaturation` | `READ_OXYGEN_SATURATION` |
| `vo2max` | `vo2Max` | _(not read on Android)_ | — |
| `sleep_duration` | _(not read on iOS)_ | `SleepSession` | `READ_SLEEP` |

No write/update scopes are requested anywhere. **No aspirational perms** (no BP,
glucose, body-temp, ECG, hydration, etc.) — those are gated separately (G2/G5).

---

## 2. `app.json` → `app.config.ts` (full migration diff)

**Action:** delete `app.json`, add `app.config.ts` below. It is the current
`app.json` reproduced verbatim as a typed `ExpoConfig`, **plus** the three new
plugin entries and the seven Android health permissions (marked `// +G3`).

```ts
// app.config.ts  (NEW FILE — replaces app.json)
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'FitSync',
  slug: 'fitsync-member',
  scheme: 'fitsync',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0A0A0A',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'pro.fitsync.member',
    infoPlist: {
      NSCameraUsageDescription:
        'FitSync uses the camera to scan the gym QR code for instant check-in.',
      NSFaceIDUsageDescription: 'FitSync uses Face ID to unlock the app.',
      NSPhotoLibraryUsageDescription:
        'FitSync lets you attach transformation photos to your progress.',
      NSLocationWhenInUseUsageDescription:
        'FitSync uses your location to show the gym branch nearest to you.',
      // NOTE: HealthKit usage strings are injected by the kingstinct plugin
      // (§4) — do NOT also set them here or they double up.
    },
  },
  android: {
    package: 'pro.fitsync.member',
    permissions: [
      'CAMERA',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      // +G3 — Health Connect READ scopes (only metrics we read today, §1)
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
      'android.permission.health.READ_DISTANCE',
      'android.permission.health.READ_HEART_RATE',
      'android.permission.health.READ_RESTING_HEART_RATE',
      'android.permission.health.READ_OXYGEN_SATURATION',
      'android.permission.health.READ_SLEEP',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-local-authentication',
    [
      'expo-camera',
      {
        cameraPermission:
          'FitSync uses the camera to scan the gym QR code for instant check-in.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'FitSync uses your location to show the gym branch nearest to you.',
      },
    ],
    // +G3 — native build properties (§5)
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 29,
          compileSdkVersion: 35,
          targetSdkVersion: 34, // ⚠️ see §8 — likely must be 35 for Play
        },
      },
    ],
    // +G3 — Apple HealthKit (iOS). Plugin prop names are kingstinct v9;
    //        VERIFY against installed version before building (§8).
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'FitSync reads your steps, heart rate, sleep and workouts from Apple ' +
          'Health to show your activity rings and trends. Your data stays yours ' +
          'and is only used inside FitSync.',
        // OPTIONAL — we do not write to HealthKit today. Include only if/when a
        // write path lands; omitting it keeps the App Store review surface smaller.
        NSHealthUpdateUsageDescription:
          'FitSync would write workouts you log back to Apple Health so your ' +
          'records stay in sync.',
        background: false, // background delivery is a Phase F (G1) concern
      },
    ],
    // +G3 — Google Health Connect (Android). Injects the permissions-rationale
    //        activity + <queries> for the Health Connect package.
    'react-native-health-connect',
  ],
  extra: {
    apiBaseUrl: 'http://localhost:4000/member/v1',
    supabaseUrl: '',
    supabaseAnonKey: '',
  },
};

export default config;
```

**Net change vs `app.json`:** identical config + 7 Android health perms + 3 plugin
entries (`expo-build-properties`, kingstinct HealthKit, `react-native-health-connect`).
No existing values altered.

---

## 3. `eas.json` — development profile

**No change required.** The profile already exists and is correct for device QA
(HealthKit does not function on the iOS Simulator, so `ios.simulator: false` is
right):

```jsonc
// eas.json (current — unchanged)
"development": {
  "developmentClient": true,
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "ios": { "simulator": false }
}
```

---

## 4. iOS usage strings (app voice)

- **`NSHealthShareUsageDescription`** (required, we read):
  > FitSync reads your steps, heart rate, sleep and workouts from Apple Health to
  > show your activity rings and trends. Your data stays yours and is only used
  > inside FitSync.
- **`NSHealthUpdateUsageDescription`** (OPTIONAL — we don't write today):
  > FitSync would write workouts you log back to Apple Health so your records stay
  > in sync.

Set via the kingstinct plugin props (§2), not duplicated in `infoPlist`.

---

## 5. `expo-build-properties` block

```jsonc
["expo-build-properties", {
  "android": {
    "minSdkVersion": 29,      // Health Connect needs 26+; 29 per brief
    "compileSdkVersion": 35,
    "targetSdkVersion": 34    // ⚠️ see §8 — recommend 35
  }
}]
```
Requires installing the package first (§6).

---

## 6. Commands for the user to run locally (DO NOT let the agent run these)

```bash
# 0. from gym-member-app/
# install the config-only build-properties dep (health libs already present)
npx expo install expo-build-properties

# 1. (after the app.config.ts swap is applied) sanity-check config resolves
npx expo config --type public > /dev/null && echo "config OK"

# 2. one-time EAS wiring (creates/links the EAS project id)
eas build:configure

# 3. Android dev client (APK, internal) — Health Connect QA
eas build --profile development --platform android

# 4. iOS dev client (device, not simulator) — HealthKit QA
eas build --profile development --platform ios

# 5. install the dev client on a device, then:
npx expo start --dev-client
```
Notes:
- A physical **Android 14 device with Health Connect** (app installed + some data)
  and a physical **iPhone with Health data** are required — emulators/simulators
  won't surface real samples.
- `eas build:configure` will write an `eas.projectId` into the app config / a
  `projectId` under `extra.eas`. Expect that follow-up edit after step 2.

---

## 7. SHA-256 capture (for future Samsung Partner Program — G4)

Appended to `docs/RELEASE_CHECKLIST.md`. Summary: after the first EAS build,
capture the signing cert SHA-256 (Samsung Partner registration needs it):

```bash
# managed credentials (EAS-managed keystore):
eas credentials   # → Android → (profile) → view the SHA-256 fingerprint

# or from a downloaded keystore:
keytool -list -v -keystore <path-to>.jks -alias <alias> | grep "SHA256:"

# or from the built APK directly:
keytool -printcert -jarfile <build>.apk | grep "SHA256:"
```
Store the value in the release checklist (not in git secrets). It is **not**
needed for G3 itself — only for the later Samsung submission.

---

## 8. What could break (re-verify after the dev-client build)

**Build / config risks**
- ⚠️ **`targetSdkVersion: 34`** is below Expo SDK 56's default (35/36) and below
  **Google Play's required target API 35** (since Aug 2025). 34 is fine for
  internal dev/QA builds but **will be rejected for Play production**. Recommend
  `targetSdkVersion: 35` unless there's a specific reason; flagged for your call.
- ⚠️ **Plugin prop names** for `@kingstinct/react-native-healthkit` v9 are written
  from memory — **verify** against the installed version's plugin schema before
  building (`node_modules/@kingstinct/react-native-healthkit/app.plugin.js` /
  its README). If they differ, the usage strings won't inject and iOS auth will
  crash on first request.
- **Health Connect manifest**: `react-native-health-connect` must inject the
  permissions-rationale activity + `<queries>` for
  `com.google.android.apps.healthdata`. If a perm is missing from the manifest,
  `requestPermission` returns empty and reads silently yield `[]` (the bridge
  already swallows this → looks like "no data", not an error).

**Existing flows that assume the current (Expo-Go-ish) runtime — re-test on the dev client**
- **Push notifications** (`expo-notifications`, `features/notifications/`): a real
  dev client changes token issuance vs Expo Go. Needs EAS `projectId` + FCM creds
  to actually deliver (already a known Phase-3 gap) — re-verify register/token.
- **Deep links** (`scheme: 'fitsync'`, notification-tap → route in `_layout.tsx`):
  custom-scheme links resolve differently in a standalone client; re-test the
  notification deep-link and any `fitsync://` links.
- **Secure store** (`expo-secure-store`, auth token persistence): behaves
  differently off Expo Go; re-verify login persists across cold start on device.
- **Biometric unlock** (`expo-local-authentication`): exercise Face ID / fingerprint
  on a real device (unavailable/in-simulator-only before).
- **Camera QR check-in** (`expo-camera`): confirm the camera permission prompt +
  scan still work in the standalone build.
- **Web target** (`npm run web`): unaffected by native config, but the health
  bridge stays the unsupported fallback there (expected).
- **`react-native-reanimated` 4.x / new-arch**: a fresh native build may flip
  Fabric/new-architecture on; smoke-test the animated screens shipped in Track 1
  (breathing circle, collapsing headers, ring fills, intro pager).

**Data-correctness (the original `⚠️ UNVERIFIED` reason)**
- `provider.native.ts` metric units/record shapes were never device-validated.
  After the build, confirm: steps counts, `activeEnergyBurned` kcal, distance in
  metres, HR bpm, SpO₂ %, and `SleepSession` duration land in
  `member_health_daily` with sane values and **dedupe correctly** on re-sync
  (`sourceUuid` stability).

---

## Apply checklist (only after "yes cross G3")
1. `npx expo install expo-build-properties`
2. Add `app.config.ts` (§2); delete `app.json`.
3. (decision) set `targetSdkVersion` 34 → 35 per §8?
4. Verify kingstinct v9 plugin prop names (§8); adjust §2 if needed.
5. `eas build:configure`; commit the resulting `projectId`.
6. Hand the §6 build commands to the user; **stop** — wait for on-device results
   before Phase F.
