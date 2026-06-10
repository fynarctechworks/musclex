/* eslint-disable @typescript-eslint/no-var-requires */
import { Platform } from 'react-native';
import type { HealthBridge } from './provider';
import type {
  HealthMetricType,
  HealthSampleInput,
  WearableProvider,
} from '../../api/types';

/**
 * ────────────────────────────────────────────────────────────────
 * NATIVE HEALTH BRIDGE  ⚠️ UNVERIFIED — REQUIRES ON-DEVICE QA
 * ────────────────────────────────────────────────────────────────
 *
 * Real Apple HealthKit (iOS) / Google Health Connect (Android) reads. The
 * native modules are loaded with a guarded require() so this file typechecks
 * and runs even before the libraries are installed / the dev client is rebuilt
 * — on a stock build `isAvailable()` simply returns false and the app falls
 * back to manual entry.
 *
 * To activate: `npm i @kingstinct/react-native-healthkit react-native-health-connect`,
 * add their Expo config plugins, then `expo prebuild && expo run:ios|android`.
 * The metric mappings below follow each library's documented API but have NOT
 * been validated on a physical device — verify units + record shapes there.
 */

const PROVIDER: WearableProvider =
  Platform.OS === 'ios' ? 'apple_health' : 'health_connect';

// Metrics we attempt to read, with their HealthKit/Health Connect identifiers.
const IOS_QUANTITY: Partial<Record<HealthMetricType, { id: string; unit: string }>> = {
  steps: { id: 'stepCount', unit: 'count' },
  calories_active: { id: 'activeEnergyBurned', unit: 'kcal' },
  calories_resting: { id: 'basalEnergyBurned', unit: 'kcal' },
  active_minutes: { id: 'appleExerciseTime', unit: 'min' },
  distance_m: { id: 'distanceWalkingRunning', unit: 'm' },
  heart_rate: { id: 'heartRate', unit: 'count/min' },
  hr_resting: { id: 'restingHeartRate', unit: 'count/min' },
  // Readiness/recovery inputs (HealthKit quantity types).
  hrv: { id: 'heartRateVariabilitySDNN', unit: 'ms' },
  respiratory_rate: { id: 'respiratoryRate', unit: 'count/min' },
  spo2: { id: 'oxygenSaturation', unit: '%' },
  vo2max: { id: 'vo2Max', unit: 'ml/(kg*min)' },
};

const ANDROID_RECORDS: Partial<Record<HealthMetricType, string>> = {
  steps: 'Steps',
  calories_active: 'ActiveCaloriesBurned',
  distance_m: 'Distance',
  heart_rate: 'HeartRate',
  hr_resting: 'RestingHeartRate',
  // Readiness/recovery inputs (Health Connect record types).
  hrv: 'HeartRateVariabilityRmssd',
  respiratory_rate: 'RespiratoryRate',
  spo2: 'OxygenSaturation',
  sleep_duration: 'SleepSession',
};

function loadNativeModule(): any | null {
  try {
    return Platform.OS === 'ios'
      ? require('@kingstinct/react-native-healthkit')
      : require('react-native-health-connect');
  } catch {
    return null; // library not installed / not linked in this build
  }
}

class NativeHealthBridge implements HealthBridge {
  readonly provider: WearableProvider | null = PROVIDER;
  private mod = loadNativeModule();

