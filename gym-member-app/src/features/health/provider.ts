import type { HealthSampleInput, WearableProvider } from '../../api/types';

/**
 * ────────────────────────────────────────────────────────────────
 * HEALTH BRIDGE — platform abstraction over the OS health stores
 * ────────────────────────────────────────────────────────────────
 *
 * The rest of the app talks ONLY to this interface. The concrete native
 * implementation (Apple HealthKit on iOS / Google Health Connect on Android)
 * lives in `provider.native.ts` and is selected by Metro's platform resolution;
 * this file is the fallback used on web / Expo Go / unsupported platforms, where
 * it reports `available = false` so the UI degrades to manual entry only.
 *
 * Native code is isolated here so it can be device-QA'd independently without
 * touching the data/sync/UI layers, all of which are platform-agnostic.
 */
export interface HealthBridge {
  /** The OS health store backing this platform, or null if none. */
  readonly provider: WearableProvider | null;
  /** Whether the native health store is usable on this device/build. */
  isAvailable(): Promise<boolean>;
  /**
   * Prompt the OS permission sheet for the requested metric scopes.
   * Resolves true once the user has granted (or already granted) access.
   */
  requestPermissions(): Promise<boolean>;
  /**
   * Read all samples recorded since `since` (exclusive), mapped to the BFF
   * ingest shape. `sourceUuid` MUST be the provider's stable per-sample id so
   * re-syncs dedupe server-side.
   */
  readSamples(since: Date): Promise<HealthSampleInput[]>;
}

/** Fallback bridge for platforms with no OS health store. */
class UnsupportedHealthBridge implements HealthBridge {
  readonly provider = null;
  async isAvailable() {
    return false;
  }
  async requestPermissions() {
    return false;
  }
  async readSamples() {
    return [];
  }
}

export const healthBridge: HealthBridge = new UnsupportedHealthBridge();
