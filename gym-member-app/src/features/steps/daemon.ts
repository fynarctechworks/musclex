import { useEffect } from 'react';
import { AppState } from 'react-native';
import { usePrefs } from '../../auth/prefs-store';
import { healthBridge } from '../health/provider';
import { useStepsStore } from './steps-store';
import {
  isPedometerAvailable,
  getPedometerPermission,
  ensurePedometerPermission,
  todayStepsFromOS,
  watchSteps,
} from './pedometer';
import { speedKmh, cadenceSpm } from './math';
import { syncSteps } from './sync';

const IDLE_MS = 2500;
const SYNC_MS = 120_000; // push step deltas to the server at most every 2 min

/**
 * Lets the Activity UI prompt for the motion permission and (re)start counting.
 * Wired by the daemon while it is mounted. Module-level so any screen can call
 * it without prop-drilling the daemon.
 */
let requestImpl: (() => Promise<boolean>) | null = null;
export async function requestStepPermission(): Promise<boolean> {
  return requestImpl ? requestImpl() : false;
}

/**
 * App-wide step daemon — mounted ONCE in the (app) layout so the phone pedometer
 * counts on every screen and across the whole foreground session (not only while
 * the Activity screen is open). It feeds the persistent steps store; the Activity
 * screen is a pure reader. On iOS it re-seeds today's total from CoreMotion on
 * each foreground (recovering steps taken while the app was backgrounded).
 */
export function useStepDaemon() {
  useEffect(() => {
    let cancelled = false;
    let sub: { remove(): void } | null = null;
    const last = { steps: 0, t: 0, has: false };
    const base = { v: 0 };
    let lastMoveT = 0;

    const store = () => useStepsStore.getState();

    const subscribe = () => {
      sub?.remove();
      last.has = false;
      sub = watchSteps((sinceStart) => {
        const s = store();
        s.rollIfNeeded();
        const total = base.v + sinceStart;
        const t = Date.now();
        if (last.has) {
          const dSteps = total - last.steps;
          const dMs = t - last.t;
          if (dSteps > 0) {
            const h = usePrefs.getState().body.heightCm;
            s.setLive(speedKmh(dSteps, dMs, h), cadenceSpm(dSteps, dMs));
            lastMoveT = t;
          }
        }
        last.steps = total;
        last.t = t;
        last.has = true;
        s.setToday(total);
      });
    };

    const seedAndSubscribe = async () => {
      // iOS: CoreMotion today total. Android: Health Connect today total (recovers
      // steps counted while the app was backgrounded/killed, if HC is granted).
      const os = await todayStepsFromOS();
      let hc: number | null = null;
      try {
        hc = await healthBridge.readTodayStepTotal();
      } catch {
        hc = null;
      }
      const stored = store().today();
      const seed = Math.max(stored, os ?? 0, hc ?? 0);
      if (seed > stored) store().setToday(seed);
      base.v = seed;
      if (!cancelled) subscribe();
    };

    const init = async () => {
      if (!store().hydrated) await store().hydrate();
      store().rollIfNeeded();
      const ok = await isPedometerAvailable();
      if (cancelled) return;
      store().setAvailable(ok);
      if (!ok) return;
      const perm = await getPedometerPermission();
      if (cancelled) return;
      store().setPermission(perm);
      if (perm === 'granted') await seedAndSubscribe();
    };

    requestImpl = async () => {
      const granted = await ensurePedometerPermission();
      store().setPermission(granted ? 'granted' : 'denied');
      if (granted) await seedAndSubscribe();
      return granted;
    };

    void init().then(() => void syncSteps());

    const decay = setInterval(() => {
      if (Date.now() - lastMoveT > IDLE_MS) store().setLive(0, 0);
    }, 1000);

    // Periodically flush step deltas to the server (no-op when nothing changed).
    const syncTimer = setInterval(() => void syncSteps(), SYNC_MS);

    const appSub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        store().rollIfNeeded();
        if (store().permission === 'granted') void seedAndSubscribe();
      } else {
        // Backgrounding/closing — capture the latest steps before a possible kill.
        void syncSteps();
      }
    });

    return () => {
      cancelled = true;
      sub?.remove();
      clearInterval(decay);
      clearInterval(syncTimer);
      appSub.remove();
      requestImpl = null;
    };
  }, []);
}