  async isAvailable(): Promise<boolean> {
    if (!this.mod) return false;
    try {
      if (Platform.OS === 'ios') {
        return await this.mod.isHealthDataAvailable();
      }
      const status = await this.mod.getSdkStatus?.();
      // SdkAvailabilityStatus.SDK_AVAILABLE === 3 in react-native-health-connect
      return status === 3 || status === undefined;
    } catch {
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (!this.mod) return false;
    try {
      if (Platform.OS === 'ios') {
        const reads = Object.values(IOS_QUANTITY).map((m) => m.id);
        await this.mod.requestAuthorization([], reads);
        return true;
      }
      await this.mod.initialize();
      const perms = Object.values(ANDROID_RECORDS).map((recordType) => ({
        accessType: 'read',
        recordType,
      }));
      const granted = await this.mod.requestPermission(perms);
      return Array.isArray(granted) ? granted.length > 0 : !!granted;
    } catch {
      return false;
    }
  }

  async readSamples(since: Date): Promise<HealthSampleInput[]> {
    if (!this.mod) return [];
    try {
      return Platform.OS === 'ios'
        ? await this.readIos(since)
        : await this.readAndroid(since);
    } catch {
      return [];
    }
  }

  private async readIos(since: Date): Promise<HealthSampleInput[]> {
    const out: HealthSampleInput[] = [];
    for (const [type, meta] of Object.entries(IOS_QUANTITY)) {
      const samples =
        (await this.mod.queryQuantitySamples?.(meta!.id, {
          from: since,
          to: new Date(),
        })) ?? [];
      for (const s of samples) {
        const id = s.uuid ?? `${meta!.id}-${s.startDate}`;
        out.push({
          type: type as HealthMetricType,
          value: Number(s.quantity ?? s.value ?? 0),
          unit: meta!.unit,
          startAt: new Date(s.startDate).toISOString(),
          endAt: new Date(s.endDate ?? s.startDate).toISOString(),
          source: PROVIDER,
          sourceUuid: String(id),
        });
      }
    }
    return out;
  }

  /**
   * Today's total steps from the OS health store. On Android this is the
   * background-inclusive Health Connect total (sum of today's Steps records),
   * which is how we recover steps taken while the app was killed. On iOS we
   * return null — the CoreMotion pedometer (expo-sensors) already supplies the
   * accurate today's total, so we don't double-query HealthKit here.
   */
  async readTodayStepTotal(): Promise<number | null> {
    if (!this.mod || Platform.OS !== 'android') return null;
    try {
      await this.mod.initialize();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const res = await this.mod.readRecords?.('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: new Date().toISOString(),
        },
      });
      const records = res?.records ?? res ?? [];
      if (!Array.isArray(records) || records.length === 0) return null;
      let total = 0;
      for (const r of records) total += Number(r.count ?? 0);
      return total;
    } catch {
      return null; // Health Connect not granted / unavailable
    }
  }

  private async readAndroid(since: Date): Promise<HealthSampleInput[]> {
    const out: HealthSampleInput[] = [];
    const timeRangeFilter = {
      operator: 'between',
      startTime: since.toISOString(),
      endTime: new Date().toISOString(),
    };
    for (const [type, recordType] of Object.entries(ANDROID_RECORDS)) {
      const res = await this.mod.readRecords?.(recordType, { timeRangeFilter });
      const records = res?.records ?? res ?? [];
      for (const r of records) {
        const mapped = mapAndroidRecord(type as HealthMetricType, r);
        if (mapped) out.push(mapped);
      }
    }
    return out;
  }
}

/** Health Connect records carry different value fields per record type. */
function mapAndroidRecord(
  type: HealthMetricType,
  r: any,
): HealthSampleInput | null {
  const id = r.metadata?.id ?? r.metadata?.clientRecordId;
  const start = r.startTime ?? r.time;
  const end = r.endTime ?? r.time ?? start;
  if (!id || !start) return null;

  let value: number | null = null;
  let unit = '';
  switch (type) {
    case 'steps':
      value = Number(r.count ?? 0);
      unit = 'count';
      break;
    case 'calories_active':
      value = Number(r.energy?.inKilocalories ?? 0);
      unit = 'kcal';
      break;
    case 'distance_m':
      value = Number(r.distance?.inMeters ?? 0);
      unit = 'm';
      break;
    case 'heart_rate':
      value = Number(r.samples?.[0]?.beatsPerMinute ?? r.beatsPerMinute ?? 0);
      unit = 'bpm';
      break;
    case 'hr_resting':
      value = Number(r.beatsPerMinute ?? 0);
      unit = 'bpm';
      break;
    case 'spo2':
      value = Number(r.percentage ?? 0);
      unit = '%';
      break;
    case 'hrv':
      value = Number(r.heartRateVariabilityMillis ?? 0);
      unit = 'ms';
      break;
    case 'respiratory_rate':
      value = Number(r.rate ?? 0);
      unit = 'count/min';
      break;
    case 'sleep_duration':
      value =
        (new Date(end).getTime() - new Date(start).getTime()) / 1000; // seconds
      unit = 's';
      break;
    default:
      return null;
  }
  if (value == null) return null;

  return {
    type,
    value,
    unit,
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
    source: PROVIDER,
    sourceUuid: String(id),
  };
}

export const healthBridge: HealthBridge = new NativeHealthBridge();
