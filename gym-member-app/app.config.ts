import type { ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config (migrated from app.json at gate G3). Adds the native-build
 * config needed to read real wearable data via Apple HealthKit / Google Health
 * Connect — see docs/G3_CROSS_PLAN.md. Plugin props verified against the installed
 * library versions (@kingstinct/react-native-healthkit 9.0.11,
 * react-native-health-connect 3.5.3, expo-build-properties).
 *
 * Health permissions are derived strictly from the metrics the bridge actually
 * reads (src/features/health/provider.native.ts) — no aspirational scopes, no
 * write scopes (the app only reads from the OS health stores today).
 */
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
      // HealthKit usage string is injected by the kingstinct plugin (below) —
      // not duplicated here.
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
      // G3 — Health Connect READ scopes (only the metrics provider.native.ts reads)
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
    // G3 — native build properties. targetSdkVersion 35 (Play's required minimum
    // since Aug 2025; the brief's 34 would be rejected for production).
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 29,
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
      },
    ],
    // G3 — Apple HealthKit (read-only). `background: false` opts out of the
    // background-delivery entitlement (a Phase F / G1 concern; the plugin would
    // otherwise add it by default). No NSHealthUpdateUsageDescription — we never
    // write to HealthKit.
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'FitSync reads your steps, heart rate, sleep and workouts from Apple ' +
          'Health to show your activity rings and trends. Your data stays yours ' +
          'and is only used inside FitSync.',
        background: false,
      },
    ],
    // G3 — Google Health Connect. Injects the permissions-rationale activity; the
    // READ_* scopes above are surfaced through android.permissions.
    'react-native-health-connect',
  ],
  extra: {
    apiBaseUrl: 'http://localhost:4000/member/v1',
    supabaseUrl: '',
    supabaseAnonKey: '',
  },
};

export default config;
